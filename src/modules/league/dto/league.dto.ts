import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export const AGE_GROUPS = [
  'U9',
  'U10',
  'U11',
  'U12',
  'U13',
  'U14',
  'U15',
  'U16',
] as const;

export const REGISTRATION_STATUSES = [
  'pending_payment',
  'confirmed',
  'waitlist',
  'withdrawn',
  'submitted',
] as const;

/** Public registration submitted from the /league page. */
export class RegisterForLeagueDto {
  @ApiPropertyOptional({
    description:
      'Season to register for. Omitted from the public form — the active season is used.',
  })
  @IsOptional()
  @IsInt()
  seasonId?: number;

  @ApiProperty({ enum: AGE_GROUPS, example: 'U13' })
  @IsIn(AGE_GROUPS as unknown as string[])
  ageGroup: string;

  @ApiProperty({ example: 'Radin' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Charim' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: '2013-06-27' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: ['M', 'F'], example: 'M' })
  @IsIn(['M', 'F'])
  gender: string;

  @ApiProperty({ example: 'parent@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '647-355-3522' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '32 Donalbain Cres' })
  @IsString()
  @IsNotEmpty()
  address1: string;

  @ApiProperty({ example: 'Thornhill' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ default: 'ON' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiProperty({ example: 'L3T 3S2' })
  @IsString()
  @IsNotEmpty()
  postalCode: string;

  @ApiPropertyOptional({ default: 'Canada' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: "Parent / guardian's name" })
  @IsOptional()
  @IsString()
  parentName?: string;

  @ApiPropertyOptional({ description: 'Allergies, asthma, medication' })
  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  jerseySize?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  previousClub?: string;

  @ApiProperty({ description: 'Must be true — terms and refund policy' })
  @IsBoolean()
  consentTerms: boolean;

  @ApiPropertyOptional({ description: 'Consent to photos/video' })
  @IsOptional()
  @IsBoolean()
  consentPhoto?: boolean;

  @ApiPropertyOptional({
    description: 'Pay the whole fee now instead of two installments',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  payInFull?: boolean;

  @ApiPropertyOptional({
    description:
      'Existing player id. Sent by the parent dashboard so an existing member is not duplicated.',
  })
  @IsOptional()
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({
    example: 'indoor',
    description: 'Season URL key, when not registering for the active season.',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description:
      'True when the player has never trained with the academy. Seasons that set a new-player rate charge it instead of the member rate.',
  })
  @IsOptional()
  @IsBoolean()
  isNewPlayer?: boolean;
}

/** Register an existing player from the parent dashboard (details prefilled). */
export class PortalRegisterDto {
  @ApiProperty({ example: 12, description: 'One of the logged-in parent\'s players' })
  @IsInt()
  userId: number;

  @ApiProperty({ enum: AGE_GROUPS, example: 'U13' })
  @IsIn(AGE_GROUPS as unknown as string[])
  ageGroup: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  payInFull?: boolean;

  @ApiProperty()
  @IsBoolean()
  consentTerms: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  consentPhoto?: boolean;

  // Anything missing from the member record is asked for once, here.
  @ApiPropertyOptional() @IsOptional() @IsString() address1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateOfBirth?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() medicalNotes?: string;
}

/**
 * A parent correcting their own family's details from the dashboard.
 *
 * Email is deliberately absent: it is how the family signs in, and letting it
 * be changed here would hand one family's players to another account.
 */
export class UpdatePlayerDetailsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional({ example: '2013-06-27' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: ['M', 'F'] })
  @IsOptional()
  @IsIn(['M', 'F'])
  gender?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() parentName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() medicalNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emergencyContactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emergencyPhone?: string;
}

/** A parent adding a player the academy has never had on file. */
export class PortalAddPlayerDto {
  @ApiProperty() @IsString() @IsNotEmpty() firstName: string;
  @ApiProperty() @IsString() @IsNotEmpty() lastName: string;

  @ApiProperty({ example: '2013-06-27' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: ['M', 'F'] })
  @IsIn(['M', 'F'])
  gender: string;

  @ApiProperty() @IsString() @IsNotEmpty() phone: string;
  @ApiProperty() @IsString() @IsNotEmpty() address1: string;
  @ApiProperty() @IsString() @IsNotEmpty() city: string;
  @ApiProperty() @IsString() @IsNotEmpty() postalCode: string;

  @ApiPropertyOptional() @IsOptional() @IsString() parentName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() medicalNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() previousClub?: string;
}

export class UpdateRegistrationDto {
  @ApiPropertyOptional({ enum: REGISTRATION_STATUSES })
  @IsOptional()
  @IsIn(REGISTRATION_STATUSES as unknown as string[])
  status?: string;

  @ApiPropertyOptional({ example: 'Pars FC U13' })
  @IsOptional()
  @IsString()
  teamName?: string;

  @ApiPropertyOptional({ enum: ['PISL', 'YRSL'] })
  @IsOptional()
  @IsIn(['PISL', 'YRSL'])
  league?: string;

  @ApiPropertyOptional({ enum: ['PLAYER', 'Coach', 'Manager'] })
  @IsOptional()
  @IsIn(['PLAYER', 'Coach', 'Manager'])
  teamRole?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() ageGroup?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() adminNote?: string;

  // Correcting a typo before the roster is filed must be possible.
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateOfBirth?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['M', 'F']) gender?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() province?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
}

export class RecordInstallmentDto {
  @ApiProperty({ enum: [1, 2], example: 1 })
  @IsIn([1, 2])
  installment: number;

  @ApiPropertyOptional({
    description: 'Defaults to the amount still owed for that installment',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    enum: ['etransfer', 'cash', 'cheque', 'stripe', 'other'],
    default: 'etransfer',
  })
  @IsOptional()
  @IsIn(['etransfer', 'cash', 'cheque', 'stripe', 'other'])
  method?: string;

  @ApiPropertyOptional({ description: 'e-Transfer confirmation number' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Back-date a payment taken earlier' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateSeasonDto {
  @ApiProperty({ example: 'Winter League 2026/27' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'indoor',
    description: "URL key for the public page: 'indoor' is served at /indoor.",
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ enum: ['league', 'indoor'], default: 'league' })
  @IsOptional()
  @IsIn(['league', 'indoor'])
  kind?: string;

  @ApiPropertyOptional({ example: 'Indoor Season 2026/27' })
  @IsOptional()
  @IsString()
  tagline?: string;

  @ApiPropertyOptional({ example: 'Covers March & April' })
  @IsOptional()
  @IsString()
  paymentCoversNote?: string;

  @ApiPropertyOptional({ example: 380, description: 'Held-spot deposit' })
  @IsOptional()
  @IsNumber()
  depositAmount?: number;

  @ApiPropertyOptional({
    example: 380,
    description: "A new player's first two months, charged up front",
  })
  @IsOptional()
  @IsNumber()
  firstTermAmount?: number;

  @ApiPropertyOptional({
    example: 75,
    description: 'One-time uniform, paid online and collected at first practice',
  })
  @IsOptional()
  @IsNumber()
  uniformFee?: number;

  @ApiPropertyOptional({
    example: 835,
    description:
      'Override for what a new player pays. Normally left out and summed from the three amounts above.',
  })
  @IsOptional()
  @IsNumber()
  newPlayerFee?: number;

  @ApiPropertyOptional({ enum: [1, 2], default: 2 })
  @IsOptional()
  @IsIn([1, 2])
  installmentCount?: number;

  @ApiPropertyOptional({ example: 'U9,U10,U11,U12,U13,U14,U15,U16' })
  @IsOptional()
  @IsString()
  ageGroups?: string;

  @ApiPropertyOptional({ example: '2026-10-15' })
  @IsOptional()
  @IsDateString()
  startsOn?: string;

  @ApiPropertyOptional({ example: '2026-08-25' })
  @IsOptional()
  @IsDateString()
  firstPaymentDue?: string;

  @ApiPropertyOptional({ example: '2026-09-20' })
  @IsOptional()
  @IsDateString()
  secondPaymentDue?: string;

  @ApiPropertyOptional({ example: 900 })
  @IsOptional()
  @IsNumber()
  feeTotal?: number;

  @ApiPropertyOptional({ example: 1100 })
  @IsOptional()
  @IsNumber()
  feeLate?: number;

  @ApiPropertyOptional({
    example: '2026-08-25',
    description: 'Date the late fee starts. Defaults to firstPaymentDue.',
  })
  @IsOptional()
  @IsDateString()
  lateFeeFrom?: string;

  @ApiPropertyOptional({ example: 875 })
  @IsOptional()
  @IsNumber()
  feePayInFull?: number;

  @ApiPropertyOptional({ example: 18 })
  @IsOptional()
  @IsInt()
  capacityPerGroup?: number;

  @ApiPropertyOptional({
    example: 'U9:12,U16:20',
    description: 'Per-age-group roster caps, comma separated',
  })
  @IsOptional()
  @IsString()
  capacityOverrides?: string;

  @ApiPropertyOptional({
    enum: ['count', 'threshold', 'status', 'hidden'],
    default: 'threshold',
    description:
      'How remaining spots are shown to parents. threshold = exact number only once it is low.',
  })
  @IsOptional()
  @IsIn(['count', 'threshold', 'status', 'hidden'])
  spotsDisplay?: string;

  @ApiPropertyOptional({
    example: 6,
    description: 'At or below this many spots, show the exact number',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  spotsThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentInstructions?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  registrationOpen?: boolean;
}

export class BookTrialDto {
  @ApiProperty() @IsString() @IsNotEmpty() firstName: string;
  @ApiProperty() @IsString() @IsNotEmpty() lastName: string;

  @ApiPropertyOptional({ example: '2013-10-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: ['M', 'F'] })
  @IsOptional()
  @IsIn(['M', 'F'])
  gender?: string;

  @ApiProperty({ example: 'U13' })
  @IsString()
  @IsNotEmpty()
  ageGroup: string;

  @ApiProperty() @IsString() @IsNotEmpty() parentName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @IsNotEmpty() phone: string;

  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() previousClub?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() position?: string;
  @ApiPropertyOptional({ example: 'Weeknights after 6pm' })
  @IsOptional()
  @IsString()
  preferredWhen?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() howHeard?: string;
}

export class UpdateTrialDto {
  @ApiPropertyOptional({
    enum: ['booked', 'attended', 'no_show', 'offered', 'joined', 'declined'],
  })
  @IsOptional()
  @IsIn(['booked', 'attended', 'no_show', 'offered', 'joined', 'declined'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coachNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}
