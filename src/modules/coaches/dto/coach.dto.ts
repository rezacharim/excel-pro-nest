import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CoachPhotoDto {
  @ApiProperty({ description: 'Image URL' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional({ description: 'Caption shown under the photo' })
  @IsOptional()
  @IsString()
  caption?: string;
}

export class CreateCoachDto {
  @ApiProperty({ description: 'Coach full name', example: 'Iman Badamaki' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description:
      'URL segment for the profile page. Generated from the name if omitted.',
    example: 'iman-badamaki',
  })
  @IsOptional()
  @IsString()
  slug?: string;

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
    description: 'Long story for the profile page. Blank lines split paragraphs.',
  })
  @IsOptional()
  @IsString()
  longBio?: string;

  @ApiPropertyOptional({
    description: 'Profile gallery photos, in display order',
    type: [CoachPhotoDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoachPhotoDto)
  photos?: CoachPhotoDto[];

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
