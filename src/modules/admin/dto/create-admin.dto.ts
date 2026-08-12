import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Admin accounts are the keys to the whole dashboard, so they get a longer
 * minimum than the 6 characters used elsewhere in the app.
 */
export const ADMIN_MIN_PASSWORD_LENGTH = 10;

export class CreateAdminDto {
  @ApiProperty({ description: 'Login username (unique)', example: 'director' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username: string;

  @ApiProperty({
    description: 'Email address (unique)',
    example: 'director@excelproso.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'First name', example: 'Amir' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  first_name: string;

  @ApiProperty({ description: 'Last name', example: 'Rezaei' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  last_name: string;

  @ApiProperty({
    description: `Initial password, at least ${ADMIN_MIN_PASSWORD_LENGTH} characters. Stored hashed.`,
    minLength: ADMIN_MIN_PASSWORD_LENGTH,
    example: 'ChangeMe2026!',
  })
  @IsString()
  @MinLength(ADMIN_MIN_PASSWORD_LENGTH, {
    message: `password must be at least ${ADMIN_MIN_PASSWORD_LENGTH} characters long`,
  })
  password: string;
}
