import {
  BadRequestException,
  ConflictException,
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
  SuspendMembershipDto,
  UpdatePlayerNotesDto,
  SetRenewalDateDto,
  BulkActionDto,
  QuickAddPlayerDto,
  InviteParentsDto,
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
  currentSubscriptionStartDate: Date | null;
  daysRemaining: number | null;
  overdue: boolean;
  holdResumeAt: Date | null;
  subscriptionCounter: number;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  suspensionNote: string | null;
  lastReminderAt: Date | null;
  remindersSent: number;
  internalNote: string | null;
  attendanceStatus: string;
  dateOfBirth: string | null;
  medicalNotes: string | null;
  invitedAt: Date | null;
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
      currentSubscriptionStartDate: user.currentSubscriptionStartDate ?? null,
      daysRemaining,
      overdue,
      holdResumeAt: user.holdResumeAt ?? null,
      subscriptionCounter: user.subscriptionCounter ?? 0,
      suspendedAt: user.suspendedAt ?? null,
      suspensionReason: user.suspensionReason ?? null,
      suspensionNote: user.suspensionNote ?? null,
      lastReminderAt: user.lastReminderAt ?? null,
      remindersSent: user.remindersSent ?? 0,
      internalNote: user.internalNote ?? null,
      attendanceStatus: user.attendanceStatus || 'attending',
      dateOfBirth: user.dateOfBirth ?? null,
      medicalNotes: user.medicalNotes ?? null,
      invitedAt: user.invitedAt ?? null,
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

  /**
   * Correct the date a membership runs to.
   *
   * Needed because plenty of families pay by cash or e-transfer outside the
   * dashboard — this is how an admin says "actually, they are paid up to
   * October 15" without inventing a payment.
   */
  async setRenewalDate(
    userId: number,
    dto: SetRenewalDateDto,
  ): Promise<MembershipOverviewRow> {
    const user = await this.getUserOrFail(userId);
    const date = new Date(dto.date);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    user.currentSubscriptionEndDate = date;

    if (dto.startDate) {
      const start = new Date(dto.startDate);
      if (isNaN(start.getTime())) {
        throw new BadRequestException('Invalid start date');
      }
      if (start > date) {
        throw new BadRequestException(
          'The period cannot start after it ends. Please check the dates.',
        );
      }
      user.currentSubscriptionStartDate = start;
    }

    // A corrected date that is still in the future means they are paid up, so
    // clear an unpaid-fee suspension and stop the reminder chase.
    if (date > new Date()) {
      if (user.suspensionReason === 'late_payment') {
        user.membershipStatus = 'active';
        user.suspendedAt = null;
        user.suspensionReason = null;
        user.suspensionNote = null;
      }
      user.remindersSent = 0;
      user.lastReminderAt = null;
    }
    if (dto.note) {
      user.internalNote = user.internalNote
        ? `${user.internalNote}\n${dto.note}`
        : dto.note;
    }

    const saved = await this.userRepository.save(user);
    return this.toOverviewRow(saved);
  }

  /**
   * Email families an invitation to start using the website.
   *
   * Skips players with no email, and (unless `resend` is set) anyone already
   * invited — sending the same family the same email twice looks careless.
   */
  async inviteParents(dto: InviteParentsDto): Promise<{
    sent: number;
    skipped: { fullname: string; reason: string }[];
    failed: { fullname: string; reason: string }[];
  }> {
    const skipped: { fullname: string; reason: string }[] = [];
    const failed: { fullname: string; reason: string }[] = [];
    let sent = 0;

    for (const userId of dto.userIds) {
      let user: User;
      try {
        user = await this.getUserOrFail(userId);
      } catch {
        failed.push({ fullname: `#${userId}`, reason: 'Player not found' });
        continue;
      }

      if (!user.email) {
        skipped.push({ fullname: user.fullname, reason: 'No email address' });
        continue;
      }
      if (user.invitedAt && !dto.resend) {
        skipped.push({
          fullname: user.fullname,
          reason: `Already invited ${new Date(user.invitedAt).toDateString()}`,
        });
        continue;
      }

      const ok = await this.mailService.sendParentInvitation(
        user.email,
        user.fullname,
        user.parent_name || null,
        user.currentSubscriptionEndDate ?? null,
      );

      if (ok) {
        user.invitedAt = new Date();
        await this.userRepository.save(user);
        sent += 1;
        // A small gap keeps the mail provider happy on large sends.
        await new Promise((r) => setTimeout(r, 300));
      } else {
        failed.push({
          fullname: user.fullname,
          reason: 'Email could not be sent',
        });
      }
    }

    return { sent, skipped, failed };
  }

  /**
   * Apply one action to many players — used mainly to clear out families who
   * left the academy long ago and were never marked as such.
   */
  async bulkAction(dto: BulkActionDto): Promise<{
    updated: number;
    failed: { userId: number; reason: string }[];
  }> {
    const failed: { userId: number; reason: string }[] = [];
    let updated = 0;

    for (const userId of dto.userIds) {
      try {
        switch (dto.action) {
          case 'stop':
            await this.stop(userId);
            break;
          case 'reactivate':
            await this.reactivate(userId);
            break;
          case 'suspend':
            await this.suspend(userId, {
              reason: dto.reason || 'other',
              note: dto.note,
              // Bulk suspensions are housekeeping, so parents are not emailed
              // unless the admin does it deliberately one at a time.
              notifyParent: false,
            });
            break;
          case 'set-plan':
            if (!dto.plan) throw new Error('No program given');
            await this.setPlan(userId, dto.plan);
            break;
          default:
            throw new Error(`Unknown action ${dto.action}`);
        }
        updated += 1;
      } catch (error) {
        failed.push({ userId, reason: error.message || 'Failed' });
      }
    }

    return { updated, failed };
  }

  /**
   * Add a player by hand from the dashboard — for walk-ins and for members
   * who joined before the website existed. Only the handful of fields the
   * academy actually needs are asked for; the rest get safe defaults.
   */
  async quickAddPlayer(dto: QuickAddPlayerDto): Promise<MembershipOverviewRow> {
    const phone = this.normalizePhone(dto.phone_number);
    const email = (dto.email || '').trim().toLowerCase();

    // Same-name-and-phone means this is a duplicate; siblings share a phone
    // but have different names, so both parts must match.
    const existing = await this.userRepository
      .createQueryBuilder('u')
      .where('u.phone_number = :phone AND LOWER(u.fullname) = :name', {
        phone,
        name: dto.fullname.trim().toLowerCase(),
      })
      .getOne();
    if (existing) {
      throw new ConflictException(
        `${dto.fullname} is already in the system with that phone number.`,
      );
    }

    const endDate = dto.currentSubscriptionEndDate
      ? new Date(dto.currentSubscriptionEndDate)
      : null;

    const player = this.userRepository.create({
      fullname: dto.fullname.trim(),
      parent_name: dto.parent_name.trim(),
      phone_number: phone,
      email,
      activePlan: dto.activePlan,
      currentSubscriptionEndDate:
        endDate && !isNaN(endDate.getTime()) ? endDate : null,
      dateOfBirth: dto.dateOfBirth || null,
      gender: this.mapGender(dto.gender),
      membershipStatus: 'active',
      // They are an existing member being recorded, not a new sign-up, so no
      // first-time registration fee is implied.
      subscriptionCounter: endDate ? 1 : 0,
      internalNote: dto.internalNote || null,
      medicalNotes: dto.medicalNotes || null,
      attendanceStatus: 'attending',
      policy: true,
      // Safe defaults for the NOT NULL columns the full sign-up form fills in.
      address: '',
      city: '',
      postalCode: '',
      emergencyContactName: dto.parent_name.trim(),
      emergencyPhone: phone,
      height: 0,
      weight: 0,
      experienceLevel: ExperienceLevel.BEGINNER,
      tShirtSize: TShirtSize.YM,
      shortSize: TShirtSize.YM,
      jacketSize: TShirtSize.YM,
      pantsSize: TShirtSize.YM,
      photoUrl: MembershipService.IMPORT_DEFAULT_IMAGE,
      NationalIdCard: MembershipService.IMPORT_DEFAULT_IMAGE,
    } as Partial<User>);

    const saved = await this.userRepository.save(player);
    return this.toOverviewRow(saved);
  }

  /**
   * Suspend an account. Unlike "stop" (the family left the academy) a
   * suspension is a temporary block the academy applies — unpaid fees,
   * discipline, missing paperwork — and it keeps the reason on record.
   *
   * Sensitive reasons (discipline, medical) default to NOT emailing the
   * parent, so the academy can have that conversation by phone first.
   */
  async suspend(
    userId: number,
    dto: SuspendMembershipDto,
  ): Promise<MembershipOverviewRow> {
    const user = await this.getUserOrFail(userId);
    user.membershipStatus = 'suspended';
    user.suspendedAt = new Date();
    user.suspensionReason = dto.reason;
    user.suspensionNote = dto.note ?? null;
    const saved = await this.userRepository.save(user);

    const emailByDefault =
      dto.reason === 'late_payment' || dto.reason === 'paperwork';
    const shouldNotify = dto.notifyParent ?? emailByDefault;

    if (shouldNotify && user.email) {
      try {
        await this.mailService.sendSuspensionNotice(
          user.email,
          user.fullname,
          dto.reason,
        );
      } catch (error) {
        this.logger.error(`Suspension email failed: ${error.message}`);
      }
    }

    return this.toOverviewRow(saved);
  }

  /** Lift a suspension and put the player back on the field. */
  async unsuspend(
    userId: number,
    notifyParent = true,
  ): Promise<MembershipOverviewRow> {
    const user = await this.getUserOrFail(userId);
    user.membershipStatus = 'active';
    user.suspendedAt = null;
    user.suspensionReason = null;
    user.suspensionNote = null;
    const saved = await this.userRepository.save(user);

    if (notifyParent && user.email) {
      try {
        await this.mailService.sendSuspensionLifted(user.email, user.fullname);
      } catch (error) {
        this.logger.error(`Reinstatement email failed: ${error.message}`);
      }
    }

    return this.toOverviewRow(saved);
  }

  /** Private admin/coach notes and how regularly the player shows up. */
  async updateNotes(
    userId: number,
    dto: UpdatePlayerNotesDto,
  ): Promise<MembershipOverviewRow> {
    const user = await this.getUserOrFail(userId);
    if (dto.internalNote !== undefined) {
      user.internalNote = dto.internalNote || null;
    }
    if (dto.attendanceStatus !== undefined) {
      user.attendanceStatus = dto.attendanceStatus;
    }
    if (dto.medicalNotes !== undefined) {
      user.medicalNotes = dto.medicalNotes || null;
    }
    const saved = await this.userRepository.save(user);
    return this.toOverviewRow(saved);
  }

  /**
   * Set (or correct) the program a player belongs to. Players who registered
   * without picking a program first were stored with a placeholder plan; this
   * lets an admin fix that from the Memberships screen.
   */
  async setPlan(
    userId: number,
    plan: string,
  ): Promise<MembershipOverviewRow> {
    const user = await this.getUserOrFail(userId);
    user.activePlan = plan as SubscriptionPlan;
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
    const months = dto.months ?? 2;
    const type = dto.type ?? 'membership';
    const periodLabel = dto.periodLabel ?? null;
    const now = new Date();

    const plan = Object.values(SubscriptionPlan).includes(
      user.activePlan as SubscriptionPlan,
    )
      ? (user.activePlan as SubscriptionPlan)
      : SubscriptionPlan.free;

    if (type === 'league') {
      // League fee: record the payment only. Do NOT touch the subscription
      // end date or the subscription counter.
      const payment = this.paymentRepository.create({
        amount,
        currency: 'cad',
        status: PaymentStatus.ACTIVE,
        plan,
        method,
        type: 'league',
        periodLabel,
        note: dto.note ?? null,
        userId: user.id,
        isFirstTimePayment: false,
      });
      await this.paymentRepository.save(payment);

      // Best-effort email; never let it break the request
      try {
        if (user.email) {
          await this.mailService.sendPaymentReceived(
            user.email,
            user.fullname,
            amount,
            null,
            { type: 'league', periodLabel },
          );
        }
      } catch (error) {
        this.logger.error(`Payment received email failed: ${error.message}`);
      }

      return this.toOverviewRow(user);
    }

    // A back-dated entry (money taken weeks ago by cash) should count in the
    // month it was actually received, not today.
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : now;
    const paidAtValid = !isNaN(paidAt.getTime()) ? paidAt : now;

    // Normally a renewal extends from the current end date so early payers
    // never lose paid days. When catching up on old cash payments the admin
    // can instead start the period at the payment date.
    const base = dto.startFromPaymentDate
      ? new Date(paidAtValid)
      : user.currentSubscriptionEndDate &&
          new Date(user.currentSubscriptionEndDate) > now
        ? new Date(user.currentSubscriptionEndDate)
        : new Date(now);
    const newEnd = new Date(base);
    newEnd.setMonth(newEnd.getMonth() + months);

    const payment = this.paymentRepository.create({
      amount,
      currency: 'cad',
      status: PaymentStatus.ACTIVE,
      plan,
      method,
      type: 'membership',
      periodLabel,
      note: dto.note ?? null,
      userId: user.id,
      isFirstTimePayment: (user.subscriptionCounter ?? 0) === 0,
      subscriptionEndDate: newEnd,
    });
    const savedPayment = await this.paymentRepository.save(payment);

    // createdAt is generated by the database, so a back-date has to be applied
    // afterwards for the Money screen and receipts to show the real month.
    if (dto.paidAt && !isNaN(paidAtValid.getTime())) {
      await this.paymentRepository.update(savedPayment.id, {
        createdAt: paidAtValid,
      });
    }

    user.currentSubscriptionEndDate = newEnd;
    user.currentSubscriptionStartDate = new Date(base);
    user.subscriptionCounter = (user.subscriptionCounter ?? 0) + 1;
    user.membershipStatus = 'active';
    user.holdStartedAt = null;
    user.holdResumeAt = null;
    user.holdNote = null;
    // Money in clears an unpaid-fee suspension and resets the chase counters.
    if (user.suspensionReason === 'late_payment') {
      user.suspendedAt = null;
      user.suspensionReason = null;
      user.suspensionNote = null;
    }
    user.remindersSent = 0;
    user.lastReminderAt = null;

    const saved = await this.userRepository.save(user);

    // Best-effort email; never let it break the request
    try {
      if (saved.email) {
        await this.mailService.sendPaymentReceived(
          saved.email,
          saved.fullname,
          amount,
          newEnd,
          { type: 'membership', periodLabel },
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
