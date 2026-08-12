import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentStatus } from '../payment/entities/enums/payment-status.enum';
import { ContactLog } from './entities/contact-log.entity';
import { MailService } from '../mail/mail.service';
import { SettingsService } from '../settings/settings.service';
import { ActivityActor, ActivityService } from '../activity/activity.service';
import {
  CollectionsRow,
  CreateContactLogDto,
  SendReminderResult,
  SendRemindersResult,
} from './dto/collections.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * A stopped player has left the academy and an on-hold player's membership
 * clock is paused by agreement, so neither owes money right now — chasing them
 * would be wrong. Suspended players stay on the list precisely because unpaid
 * fees are the usual reason for a suspension.
 */
const NOT_CHASEABLE = ['stopped', 'on_hold'];

/** Gmail and friends throttle bursts; a small gap keeps batches deliverable. */
const REMINDER_PAUSE_MS = 300;

interface LastPaymentRow {
  userId: number | string;
  lastPaymentAt: Date | string | null;
}

@Injectable()
export class CollectionsService {
  private readonly logger = new Logger(CollectionsService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(ContactLog)
    private readonly contactLogRepository: Repository<ContactLog>,
    private readonly mailService: MailService,
    private readonly settingsService: SettingsService,
    private readonly activityService: ActivityService,
  ) {}

  private toIso(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }

  private daysOverdue(user: User, now: Date): number {
    if (!user.currentSubscriptionEndDate) return 0;
    const end = new Date(user.currentSubscriptionEndDate);
    if (isNaN(end.getTime()) || end >= now) return 0;
    return Math.max(0, Math.ceil((now.getTime() - end.getTime()) / MS_PER_DAY));
  }

  /** First-timers also owe the one-time registration fee on top of the cycle. */
  private amountDue(
    user: User,
    membershipPrice: number,
    firstTimeFee: number,
  ): number {
    const total =
      (user.subscriptionCounter ?? 0) === 0
        ? membershipPrice + firstTimeFee
        : membershipPrice;
    return Math.round(total * 100) / 100;
  }

  private async getUserOrFail(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  /**
   * Newest contact log per player. The table may not exist yet (migration not
   * run), which must not take the whole collections dashboard down.
   */
  private async loadLatestContactLogs(
    userIds: number[],
  ): Promise<Map<number, ContactLog[]>> {
    const byUser = new Map<number, ContactLog[]>();
    if (userIds.length === 0) return byUser;

    try {
      const logs = await this.contactLogRepository.find({
        where: { userId: In(userIds) },
        order: { createdAt: 'DESC', id: 'DESC' },
      });
      for (const log of logs) {
        const existing = byUser.get(log.userId);
        if (existing) existing.push(log);
        else byUser.set(log.userId, [log]);
      }
    } catch (error) {
      this.logger.warn(
        `Contact log unavailable (falling back to empty history): ${error.message}`,
      );
    }

    return byUser;
  }

  private async loadLastPayments(
    userIds: number[],
  ): Promise<Map<number, string | null>> {
    const byUser = new Map<number, string | null>();
    if (userIds.length === 0) return byUser;

    const rows: LastPaymentRow[] = await this.paymentRepository
      .createQueryBuilder('p')
      .select('p.userId', 'userId')
      .addSelect('MAX(p.createdAt)', 'lastPaymentAt')
      .where('p.status = :status', { status: PaymentStatus.ACTIVE })
      .andWhere('p.userId IN (:...userIds)', { userIds })
      .groupBy('p.userId')
      .getRawMany();

    for (const row of rows) {
      byUser.set(Number(row.userId), this.toIso(row.lastPaymentAt));
    }
    return byUser;
  }

  async getCollections(): Promise<CollectionsRow[]> {
    const now = new Date();
    const settings = await this.settingsService.getAll();

    const users = await this.userRepository
      .createQueryBuilder('u')
      .where(
        '(u.membershipStatus IS NULL OR u.membershipStatus NOT IN (:...notChaseable))',
        { notChaseable: NOT_CHASEABLE },
      )
      // Collections is a money screen. A player is listed when their
      // membership has actually lapsed, or when they were suspended *for
      // non-payment* — a discipline or medical suspension is not a debt and
      // must not show up here as a family that owes $380.
      .andWhere(
        `(u.currentSubscriptionEndDate < :now
          OR (u.membershipStatus = :suspended AND u.suspensionReason = :latePayment))`,
        { now, suspended: 'suspended', latePayment: 'late_payment' },
      )
      .getMany();

    const userIds = users.map((u) => u.id);
    const [contactLogs, lastPayments] = await Promise.all([
      this.loadLatestContactLogs(userIds),
      this.loadLastPayments(userIds),
    ]);

    const rows: CollectionsRow[] = users.map((user) => {
      const logs = contactLogs.get(user.id) ?? [];
      const latest = logs[0] ?? null;
      // The promise an admin made most recently, even if a later note had none.
      const latestWithFollowUp = logs.find((log) => log.followUpAt) ?? null;

      return {
        userId: user.id,
        fullname: user.fullname,
        parent_name: user.parent_name,
        email: user.email,
        phone_number: user.phone_number,
        activePlan: user.activePlan ?? null,
        membershipStatus: user.membershipStatus || 'active',
        currentSubscriptionEndDate: this.toIso(user.currentSubscriptionEndDate),
        daysOverdue: this.daysOverdue(user, now),
        amountDue: this.amountDue(
          user,
          settings.membershipPrice,
          settings.firstTimeFee,
        ),
        remindersSent: user.remindersSent ?? 0,
        lastReminderAt: this.toIso(user.lastReminderAt),
        lastContactAt: latest ? this.toIso(latest.createdAt) : null,
        lastContactNote: latest?.note ?? null,
        lastContactMethod: latest?.method ?? null,
        followUpAt: latestWithFollowUp
          ? this.toIso(latestWithFollowUp.followUpAt)
          : null,
        lastPaymentAt: lastPayments.get(user.id) ?? null,
      };
    });

    rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
    return rows;
  }

  async sendReminder(
    userId: number,
    actor: ActivityActor | null,
  ): Promise<SendReminderResult> {
    const user = await this.getUserOrFail(userId);

    if (!user.email) {
      throw new BadRequestException(
        `${user.fullname} has no email address on file`,
      );
    }

    const settings = await this.settingsService.getAll();
    const amountDue = this.amountDue(
      user,
      settings.membershipPrice,
      settings.firstTimeFee,
    );
    const daysOverdue = this.daysOverdue(user, new Date());

    const sent = await this.mailService.sendCollectionsReminder(
      user.email,
      user.fullname,
      user.currentSubscriptionEndDate ?? null,
      amountDue,
      daysOverdue,
      settings.etransferEmail,
    );

    // Counters must only move when a message actually left the building,
    // otherwise the dashboard claims families were chased when they were not.
    if (!sent) {
      throw new BadRequestException(
        this.mailService.isEnabled
          ? `Reminder email to ${user.email} could not be delivered. Nothing was recorded — check the mail server logs and try again.`
          : 'Email is not configured on this server (SMTP_HOST/SMTP_USER/SMTP_PASS missing), so no reminder was sent.',
      );
    }

    const now = new Date();
    user.remindersSent = (user.remindersSent ?? 0) + 1;
    user.lastReminderAt = now;
    const saved = await this.userRepository.save(user);

    try {
      await this.contactLogRepository.save(
        this.contactLogRepository.create({
          userId: saved.id,
          method: 'reminder_email',
          note: `Payment reminder emailed to ${saved.email} ($${amountDue.toFixed(2)} CAD, ${daysOverdue} day(s) overdue)`,
          adminUsername: actor?.username || 'system',
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Could not write contact log for reminder to user ${saved.id}: ${error.message}`,
      );
    }

    await this.activityService.log(actor, {
      action: 'collections.reminder_sent',
      targetType: 'member',
      targetId: saved.id,
      targetName: saved.fullname,
      details: `Reminder emailed to ${saved.email} ($${amountDue.toFixed(2)} CAD, ${daysOverdue} day(s) overdue)`,
    });

    return {
      success: true,
      sentTo: saved.email,
      remindersSent: saved.remindersSent ?? 0,
    };
  }

  async sendReminders(
    userIds: number[],
    actor: ActivityActor | null,
  ): Promise<SendRemindersResult> {
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < userIds.length; i++) {
      const userId = userIds[i];
      try {
        await this.sendReminder(userId, actor);
        sent += 1;
      } catch (error) {
        failed += 1;
        errors.push(`User ${userId}: ${error?.message ?? 'unknown error'}`);
      }

      if (i < userIds.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, REMINDER_PAUSE_MS));
      }
    }

    await this.activityService.log(actor, {
      action: 'collections.reminders_sent',
      targetType: 'member',
      details: `Bulk reminders: ${sent} sent, ${failed} failed (${userIds.length} requested)`,
    });

    return { sent, failed, errors };
  }

  async getContactLog(userId: number): Promise<ContactLog[]> {
    try {
      return await this.contactLogRepository.find({
        where: { userId },
        order: { createdAt: 'DESC', id: 'DESC' },
      });
    } catch (error) {
      this.logger.warn(
        `Contact log unavailable for user ${userId}: ${error.message}`,
      );
      return [];
    }
  }

  async addContactLog(
    userId: number,
    dto: CreateContactLogDto,
    actor: ActivityActor | null,
  ): Promise<ContactLog> {
    const user = await this.getUserOrFail(userId);

    let followUpAt: Date | null = null;
    if (dto.followUpAt) {
      const parsed = new Date(dto.followUpAt);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid followUpAt date');
      }
      followUpAt = parsed;
    }

    const saved = await this.contactLogRepository.save(
      this.contactLogRepository.create({
        userId: user.id,
        method: dto.method,
        note: dto.note,
        followUpAt,
        adminUsername: actor?.username || 'system',
      }),
    );

    await this.activityService.log(actor, {
      action: 'collections.contact_logged',
      targetType: 'member',
      targetId: user.id,
      targetName: user.fullname,
      details: `Contact via ${dto.method}: ${dto.note}`,
    });

    return saved;
  }

  async deleteContactLog(
    id: number,
    actor: ActivityActor | null,
  ): Promise<{ success: boolean; id: number }> {
    const log = await this.contactLogRepository.findOne({ where: { id } });
    if (!log) {
      throw new NotFoundException(`Contact log entry ${id} not found`);
    }

    // Snapshot before remove(): TypeORM strips the primary key off the entity.
    const { userId, method, createdAt } = log;
    await this.contactLogRepository.remove(log);

    await this.activityService.log(actor, {
      action: 'collections.contact_deleted',
      targetType: 'member',
      targetId: userId,
      details: `Deleted ${method} contact log from ${this.toIso(createdAt) ?? 'unknown date'}`,
    });

    return { success: true, id };
  }
}
