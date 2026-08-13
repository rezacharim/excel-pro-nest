import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class HoldMembershipDto {
  @ApiPropertyOptional({
    description:
      'ISO date at which the membership should automatically resume. Omit for an indefinite hold.',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsISO8601()
  resumeAt?: string;

  @ApiPropertyOptional({ description: 'Internal note about the hold' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ExtendMembershipDto {
  @ApiProperty({ description: 'Number of days to extend the membership by' })
  @Type(() => Number)
  @IsInt()
  days: number;

  @ApiPropertyOptional({ description: 'Internal note about the extension' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SetRenewalDateDto {
  @ApiProperty({
    description:
      'The date this membership is actually paid up to. Used to correct records for payments taken outside the dashboard.',
    example: '2026-10-15',
  })
  @IsISO8601()
  date: string;

  @ApiPropertyOptional({
    description:
      'The date the current paid period started. Optional — set it when correcting a full period.',
    example: '2026-08-15',
  })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Internal note about the correction' })
  @IsOptional()
  @IsString()
  note?: string;
}

/** Actions that can be applied to many players at once. */
export const BULK_ACTIONS = [
  'stop',
  'reactivate',
  'suspend',
  'set-plan',
] as const;

export class BulkActionDto {
  @ApiProperty({ description: 'Players to apply the action to', type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  userIds: number[];

  @ApiProperty({ enum: BULK_ACTIONS })
  @IsIn(BULK_ACTIONS as unknown as string[])
  action: string;

  @ApiPropertyOptional({
    description: 'Suspension reason (required when action is suspend)',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Program, when action is set-plan' })
  @IsOptional()
  @IsIn(['U5_U8', 'U9_U12', 'U13_U14', 'U15_U18'])
  plan?: string;

  @ApiPropertyOptional({ description: 'Internal note stored on each player' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class QuickAddPlayerDto {
  @ApiProperty({ example: 'Sam Ahmadi' })
  @IsString()
  fullname: string;

  @ApiProperty({ example: 'Nina Ahmadi' })
  @IsString()
  parent_name: string;

  @ApiProperty({ example: '4165551234' })
  @IsString()
  phone_number: string;

  @ApiPropertyOptional({ example: 'parent@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ enum: ['U5_U8', 'U9_U12', 'U13_U14', 'U15_U18'] })
  @IsIn(['U5_U8', 'U9_U12', 'U13_U14', 'U15_U18'])
  activePlan: string;

  @ApiPropertyOptional({
    description: 'Date the membership is paid up to',
    example: '2026-10-15',
  })
  @IsOptional()
  @IsISO8601()
  currentSubscriptionEndDate?: string;

  @ApiPropertyOptional({ example: '2015-04-20' })
  @IsOptional()
  @IsISO8601()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: ['Male', 'Female', 'Prefer not to say'] })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: 'Private note about the player' })
  @IsOptional()
  @IsString()
  internalNote?: string;

  @ApiPropertyOptional({
    description: 'Allergies / medical information a coach must know',
  })
  @IsOptional()
  @IsString()
  medicalNotes?: string;
}

export class InviteParentsDto {
  @ApiProperty({ description: 'Players whose parents should be invited', type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  userIds: number[];

  @ApiPropertyOptional({
    description:
      'Send again to families already invited. Off by default so nobody is emailed twice by accident.',
  })
  @IsOptional()
  @IsBoolean()
  resend?: boolean;
}

/** Why an account was suspended. Shown to admins; only some are emailed. */
export const SUSPENSION_REASONS = [
  'late_payment',
  'discipline',
  'paperwork',
  'medical',
  'other',
] as const;

export class SuspendMembershipDto {
  @ApiProperty({
    description: 'Reason for the suspension',
    enum: SUSPENSION_REASONS,
    example: 'late_payment',
  })
  @IsIn(SUSPENSION_REASONS as unknown as string[])
  reason: string;

  @ApiPropertyOptional({
    description: 'Internal note with the details (never emailed to the parent)',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description:
      'Email the parent that the account is suspended. Defaults to true for payment reasons, false for sensitive ones (e.g. discipline) so you can call them first.',
  })
  @IsOptional()
  @IsBoolean()
  notifyParent?: boolean;
}

export class UpdatePlayerNotesDto {
  @ApiPropertyOptional({ description: 'Private note about this player/family' })
  @IsOptional()
  @IsString()
  internalNote?: string;

  @ApiPropertyOptional({
    description: 'How regularly the player attends',
    enum: ['attending', 'irregular', 'not_attending'],
  })
  @IsOptional()
  @IsIn(['attending', 'irregular', 'not_attending'])
  attendanceStatus?: string;

  @ApiPropertyOptional({
    description: 'Allergies / medical information a coach must know',
  })
  @IsOptional()
  @IsString()
  medicalNotes?: string;
}

export class SetPlanDto {
  @ApiProperty({
    description: 'Program the player belongs to',
    enum: ['U5_U8', 'U9_U12', 'U13_U14', 'U15_U18'],
    example: 'U9_U12',
  })
  @IsIn(['U5_U8', 'U9_U12', 'U13_U14', 'U15_U18'])
  plan: 'U5_U8' | 'U9_U12' | 'U13_U14' | 'U15_U18';
}

export class RecordPaymentDto {
  @ApiPropertyOptional({ description: 'Amount in CAD', default: 380 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    description:
      'Months of membership this payment covers (membership type only)',
    default: 2,
    minimum: 1,
    maximum: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  months?: number;

  @ApiPropertyOptional({
    description:
      "Payment type. 'membership' extends the subscription; 'league' only records a fee.",
    enum: ['membership', 'league'],
    default: 'membership',
  })
  @IsOptional()
  @IsIn(['membership', 'league'])
  type?: 'membership' | 'league';

  @ApiPropertyOptional({
    description: "Human-readable period label, e.g. 'Sep-Oct 2026'",
  })
  @IsOptional()
  @IsString()
  periodLabel?: string;

  @ApiPropertyOptional({
    description: 'Payment method',
    enum: ['etransfer', 'cash', 'other'],
    default: 'etransfer',
  })
  @IsOptional()
  @IsIn(['etransfer', 'cash', 'other'])
  method?: 'etransfer' | 'cash' | 'other';

  @ApiPropertyOptional({ description: 'Internal note about the payment' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description:
      'The date the money was actually received. Set this when entering a payment that was taken earlier by cash or e-transfer, so it lands in the right month on the Money screen. Defaults to today.',
    example: '2026-06-01',
  })
  @IsOptional()
  @IsISO8601()
  paidAt?: string;

  @ApiPropertyOptional({
    description:
      'Start the new membership period from the payment date rather than extending the current end date. Use for back-dated catch-up entries.',
  })
  @IsOptional()
  @IsBoolean()
  startFromPaymentDate?: boolean;
}

/**
 * One row of a bulk player import. Row-level validation is performed in the
 * service so that a single bad row is skipped (and reported) instead of
 * failing the whole request.
 */
export interface ImportPlayerRow {
  fullname?: string;
  dateOfBirth?: string;
  gender?: string;
  parent_name?: string;
  email?: string;
  phone_number?: string;
  activePlan?: string;
  membershipStatus?: string;
  currentSubscriptionEndDate?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  emergencyContactName?: string;
  emergencyPhone?: string;
}

export class ImportPlayersDto {
  @ApiProperty({
    description:
      'Players to import. Required per row: fullname, dateOfBirth, parent_name, email, phone_number, activePlan (U5_U8 | U9_U12 | U13_U14 | U15_U18). Optional: gender, membershipStatus (active | on_hold | stopped), currentSubscriptionEndDate (ISO date), address, city, postalCode, emergencyContactName, emergencyPhone. Invalid or duplicate rows are skipped and reported, not rejected.',
    type: 'array',
    items: { type: 'object' },
  })
  @IsArray()
  @ArrayNotEmpty()
  players: ImportPlayerRow[];
}

export interface ImportSkippedRow {
  index: number;
  fullname?: string;
  reason: string;
}

export interface ImportPlayersResult {
  created: number;
  createdIds: number[];
  skipped: ImportSkippedRow[];
}
