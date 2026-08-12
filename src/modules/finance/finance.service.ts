import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentStatus } from '../payment/entities/enums/payment-status.enum';
import { SettingsService } from '../settings/settings.service';

export interface FinanceMonthRow {
  month: string;
  label: string;
  total: number;
  count: number;
}

export interface FinanceRecentPayment {
  id: number;
  playerName: string;
  amount: number;
  method: string;
  type: string;
  periodLabel: string | null;
  createdAt: string;
}

export interface FinanceSummary {
  collectedThisMonth: number;
  collectedThisYear: number;
  collectedAllTime: number;
  outstandingAmount: number;
  outstandingCount: number;
  expectedNext30Days: number;
  expectedNext30Count: number;
  activeMembers: number;
  byMonth: FinanceMonthRow[];
  byType: { membership: number; league: number };
  byMethod: { etransfer: number; cash: number; other: number };
  recentPayments: FinanceRecentPayment[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Statuses that are never chased for money: a stopped player has left the
 * academy, and an on-hold player's clock is paused by agreement — neither
 * owes anything today, so they stay out of the outstanding/expected figures.
 */
const NOT_CHASEABLE = ['stopped', 'on_hold'];

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly settingsService: SettingsService,
  ) {}

  /** Decimal columns come back from pg as strings; money must leave as numbers. */
  private money(value: unknown): number {
    const num = Number(value);
    return isNaN(num) ? 0 : Math.round(num * 100) / 100;
  }

  private monthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  async getSummary(year?: number): Promise<FinanceSummary> {
    const now = new Date();
    const targetYear =
      year !== undefined && !isNaN(year) ? year : now.getFullYear();

    const settings = await this.settingsService.getAll();

    // A single scan of collected payments feeds every total below. The academy
    // has a few thousand rows at most, so one query beats eight aggregates.
    const collected = await this.paymentRepository.find({
      where: { status: PaymentStatus.ACTIVE },
      select: ['id', 'amount', 'type', 'method', 'createdAt'],
    });

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(targetYear, 0, 1);
    const yearEnd = new Date(targetYear + 1, 0, 1);

    // 12 rolling months ending this month, zero-filled so the chart never gaps.
    const buckets = new Map<string, FinanceMonthRow>();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.set(this.monthKey(d), {
        month: this.monthKey(d),
        label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
        total: 0,
        count: 0,
      });
    }

    let collectedThisMonth = 0;
    let collectedThisYear = 0;
    let collectedAllTime = 0;
    const byType = { membership: 0, league: 0 };
    const byMethod = { etransfer: 0, cash: 0, other: 0 };

    for (const payment of collected) {
      const amount = this.money(payment.amount);
      const createdAt = new Date(payment.createdAt);
      if (isNaN(createdAt.getTime())) continue;

      collectedAllTime += amount;

      if (createdAt >= monthStart) {
        collectedThisMonth += amount;
      }

      // The breakdowns follow the requested year so an admin can review a past
      // season; the rolling 12-month chart deliberately stays anchored to today.
      if (createdAt >= yearStart && createdAt < yearEnd) {
        collectedThisYear += amount;
        if (payment.type === 'league') byType.league += amount;
        else byType.membership += amount;

        if (payment.method === 'etransfer') byMethod.etransfer += amount;
        else if (payment.method === 'cash') byMethod.cash += amount;
        // Stripe and anything else roll into "other" — the dashboard only
        // separates the two channels the academy actually reconciles by hand.
        else byMethod.other += amount;
      }

      const bucket = buckets.get(this.monthKey(createdAt));
      if (bucket) {
        bucket.total += amount;
        bucket.count += 1;
      }
    }

    const users = await this.userRepository.find({
      select: [
        'id',
        'membershipStatus',
        'currentSubscriptionEndDate',
        'subscriptionCounter',
      ],
    });

    const next30 = new Date(now.getTime() + 30 * MS_PER_DAY);
    let outstandingCount = 0;
    let expectedNext30Count = 0;
    let activeMembers = 0;

    for (const user of users) {
      const status = user.membershipStatus || 'active';
      const end = user.currentSubscriptionEndDate
        ? new Date(user.currentSubscriptionEndDate)
        : null;
      const overdue = end !== null && end < now;

      if (status === 'active' && !overdue) {
        activeMembers += 1;
      }

      if (NOT_CHASEABLE.includes(status)) continue;

      if (overdue) {
        outstandingCount += 1;
      } else if (end !== null && end <= next30) {
        expectedNext30Count += 1;
      }
    }

    const recent = await this.paymentRepository.find({
      where: { status: PaymentStatus.ACTIVE },
      relations: ['user'],
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 10,
    });

    return {
      collectedThisMonth: this.money(collectedThisMonth),
      collectedThisYear: this.money(collectedThisYear),
      collectedAllTime: this.money(collectedAllTime),
      outstandingAmount: this.money(
        outstandingCount * settings.membershipPrice,
      ),
      outstandingCount,
      expectedNext30Days: this.money(
        expectedNext30Count * settings.membershipPrice,
      ),
      expectedNext30Count,
      activeMembers,
      byMonth: Array.from(buckets.values()).map((row) => ({
        ...row,
        total: this.money(row.total),
      })),
      byType: {
        membership: this.money(byType.membership),
        league: this.money(byType.league),
      },
      byMethod: {
        etransfer: this.money(byMethod.etransfer),
        cash: this.money(byMethod.cash),
        other: this.money(byMethod.other),
      },
      recentPayments: recent.map((payment) => ({
        id: payment.id,
        playerName: payment.user?.fullname ?? 'Unknown player',
        amount: this.money(payment.amount),
        method: payment.method,
        type: payment.type,
        periodLabel: payment.periodLabel ?? null,
        createdAt: new Date(payment.createdAt).toISOString(),
      })),
    };
  }

  private escapeCsv(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = value instanceof Date ? value.toISOString() : String(value);
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Every payment recorded in `year` (all statuses — the Status column lets the
   * bookkeeper see pending/canceled rows too), oldest first.
   */
  async exportPaymentsCsv(year: number): Promise<string> {
    const payments = await this.paymentRepository.find({
      where: {
        // Between is inclusive on both ends, so stop 1ms short of next Jan 1
        // to keep a New Year's midnight payment out of two exports.
        createdAt: Between(
          new Date(year, 0, 1),
          new Date(new Date(year + 1, 0, 1).getTime() - 1),
        ),
      },
      relations: ['user'],
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    const header = [
      'Date',
      'Player',
      'Parent',
      'Email',
      'Phone',
      'Amount',
      'Currency',
      'Method',
      'Type',
      'Period',
      'Status',
    ].join(',');

    const lines = payments.map((payment) =>
      [
        this.escapeCsv(new Date(payment.createdAt).toISOString().slice(0, 10)),
        this.escapeCsv(payment.user?.fullname),
        this.escapeCsv(payment.user?.parent_name),
        this.escapeCsv(payment.user?.email),
        this.escapeCsv(payment.user?.phone_number),
        this.escapeCsv(this.money(payment.amount).toFixed(2)),
        this.escapeCsv((payment.currency || '').toUpperCase()),
        this.escapeCsv(payment.method),
        this.escapeCsv(payment.type),
        this.escapeCsv(payment.periodLabel),
        this.escapeCsv(payment.status),
      ].join(','),
    );

    return [header, ...lines].join('\r\n');
  }
}
