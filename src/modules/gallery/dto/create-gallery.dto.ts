import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateGalleryDto {
  @ApiProperty({
    description: 'The ID of the user uploading the image',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Optional caption for the image',
    example: 'Sunset at the beach',
    required: false,
  })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiProperty({
    description: 'Show this photo in the home page slideshow',
    required: false,
    default: false,
  })
  @IsOptional()
  // Multipart uploads arrive as strings, so "true" has to survive the trip.
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  show_on_home?: boolean;
}
