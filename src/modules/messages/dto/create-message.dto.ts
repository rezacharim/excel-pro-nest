import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMessageDto {
  @ApiProperty({ example: 'John Doe', description: 'Sender name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'john@example.com', description: 'Sender email' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Inquiry about services',
    description: 'Message subject',
  })
  @IsNotEmpty()
  @IsString()
  subject: string;

  @ApiProperty({
    example:
      'I would like to learn more about your services. Please contact me.',
    description: 'Message content',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(10, { message: 'Message must be at least 10 characters long' })
  message: string;
}
