import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import {
  Gender,
  PlayerPosition,
  TShirtSize,
  ExperienceLevel,
} from '../entities/enums/enums';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @ApiProperty({ description: 'Full name of the user' })
  @IsNotEmpty()
  @IsString()
  fullname: string;

  @ApiProperty({
    description: 'Date of birth of the user',
    example: '1990-01-01',
  })
  @IsNotEmpty()
  @IsString()
  dateOfBirth: string;

  @ApiProperty({ description: 'Height in Centimeter (CM)', example: 175 })
  @IsNotEmpty()
  @IsString()
  height: string;

  @ApiProperty({ description: 'Weight in Kilo Gram (KG)', example: 70 })
  @IsNotEmpty()
  @IsString()
  weight: string;

  @ApiProperty({
    description: 'T-Shirt Size (Jersey). For youth size use: YM OR YL',
    enum: TShirtSize,
    example: TShirtSize.M,
  })
  @IsNotEmpty()
  @IsEnum(TShirtSize)
  tShirtSize: TShirtSize;

  @ApiProperty({
    description: 'Short Size',
    enum: TShirtSize, // Reusing the same enum
    example: TShirtSize.M,
  })
  @IsNotEmpty()
  @IsEnum(TShirtSize)
  shortSize: TShirtSize;

  @ApiProperty({
    description: 'Jacket Size',
    enum: TShirtSize, // Reusing the same enum
    example: TShirtSize.M,
  })
  @IsNotEmpty()
  @IsEnum(TShirtSize)
  jacketSize: TShirtSize;

  @ApiProperty({
    description: 'Pants Size',
    enum: TShirtSize, // Reusing the same enum
    example: TShirtSize.M,
  })
  @IsNotEmpty()
  @IsEnum(TShirtSize)
  pantsSize: TShirtSize;

  @ApiProperty({
    description:
      'Full address including street, city, state, postal code, etc.',
    example: '123 Main Street, Apartment 4B, New York, NY 10001',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  address: string;

  @ApiProperty({
    description: 'Postal Code',
    example: '10001',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  postalCode: string;

  @ApiProperty({
    description: 'City',
    example: 'New York',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  city: string;

  @ApiProperty({
    description: 'Emergency Contact Name',
    example: 'John Doe',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  emergencyContactName: string;

  @ApiProperty({
    description: 'Emergency Phone Number',
    example: '+1-555-123-4567',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  emergencyPhone: string;

  @ApiProperty({
    description: 'Experience Level',
    enum: ExperienceLevel,
    example: ExperienceLevel.INTERMEDIATE,
    required: false,
  })
  @IsNotEmpty()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @ApiProperty({
    description: 'Profile photo in base64 format',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZ...',
    required: false,
  })
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiProperty({
    description: 'National ID card photo in base64 format',
    example: 'data:image/jpeg;base64,/9j/4AAQSkZ...',
    required: false,
  })
  @IsString()
  @IsOptional()
  NationalIdCard?: string;

  @ApiProperty({ enum: Gender, description: 'Gender of the user' })
  @IsNotEmpty()
  @IsEnum(Gender)
  gender: Gender;

  @ApiProperty({ description: 'Parent name of the user', example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  parent_name: string;

  @ApiProperty({
    description: 'Phone number of the user',
    example: '+123456789',
  })
  @IsNotEmpty()
  @IsString()
  phone_number: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @IsString()
  email: string;

  @ApiProperty({
    enum: PlayerPosition,
    description: 'Player position',
    required: false,
  })
  @IsOptional()
  @IsEnum(PlayerPosition)
  player_positions?: PlayerPosition;

  @ApiProperty({ description: 'Custom player position', required: false })
  @IsOptional()
  @IsString()
  custom_position?: string;

  @ApiProperty({ description: 'Cancellation policy agreement' })
  @IsNotEmpty()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  policy: boolean;

  @IsOptional()
  @IsString()
  activePlan?: string;
}
