import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const ADMIN_ACCOUNT_STATUSES = ['active', 'locked', 'disabled'] as const;
export type AdminAccountStatus = (typeof ADMIN_ACCOUNT_STATUSES)[number];

/**
 * Username is intentionally immutable and the password has its own endpoint,
 * so a routine profile edit can never change how somebody signs in.
 */
export class UpdateAdminDto {
  @ApiPropertyOptional({ description: 'Email address (unique)' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'First name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  first_name?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  last_name?: string;

  @ApiPropertyOptional({
    description:
      "Account status. 'disabled' blocks sign-in without deleting history.",
    enum: ADMIN_ACCOUNT_STATUSES,
  })
  @IsOptional()
  @IsIn(ADMIN_ACCOUNT_STATUSES as unknown as string[])
  account_status?: AdminAccountStatus;
}
