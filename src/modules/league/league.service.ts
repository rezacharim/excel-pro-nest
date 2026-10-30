import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';

import { LeagueSeason } from './entities/league-season.entity';
import {
  LeagueRegistration,
  LeagueRegistrationStatus,
} from './entities/league-registration.entity';
import { TrialBooking } from './entities/trial-booking.entity';
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
  AdminCreateRegistrationDto,
  BookTrialDto,
  CreateSeasonDto,
  PortalRegisterDto,
  RecordInstallmentDto,
  RegisterForLeagueDto,
  UpdateRegistrationDto,
  UpdateTrialDto,
  SendTrialInvitationDto,
  SendImodelOfferDto,
} from './dto/league.dto';
import {
  offerUrl,
  trialIdFromOfferToken,
} from '../../common/email/offer-token';

/** Statuses that occupy a roster spot. */
const OCCUPYING: LeagueRegistrationStatus[] = [
  'pending_payment',
  'confirmed',
  'submitted',
];

/**
 * The I-Model Team's summer season. Created automatically (once) when the
 * server starts, so it appears in Dashboard → League without anyone having
 * to set it up; every value can be changed afterwards in Season settings.
 *
 * Prices confirmed by Reza (2026-10-28): $1,200, or $1,050 early bird when
 * paid in full before February 2027. Registration is by invitation after a
 * trial. Never active: the "active" season is the one the rest of the site
 * treats as the league, and the I-Model page always asks for it by slug.
 */
const IMODEL_SLUG = 'imodel';

/** Which season registration (and installment) a payment counts towards. */
export interface PaymentLink {
  registrationId: number;
  seasonName: string;
  ageGroup: string;
  installment: 1 | 2;
}

const IMODEL_SEASON: Partial<LeagueSeason> = {
  name: 'I-Model Team Summer 2027',
  slug: IMODEL_SLUG,
  kind: 'imodel',
  tagline: 'I-Model Team · Summer 2027',
  paymentCoversNote: 'I-Model Team, Summer 2027 season',
  ageGroups: 'U13,U14,U15,U16',
  startsOn: null,
  firstPaymentDue: '2027-01-31',
  secondPaymentDue: null,
  // Early bird is the on-time fee; the regular fee is the "late" one, from
  // February 1. isLate() compares with ">", so January 31 is still early.
  feeTotal: 1050,
  feeLate: 1200,
  lateFeeFrom: '2027-01-31',
  feePayInFull: null,
  installmentCount: 1,
  capacityPerGroup: 18,
  spotsDisplay: 'hidden',
  paymentInstructions:
    "Send your Interac e-Transfer to Excelpro.Etransfer@gmail.com with the player's full name and age group in the message.",
  registrationOpen: true,
  isActive: false,
};

@Injectable()
export class LeagueService implements OnModuleInit {
  private readonly logger = new Logger(LeagueService.name);

  constructor(
    @InjectRepository(LeagueSeason)
    private readonly seasonRepo: Repository<LeagueSeason>,
    @InjectRepository(LeagueRegistration)
    private readonly registrationRepo: Repository<LeagueRegistration>,
    @InjectRepository(TrialBooking)
    private readonly trialRepo: Repository<TrialBooking>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly mailService: MailService,
  ) {}

  async onModuleInit() {
    try {
      const existing = await this.seasonRepo.findOne({
        where: { slug: IMODEL_SLUG },
      });
      if (!existing) {
        await this.seasonRepo.save(this.seasonRepo.create(IMODEL_SEASON));
        this.logger.log('Created the I-Model Team season');
      }
    } catch (error) {
      // Two cold starts at once: the unique slug stops a second copy.
      this.logger.warn(`I-Model season check skipped: ${error.message}`);
    }
  }

  // ------------------------------------------------------------------
  // Seasons
  // ------------------------------------------------------------------

  async getActiveSeason(): Promise<LeagueSeason> {
    const season = await this.seasonRepo.findOne({
      where: { isActive: true },
      order: { id: 'DESC' },
    });
    if (!season) {
      throw new NotFoundException('No active league season');
    }
    return season;
  }

  /** A season addressed by its public URL key, e.g. 'indoor'. */
  async getSeasonBySlug(slug: string): Promise<LeagueSeason> {
    const season = await this.seasonRepo.findOne({ where: { slug } });
    if (!season) {
      throw new NotFoundException(`No season found at /${slug}`);
    }
    return season;
  }

  async listSeasons(): Promise<LeagueSeason[]> {
    return this.seasonRepo.find({ order: { id: 'DESC' } });
  }

  async createSeason(dto: CreateSeasonDto): Promise<LeagueSeason> {
    // Only one season takes registrations at a time, otherwise the public
    // form has no single answer to "which season am I signing up for?".
    await this.seasonRepo.update({ isActive: true }, { isActive: false });
    const season = this.seasonRepo.create({
      name: dto.name.trim(),
      ageGroups: dto.ageGroups ?? 'U9,U10,U11,U12,U13,U14,U15,U16',
      startsOn: dto.startsOn ?? null,
      firstPaymentDue: dto.firstPaymentDue ?? null,
      secondPaymentDue: dto.secondPaymentDue ?? null,
      feeTotal: dto.feeTotal ?? 900,
      feeLate: dto.feeLate ?? 1100,
      lateFeeFrom: dto.lateFeeFrom ?? dto.firstPaymentDue ?? null,
      feePayInFull: dto.feePayInFull ?? null,
      capacityPerGroup: dto.capacityPerGroup ?? 18,
      capacityOverrides: dto.capacityOverrides ?? null,
      depositAmount: dto.depositAmount ?? null,
      firstTermAmount: dto.firstTermAmount ?? null,
      uniformFee: dto.uniformFee ?? null,
      slug: dto.slug ?? null,
      kind: dto.kind ?? 'league',
      tagline: dto.tagline ?? null,
      paymentCoversNote: dto.paymentCoversNote ?? null,
      newPlayerFee: dto.newPlayerFee ?? null,
      installmentCount: dto.installmentCount ?? 2,
      spotsDisplay: dto.spotsDisplay ?? 'threshold',
      spotsThreshold: dto.spotsThreshold ?? 6,
      paymentInstructions: dto.paymentInstructions ?? null,
      registrationOpen: dto.registrationOpen ?? true,
      isActive: true,
    });
    return this.seasonRepo.save(season);
  }

  async updateSeason(
    id: number,
    dto: Partial<CreateSeasonDto>,
  ): Promise<LeagueSeason> {
    const season = await this.seasonRepo.findOne({ where: { id } });
    if (!season) throw new NotFoundException('Season not found');
    Object.assign(season, {
      ...dto,
      name: dto.name?.trim() ?? season.name,
    });
    return this.seasonRepo.save(season);
  }

  /**
   * What the public /league page needs: the season, and how many spots are
   * left in each age group. Showing a real number is the single most
   * effective thing on that page — "4 spots left" converts, "register now"
   * does not.
   */
  async getPublicSeason(slug?: string) {
    const season = slug
      ? await this.getSeasonBySlug(slug)
      : await this.getActiveSeason();
    const groups = this.ageGroupsOf(season);

    const rows = await this.registrationRepo
      .createQueryBuilder('r')
      .select('r.ageGroup', 'ageGroup')
      .addSelect('COUNT(*)', 'taken')
      .where('r.seasonId = :seasonId', { seasonId: season.id })
      .andWhere('r.status IN (:...statuses)', { statuses: OCCUPYING })
      .andWhere("r.teamRole = 'PLAYER'")
      .groupBy('r.ageGroup')
      .getRawMany<{ ageGroup: string; taken: string }>();

    const taken = new Map(rows.map((r) => [r.ageGroup, Number(r.taken)]));
    const overrides = this.capacityOverridesOf(season);

    // Real social proof: how many families signed up in the last week. A
    // number that GROWS motivates; a big "spots left" reads as "no rush".
    const since = new Date(Date.now() - 7 * 86400000);
    const recentSignups = await this.registrationRepo
      .createQueryBuilder('r')
      .where('r.seasonId = :seasonId', { seasonId: season.id })
      .andWhere('r.createdAt >= :since', { since })
      .andWhere("r.teamRole = 'PLAYER'")
      .getCount();

    return {
      recentSignups,
      spotsDisplay: season.spotsDisplay,
      slug: season.slug,
      kind: season.kind,
      tagline: season.tagline,
      paymentCoversNote: season.paymentCoversNote,
      ...this.feeBreakdown(season),
      installmentCount: season.installmentCount,
      id: season.id,
      name: season.name,
      startsOn: season.startsOn,
      firstPaymentDue: season.firstPaymentDue,
      secondPaymentDue: season.secondPaymentDue,
      feeTotal: Number(season.feeTotal),
      feeLate: Number(season.feeLate),
      lateFeeFrom: season.lateFeeFrom ?? season.firstPaymentDue,
      feePayInFull:
        season.feePayInFull === null ? null : Number(season.feePayInFull),
      registrationOpen: season.registrationOpen,
      isLateNow:
        this.isLate(season) && Number(season.feeLate) > Number(season.feeTotal),
      paymentInstructions: season.paymentInstructions,
      ageGroups: groups.map((ageGroup) => {
        const capacity = overrides.get(ageGroup) ?? season.capacityPerGroup;
        const used = taken.get(ageGroup) ?? 0;
        const spotsLeft = Math.max(capacity - used, 0);
        return {
          ageGroup,
          capacity,
          taken: used,
          spotsLeft,
          // The page renders whatever it is handed, so the wording can be
          // changed from the admin screen without a deploy.
          ...this.presentSpots(season, capacity, spotsLeft),
        };
      }),
    };
  }

  /**
   * What each kind of family pays, itemised. The page renders these lines
   * verbatim, so changing a price or renaming a line is a database edit.
   */
  private feeBreakdown(season: LeagueSeason) {
    const num = (v: number | null | undefined) =>
      v === null || v === undefined ? null : Number(v);

    const deposit = num(season.depositAmount) ?? Number(season.feeTotal);
    const firstTerm = num(season.firstTermAmount);
    const uniform = num(season.uniformFee);

    const memberLines = [
      { label: season.paymentCoversNote || 'Reservation', amount: deposit },
    ];

    const newLines = [...memberLines];
    if (firstTerm)
      newLines.push({ label: 'First 2 months', amount: firstTerm });
    if (uniform) {
      newLines.push({
        label: 'Uniform (one-time, collected at first practice)',
        amount: uniform,
      });
    }

    const computedNew = newLines.reduce((sum, l) => sum + l.amount, 0);
    const newPlayerFee = num(season.newPlayerFee) ?? computedNew;

    return {
      memberFee: deposit,
      memberLines,
      newPlayerFee,
      newPlayerLines: newLines,
      depositAmount: deposit,
      firstTermAmount: firstTerm,
      uniformFee: uniform,
    };
  }

  private capacityOverridesOf(season: LeagueSeason): Map<string, number> {
    const map = new Map<string, number>();
    for (const part of (season.capacityOverrides || '').split(',')) {
      const [group, value] = part.split(':').map((x) => x.trim());
      const n = parseInt(value, 10);
      if (group && !isNaN(n) && n > 0) map.set(group, n);
    }
    return map;
  }

  /**
   * Turns "spots left" into something a parent acts on.
   *
   * The honest problem with a raw count is that "18 spots left" tells a
   * family they can safely decide next month, which is exactly what an
   * academy with a payment deadline does not want. The fix is not a made-up
   * number — parents in the same WhatsApp group compare notes, and a figure
   * that never moves is worse than no figure. The fix is to say nothing
   * precise until the number is genuinely low, and to let the deadline do
   * the work until then.
   */
  private presentSpots(
    season: LeagueSeason,
    capacity: number,
    spotsLeft: number,
  ): { label: string; tone: 'ok' | 'medium' | 'low' | 'full'; show: boolean } {
    if (spotsLeft <= 0) {
      return { label: 'Full - waiting list', tone: 'full', show: true };
    }

    const filled = capacity > 0 ? (capacity - spotsLeft) / capacity : 0;
    const plural = spotsLeft === 1 ? '' : 's';
    const exact = `${spotsLeft} spot${plural} left`;

    switch (season.spotsDisplay) {
      case 'hidden':
        return { label: '', tone: 'ok', show: false };

      case 'count':
        return {
          label: exact,
          tone: spotsLeft <= season.spotsThreshold ? 'low' : 'ok',
          show: true,
        };

      case 'status':
        if (filled >= 0.8)
          return { label: 'Almost full', tone: 'low', show: true };
        if (filled >= 0.5)
          return { label: 'Filling fast', tone: 'medium', show: true };
        return { label: 'Open', tone: 'ok', show: true };

      case 'threshold':
      default:
        return spotsLeft <= season.spotsThreshold
          ? { label: exact, tone: 'low', show: true }
          : filled >= 0.5
            ? { label: 'Filling fast', tone: 'medium', show: true }
            : { label: 'Spots available', tone: 'ok', show: true };
    }
  }

  // ------------------------------------------------------------------
  // Registration
  // ------------------------------------------------------------------

  /** Public registration from the /league page. */
  async register(dto: RegisterForLeagueDto, ip: string | null = null) {
    const season = dto.seasonId
      ? await this.seasonRepo.findOne({ where: { id: dto.seasonId } })
      : dto.slug
        ? await this.getSeasonBySlug(dto.slug)
        : await this.getActiveSeason();
    if (!season) throw new NotFoundException('Season not found');
    if (!season.registrationOpen) {
      throw new BadRequestException(
        'Registration for this season is closed. Please contact the academy.',
      );
    }
    if (!dto.consentTerms) {
      throw new BadRequestException('You must accept the terms to register.');
    }
    // The I-Model Team is selective: only a family offered a spot after a
    // trial can register, through the personal link in the offer email.
    const offeredTrial =
      season.kind === 'imodel'
        ? await this.assertImodelOffer(dto.offerToken)
        : null;
    dto.ageGroup = this.assertAgeGroupOpen(season, dto.ageGroup);

    const email = dto.email.trim().toLowerCase();
    let user: User | null;
    // Whether the academy has had this player before decides which rate the
    // season charges. Worked out here rather than trusted from the browser.
    let isNewPlayer = false;
    if (dto.userId) {
      user = await this.userRepo.findOne({ where: { id: dto.userId } });
    } else {
      const found = await this.findOrCreatePlayer(dto, email);
      user = found.user;
      isNewPlayer = found.isNew;
    }

    await this.assertNotAlreadyRegistered(season.id, {
      userId: user?.id ?? null,
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: dto.dateOfBirth,
    });

    const referrer = await this.resolveReferrer(
      dto.referrerId,
      email,
      isNewPlayer,
    );

    // CASL: the separate, unticked "send me emails" box. Ticking it again
    // after an unsubscribe is a fresh, express consent.
    if (dto.consentMarketing && user) {
      user.marketingOptIn = true;
      user.marketingConsentAt = new Date();
      user.marketingOptOutAt = null;
      await this.userRepo.save(user);
    }

    const registration = await this.buildRegistration(season, {
      isNewPlayer,
      referredByUserId: referrer?.id ?? null,
      userId: user?.id ?? null,
      ageGroup: dto.ageGroup,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email,
      dateOfBirth: dto.dateOfBirth,
      gender: dto.gender,
      phone: dto.phone.trim(),
      address1: dto.address1.trim(),
      city: dto.city.trim(),
      province: (dto.province || 'ON').trim(),
      postalCode: this.normalisePostalCode(dto.postalCode),
      country: (dto.country || 'Canada').trim(),
      parentName: dto.parentName?.trim() ?? null,
      medicalNotes: dto.medicalNotes?.trim() ?? null,
      jerseySize: dto.jerseySize ?? null,
      previousClub: dto.previousClub?.trim() ?? null,
      consentTerms: true,
      consentPhoto: dto.consentPhoto ?? false,
      payInFull: dto.payInFull ?? false,
      ...this.agreementFields(dto, ip),
    });

    if (offeredTrial) {
      try {
        offeredTrial.status = 'joined';
        offeredTrial.convertedUserId = user?.id ?? null;
        await this.trialRepo.save(offeredTrial);
      } catch (error) {
        this.logger.error(`Could not mark trial as joined: ${error.message}`);
      }
    }

    await this.sendRegistrationEmail(season, registration);
    await this.notifyAcademy(season, registration, {
      via: offeredTrial ? 'I-Model offer link' : 'website form',
      isNewPlayer,
      referredBy: referrer
        ? `${referrer.parent_name || 'Family of'} ${referrer.parent_name ? `(${referrer.fullname})` : referrer.fullname}`.trim()
        : undefined,
    });
    return this.toRegistrationView(registration, season);
  }

  /**
   * Referral program: who shared the link a new family registered through.
   * Counts only when the player is new to the academy, the referring player
   * exists, and the family is not referring itself (same email).
   */
  private async resolveReferrer(
    referrerId: number | undefined,
    registrantEmail: string,
    isNewPlayer: boolean,
  ): Promise<User | null> {
    if (!referrerId || !isNewPlayer) return null;
    const ref = await this.userRepo.findOne({ where: { id: referrerId } });
    if (!ref) return null;
    if ((ref.email || '').trim().toLowerCase() === registrantEmail) return null;
    return ref;
  }

  /** Admin: every registration that came through a family's referral link. */
  async listReferrals() {
    const rows = await this.registrationRepo.find({
      where: { referredByUserId: Not(IsNull()) },
      order: { createdAt: 'DESC' },
    });
    const ids = [...new Set(rows.map((r) => r.referredByUserId as number))];
    const referrers = ids.length
      ? await this.userRepo.find({ where: { id: In(ids) } })
      : [];
    const byId = new Map(referrers.map((u) => [u.id, u]));
    return rows.map((r) => {
      const ref = byId.get(r.referredByUserId as number);
      return {
        registrationId: r.id,
        seasonId: r.seasonId,
        friend: `${r.firstName} ${r.lastName}`.trim(),
        friendAgeGroup: r.ageGroup,
        friendParent: r.parentName,
        friendStatus: r.status,
        createdAt: r.createdAt,
        rewardStatus: r.referralRewardStatus,
        referrer: ref
          ? {
              userId: ref.id,
              player: ref.fullname,
              parent: ref.parent_name,
              email: ref.email,
              phone: ref.phone_number,
            }
          : null,
      };
    });
  }

  /**
   * What the parent accepted, and the proof of it.
   *
   * The version string matters more than the booleans: it is how the exact
   * wording a family agreed to can be reconstructed years later. A minor can
   * bring a claim until well after they turn 18, so these rows outlive the
   * season. Never overwrite them on a later edit.
   */
  private agreementFields(
    dto: {
      agreementVersion?: string;
      parentSignature?: string;
      acceptedConcussion?: boolean;
    },
    ip: string | null,
  ) {
    return {
      agreementVersion: dto.agreementVersion ?? null,
      parentSignature: dto.parentSignature?.trim() || null,
      acceptedConcussion: dto.acceptedConcussion ?? null,
      agreementAcceptedAt: dto.agreementVersion ? new Date() : null,
      agreementIp: ip,
    };
  }

  /**
   * Register an existing player from the parent dashboard. Everything the
   * league needs is already on the member record, so the parent confirms
   * rather than retypes — which is also why the exported roster stops being
   * full of typos.
   */
  async portalRegister(
    parentEmail: string,
    dto: PortalRegisterDto,
    ip: string | null = null,
  ) {
    const season = await this.getActiveSeason();
    if (!season.registrationOpen) {
      throw new BadRequestException('Registration for this season is closed.');
    }
    if (!dto.consentTerms) {
      throw new BadRequestException('You must accept the terms to register.');
    }

    dto.ageGroup = this.assertAgeGroupOpen(season, dto.ageGroup);

    const user = await this.userRepo.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Player not found');
    if ((user.email || '').toLowerCase() !== parentEmail.toLowerCase()) {
      // Never let one parent register another family's child.
      throw new NotFoundException('Player not found');
    }

    const dateOfBirth = dto.dateOfBirth ?? user.dateOfBirth ?? null;
    if (!dateOfBirth) {
      throw new BadRequestException(
        'This player has no date of birth on file, and the league requires one. Please add it.',
      );
    }

    const address1 = dto.address1 ?? user.address ?? '';
    const city = dto.city ?? user.city ?? '';
    const postalCode = dto.postalCode ?? user.postalCode ?? '';
    if (!address1 || !city || !postalCode) {
      throw new BadRequestException(
        'The league needs a full address. Please complete address, city and postal code.',
      );
    }

    await this.assertNotAlreadyRegistered(season.id, {
      userId: user.id,
      firstName: null,
      lastName: null,
      dateOfBirth: null,
    });

    const [firstName, ...rest] = (user.fullname || '').trim().split(/\s+/);
    const registration = await this.buildRegistration(season, {
      userId: user.id,
      ageGroup: dto.ageGroup,
      firstName: firstName || user.fullname,
      lastName: rest.join(' ') || '-',
      email: (user.email || parentEmail).toLowerCase(),
      dateOfBirth,
      gender: this.toLeagueGender(user.gender),
      phone: user.phone_number || '',
      address1,
      city,
      province: 'ON',
      postalCode: this.normalisePostalCode(postalCode),
      country: 'Canada',
      parentName: user.parent_name ?? null,
      medicalNotes: dto.medicalNotes ?? user.medicalNotes ?? null,
      jerseySize: user.tShirtSize ?? null,
      previousClub: null,
      consentTerms: true,
      consentPhoto: dto.consentPhoto ?? false,
      payInFull: dto.payInFull ?? false,
      ...this.agreementFields(dto, ip),
    });

    // Keep the member record in step with anything the parent just supplied.
    if (dto.dateOfBirth) user.dateOfBirth = dto.dateOfBirth;
    if (dto.address1) user.address = dto.address1;
    if (dto.city) user.city = dto.city;
    if (dto.postalCode) user.postalCode = dto.postalCode;
    if (dto.medicalNotes !== undefined) {
      user.medicalNotes = dto.medicalNotes || user.medicalNotes;
    }
    await this.userRepo.save(user);

    await this.sendRegistrationEmail(season, registration);
    await this.notifyAcademy(season, registration, {
      via: 'parent account',
      isNewPlayer: false,
    });
    return this.toRegistrationView(registration, season);
  }

  /**
   * An admin adding a registration by hand.
   *
   * Deliberately more permissive than the public form: a closed season is
   * accepted, and consent is taken as given because the admin is recording a
   * decision the family already made somewhere else — on the phone, by
   * e-transfer, or through the wrong form on the website.
   *
   * Everything downstream is identical to a public registration: same fee
   * rules, same late check, same waitlist behaviour when an age group is full,
   * same roster export. This is a different door into the same room, not a
   * second kind of registration.
   */
  async adminCreateRegistration(dto: AdminCreateRegistrationDto) {
    const season = dto.seasonId
      ? await this.seasonRepo.findOne({ where: { id: dto.seasonId } })
      : await this.getActiveSeason();
    if (!season) throw new NotFoundException('Season not found');
    dto.ageGroup = this.assertAgeGroupOpen(season, dto.ageGroup);

    let user: User | null = null;
    let isNewPlayer = false;

    if (dto.userId) {
      user = await this.userRepo.findOne({ where: { id: dto.userId } });
      if (!user) throw new NotFoundException('Player not found');
    }

    // Whatever the member record holds, overridden by anything typed in.
    const [memberFirst, ...memberRest] = (user?.fullname || '')
      .trim()
      .split(/\s+/);
    const firstName = (dto.firstName ?? memberFirst ?? '').trim();
    const lastName = (dto.lastName ?? memberRest.join(' ') ?? '').trim();
    const email = (dto.email ?? user?.email ?? '').trim().toLowerCase();
    const phone = (dto.phone ?? user?.phone_number ?? '').trim();
    const dateOfBirth = dto.dateOfBirth ?? user?.dateOfBirth ?? null;
    const address1 = (dto.address1 ?? user?.address ?? '').trim();
    const city = (dto.city ?? user?.city ?? '').trim();
    const postalCode = (dto.postalCode ?? user?.postalCode ?? '').trim();
    const gender = dto.gender ?? this.toLeagueGender(user?.gender);

    // Named all at once. Being told about one missing field per save, five
    // saves running, is how a form earns a reputation.
    const missing = [
      !firstName && 'first name',
      !lastName && 'last name',
      !email && 'email',
      !phone && 'phone',
      !dateOfBirth && 'date of birth',
      !address1 && 'address',
      !city && 'city',
      !postalCode && 'postal code',
    ].filter(Boolean) as string[];
    if (missing.length) {
      throw new BadRequestException(
        `The league roster needs ${missing.join(', ')}. ${
          dto.userId
            ? "This player's record does not have them — add them here and they will be saved back to the member record."
            : 'Please complete the form.'
        }`,
      );
    }

    if (!user) {
      // Same lookup the public form uses, so entering a family that already
      // exists links to their record rather than creating a duplicate.
      const found = await this.findOrCreatePlayer(
        {
          ageGroup: dto.ageGroup,
          firstName,
          lastName,
          dateOfBirth,
          gender,
          email,
          phone,
          address1,
          city,
          province: dto.province || 'ON',
          postalCode,
          country: dto.country || 'Canada',
          parentName: dto.parentName,
          medicalNotes: dto.medicalNotes,
          jerseySize: dto.jerseySize,
          consentTerms: true,
        } as RegisterForLeagueDto,
        email,
      );
      user = found.user;
      isNewPlayer = found.isNew;
    } else {
      // Fill gaps in the member record from what was just typed, so the next
      // registration does not ask again.
      user.dateOfBirth = user.dateOfBirth || dateOfBirth;
      user.address = user.address || address1;
      user.city = user.city || city;
      user.postalCode = user.postalCode || postalCode;
      user.phone_number = user.phone_number || phone;
      if (dto.medicalNotes) user.medicalNotes = dto.medicalNotes;
      await this.userRepo.save(user);
    }

    await this.assertNotAlreadyRegistered(season.id, {
      userId: user?.id ?? null,
      firstName,
      lastName,
      dateOfBirth,
    });

    const registration = await this.buildRegistration(season, {
      isNewPlayer,
      userId: user?.id ?? null,
      ageGroup: dto.ageGroup,
      firstName,
      lastName,
      email,
      dateOfBirth,
      gender,
      phone,
      address1,
      city,
      province: (dto.province || 'ON').trim(),
      postalCode: this.normalisePostalCode(postalCode),
      country: (dto.country || 'Canada').trim(),
      parentName: dto.parentName?.trim() ?? user?.parent_name ?? null,
      medicalNotes: dto.medicalNotes?.trim() ?? user?.medicalNotes ?? null,
      jerseySize: dto.jerseySize ?? user?.tShirtSize ?? null,
      previousClub: dto.previousClub?.trim() ?? null,
      consentTerms: true,
      consentPhoto: dto.consentPhoto ?? false,
      payInFull: dto.payInFull ?? false,
      adminNote: dto.adminNote?.trim() || 'Added from the dashboard',
    });

    // Off by choice when the admin is recording something that already
    // happened — a second "thanks for registering" email a week late reads
    // like the academy lost track.
    if (dto.sendEmail !== false) {
      await this.sendRegistrationEmail(season, registration);
    }

    return this.toRegistrationView(registration, season);
  }

  /** The league block on the parent dashboard. */
  async portalOverview(parentEmail: string) {
    const season = await this.seasonRepo.findOne({
      where: { isActive: true },
      order: { id: 'DESC' },
    });
    const players = await this.userRepo.find({
      where: { email: parentEmail.toLowerCase() },
      order: { id: 'ASC' },
    });

    const registrations = season
      ? await this.registrationRepo.find({
          where: {
            seasonId: season.id,
            userId: In(players.map((p) => p.id).concat(-1)),
          },
        })
      : [];

    const byUser = new Map(registrations.map((r) => [r.userId, r]));

    return {
      season: season
        ? {
            id: season.id,
            name: season.name,
            startsOn: season.startsOn,
            firstPaymentDue: season.firstPaymentDue,
            secondPaymentDue: season.secondPaymentDue,
            registrationOpen: season.registrationOpen,
            feeTotal: Number(season.feeTotal),
            paymentInstructions: season.paymentInstructions,
          }
        : null,
      players: players.map((p) => {
        const reg = byUser.get(p.id);
        const [firstName, ...rest] = (p.fullname || '').trim().split(/\s+/);
        return {
          userId: p.id,
          fullname: p.fullname,
          // Split out so the edit form has something to put in each box.
          firstName: firstName || '',
          lastName: rest.join(' '),
          dateOfBirth: p.dateOfBirth,
          gender: this.toLeagueGender(p.gender),
          phone: p.phone_number,
          address1: p.address,
          city: p.city,
          postalCode: p.postalCode,
          parentName: p.parent_name,
          medicalNotes: p.medicalNotes,
          emergencyContactName: p.emergencyContactName,
          emergencyPhone: p.emergencyPhone,
          // What the dashboard needs to decide between "Register" and a
          // status badge with an outstanding balance.
          registration: reg ? this.toRegistrationView(reg, season) : null,
          missingForLeague: this.missingLeagueFields(p),
          // Once a roster is filed with the league the snapshot is frozen, so
          // the dashboard must stop offering to edit it.
          detailsLocked: reg?.status === 'submitted',
        };
      }),
    };
  }

  /**
   * A parent correcting their own details. Families change address, and a
   * name typed at 11pm on a phone is often wrong — making them phone the
   * academy to fix it is how bad data ends up on a league roster.
   */
  async portalUpdatePlayer(
    parentEmail: string,
    userId: number,
    dto: Partial<{
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      gender: string;
      phone: string;
      address1: string;
      city: string;
      postalCode: string;
      parentName: string;
      medicalNotes: string;
      emergencyContactName: string;
      emergencyPhone: string;
    }>,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (
      !user ||
      (user.email || '').toLowerCase() !== parentEmail.toLowerCase()
    ) {
      throw new NotFoundException('Player not found');
    }

    const first = dto.firstName?.trim();
    const last = dto.lastName?.trim();
    if (first || last) {
      const [curFirst, ...curRest] = (user.fullname || '').trim().split(/\s+/);
      user.fullname =
        `${first || curFirst || ''} ${last ?? curRest.join(' ')}`.trim();
    }
    if (dto.dateOfBirth) user.dateOfBirth = dto.dateOfBirth;
    if (dto.gender) user.gender = this.mapGender(dto.gender);
    if (dto.phone) user.phone_number = dto.phone.trim();
    if (dto.address1) user.address = dto.address1.trim();
    if (dto.city) user.city = dto.city.trim();
    if (dto.postalCode)
      user.postalCode = this.normalisePostalCode(dto.postalCode);
    if (dto.parentName) user.parent_name = dto.parentName.trim();
    if (dto.medicalNotes !== undefined)
      user.medicalNotes = dto.medicalNotes || null;
    if (dto.emergencyContactName) {
      user.emergencyContactName = dto.emergencyContactName.trim();
    }
    if (dto.emergencyPhone) user.emergencyPhone = dto.emergencyPhone.trim();
    await this.userRepo.save(user);

    // Keep any registration that has NOT been filed with the league in step.
    // A submitted roster is deliberately left alone — see the entity comment.
    const season = await this.seasonRepo.findOne({
      where: { isActive: true },
      order: { id: 'DESC' },
    });
    if (season) {
      const reg = await this.registrationRepo.findOne({
        where: { seasonId: season.id, userId: user.id },
      });
      if (reg && reg.status !== 'submitted') {
        const [rFirst, ...rRest] = (user.fullname || '').trim().split(/\s+/);
        reg.firstName = rFirst || reg.firstName;
        reg.lastName = rRest.join(' ') || reg.lastName;
        if (user.dateOfBirth) reg.dateOfBirth = user.dateOfBirth;
        reg.gender = this.toLeagueGender(user.gender);
        if (user.phone_number) reg.phone = user.phone_number;
        if (user.address) reg.address1 = user.address;
        if (user.city) reg.city = user.city;
        if (user.postalCode) reg.postalCode = user.postalCode;
        if (user.parent_name) reg.parentName = user.parent_name;
        reg.medicalNotes = user.medicalNotes;
        await this.registrationRepo.save(reg);
      }
    }

    return this.portalOverview(parentEmail);
  }

  /**
   * A family the academy already trains but has never had on file — the
   * player joined at the field, not through the website. They should be able
   * to add themselves rather than be told to phone in.
   */
  async portalAddPlayer(
    parentEmail: string,
    dto: {
      firstName: string;
      lastName: string;
      dateOfBirth: string;
      gender: string;
      phone: string;
      address1: string;
      city: string;
      postalCode: string;
      parentName?: string;
      medicalNotes?: string;
    },
  ) {
    const email = parentEmail.toLowerCase();
    const fullname = `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim();

    const existing = await this.userRepo.findOne({
      where: { email, fullname },
    });
    if (existing) {
      throw new ConflictException(
        `${fullname} is already on your account. Refresh the page to see them.`,
      );
    }

    const player = this.userRepo.create({
      fullname,
      parent_name: dto.parentName?.trim() || fullname,
      phone_number: dto.phone.trim(),
      email,
      dateOfBirth: dto.dateOfBirth,
      gender: this.mapGender(dto.gender),
      address: dto.address1.trim(),
      city: dto.city.trim(),
      postalCode: this.normalisePostalCode(dto.postalCode),
      emergencyContactName: dto.parentName?.trim() || fullname,
      emergencyPhone: dto.phone.trim(),
      medicalNotes: dto.medicalNotes?.trim() || null,
      membershipStatus: 'active',
      attendanceStatus: 'attending',
      activePlan: SubscriptionPlan.free,
      policy: true,
      subscriptionCounter: 0,
      height: 0,
      weight: 0,
      experienceLevel: ExperienceLevel.BEGINNER,
      tShirtSize: TShirtSize.YM,
      shortSize: TShirtSize.YM,
      jacketSize: TShirtSize.YM,
      pantsSize: TShirtSize.YM,
    });
    await this.userRepo.save(player);
    return this.portalOverview(email);
  }

  // ------------------------------------------------------------------
  // Admin
  // ------------------------------------------------------------------

  async listRegistrations(filters: {
    seasonId?: number;
    ageGroup?: string;
    status?: string;
    search?: string;
  }) {
    const season = filters.seasonId
      ? await this.seasonRepo.findOne({ where: { id: filters.seasonId } })
      : await this.seasonRepo.findOne({
          where: { isActive: true },
          order: { id: 'DESC' },
        });
    if (!season) return { season: null, rows: [], totals: null };

    const qb = this.registrationRepo
      .createQueryBuilder('r')
      .where('r.seasonId = :seasonId', { seasonId: season.id });

    if (filters.ageGroup) {
      qb.andWhere('r.ageGroup = :ageGroup', { ageGroup: filters.ageGroup });
    }
    if (filters.status) {
      qb.andWhere('r.status = :status', { status: filters.status });
    }
    if (filters.search) {
      qb.andWhere(
        '(LOWER(r.firstName) LIKE :q OR LOWER(r.lastName) LIKE :q OR LOWER(r.email) LIKE :q)',
        { q: `%${filters.search.toLowerCase()}%` },
      );
    }

    const rows = await qb
      .orderBy('r.ageGroup', 'ASC')
      .addOrderBy('r.lastName', 'ASC')
      .getMany();

    const collected = rows.reduce(
      (sum, r) =>
        sum +
        (r.firstPaidAt ? Number(r.firstAmount) : 0) +
        (r.secondPaidAt ? Number(r.secondAmount) : 0),
      0,
    );
    const expected = rows
      .filter((r) => r.status !== 'withdrawn')
      .reduce((sum, r) => sum + Number(r.feeTotal), 0);

    return {
      // The settings travel with the list so the dashboard can show what a
      // family registering today would be charged, and edit it, without a
      // second request for something it already had to load.
      season: {
        id: season.id,
        name: season.name,
        feeTotal: Number(season.feeTotal),
        feeLate: Number(season.feeLate),
        feePayInFull:
          season.feePayInFull === null ? null : Number(season.feePayInFull),
        firstPaymentDue: season.firstPaymentDue,
        secondPaymentDue: season.secondPaymentDue,
        lateFeeFrom: season.lateFeeFrom,
        capacityPerGroup: season.capacityPerGroup,
        registrationOpen: season.registrationOpen,
        installmentCount: season.installmentCount,
        // So the dashboard can switch between League and Indoor and offer
        // each season's own age groups.
        slug: season.slug ?? null,
        kind: season.kind ?? null,
        ageGroups: this.ageGroupsOf(season),
      },
      totals: {
        registrations: rows.length,
        confirmed: rows.filter((r) => r.status === 'confirmed').length,
        pending: rows.filter((r) => r.status === 'pending_payment').length,
        waitlist: rows.filter((r) => r.status === 'waitlist').length,
        expected: Number(expected.toFixed(2)),
        collected: Number(collected.toFixed(2)),
        outstanding: Number((expected - collected).toFixed(2)),
      },
      rows: rows.map((r) => this.toRegistrationView(r, season)),
    };
  }

  async updateRegistration(id: number, dto: UpdateRegistrationDto) {
    const registration = await this.registrationRepo.findOne({ where: { id } });
    if (!registration) throw new NotFoundException('Registration not found');

    // Not a column — it decides what to write, so it must not reach the row.
    const { resetFeesToSeason, ...fields } = dto;

    if (resetFeesToSeason) {
      // Refused rather than silently reconciled: once money is recorded, the
      // payment row and the installment amount have to agree, and quietly
      // moving one under the other is how a ledger stops being trustworthy.
      if (registration.firstPaidAt || registration.secondPaidAt) {
        throw new ConflictException(
          'A payment is already recorded against this registration. Undo the payment first, or set the amounts by hand.',
        );
      }

      const season = await this.seasonRepo.findOne({
        where: { id: registration.seasonId },
      });
      if (!season) throw new NotFoundException('Season not found');

      const singlePayment = season.installmentCount === 1;
      const payInFull =
        fields.payInFull ?? registration.payInFull ?? singlePayment;
      // The season's headline on-time fee. Whether this player was new to the
      // academy is not recorded on the row, so a new-player rate cannot be
      // reconstructed here — set it by hand in the rare case it differs.
      const feeTotal =
        payInFull && !singlePayment && season.feePayInFull !== null
          ? Number(season.feePayInFull)
          : Number(season.feeTotal);
      const firstAmount = payInFull
        ? feeTotal
        : Number((feeTotal / 2).toFixed(2));

      Object.assign(registration, {
        isLate: false,
        feeTotal,
        firstAmount,
        secondAmount: payInFull
          ? 0
          : Number((feeTotal - firstAmount).toFixed(2)),
        firstDueDate: season.firstPaymentDue,
        secondDueDate: payInFull ? null : season.secondPaymentDue,
      });
    }

    // Applied after the reset so an amount typed in the same request wins.
    Object.assign(registration, {
      ...fields,
      postalCode: fields.postalCode
        ? this.normalisePostalCode(fields.postalCode)
        : registration.postalCode,
    });

    if (dto.status === 'submitted' && !registration.submittedAt) {
      registration.submittedAt = new Date();
    }

    return this.toRegistrationView(
      await this.awardReferral(await this.registrationRepo.save(registration)),
    );
  }

  /**
   * Referral program: the moment a referred family's spot is confirmed (paid),
   * the family who referred them has earned a private session with Coach
   * Reza Abedian. They are emailed, the academy is alerted, and the reward
   * shows in Dashboard → Referrals to book. Runs once per registration.
   */
  private async awardReferral(
    r: LeagueRegistration,
  ): Promise<LeagueRegistration> {
    if (
      r.status !== 'confirmed' ||
      !r.referredByUserId ||
      r.referralRewardStatus
    ) {
      return r;
    }
    r.referralRewardStatus = 'earned';
    const saved = await this.registrationRepo.save(r);
    try {
      const ref = await this.userRepo.findOne({
        where: { id: r.referredByUserId },
      });
      if (ref?.email) {
        const earned = await this.registrationRepo.count({
          where: {
            referredByUserId: In(
              (
                await this.userRepo.find({
                  where: { email: ref.email },
                  select: ['id'],
                })
              ).map((u) => u.id),
            ),
            referralRewardStatus: Not(IsNull()),
          },
        });
        await this.mailService.sendReferralRewardEarned(
          ref.email,
          ref.parent_name || null,
          ref.fullname,
          r.firstName,
          earned,
        );
      }
      await this.mailService.sendAdminAlert(
        `Referral reward earned: ${ref?.fullname ?? 'a family'}`,
        'A family earned a private session',
        `<strong>${r.firstName} ${r.lastName}</strong> has paid for the indoor season through a referral link. The referring family has earned a private session with Coach Reza Abedian (one-on-one or small group, at his private gym). Agree a date and time with them and mark it in Dashboard &rarr; Referrals.`,
        {
          'New player': `${r.firstName} ${r.lastName} (${r.ageGroup})`,
          'Referred by': ref
            ? `${ref.parent_name || ''} (${ref.fullname})`.trim()
            : `player #${r.referredByUserId}`,
          'Referrer email': ref?.email,
          'Referrer phone': ref?.phone_number,
        },
      );
    } catch (error) {
      this.logger.error(`Referral reward email failed: ${error.message}`);
    }
    return saved;
  }

  /**
   * Mark one installment received. A real `payments` row is created here and
   * nowhere else, so the money dashboard only ever counts money that arrived.
   */
  async recordInstallment(id: number, dto: RecordInstallmentDto) {
    const registration = await this.registrationRepo.findOne({ where: { id } });
    if (!registration) throw new NotFoundException('Registration not found');

    const first = dto.installment === 1;
    if (first && registration.firstPaidAt) {
      throw new ConflictException('First installment is already recorded');
    }
    if (!first && registration.secondPaidAt) {
      throw new ConflictException('Second installment is already recorded');
    }

    const amount =
      dto.amount ??
      Number(first ? registration.firstAmount : registration.secondAmount);
    const paidAtRaw = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const paidAt = isNaN(paidAtRaw.getTime()) ? new Date() : paidAtRaw;

    let paymentId: number | null = null;
    if (registration.userId) {
      const user = await this.userRepo.findOne({
        where: { id: registration.userId },
      });
      const plan = this.planForAgeGroup(
        registration.ageGroup,
        user?.activePlan,
      );
      const season = await this.seasonRepo.findOne({
        where: { id: registration.seasonId },
      });
      const payment = this.paymentRepo.create({
        amount,
        currency: 'cad',
        status: PaymentStatus.ACTIVE,
        plan,
        method: dto.method ?? 'etransfer',
        type: 'league',
        periodLabel: `${season?.name ?? 'League'} - ${first ? '1st' : '2nd'} payment`,
        note:
          [dto.reference ? `Ref ${dto.reference}` : null, dto.note]
            .filter(Boolean)
            .join(' | ') || null,
        userId: registration.userId,
        isFirstTimePayment: false,
        createdAt: paidAt,
      });
      const saved = await this.paymentRepo.save(payment);
      paymentId = saved.id;
    }

    if (first) {
      registration.firstPaidAt = paidAt;
      registration.firstPaymentId = paymentId;
      registration.firstAmount = amount;
      // Paying the deposit is what actually holds the roster spot.
      if (registration.status === 'pending_payment') {
        registration.status = 'confirmed';
      }
    } else {
      registration.secondPaidAt = paidAt;
      registration.secondPaymentId = paymentId;
      registration.secondAmount = amount;
    }

    const saved = await this.awardReferral(
      await this.registrationRepo.save(registration),
    );

    try {
      await this.mailService.sendPaymentReceived(
        saved.email,
        `${saved.firstName} ${saved.lastName}`,
        amount,
        null,
        {
          type: 'league',
          periodLabel: `${first ? '1st' : '2nd'} league payment`,
        },
      );
    } catch (error) {
      this.logger.error(`League receipt email failed: ${error.message}`);
    }

    return this.toRegistrationView(saved);
  }

  /**
   * Count an already-saved payment towards a season registration, without
   * creating a second payments row. Used when money is recorded from
   * Dashboard → Memberships, so a family's payment is entered once and shows
   * on both screens. Fills the first unpaid installment.
   *
   * The indoor season is stored as one installment of the full fee; when a
   * family pays part of it now (e.g. $455 of $835) the rest becomes the
   * second installment, so the balance can be recorded later.
   */
  async linkExistingPayment(
    registrationId: number,
    payment: Payment,
    paidAt: Date,
  ): Promise<LeagueRegistration> {
    const registration = await this.registrationRepo.findOne({
      where: { id: registrationId },
    });
    if (!registration) throw new NotFoundException('Registration not found');
    if (registration.userId !== payment.userId) {
      throw new BadRequestException(
        'That season registration belongs to a different player',
      );
    }
    const amount = Number(payment.amount);
    const fee = Number(registration.feeTotal);

    if (!registration.firstPaidAt) {
      registration.firstPaidAt = paidAt;
      registration.firstPaymentId = payment.id;
      registration.firstAmount = amount;
      const rest = Number((fee - amount).toFixed(2));
      if (!registration.secondPaidAt && rest > 0) {
        registration.secondAmount = rest;
      }
      if (registration.status === 'pending_payment') {
        registration.status = 'confirmed';
      }
    } else if (!registration.secondPaidAt) {
      registration.secondPaidAt = paidAt;
      registration.secondPaymentId = payment.id;
      registration.secondAmount = amount;
    } else {
      throw new ConflictException(
        'Both payments for this season are already recorded',
      );
    }

    return this.awardReferral(await this.registrationRepo.save(registration));
  }

  /** The registration (and which installment) each payment counts towards. */
  async findLinkForPayments(
    paymentIds: number[],
  ): Promise<Map<number, PaymentLink>> {
    const map = new Map<number, PaymentLink>();
    if (!paymentIds.length) return map;
    const regs = await this.registrationRepo.find({
      where: [
        { firstPaymentId: In(paymentIds) },
        { secondPaymentId: In(paymentIds) },
      ],
    });
    const seasons = await this.seasonRepo.find();
    const nameOf = new Map(seasons.map((s) => [s.id, s.name]));
    for (const r of regs) {
      const base = {
        registrationId: r.id,
        seasonName: nameOf.get(r.seasonId) ?? 'Season',
        ageGroup: r.ageGroup,
      };
      if (r.firstPaymentId && paymentIds.includes(r.firstPaymentId)) {
        map.set(r.firstPaymentId, { ...base, installment: 1 });
      }
      if (r.secondPaymentId && paymentIds.includes(r.secondPaymentId)) {
        map.set(r.secondPaymentId, { ...base, installment: 2 });
      }
    }
    return map;
  }

  /**
   * Stop a payment counting towards any registration (it is being deleted or
   * moved). The payments row itself is left to the caller.
   */
  async unlinkPayment(paymentId: number): Promise<void> {
    const regs = await this.registrationRepo.find({
      where: [{ firstPaymentId: paymentId }, { secondPaymentId: paymentId }],
    });
    for (const r of regs) {
      if (r.firstPaymentId === paymentId) {
        r.firstPaidAt = null;
        r.firstPaymentId = null;
        if (r.status === 'confirmed' && !r.secondPaidAt) {
          r.status = 'pending_payment';
        }
      }
      if (r.secondPaymentId === paymentId) {
        r.secondPaidAt = null;
        r.secondPaymentId = null;
      }
      await this.registrationRepo.save(r);
    }
  }

  /** Keep a linked installment in step when its payment is edited. */
  async syncLinkedPayment(
    paymentId: number,
    amount: number,
    paidAt: Date | null,
  ): Promise<void> {
    const regs = await this.registrationRepo.find({
      where: [{ firstPaymentId: paymentId }, { secondPaymentId: paymentId }],
    });
    for (const r of regs) {
      if (r.firstPaymentId === paymentId) {
        r.firstAmount = amount;
        if (paidAt) r.firstPaidAt = paidAt;
      }
      if (r.secondPaymentId === paymentId) {
        r.secondAmount = amount;
        if (paidAt) r.secondPaidAt = paidAt;
      }
      await this.registrationRepo.save(r);
    }
  }

  /** Undo a mis-keyed payment. */
  async reverseInstallment(id: number, installment: number) {
    const registration = await this.registrationRepo.findOne({ where: { id } });
    if (!registration) throw new NotFoundException('Registration not found');
    const first = installment === 1;
    const paymentId = first
      ? registration.firstPaymentId
      : registration.secondPaymentId;

    if (paymentId) {
      await this.paymentRepo.delete({ id: paymentId });
    }
    if (first) {
      registration.firstPaidAt = null;
      registration.firstPaymentId = null;
      if (registration.status === 'confirmed') {
        registration.status = 'pending_payment';
      }
    } else {
      registration.secondPaidAt = null;
      registration.secondPaymentId = null;
    }
    return this.toRegistrationView(
      await this.registrationRepo.save(registration),
    );
  }

  /** Who still owes money — drives the reminder messages. */
  async outstanding(seasonId?: number) {
    const season = seasonId
      ? await this.seasonRepo.findOne({ where: { id: seasonId } })
      : await this.getActiveSeason();
    if (!season) return [];

    const rows = await this.registrationRepo.find({
      where: {
        seasonId: season.id,
        status: Not(In(['withdrawn', 'waitlist'])),
      },
      order: { ageGroup: 'ASC', lastName: 'ASC' },
    });

    const today = this.today();
    return rows
      .flatMap((r) => {
        const items: any[] = [];
        if (!r.firstPaidAt) {
          items.push({
            installment: 1,
            amount: Number(r.firstAmount),
            due: r.firstDueDate,
          });
        }
        if (!r.secondPaidAt && !r.payInFull) {
          items.push({
            installment: 2,
            amount: Number(r.secondAmount),
            due: r.secondDueDate,
          });
        }
        return items.map((i) => ({
          registrationId: r.id,
          player: `${r.firstName} ${r.lastName}`,
          ageGroup: r.ageGroup,
          parentName: r.parentName,
          email: r.email,
          phone: r.phone,
          status: r.status,
          ...i,
          daysOverdue: i.due
            ? Math.floor((Date.parse(today) - Date.parse(i.due)) / 86400000)
            : null,
        }));
      })
      .sort((a, b) => (b.daysOverdue ?? -9999) - (a.daysOverdue ?? -9999));
  }

  /** Rows for the roster export, in the league sheet's own order. */
  async rosterRows(filters: {
    seasonId?: number;
    ageGroup?: string;
    includePending?: boolean;
  }) {
    const season = filters.seasonId
      ? await this.seasonRepo.findOne({ where: { id: filters.seasonId } })
      : await this.getActiveSeason();
    if (!season) throw new NotFoundException('Season not found');

    const statuses: LeagueRegistrationStatus[] = filters.includePending
      ? ['confirmed', 'submitted', 'pending_payment']
      : ['confirmed', 'submitted'];

    const where: any = { seasonId: season.id, status: In(statuses) };
    if (filters.ageGroup) where.ageGroup = filters.ageGroup;

    const rows = await this.registrationRepo.find({ where });

    // Players first (numbered), then staff (unnumbered) — the order the
    // league's import sheet expects.
    const rank = (r: LeagueRegistration) =>
      r.teamRole === 'PLAYER' ? 0 : r.teamRole === 'Coach' ? 1 : 2;
    rows.sort(
      (a, b) =>
        a.ageGroup.localeCompare(b.ageGroup) ||
        rank(a) - rank(b) ||
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName),
    );

    return { season, rows };
  }

  // ------------------------------------------------------------------
  // Trials
  // ------------------------------------------------------------------

  async bookTrial(dto: BookTrialDto) {
    const booking = this.trialRepo.create({
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      dateOfBirth: dto.dateOfBirth ?? null,
      gender: dto.gender ?? null,
      ageGroup: dto.ageGroup.trim(),
      parentName: dto.parentName.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone.trim(),
      city: dto.city?.trim() ?? null,
      previousClub: dto.previousClub?.trim() ?? null,
      position: dto.position ?? null,
      preferredWhen: dto.preferredWhen?.trim() ?? null,
      howHeard: (await this.referralNote(dto)) ?? dto.howHeard?.trim() ?? null,
      status: 'booked',
      agreementVersion: dto.agreementVersion ?? null,
      parentSignature: dto.parentSignature?.trim() || null,
      agreementAcceptedAt: dto.agreementVersion ? new Date() : null,
      acceptedConcussion: dto.acceptedConcussion ?? null,
      consentPhoto: dto.consentPhoto ?? null,
      consentMarketing: dto.consentMarketing ?? null,
    });
    const saved = await this.trialRepo.save(booking);

    try {
      await this.mailService.sendTrialRequestReceived(
        saved.email,
        `${saved.firstName} ${saved.lastName}`,
        saved.ageGroup,
        saved.preferredWhen,
      );
    } catch (error) {
      this.logger.error(`Trial confirmation email failed: ${error.message}`);
    }

    // Until now nobody at the academy was told a trial had been booked — the
    // request sat in a table with no screen. The same alert as a new
    // registration goes to the notification addresses in Settings.
    try {
      const player = `${saved.firstName} ${saved.lastName}`.trim();
      const kind = /i-?model/i.test(saved.preferredWhen ?? '')
        ? 'I-Model trial'
        : 'Free session';
      await this.mailService.sendAdminAlert(
        `${kind} request: ${player} (${saved.ageGroup})`,
        `New ${kind.toLowerCase()} request`,
        `<strong>${player}</strong> asked for a ${kind.toLowerCase()} on the website. Pick a date in Dashboard &rarr; Trials and press Send invitation.`,
        {
          Player: player,
          'Age group': saved.ageGroup,
          'Date of birth': saved.dateOfBirth,
          Preferred: saved.preferredWhen,
          'Current / last club': saved.previousClub,
          Position: saved.position,
          Parent: saved.parentName,
          Email: saved.email,
          Phone: saved.phone,
          City: saved.city,
          'Heard about us': saved.howHeard,
        },
      );
    } catch (error) {
      this.logger.error(`Trial admin alert failed: ${error.message}`);
    }

    return saved;
  }

  /**
   * Invitation type 2: tell the family exactly when and where to come. Saves
   * the date on the booking so the dashboard shows who has been invited.
   */
  async inviteTrial(id: number, dto: SendTrialInvitationDto) {
    const trial = await this.trialRepo.findOne({ where: { id } });
    if (!trial) throw new NotFoundException('Trial booking not found');
    const when = new Date(dto.scheduledFor);
    if (isNaN(when.getTime())) {
      throw new BadRequestException('Invalid session date');
    }
    const ok = await this.mailService.sendTrialInvitation(
      trial.email,
      `${trial.firstName} ${trial.lastName}`.trim(),
      trial.parentName,
      {
        kind: dto.kind,
        whenText: dto.whenText,
        where: dto.where,
        address: dto.address,
        mapsUrl: dto.mapsUrl,
        note: dto.note ?? null,
      },
    );
    if (!ok) {
      throw new BadRequestException(
        'The email could not be sent. Please try again, or call the family.',
      );
    }
    trial.scheduledFor = when;
    return this.trialRepo.save(trial);
  }

  /**
   * I-Model Team: offer a spot after the trial. Emails the family a personal
   * link to register and pay, and returns the link too so it can also be
   * sent on WhatsApp.
   */
  async sendImodelOffer(id: number, dto: SendImodelOfferDto) {
    const trial = await this.trialRepo.findOne({ where: { id } });
    if (!trial) throw new NotFoundException('Trial booking not found');
    const season = await this.getSeasonBySlug(IMODEL_SLUG);
    if (!season.registrationOpen) {
      throw new BadRequestException(
        'I-Model registration is closed. Open it in Dashboard → League → I-Model Team → Season settings first.',
      );
    }
    const url = offerUrl(trial.id);
    const late = this.isLate(season);
    const ok = await this.mailService.sendImodelOffer(
      trial.email,
      `${trial.firstName} ${trial.lastName}`.trim(),
      trial.parentName,
      {
        url,
        seasonName: season.name,
        regular: Number(season.feeLate),
        earlyBird: late ? null : Number(season.feeTotal),
        earlyBirdBy: late ? null : season.lateFeeFrom,
        note: dto.note?.trim() || null,
      },
    );
    if (!ok) {
      throw new BadRequestException(
        'The email could not be sent. Please try again, or send the family the link yourself.',
      );
    }
    trial.status = 'offered';
    trial.offerSentAt = new Date();
    const saved = await this.trialRepo.save(trial);
    return { ...saved, offerUrl: url };
  }

  /** Public: who an offer link is for, so the form opens already filled in. */
  async getImodelOffer(token: string) {
    const trial = await this.assertImodelOffer(token);
    return {
      firstName: trial.firstName,
      lastName: trial.lastName,
      dateOfBirth: trial.dateOfBirth,
      gender: trial.gender,
      ageGroup: trial.ageGroup,
      parentName: trial.parentName,
      email: trial.email,
      phone: trial.phone,
      city: trial.city,
      alreadyRegistered: trial.status === 'joined',
    };
  }

  private async assertImodelOffer(token?: string | null) {
    const id = trialIdFromOfferToken(token);
    const trial = id
      ? await this.trialRepo.findOne({ where: { id } })
      : null;
    if (!trial || !trial.offerSentAt || trial.status === 'declined') {
      throw new BadRequestException(
        'The I-Model Team is by invitation after a trial. Please use the personal link from your offer email, or book a trial at excelproso.com/trials. Questions? Call 647-703-7821.',
      );
    }
    return trial;
  }

  /**
   * "Bring a friend": a booking made through a family's shared link records
   * who sent it, e.g. "Friend of Neda Rahimi (Kian Rahimi)". An id that does
   * not match a player is ignored and the family's own answer is kept.
   */
  private async referralNote(dto: BookTrialDto): Promise<string | null> {
    if (!dto.referrerId) return null;
    const ref = await this.userRepo.findOne({ where: { id: dto.referrerId } });
    if (!ref) return null;
    const parent = (ref.parent_name || '').trim();
    return parent
      ? `Friend of ${parent} (${ref.fullname})`
      : `Friend of ${ref.fullname}'s family`;
  }

  async listTrials(status?: string) {
    const where = status ? { status: status as any } : {};
    return this.trialRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async updateTrial(id: number, dto: UpdateTrialDto) {
    const trial = await this.trialRepo.findOne({ where: { id } });
    if (!trial) throw new NotFoundException('Trial booking not found');
    if (dto.status) trial.status = dto.status as any;
    if (dto.coachNotes !== undefined) trial.coachNotes = dto.coachNotes || null;
    if (dto.scheduledFor) trial.scheduledFor = new Date(dto.scheduledFor);
    return this.trialRepo.save(trial);
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private ageGroupsOf(season: LeagueSeason): string[] {
    return (season.ageGroups || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /**
   * The age group must be one the season actually offers. Each season sets
   * its own list (league: U9…U16, indoor: U6-U9…U15-U18), so this is checked
   * here rather than against a fixed list in the DTO — a fixed list is what
   * blocked every indoor registration in September 2026.
   *
   * Matching ignores case, spaces and the kind of dash, so "u5 – u8" from an
   * old cached page still lands on "U6-U9". Returns the season's spelling.
   */
  private assertAgeGroupOpen(season: LeagueSeason, ageGroup: string): string {
    const key = (v: string) =>
      (v || '')
        .toUpperCase()
        .replace(/[\s\u2010-\u2015_]/g, (c) => (/\s/.test(c) ? '' : '-'));
    const groups = this.ageGroupsOf(season);
    // Groups renamed for 2026/27. A page cached before the rename may still
    // send the old name; land it on the new group when the season has it.
    const RENAMED: Record<string, string> = {
      'U5-U8': 'U6-U9',
      'U9-U12': 'U10-U12',
    };
    const match =
      groups.find((g) => key(g) === key(ageGroup)) ??
      groups.find((g) => key(g) === RENAMED[key(ageGroup)]);
    if (!match) {
      throw new BadRequestException(
        `Please choose one of the age groups for ${season.name}: ${groups.join(', ')}.`,
      );
    }
    return match;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * A family registering after the deadline must not be emailed "pay by
   * September 20" on September 27. Give them the date they registered on;
   * the reminder job and the dashboard treat it like any other due date.
   */
  private notBeforeToday(date: string | null): string | null {
    if (!date) return date;
    const today = this.today();
    return date < today ? today : date;
  }

  private isLate(season: LeagueSeason): boolean {
    const from = season.lateFeeFrom ?? season.firstPaymentDue;
    if (!from) return false;
    return this.today() > from;
  }

  private normalisePostalCode(value: string): string {
    const compact = (value || '').toUpperCase().replace(/\s+/g, '');
    return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)
      ? `${compact.slice(0, 3)} ${compact.slice(3)}`
      : (value || '').trim();
  }

  /** The league sheet only accepts M or F. */
  private toLeagueGender(gender?: string | null): string {
    return (gender || '').toLowerCase().startsWith('f') ? 'F' : 'M';
  }

  private mapGender(value?: string | null): Gender {
    const v = (value || '').toLowerCase();
    if (v.startsWith('f')) return Gender.FEMALE;
    if (v.startsWith('m')) return Gender.MALE;
    return Gender.PREFER_NOT_TO_SAY;
  }

  private planForAgeGroup(
    ageGroup: string,
    fallback?: string | null,
  ): SubscriptionPlan {
    // First number only: "U6-U9" is the U5_U8 plan, not "69".
    // The plan keys are historical DB enum values; parents see them as
    // U6–U9 / U10–U12 / U13–U14 / U15–U18 (2026/27 groups), so U9 belongs
    // to the first plan.
    const n = parseInt((ageGroup || '').match(/\d+/)?.[0] ?? '', 10);
    if (!isNaN(n)) {
      if (n <= 9) return SubscriptionPlan.U5_U8;
      if (n <= 12) return SubscriptionPlan.U9_U12;
      if (n <= 14) return SubscriptionPlan.U13_U14;
      return SubscriptionPlan.U15_U18;
    }
    return Object.values(SubscriptionPlan).includes(
      fallback as SubscriptionPlan,
    )
      ? (fallback as SubscriptionPlan)
      : SubscriptionPlan.free;
  }

  private missingLeagueFields(user: User): string[] {
    const missing: string[] = [];
    if (!user.dateOfBirth) missing.push('dateOfBirth');
    if (!user.address) missing.push('address');
    if (!user.city) missing.push('city');
    if (!user.postalCode) missing.push('postalCode');
    if (!user.phone_number) missing.push('phone');
    return missing;
  }

  private async assertNotAlreadyRegistered(
    seasonId: number,
    who: {
      userId: number | null;
      firstName: string | null;
      lastName: string | null;
      dateOfBirth: string | null;
    },
  ) {
    if (who.userId) {
      const existing = await this.registrationRepo.findOne({
        where: {
          seasonId,
          userId: who.userId,
          status: Not('withdrawn' as any),
        },
      });
      if (existing) {
        throw new ConflictException(
          'This player is already registered for this season.',
        );
      }
      return;
    }
    if (who.firstName && who.lastName && who.dateOfBirth) {
      const existing = await this.registrationRepo.findOne({
        where: {
          seasonId,
          firstName: who.firstName.trim(),
          lastName: who.lastName.trim(),
          dateOfBirth: who.dateOfBirth,
          status: Not('withdrawn' as any),
        },
      });
      if (existing) {
        throw new ConflictException(
          'A registration already exists for this player. Contact the academy if this is wrong.',
        );
      }
    }
  }

  private async findOrCreatePlayer(
    dto: RegisterForLeagueDto,
    email: string,
  ): Promise<{ user: User; isNew: boolean }> {
    const fullname = `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim();

    const existing = await this.userRepo.findOne({
      where: { email, fullname },
    });
    if (existing) {
      // Fill in anything the member record was missing — the league form
      // asks for more than the short sign-up form does.
      existing.dateOfBirth = existing.dateOfBirth || dto.dateOfBirth;
      existing.address = existing.address || dto.address1;
      existing.city = existing.city || dto.city;
      existing.postalCode = existing.postalCode || dto.postalCode;
      existing.phone_number = existing.phone_number || dto.phone;
      if (dto.medicalNotes) existing.medicalNotes = dto.medicalNotes;
      return { user: await this.userRepo.save(existing), isNew: false };
    }

    const player = this.userRepo.create({
      fullname,
      parent_name: dto.parentName?.trim() || fullname,
      phone_number: dto.phone.trim(),
      email,
      dateOfBirth: dto.dateOfBirth,
      gender: this.mapGender(dto.gender),
      address: dto.address1.trim(),
      city: dto.city.trim(),
      postalCode: dto.postalCode.trim(),
      emergencyContactName: dto.parentName?.trim() || fullname,
      emergencyPhone: dto.phone.trim(),
      medicalNotes: dto.medicalNotes?.trim() || null,
      membershipStatus: 'active',
      attendanceStatus: 'attending',
      activePlan: this.planForAgeGroup(dto.ageGroup),
      policy: true,
      subscriptionCounter: 0,
      // Safe defaults for the NOT NULL columns the full sign-up form fills in.
      height: 0,
      weight: 0,
      experienceLevel: ExperienceLevel.BEGINNER,
      tShirtSize: (dto.jerseySize as TShirtSize) || TShirtSize.YM,
      shortSize: TShirtSize.YM,
      jacketSize: TShirtSize.YM,
      pantsSize: TShirtSize.YM,
    });
    return { user: await this.userRepo.save(player), isNew: true };
  }

  private async buildRegistration(
    season: LeagueSeason,
    data: Partial<LeagueRegistration> & {
      ageGroup: string;
      /** Not a column — decides which rate the season charges. */
      isNewPlayer?: boolean;
    },
  ): Promise<LeagueRegistration> {
    // A late registration pays the season's late surcharge on top of its own
    // rate. When feeLate is not above the normal fee (indoor: 380 / 380)
    // there is no surcharge, so the family is not "late" at all — previously
    // feeLate replaced the rate outright, which charged a new indoor player
    // $380 instead of $835 and emailed them about a late fee.
    const lateSurcharge = Math.max(
      0,
      Number(season.feeLate || 0) - Number(season.feeTotal || 0),
    );
    const late = this.isLate(season) && lateSurcharge > 0;
    // A one-payment season (the indoor deposit) is "pay in full" by nature.
    const singlePayment = season.installmentCount === 1;
    const payInFull = singlePayment || (data.payInFull ?? false);

    // A player the academy has never had on file pays the new-player rate
    // when the season sets one — for indoor that is the deposit plus their
    // first two months.
    const isNewPlayer = data.isNewPlayer === true;
    const fees = this.feeBreakdown(season);
    // The amount charged is the same number the page quoted — one source.
    const baseFee = isNewPlayer ? fees.newPlayerFee : fees.memberFee;

    const feeTotal = late
      ? baseFee + lateSurcharge
      : payInFull && !singlePayment && season.feePayInFull !== null
        ? Number(season.feePayInFull)
        : baseFee;

    const firstAmount = payInFull
      ? feeTotal
      : Number((feeTotal / 2).toFixed(2));
    const secondAmount = payInFull
      ? 0
      : Number((feeTotal - firstAmount).toFixed(2));

    // A full age group does not mean "turn the family away" — it means the
    // spot is not guaranteed, and the academy decides.
    const taken = await this.registrationRepo.count({
      where: {
        seasonId: season.id,
        ageGroup: data.ageGroup,
        teamRole: 'PLAYER',
        status: In(OCCUPYING),
      },
    });
    const status: LeagueRegistrationStatus =
      taken >= season.capacityPerGroup ? 'waitlist' : 'pending_payment';

    // isNewPlayer only chooses the rate; it is not a column on the row.
    const { isNewPlayer: _rateFlag, ...columns } = data;
    void _rateFlag;
    const registration = this.registrationRepo.create({
      ...columns,
      seasonId: season.id,
      teamRole: 'PLAYER',
      status,
      isLate: late,
      payInFull,
      feeTotal,
      firstAmount,
      secondAmount,
      firstDueDate: this.notBeforeToday(season.firstPaymentDue),
      secondDueDate: payInFull
        ? null
        : this.notBeforeToday(season.secondPaymentDue),
    });

    const savedRegistration = await this.registrationRepo.save(registration);

    // A family found by email but saved long ago with a placeholder plan
    // ("free") showed as "Not set" in Memberships even though the child had
    // just registered for a season. Give them the program their age group
    // belongs to; a real plan already on the record is left alone.
    if (data.userId) {
      try {
        const user = await this.userRepo.findOne({
          where: { id: data.userId },
        });
        const realPlans = [
          SubscriptionPlan.U5_U8,
          SubscriptionPlan.U9_U12,
          SubscriptionPlan.U13_U14,
          SubscriptionPlan.U15_U18,
        ] as string[];
        if (user && !realPlans.includes(user.activePlan as string)) {
          user.activePlan = this.planForAgeGroup(data.ageGroup);
          await this.userRepo.save(user);
        }
      } catch (error) {
        this.logger.error(
          `Could not set plan for user ${data.userId}: ${error.message}`,
        );
      }
    }

    return savedRegistration;
  }

  /**
   * Tell the academy (Dashboard → Settings → Notification emails) that a
   * family registered and how much to expect, with the exact e-transfer
   * message the parent was told to use — so the money can be matched.
   */
  private async notifyAcademy(
    season: LeagueSeason,
    r: LeagueRegistration,
    opts: { via: string; isNewPlayer: boolean; referredBy?: string },
  ) {
    try {
      const player = `${r.firstName} ${r.lastName}`.trim();
      const money = (n: number) => `$${Number(n || 0).toFixed(2)}`;
      await this.mailService.sendAdminAlert(
        `New registration: ${player} - ${season.name} ${r.ageGroup}`,
        'New registration',
        `<strong>${player}</strong> just registered for <strong>${season.name}</strong> (${r.ageGroup}) through the ${opts.via}.`,
        {
          Player: player,
          'Age group': r.ageGroup,
          'Date of birth': r.dateOfBirth,
          Parent: r.parentName,
          Email: r.email,
          Phone: r.phone,
          'New to the academy': opts.isNewPlayer
            ? 'Yes'
            : 'No (existing member)',
          ...(opts.referredBy
            ? {
                'Referred by': `${opts.referredBy} — private session reward once paid`,
              }
            : {}),
          Status:
            r.status === 'waitlist'
              ? 'Waiting list - age group full, told NOT to pay yet'
              : 'Awaiting payment',
          'Amount to expect now':
            r.status === 'waitlist' ? '-' : money(r.firstAmount),
          'Season total': money(r.feeTotal),
          'E-transfer message they were told to use': `${player} - ${r.ageGroup}`,
          'Where to record it':
            'Dashboard -> League -> choose the season -> Record payment',
        },
      );
    } catch (error) {
      this.logger.error(`Academy registration alert failed: ${error.message}`);
    }
  }

  private async sendRegistrationEmail(
    season: LeagueSeason,
    registration: LeagueRegistration,
  ) {
    try {
      await this.mailService.sendLeagueRegistrationReceived(
        registration.email,
        `${registration.firstName} ${registration.lastName}`,
        {
          seasonName: season.name,
          ageGroup: registration.ageGroup,
          waitlisted: registration.status === 'waitlist',
          feeTotal: Number(registration.feeTotal),
          firstAmount: Number(registration.firstAmount),
          firstDueDate: registration.firstDueDate,
          secondAmount: Number(registration.secondAmount),
          secondDueDate: registration.secondDueDate,
          isLate: registration.isLate,
          payInFull: registration.payInFull,
          priceNote:
            season.kind === 'imodel' ? this.imodelPriceNote(season, registration) : null,
        },
      );
    } catch (error) {
      this.logger.error(`League registration email failed: ${error.message}`);
    }
  }

  /** The early bird line in an I-Model registration email. */
  private imodelPriceNote(season: LeagueSeason, r: LeagueRegistration) {
    const money = (n: number) => `$${Number(n).toLocaleString('en-CA')}`;
    const by = season.lateFeeFrom
      ? new Date(`${season.lateFeeFrom}T12:00:00`).toLocaleDateString('en-CA', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : null;
    if (r.isLate || !by) {
      return `The fee for the ${season.name} is ${money(Number(season.feeLate))}, paid in full before the season starts.`;
    }
    return `Early bird price: ${money(Number(r.feeTotal))} when paid in full by ${by}. After that date the fee is ${money(Number(season.feeLate))}.`;
  }

  private toRegistrationView(
    r: LeagueRegistration,
    season?: LeagueSeason | null,
  ) {
    const paid =
      (r.firstPaidAt ? Number(r.firstAmount) : 0) +
      (r.secondPaidAt ? Number(r.secondAmount) : 0);
    return {
      id: r.id,
      seasonId: r.seasonId,
      seasonName: season?.name,
      userId: r.userId,
      ageGroup: r.ageGroup,
      teamName: r.teamName,
      league: r.league,
      teamRole: r.teamRole,
      player: `${r.firstName} ${r.lastName}`,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      phone: r.phone,
      dateOfBirth: r.dateOfBirth,
      gender: r.gender,
      address1: r.address1,
      city: r.city,
      province: r.province,
      postalCode: r.postalCode,
      country: r.country,
      parentName: r.parentName,
      status: r.status,
      isLate: r.isLate,
      payInFull: r.payInFull,
      feeTotal: Number(r.feeTotal),
      amountPaid: Number(paid.toFixed(2)),
      balance: Number((Number(r.feeTotal) - paid).toFixed(2)),
      installments: [
        {
          number: 1,
          amount: Number(r.firstAmount),
          dueDate: r.firstDueDate,
          paidAt: r.firstPaidAt,
        },
        {
          number: 2,
          amount: Number(r.secondAmount),
          dueDate: r.secondDueDate,
          paidAt: r.secondPaidAt,
        },
      ],
      medicalNotes: r.medicalNotes,
      adminNote: r.adminNote,
      submittedAt: r.submittedAt,
      createdAt: r.createdAt,
    };
  }
}
