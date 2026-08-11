import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class UploadPhotoDto {
  @ApiProperty({
    description: 'User ID',
    example: 1,
    type: Number,
  })
  @IsNotEmpty({ message: 'User ID is required' })
  @IsInt({ message: 'User ID must be an integer' })
  @Type(() => Number)
  userId: number;
}
