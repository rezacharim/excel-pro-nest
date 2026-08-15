import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ANNOUNCEMENT_CATEGORIES,
  AnnouncementCategory,
} from '../entities/announcement.entity';

export class CreateAnnouncementDto {
  @ApiProperty({ description: 'Announcement title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Announcement body' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({
    description: 'Announcement category',
    enum: ANNOUNCEMENT_CATEGORIES,
    example: 'news',
  })
  @IsIn(ANNOUNCEMENT_CATEGORIES)
  category: AnnouncementCategory;

  @ApiPropertyOptional({ description: 'Optional call-to-action label' })
  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @ApiPropertyOptional({ description: 'Optional call-to-action URL' })
  @IsOptional()
  @IsString()
  ctaUrl?: string;

  @ApiPropertyOptional({
    description: 'Photo URL for the news card (pick one from the Gallery)',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Whether the announcement is visible',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAnnouncementDto extends PartialType(CreateAnnouncementDto) {}
