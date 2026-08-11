import {
  ArrayNotEmpty,
  IsArray,
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
