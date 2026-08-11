import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentStatus } from '../payment/entities/enums/payment-status.enum';
import {
  ExperienceLevel,
  Gender,
  SubscriptionPlan,
  TShirtSize,
} from '../users/entities/enums/enums';
import { MailService } from '../mail/mail.service';
import {
  ExtendMembershipDto,
  HoldMembershipDto,
  ImportPlayerRow,
  ImportPlayersDto,
  ImportPlayersResult,
  ImportSkippedRow,
  RecordPaymentDto,
} from './dto/membership.dto';

export interface MembershipOverviewRow {
  id: number;
  fullname: string;
  parent_name: string;
  email: string;
  phone_number: string;
  activePlan: string | null;
  membershipStatus: string;
  currentSubscriptionEndDate: Date | null;
  daysRemaining: number | null;
  overdue: boolean;
  holdResumeAt: Date | null;
  subscriptionCounter: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class MembershipService {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly mailService: MailService,
  ) {}

  private toOverviewRow(user: User, now = new Date()): MembershipOverviewRow {
    let daysRemaining: number | null = null;
    let overdue = false;

    if (user.currentSubscriptionEndDate) {
      const end = new Date(user.currentSubscriptionEndDate);
      daysRemaining = Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY);
      overdue = daysRemaining < 0;
    }

    return {
      id: user.id,
      fullname: user.fullname,
      parent_name: user.parent_name,
      email: user.email,
      phone_number: user.phone_number,
      activePlan: user.activePlan ?? null,
      membershipStatus: user.membershipStatus || 'active',
      currentSubscriptionEndDate: user.currentSubscriptionEndDate ?? null,
      daysRemaining,
      overdue,
      holdResumeAt: user.holdResumeAt ?? null,
      subscriptionCounter: user.subscriptionCounter ?? 0,
    };
  }

  private async getUserOrFail(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
  }

  async getOverview(): Promise<MembershipOverviewRow[]> {
    const users = await this.userRepository.find();
    const now = new Date();
    const rows = users.map((u) => this.toOverviewRow(u, now));

    // Overdue first, then by end date ascending; users without an end date last
    rows.sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const aTime = a.currentSubscriptionEndDate
        ? new Date(a.currentSubscriptionEndDate).getTime()
        : Number.POSITIVE_INFINITY;
      const bTime = b.currentSubscriptionEndDate
        ? new Date(b.currentSubscriptionEndDate).getTime()
        : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });

    return rows;
  }

  async hold(
    userId: number,
    dto: HoldMembershipDto,
  ): Promise<MembershipOverviewRow> {
    const user = await this.getUserOrFail(userId);

    const resumeAt = dto.resumeAt ? new Date(dto.resumeAt) : null;
    if (resumeAt && isNaN(resumeAt.getTime())) {
      throw new BadRequestException('Invalid resumeAt date');
    }

    user.membershipStatus = 'on_hold';
    user.holdStartedAt = new Date();
    user.holdResumeAt = resumeAt;
    user.holdNote = dto.note ?? null;

    const saved = await this.userRepository.save(user);

    // Best-effort email; never let it break the request
    try {
      if (saved.email) {
        await this.mailService.sendHoldConfirmation(
          saved.email,
          saved.fullname,
          resumeAt,
        );
      }
    } catch (error) {
      this.logger.error(`Hold confirmation email failed: ${error.message}`);
    }

    return this.toOverviewRow(saved);
  }

  /**
   * Core resume logic, shared between the endpoint and the cron auto-resume.
   * Credits the time spent on hold back onto the subscription end date.
   */
  applyResume(user: User, now = new Date()): User {
    if (user.membershipStatus !== 'on_hold') {
      return user;
    }

    if (user.holdStartedAt && user.currentSubscriptionEndDate) {
      const heldMs = Math.max(
        0,
        now.getTime() - new Date(user.holdStartedAt).getTime(),
      );
      user.currentSubscriptionEndDate = new Date(
        new Date(user.currentSubscriptionEndDate).getTime() + heldMs,
      );
    }

    user.membershipStatus = 'active';
    user.holdStartedAt = null;
    user.holdResumeAt = null;
    user.holdNote = null;
    return user;
  }

  async resume(userId: number): Promise<MembershipOverviewRow> {
    const user = await this.getUserOrFail(userId);

    if (user.membershipStatus !== 'on_hold') {
      throw new BadRequestException(
        `Membership is not on hold (current status: ${user.membershipStatus || 'active'})`,
      );
    }

    this.applyResume(user);
    const saved = await this.userRepository.save(user);
    return this.toOverviewRow(saved);
  }

  async extend(
    userId: number,
    dto: ExtendMembershipDto,
  ): Promise<MembershipOverviewRow> {
    const user = await this.getUserOrFail(userId);

    const base = user.currentSubscriptionEndDate
      ? new Date(user.currentSubscriptionEndDate)
      : new Date();
    user.currentSubscriptionEndDate = new Date(
      base.getTime() + dto.days * MS_PER_DAY,
    );

    const saved = await this.userRepository.save(user);
    return this.toOverviewRow(saved);
  }

  async stop(userId: number): Promise<MembershipOverviewRow> {
    const user = await this.getUserOrFail(userId);
    user.membershipStatus = 'stopped';
    const saved = await this.userRepository.save(user);
    return this.toOverviewRow(saved);
  }

  async reactivate(userId: number): Promise<MembershipOverviewRow> {
    const user = await this.getUserOrFail(userId);
    user.membershipStatus = 'active';
    user.holdStartedAt = null;
    user.holdResumeAt = null;
    user.holdNote = null;
    const saved = await this.userRepository.save(user);
    return this.toOverviewRow(saved);
  }

  async recordPayment(
    userId: number,
    dto: RecordPaymentDto,
  ): Promise<MembershipOverviewRow> {
    const user = await this.getUserOrFail(userId);

    const amount = dto.amount ?? 380;
    const method = dto.method ?? 'etransfer';
    const now = new Date();

    // New end date = max(now, currentSubscriptionEndDate) + 2 months
    const base =
      user.currentSubscriptionEndDate &&
      new Date(user.currentSubscriptionEndDate) > now
        ? new Date(user.currentSubscriptionEndDate)
        : new Date(now);
    const newEnd = new Date(base);
    newEnd.setMonth(newEnd.getMonth() + 2);

    const plan = Object.values(SubscriptionPlan).includes(
      user.activePlan as SubscriptionPlan,
    )
      ? (user.activePlan as SubscriptionPlan)
      : SubscriptionPlan.free;

    const payment = this.paymentRepository.create({
      amount,
      currency: 'cad',
      status: PaymentStatus.ACTIVE,
      plan,
      method,
      note: dto.note ?? null,
      userId: user.id,
      isFirstTimePayment: (user.subscriptionCounter ?? 0) === 0,
      subscriptionEndDate: newEnd,
    });
    await this.paymentRepository.save(payment);

    user.currentSubscriptionEndDate = newEnd;
    user.subscriptionCounter = (user.subscriptionCounter ?? 0) + 1;
    user.membershipStatus = 'active';
    user.holdStartedAt = null;
    user.holdResumeAt = null;
    user.holdNote = null;

    const saved = await this.userRepository.save(user);

    // Best-effort email; never let it break the request
    try {
      if (saved.email) {
        await this.mailService.sendPaymentReceived(
          saved.email,
          saved.fullname,
          amount,
          newEnd,
        );
      }
    } catch (error) {
      this.logger.error(`Payment received email failed: ${error.message}`);
    }

    return this.toOverviewRow(saved);
  }

  private static readonly IMPORT_PLANS: string[] = [
    SubscriptionPlan.U5_U8,
    SubscriptionPlan.U9_U12,
    SubscriptionPlan.U13_U14,
    SubscriptionPlan.U15_U18,
  ];

  private static readonly IMPORT_STATUSES = ['active', 'on_hold', 'stopped'];

  private static readonly IMPORT_DEFAULT_IMAGE =
    '/images/logo/excelpro_logo.png';

  /** Strip spaces/dashes; prefix +1 when a bare 10-digit number is given. */
  private normalizePhone(raw: string): string {
    let phone = raw.replace(/[\s-]/g, '');
    if (/^\d{10}$/.test(phone)) {
      phone = `+1${phone}`;
    }
    return phone;
  }

  private mapGender(raw?: string): Gender {
    const value = (raw ?? '').trim().toLowerCase();
    if (value === 'male') return Gender.MALE;
    if (value === 'female') return Gender.FEMALE;
    return Gender.PREFER_NOT_TO_SAY;
  }

  private validateImportRow(row: ImportPlayerRow): string | null {
    const requiredStrings: (keyof ImportPlayerRow)[] = [
      'fullname',
      'dateOfBirth',
      'parent_name',
      'email',
      'phone_number',
      'activePlan',
    ];
    for (const field of requiredStrings) {
      const value = row[field];
      if (typeof value !== 'string' || value.trim().length === 0) {
        return `missing or invalid ${field}`;
      }
    }

    if (!MembershipService.IMPORT_PLANS.includes(row.activePlan.trim())) {
      return `invalid activePlan '${row.activePlan}' (expected one of ${MembershipService.IMPORT_PLANS.join(
        ' | ',
      )})`;
    }

    if (
      row.membershipStatus !== undefined &&
      !MembershipService.IMPORT_STATUSES.includes(row.membershipStatus)
    ) {
      return `invalid membershipStatus '${row.membershipStatus}' (expected one of ${MembershipService.IMPORT_STATUSES.join(
        ' | ',
      )})`;
    }

    if (row.currentSubscriptionEndDate !== undefined) {
      if (
        typeof row.currentSubscriptionEndDate !== 'string' ||
        isNaN(new Date(row.currentSubscriptionEndDate).getTime())
      ) {
        return `invalid currentSubscriptionEndDate '${row.currentSubscriptionEndDate}'`;
      }
    }

    return null;
  }

  /**
   * Bulk-import existing members. Duplicate (phone/email) and invalid rows
   * are skipped and reported; no emails are sent for imported players.
   */
  async importPlayers(dto: ImportPlayersDto): Promise<ImportPlayersResult> {
    const rows = dto.players ?? [];
    const skipped: ImportSkippedRow[] = [];
    const createdIds: number[] = [];

    // Existing users, for duplicate detection
    const existingUsers = await this.userRepository.find({
      select: ['email', 'phone_number'],
    });
    const existingEmails = new Set(
      existingUsers
        .map((u) => (u.email ?? '').trim().toLowerCase())
        .filter((e) => e.length > 0),
    );
    const existingPhones = new Set(
      existingUsers
        .map((u) => (u.phone_number ?? '').trim())
        .filter((p) => p.length > 0),
    );

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index] ?? {};
      const fullname =
        typeof row.fullname === 'string' ? row.fullname.trim() : undefined;

      const validationError = this.validateImportRow(row);
      if (validationError) {
        skipped.push({ index, fullname, reason: validationError });
        continue;
      }

      const email = row.email.trim();
      const phone = this.normalizePhone(row.phone_number.trim());

      if (
        existingEmails.has(email.toLowerCase()) ||
        existingPhones.has(phone)
      ) {
        skipped.push({ index, fullname, reason: 'duplicate phone/email' });
        continue;
      }

      let subscriptionEndDate: Date;
      if (row.currentSubscriptionEndDate) {
        subscriptionEndDate = new Date(row.currentSubscriptionEndDate);
      } else {
        subscriptionEndDate = new Date();
        subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 2);
      }

      const parentName = row.parent_name.trim();

      const user = this.userRepository.create({
        fullname,
        dateOfBirth: row.dateOfBirth.trim(),
        gender: this.mapGender(row.gender),
        parent_name: parentName,
        email,
        phone_number: phone,
        activePlan: row.activePlan.trim(),
        membershipStatus: row.membershipStatus ?? 'active',
        currentSubscriptionEndDate: subscriptionEndDate,
        address: row.address?.trim() || 'N/A',
        city: row.city?.trim() || 'N/A',
        postalCode: row.postalCode?.trim() || 'N/A',
        emergencyContactName: row.emergencyContactName?.trim() || parentName,
        emergencyPhone: row.emergencyPhone?.trim() || phone,
        // Safe defaults for NOT NULL columns not covered by the import file
        height: 0,
        weight: 0,
        tShirtSize: TShirtSize.M,
        shortSize: TShirtSize.M,
        jacketSize: TShirtSize.M,
        pantsSize: TShirtSize.M,
        experienceLevel: ExperienceLevel.BEGINNER,
        photoUrl: MembershipService.IMPORT_DEFAULT_IMAGE,
        NationalIdCard: MembershipService.IMPORT_DEFAULT_IMAGE,
        policy: true,
        subscriptionCounter: 1,
      });

      try {
        const saved = await this.userRepository.save(user);
        createdIds.push(saved.id);
        // Guard against duplicates within the same import payload
        existingEmails.add(email.toLowerCase());
        existingPhones.add(phone);
      } catch (error) {
        this.logger.error(
          `Import failed for row ${index} (${fullname ?? 'unknown'}): ${error.message}`,
        );
        skipped.push({
          index,
          fullname,
          reason: `database error: ${error.message}`,
        });
      }
    }

    return { created: createdIds.length, createdIds, skipped };
  }

  async exportEmailsCsv(): Promise<string> {
    const users = await this.userRepository.find({
      order: { createdAt: 'DESC' },
    });

    const escapeCsv = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const str =
        value instanceof Date ? value.toISOString() : String(value);
      if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = [
      'fullname',
      'parent_name',
      'email',
      'phone_number',
      'activePlan',
      'membershipStatus',
      'currentSubscriptionEndDate',
      'subscriptionCounter',
      'createdAt',
    ].join(',');

    const lines = users.map((u) =>
      [
        escapeCsv(u.fullname),
        escapeCsv(u.parent_name),
        escapeCsv(u.email),
        escapeCsv(u.phone_number),
        escapeCsv(u.activePlan),
        escapeCsv(u.membershipStatus || 'active'),
        escapeCsv(u.currentSubscriptionEndDate),
        escapeCsv(u.subscriptionCounter ?? 0),
        escapeCsv(u.createdAt),
      ].join(','),
    );

    return [header, ...lines].join('\r\n');
  }
}
