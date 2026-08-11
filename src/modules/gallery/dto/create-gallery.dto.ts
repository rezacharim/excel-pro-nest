import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
