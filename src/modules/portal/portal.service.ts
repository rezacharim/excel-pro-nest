import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PortalRequest } from './entities/portal-request.entity';
import { Transfer } from '../transfer/entities/transfer.entity';
import { TransferStatus } from '../transfer/entities/enums/transfer-status.enum';
import { SubscriptionPlan } from '../users/entities/enums/enums';
import { RedisService } from '../../common/db/redis.service';
import { MailService } from '../mail/mail.service';
import { v4 as uuidv4 } from 'uuid';
import {
  PortalLoginDto,
  RenewDto,
  RequestHoldDto,
  RequestInstallmentsDto,
} from './dto/portal.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PortalPlayer {
  id: number;
  fullname: string;
  activePlan: string | null;
  membershipStatus: string;
  currentSubscriptionEndDate: Date | null;
  daysRemaining: number | null;
  overdue: boolean;
  holdResumeAt: Date | null;
  subscriptionCounter: number;
  requests: {
    id: number;
    kind: string;
    status: string;
    resumeAt: Date | null;
    note: string | null;
    totalAmount: number | null;
    installments: number | null;
    createdAt: Date;
  }[];
  payments: {
    id: number;
    amount: number;
    currency: string;
    method: string;
    type: string;
    status: string;
    periodLabel: string | null;
    subscriptionEndDate: Date | null;
    createdAt: Date;
  }[];
}

@Injectable()
export class PortalService {
  private readonly logger = new Logger(PortalService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PortalRequest)
    private readonly portalRequestRepository: Repository<PortalRequest>,
    @InjectRepository(Transfer)
    private readonly transferRepository: Repository<Transfer>,
    private readonly redisService: RedisService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  private normalizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  async login(dto: PortalLoginDto): Promise<{ token: string; email: string }> {
    const email = this.normalizeEmail(dto.email);
    const otp = (dto.otp || '').trim();

    if (!email || !otp) {
      throw new BadRequestException('Invalid or expired code');
    }

    const key = `otp:email:${email}`;
    const stored = await this.redisService.getOTP(key);
    if (!stored || stored !== otp) {
      throw new BadRequestException('Invalid or expired code');
    }
    await this.redisService.deleteOTP(key);

    const token = this.jwtService.sign(
      { email, role: 'parent' },
      { expiresIn: '30d' },
    );

    return { token, email };
  }

  private async findPlayersByEmail(email: string): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', {
        email: this.normalizeEmail(email),
      })
      .orderBy('user.id', 'ASC')
      .getMany();
  }

  private async toPortalPlayer(user: User, now: Date): Promise<PortalPlayer> {
    let daysRemaining: number | null = null;
    let overdue = false;

    if (user.currentSubscriptionEndDate) {
      const end = new Date(user.currentSubscriptionEndDate);
      daysRemaining = Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY);
      overdue = daysRemaining < 0;
    }

    const [requests, payments] = await Promise.all([
      this.portalRequestRepository.find({
        where: { userId: user.id },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
      this.paymentRepository.find({
        where: { userId: user.id },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
    ]);

    return {
      id: user.id,
      fullname: user.fullname,
      activePlan: user.activePlan ?? null,
      membershipStatus: user.membershipStatus || 'active',
      currentSubscriptionEndDate: user.currentSubscriptionEndDate ?? null,
      daysRemaining,
      overdue,
      holdResumeAt: user.holdResumeAt ?? null,
      subscriptionCounter: user.subscriptionCounter ?? 0,
      requests: requests.map((r) => ({
        id: r.id,
        kind: r.kind,
        status: r.status,
        resumeAt: r.resumeAt ?? null,
        note: r.note ?? null,
        totalAmount: r.totalAmount ?? null,
        installments: r.installments ?? null,
        createdAt: r.createdAt,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        method: p.method,
        type: p.type,
        status: p.status,
        periodLabel: p.periodLabel ?? null,
        subscriptionEndDate: p.subscriptionEndDate ?? null,
        createdAt: p.createdAt,
      })),
    };
  }

  async me(email: string): Promise<{ email: string; players: PortalPlayer[] }> {
    const normalized = this.normalizeEmail(email);
    const users = await this.findPlayersByEmail(normalized);
    const now = new Date();
    const players = await Promise.all(
      users.map((u) => this.toPortalPlayer(u, now)),
    );
    return { email: normalized, players };
  }

  /** The player must belong to the authenticated parent's email. */
  private async getOwnedPlayer(email: string, userId: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (
      !user ||
      this.normalizeEmail(user.email) !== this.normalizeEmail(email)
    ) {
      throw new NotFoundException('Player not found');
    }
    return user;
  }

  /**
   * Start a membership renewal from the parent portal.
   *
   * Creates (or re-uses) a pending e-transfer payment request for the player,
   * exactly like the one created during registration, so the admin verifies
   * it with the same dashboard tools. The amount is decided server-side:
   * $455 for a first-ever payment ($380 + $75 one-time fee), $380 otherwise.
   */
  async renew(
    email: string,
    dto: RenewDto,
  ): Promise<{
    transferId: string | number;
    token: string;
    amount: number;
    plan: string;
    isFirstTimePayment: boolean;
    playerName: string;
  }> {
    const user = await this.getOwnedPlayer(email, dto.userId);

    // Re-use an existing pending request so double-clicks or refreshes never
    // create duplicate payment requests for the same player.
    let transfer = await this.transferRepository.findOne({
      where: { userId: user.id, status: TransferStatus.PENDING },
    });

    if (!transfer) {
      const isFirstTimePayment = (user.subscriptionCounter ?? 0) === 0;
      const amount = isFirstTimePayment ? 455 : 380;
      const plan =
        user.activePlan &&
        Object.values(SubscriptionPlan).includes(
          user.activePlan as SubscriptionPlan,
        )
          ? (user.activePlan as SubscriptionPlan)
          : SubscriptionPlan.U13_U14;

      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + 48);

      transfer = this.transferRepository.create({
        userId: user.id,
        user,
        plan,
        amount,
        token: uuidv4(),
        expiryDate,
        isFirstTimePayment,
        status: TransferStatus.PENDING,
      });
      transfer = await this.transferRepository.save(transfer);

      // Best-effort heads-up for the admins; never break the renewal.
      try {
        await this.mailService.sendAdminRequestNotice(
          'renewal payment started',
          user.fullname,
          {
            'Parent email': this.normalizeEmail(email),
            Amount: `$${amount} CAD (e-transfer)`,
            Plan: String(plan),
            Note: 'Verify it in Dashboard once the e-transfer arrives.',
          },
        );
      } catch (error) {
        this.logger.error(`Admin renewal email failed: ${error.message}`);
      }
    }

    return {
      transferId: transfer.id,
      token: transfer.token,
      amount: Number(transfer.amount),
      plan: String(transfer.plan),
      isFirstTimePayment: transfer.isFirstTimePayment,
      playerName: user.fullname,
    };
  }

  async requestHold(
    email: string,
    dto: RequestHoldDto,
  ): Promise<{ success: boolean }> {
    const user = await this.getOwnedPlayer(email, dto.userId);

    const resumeAt = dto.resumeAt ? new Date(dto.resumeAt) : null;
    if (resumeAt && isNaN(resumeAt.getTime())) {
      throw new BadRequestException('Invalid resumeAt date');
    }

    const request = this.portalRequestRepository.create({
      userId: user.id,
      kind: 'hold',
      resumeAt,
      note: dto.note ?? null,
      totalAmount: null,
      installments: null,
      status: 'pending',
    });
    await this.portalRequestRepository.save(request);

    // Best-effort admin notification; never break the request.
    try {
      await this.mailService.sendAdminRequestNotice('hold', user.fullname, {
        'Parent email': this.normalizeEmail(email),
        'Resume date': resumeAt ? resumeAt.toDateString() : 'Indefinite',
        Note: dto.note || '-',
      });
    } catch (error) {
      this.logger.error(`Admin hold-request email failed: ${error.message}`);
    }

    return { success: true };
  }

  async requestInstallments(
    email: string,
    dto: RequestInstallmentsDto,
  ): Promise<{ success: boolean }> {
    const user = await this.getOwnedPlayer(email, dto.userId);

    const request = this.portalRequestRepository.create({
      userId: user.id,
      kind: 'installment',
      resumeAt: null,
      note: dto.note ?? null,
      totalAmount: dto.totalAmount,
      installments: dto.installments,
      status: 'pending',
    });
    await this.portalRequestRepository.save(request);

    // Best-effort admin notification; never break the request.
    try {
      await this.mailService.sendAdminRequestNotice(
        'installment',
        user.fullname,
        {
          'Parent email': this.normalizeEmail(email),
          'Total amount': `$${Number(dto.totalAmount).toFixed(2)} CAD`,
          Installments: String(dto.installments),
          Note: dto.note || '-',
        },
      );
    } catch (error) {
      this.logger.error(
        `Admin installment-request email failed: ${error.message}`,
      );
    }

    return { success: true };
  }
}
