import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber } from 'class-validator';

export class CreateProgramDto {
  @ApiProperty({
    description: 'Index image URL of the program',
    example: 'https://example.com/index-image.png',
  })
  @IsString()
  index_image_url: string;

  @ApiProperty({
    description: 'Name of the program',
    example: 'Beginner Bootcamp',
  })
  @IsString()
  program_name: string;

  @ApiProperty({
    description: 'Price of the program',
    example: 99.99,
  })
  @IsNumber()
  price: number;

  @ApiProperty({
    description: 'Description of the program',
    example: 'A comprehensive program for beginners',
  })
  @IsString()
  description: string;
}
