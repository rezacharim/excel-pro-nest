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

export class CreateTestimonialDto {
  @ApiProperty({ description: 'Who said it', example: 'Somayeh Hosseini' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Their relationship to the academy',
    example: 'Parent of Arsham, U13',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: 'The testimonial, in their own words' })
  @IsOptional()
  @IsString()
  quote?: string;

  @ApiPropertyOptional({
    description: 'Photo URL — a Gallery URL or a path under /images/',
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

  @ApiPropertyOptional({ description: 'Visible on the site', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTestimonialDto extends PartialType(CreateTestimonialDto) {}

export class ReorderTestimonialsDto {
  @ApiProperty({
    description: 'Testimonial ids in the order they should appear',
    type: [Number],
    example: [3, 1, 2],
  })
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  ids: number[];
}
