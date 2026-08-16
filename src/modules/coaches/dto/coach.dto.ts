import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateCoachDto {
  @ApiProperty({ description: 'Coach full name', example: 'Iman Badamaki' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Title shown under the name', example: 'Youth Coach' })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiPropertyOptional({ description: 'Short biography shown on the card' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    description: 'Photo URL — a path under /images/person/ or a Gallery URL',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Display order, lowest first. Defaults to the end of the list.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Visible on the public page', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCoachDto extends PartialType(CreateCoachDto) {}

export class ReorderCoachesDto {
  @ApiProperty({
    description: 'Coach ids in the order they should appear, first to last',
    type: [Number],
    example: [3, 1, 2],
  })
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  ids: number[];
}
