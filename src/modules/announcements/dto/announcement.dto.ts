import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ANNOUNCEMENT_CATEGORIES,
  AnnouncementCategory,
} from '../entities/announcement.entity';

export class AnnouncementPhotoDto {
  @ApiProperty({ description: 'Image URL' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional({ description: 'Caption shown under the photo' })
  @IsOptional()
  @IsString()
  caption?: string;
}

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
    description: 'URL segment for the full post. Generated from the title.',
  })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({
    description:
      'Full story for the post page. ## headings, - bullets, **bold**.',
  })
  @IsOptional()
  @IsString()
  fullBody?: string;

  @ApiPropertyOptional({
    description: 'Photo gallery for the post, in display order',
    type: [AnnouncementPhotoDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnnouncementPhotoDto)
  photos?: AnnouncementPhotoDto[];

  @ApiPropertyOptional({
    description: 'Date of the match or presentation (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  eventDate?: string;

  @ApiPropertyOptional({
    description: 'Whether the announcement is visible',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateAnnouncementDto extends PartialType(CreateAnnouncementDto) {}
