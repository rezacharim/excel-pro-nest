import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';
import { ADMIN_MIN_PASSWORD_LENGTH } from './create-admin.dto';

/**
 * Owner-driven reset: the current password is deliberately NOT required, since
 * the whole point is to get a locked-out or forgetful admin back in.
 */
export class ResetAdminPasswordDto {
  @ApiProperty({
    description: `New password, at least ${ADMIN_MIN_PASSWORD_LENGTH} characters. Stored hashed.`,
    minLength: ADMIN_MIN_PASSWORD_LENGTH,
    example: 'ChangeMe2026!',
  })
  @IsString()
  @MinLength(ADMIN_MIN_PASSWORD_LENGTH, {
    message: `password must be at least ${ADMIN_MIN_PASSWORD_LENGTH} characters long`,
  })
  password: string;
}
