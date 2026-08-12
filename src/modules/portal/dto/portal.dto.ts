import {
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PortalLoginDto {
  @ApiProperty({ example: 'parent@example.com' })
  @IsString()
  email: string;

  @ApiProperty({ example: '12345' })
  @IsString()
  otp: string;
}

export class RenewDto {
  @ApiProperty({ description: 'Player (user) id to renew the membership for' })
  @Type(() => Number)
  @IsInt()
  userId: number;
}

export class RequestHoldDto {
  @ApiProperty({ description: 'Player (user) id the request is for' })
  @Type(() => Number)
  @IsInt()
  userId: number;

  @ApiPropertyOptional({
    description: 'ISO date the membership should resume. Omit for indefinite.',
    example: '2026-09-01',
  })
  @IsOptional()
  @IsISO8601()
  resumeAt?: string;

  @ApiPropertyOptional({ description: 'Message for the academy admins' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class RequestInstallmentsDto {
  @ApiProperty({ description: 'Player (user) id the request is for' })
  @Type(() => Number)
  @IsInt()
  userId: number;

  @ApiProperty({ description: 'Total amount to split, in CAD' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalAmount: number;

  @ApiProperty({ description: 'Number of installments' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  installments: number;

  @ApiPropertyOptional({ description: 'Message for the academy admins' })
  @IsOptional()
  @IsString()
  note?: string;
}
