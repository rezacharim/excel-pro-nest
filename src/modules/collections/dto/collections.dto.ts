import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const CONTACT_METHODS = ['call', 'email', 'text', 'in_person'] as const;

export type ContactMethod = (typeof CONTACT_METHODS)[number];

export class CreateContactLogDto {
  @ApiProperty({
    description: 'How the family was contacted',
    enum: CONTACT_METHODS,
    example: 'call',
  })
  @IsIn(CONTACT_METHODS as unknown as string[])
  method: ContactMethod;

  @ApiProperty({
    description: 'What was said/agreed, e.g. "called Aug 12, will pay Friday"',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  note: string;

  @ApiPropertyOptional({
    description: 'ISO date the admin promised to check back on',
    example: '2026-08-19',
  })
  @IsOptional()
  @IsISO8601()
  followUpAt?: string;
}

export class SendRemindersDto {
  @ApiProperty({
    description: 'Player IDs to email an overdue-payment reminder to',
    type: [Number],
    example: [12, 34],
  })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  userIds: number[];
}

export interface CollectionsRow {
  userId: number;
  fullname: string;
  parent_name: string;
  email: string;
  phone_number: string;
  activePlan: string | null;
  membershipStatus: string;
  currentSubscriptionEndDate: string | null;
  daysOverdue: number;
  amountDue: number;
  remindersSent: number;
  lastReminderAt: string | null;
  lastContactAt: string | null;
  lastContactNote: string | null;
  lastContactMethod: string | null;
  followUpAt: string | null;
  lastPaymentAt: string | null;
}

export interface SendReminderResult {
  success: true;
  sentTo: string;
  remindersSent: number;
}

export interface SendRemindersResult {
  sent: number;
  failed: number;
  errors: string[];
}
