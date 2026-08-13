import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  IsNull,
  LessThan,
  LessThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { Transfer } from './entities/transfer.entity';
import { User } from '../users/entities/user.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PaymentStatus } from '../payment/entities/enums/payment-status.enum';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferStatus } from './entities/enums/transfer-status.enum';
import { v4 as uuidv4 } from 'uuid';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailService, AdminDigestRow } from '../mail/mail.service';
import { MembershipService } from '../membership/membership.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class TransferService {
  constructor(
    @InjectRepository(Transfer)
    private transferRepository: Repository<Transfer>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private mailService: MailService,
    private membershipService: MembershipService,
    private settingsService: SettingsService,
  ) {}

  // MAIN ISSUE: When the second user registers, information is recorded under the first user's name
  // SOLUTION: More precise user verification using phone number and full name

  // Create a new transfer request
  async createTransfer(
    userId: number,
    createTransferDto: CreateTransferDto,
  ): Promise<Transfer> {
    // Ensure userId is valid
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Additional verification of user identity with provided information (if exists)
    if (createTransferDto.fullname && createTransferDto.phone_number) {
      // Verify that the found user matches the information provided
      if (
        user.fullname?.toLowerCase() !==
          createTransferDto.fullname.toLowerCase() ||
        user.phone_number !== createTransferDto.phone_number
      ) {
        // Remove sensitive user information logs
        throw new ConflictException(
          'User information does not match our records. Please contact support.',
        );
      }
    }

    // This line should be removed:
    // activePlan should only be updated after payment confirmation by admin, not now
    // await this.userRepository.update(user.id, {
    //   activePlan: createTransferDto.plan,
    // });

    // Check if user already has a pending transfer
    const pendingTransfer = await this.transferRepository.findOne({
      where: {
        userId,
        status: TransferStatus.PENDING,
      },
    });

    if (pendingTransfer) {
      return pendingTransfer; // Return existing pending transfer
    }

    // Generate unique token
    const token = uuidv4();

    // Set expiry date (48 hours from now)
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 48);

    // Check if this is first payment
    const isFirstTimePayment = user.subscriptionCounter === 0;

    // Create transfer
    const transfer = this.transferRepository.create({
      ...createTransferDto,
      userId,
      user,
      token,
      expiryDate,
      isFirstTimePayment,
      status: TransferStatus.PENDING,
    });

    // FIX: Ensure the received amount is correct
    if (isFirstTimePayment && transfer.amount < 400) {
      // Remove sensitive logs containing amount information
      transfer.amount = 455; // Fixed amount for first-time registration ($380 + $75 one-time fee)
    } else if (!isFirstTimePayment && transfer.amount < 300) {
      // Remove sensitive logs containing amount information
      transfer.amount = 380; // Fixed amount for renewal
    }

    const savedTransfer = await this.transferRepository.save(transfer);

    // Email the parent the e-transfer details (SMS is switched off).
    try {
      if (user.email) {
        await this.mailService.sendPaymentInstructions(
          user.email,
          user.fullname,
          Number(savedTransfer.amount),
          savedTransfer.isFirstTimePayment,
        );
      }
    } catch (error) {
      console.error('❌ Payment instructions email failed (ignored) –', error.message);
    }

    return savedTransfer;
  }

  // Get transfer by token
  async getTransferByToken(token: string): Promise<Transfer> {
    const transfer = await this.transferRepository.findOne({
      where: { token },
      relations: ['user'],
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    // Check if expired
    if (
      new Date() > transfer.expiryDate &&
      transfer.status === TransferStatus.PENDING
    ) {
      transfer.status = TransferStatus.EXPIRED;
      await this.transferRepository.save(transfer);
    }

    return transfer;
  }

  // User confirms they have made the payment
  async confirmTransfer(token: string): Promise<Transfer> {
    const transfer = await this.getTransferByToken(token);

    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException(
        `Cannot confirm transfer with status: ${transfer.status}`,
      );
    }

    if (new Date() > transfer.expiryDate) {
      transfer.status = TransferStatus.EXPIRED;
      await this.transferRepository.save(transfer);
      throw new BadRequestException('Transfer request has expired');
    }

    // Update transfer
    transfer.status = TransferStatus.CONFIRMED;
    transfer.confirmedByUser = true;
    transfer.confirmedAt = new Date();

    const savedTransfer = await this.transferRepository.save(transfer);

    // Tell the admins by email that money is waiting to be verified.
    try {
      await this.mailService.sendAdminRequestNotice(
        'payment confirmation',
        savedTransfer.user.fullname,
        {
          Amount: `$${Number(savedTransfer.amount).toFixed(2)} CAD`,
          Plan: String(savedTransfer.plan),
          'Parent email': savedTransfer.user.email || '-',
          Phone: savedTransfer.user.phone_number || '-',
          Note: 'The parent says they have sent the e-transfer. Approve it in Dashboard -> Payments once it arrives.',
        },
      );
    } catch (error) {
      console.error('❌ Admin payment email failed (ignored) –', error.message);
    }

    return savedTransfer;
  }

  // Admin verifies the payment
  async verifyTransfer(
    id: string,
    isApproved: boolean,
    notes?: string,
  ): Promise<Transfer> {
    const transfer = await this.transferRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    // Make sure we find the user associated with the transfer
    const user = await this.userRepository.findOne({
      where: { id: transfer.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${transfer.userId} not found`);
    }

    if (transfer.status !== TransferStatus.CONFIRMED) {
      throw new BadRequestException(
        `Cannot verify transfer with status: ${transfer.status}`,
      );
    }

    // Handle rejection
    if (!isApproved) {
      transfer.status = TransferStatus.REJECTED;
      try {
        if (transfer.user.email) {
          await this.mailService.sendPaymentRejected(
            transfer.user.email,
            transfer.user.fullname,
            Number(transfer.amount),
            notes || 'Payment could not be verified',
          );
        }
      } catch (error) {
        console.error('❌ Rejection email failed (ignored) –', error.message);
      }

      if (transfer.isFirstTimePayment && transfer.user.isTemporary) {
        try {
          await this.userRepository.remove(transfer.user);
          // Remove sensitive log containing user ID
          return transfer;
        } catch (error) {
          console.error('Error deleting temporary user:', error);
        }
      }

      transfer.verifiedByAdmin = false;
      transfer.adminNotes = notes;
      transfer.verifiedAt = new Date();
      return this.transferRepository.save(transfer);
    }

    // Handle approval
    transfer.status = TransferStatus.VERIFIED;
    // Extend from the later of "now" and the current subscription end date so
    // early renewals do not lose remaining paid time.
    const now = new Date();
    const base =
      user.currentSubscriptionEndDate &&
      new Date(user.currentSubscriptionEndDate) > now
        ? new Date(user.currentSubscriptionEndDate)
        : now;
    const endDate = new Date(base);
    endDate.setMonth(endDate.getMonth() + 2);
    transfer.subscriptionEndDate = endDate;

    // FIX: Here activePlan is updated - after payment confirmation
    const subscriptionCounter = user.subscriptionCounter || 0;

    await this.userRepository.update(user.id, {
      activePlan: transfer.plan,
      currentSubscriptionEndDate: endDate,
      isTemporary: false, // User is no longer temporary
      subscriptionCounter: subscriptionCounter + 1, // Increment subscription counter
      membershipStatus: 'active',
      holdStartedAt: null,
      holdResumeAt: null,
      holdNote: null,
      // A fresh payment clears any unpaid-fee suspension and the chase counters.
      suspendedAt: null,
      suspensionReason: null,
      suspensionNote: null,
      remindersSent: 0,
      lastReminderAt: null,
    });

    transfer.verifiedByAdmin = true;
    transfer.adminNotes = notes;
    transfer.verifiedAt = new Date();
    transfer.expiryDate = null; // Clear expiry date on approval

    // Save the verified transfer BEFORE any notification. Previously an SMS
    // failure threw here, leaving the membership extended but the transfer
    // still "pending" — so every retry of Approve added another 2 months.
    const savedTransfer = await this.transferRepository.save(transfer);

    // Record the money so it appears on the Money screen, in the admin's
    // reports and in the parent's receipts. Without this, e-transfers approved
    // on this screen were invisible to the accounting side of the dashboard.
    try {
      const payment = this.paymentRepository.create({
        amount: Number(transfer.amount),
        currency: 'cad',
        status: PaymentStatus.ACTIVE,
        plan: transfer.plan,
        method: 'etransfer',
        type: 'membership',
        periodLabel: null,
        note: notes || 'Approved from Payments screen',
        userId: user.id,
        isFirstTimePayment: transfer.isFirstTimePayment,
        subscriptionEndDate: endDate,
      });
      await this.paymentRepository.save(payment);
    } catch (error) {
      console.error('❌ Could not record payment for transfer –', error.message);
    }

    // Notifications are best-effort: SMTP being down must never fail an
    // approval the admin already made.
    try {
      if (user.email) {
        await this.mailService.sendPaymentReceived(
          user.email,
          user.fullname,
          Number(transfer.amount),
          endDate,
          { type: 'membership', periodLabel: null },
        );
      }
    } catch (error) {
      console.error('❌ Approval email failed (ignored) –', error.message);
    }

    return savedTransfer;
  }

  // Get user's transfers
  async getUserTransfers(userId: number): Promise<Transfer[]> {
    // Verify user validity before returning transfers
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.transferRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  // Get transfers for admin panel
  async getTransfersForAdmin(status?: TransferStatus): Promise<Transfer[]> {
    const queryOptions: any = {
      relations: ['user'],
      order: { createdAt: 'DESC' },
    };

    if (status) {
      queryOptions.where = { status };
    }

    return this.transferRepository.find(queryOptions);
  }

  // Get transfers that need admin verification
  async getTransfersNeedingVerification(): Promise<Transfer[]> {
    return this.transferRepository.find({
      where: { status: TransferStatus.CONFIRMED },
      relations: ['user'],
      order: { confirmedAt: 'ASC' }, // Oldest confirmations first
    });
  }

  // Scheduled job to expire pending transfers
  @Cron(CronExpression.EVERY_DAY_AT_3PM)
  async handleExpiredTransfers() {
    const now = new Date();

    // Find all pending transfers that are expired
    const expiredTransfers = await this.transferRepository.find({
      where: {
        status: TransferStatus.PENDING,
        expiryDate: LessThan(now),
      },
      relations: ['user'],
    });

    for (const transfer of expiredTransfers) {
      try {
        transfer.status = TransferStatus.EXPIRED;
        await this.transferRepository.save(transfer);

        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        console.error(
          `❌ Error processing expired transfer ID: ${transfer.id} –`,
          err.message,
        );
      }

      // Cleanup: Delete temp user if it was first-time payment
      if (transfer.isFirstTimePayment && transfer.user.isTemporary) {
        try {
          await this.userRepository.remove(transfer.user);
        } catch (err) {
          console.error(
            `❌ Error deleting temporary user ID: ${transfer.user.id} –`,
            err.message,
          );
        }
      }
    }

    // Auto-resume memberships whose hold period has ended (credits held time back)
    try {
      const usersToAutoResume = await this.userRepository.find({
        where: {
          membershipStatus: 'on_hold',
          holdResumeAt: LessThanOrEqual(now),
        },
      });

      for (const user of usersToAutoResume) {
        try {
          this.membershipService.applyResume(user, now);
          await this.userRepository.save(user);
          console.log(`✅ Auto-resumed membership for user ID: ${user.id}`);
        } catch (err) {
          console.error(
            `❌ Error auto-resuming membership for user ID: ${user.id} –`,
            err.message,
          );
        }
      }
    } catch (err) {
      console.error('❌ Error processing auto-resumes –', err.message);
    }

    // Automatic emails to families can be paused while records are being
    // corrected, so nobody is chased over a date that is simply wrong.
    let remindersPaused = false;
    try {
      remindersPaused = (await this.settingsService.getAll()).remindersPaused;
    } catch (err) {
      console.error('❌ Could not read reminder settings –', err.message);
    }
    if (remindersPaused) {
      console.log('⏸ Automatic parent reminders are paused — skipping.');
    }

    // Users with subscriptions expiring in 2 days (active memberships only)
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const oneDayWindowStart = new Date(
      twoDaysFromNow.getTime() - 24 * 60 * 60 * 1000,
    );

    const usersExpiringSoon = await this.userRepository.find({
      where: {
        currentSubscriptionEndDate: Between(oneDayWindowStart, twoDaysFromNow),
        activePlan: Not(IsNull()),
        membershipStatus: 'active',
      },
    });

    for (const user of remindersPaused ? [] : usersExpiringSoon) {

      // Email alongside SMS (best-effort)
      try {
        if (user.email) {
          await this.mailService.sendPaymentReminder(
            user.email,
            user.fullname,
            user.currentSubscriptionEndDate,
          );
        }
      } catch (err) {
        console.error(
          `❌ Error sending renewal reminder email to user ID: ${user.id} –`,
          err.message,
        );
      }
    }

    // Overdue chase-up. Reminders escalate on a fixed schedule — day 1, 3, 7,
    // 14, then weekly — instead of every second day forever, so parents are
    // not spammed but nothing quietly falls through the cracks either.
    const REMINDER_DAYS = [1, 3, 7, 14];
    const isReminderDay = (daysOverdue: number) =>
      REMINDER_DAYS.includes(daysOverdue) ||
      (daysOverdue > 14 && daysOverdue % 7 === 0);

    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const usersWithExpiredSubscriptions = await this.userRepository.find({
      where: {
        currentSubscriptionEndDate: Between(sixtyDaysAgo, now),
        activePlan: Not(IsNull()),
        membershipStatus: 'active',
      },
    });

    for (const user of remindersPaused ? [] : usersWithExpiredSubscriptions) {
      const daysSinceExpiry = Math.floor(
        (now.getTime() - user.currentSubscriptionEndDate.getTime()) /
          (24 * 60 * 60 * 1000),
      );

      // Optional auto-suspend, off unless the academy turns it on in Settings.
      try {
        const settings = await this.settingsService.getAll();
        if (
          settings.autoSuspendEnabled &&
          daysSinceExpiry >= settings.autoSuspendDays
        ) {
          user.membershipStatus = 'suspended';
          user.suspendedAt = now;
          user.suspensionReason = 'late_payment';
          user.suspensionNote = `Automatically suspended after ${daysSinceExpiry} days overdue`;
          await this.userRepository.save(user);
          if (user.email) {
            await this.mailService.sendSuspensionNotice(
              user.email,
              user.fullname,
              'late_payment',
            );
          }
          continue; // suspended today: the suspension email replaces the reminder
        }
      } catch (err) {
        console.error('❌ Auto-suspend check failed –', err.message);
      }

      if (isReminderDay(daysSinceExpiry)) {

        // Email alongside SMS (best-effort)
        try {
          if (user.email) {
            const sent = await this.mailService.sendOverdueNotice(
              user.email,
              user.fullname,
              user.currentSubscriptionEndDate,
            );
            // Track the chase so the Collections screen shows how many
            // reminders a family has already had.
            if (sent) {
              user.remindersSent = (user.remindersSent || 0) + 1;
              user.lastReminderAt = now;
              await this.userRepository.save(user);
            }
          }
        } catch (err) {
          console.error(
            `❌ Error sending overdue email to user ID: ${user.id} –`,
            err.message,
          );
        }
      }
    }

    // Admin digest: due within 3 days + overdue (active memberships only)
    try {
      const threeDaysFromNow = new Date(
        now.getTime() + 3 * 24 * 60 * 60 * 1000,
      );

      const dueSoonUsers = await this.userRepository.find({
        where: {
          currentSubscriptionEndDate: Between(now, threeDaysFromNow),
          activePlan: Not(IsNull()),
          membershipStatus: 'active',
        },
        order: { currentSubscriptionEndDate: 'ASC' },
      });

      const overdueUsers = await this.userRepository.find({
        where: {
          currentSubscriptionEndDate: LessThan(now),
          activePlan: Not(IsNull()),
          membershipStatus: 'active',
        },
        order: { currentSubscriptionEndDate: 'ASC' },
      });

      const toDigestRow = (user: User): AdminDigestRow => ({
        fullname: user.fullname,
        parent_name: user.parent_name,
        email: user.email,
        phone_number: user.phone_number,
        activePlan: user.activePlan,
        currentSubscriptionEndDate: user.currentSubscriptionEndDate,
        daysRemaining: user.currentSubscriptionEndDate
          ? Math.ceil(
              (new Date(user.currentSubscriptionEndDate).getTime() -
                now.getTime()) /
                (24 * 60 * 60 * 1000),
            )
          : null,
      });

      if (dueSoonUsers.length > 0 || overdueUsers.length > 0) {
        await this.mailService.sendAdminDigest(
          dueSoonUsers.map(toDigestRow),
          overdueUsers.map(toDigestRow),
        );
      }
    } catch (err) {
      console.error('❌ Error sending admin digest email –', err.message);
    }
  }
}
