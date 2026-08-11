import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { SubscriptionPlan } from 'src/modules/users/entities/enums/enums';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'The ID of the price plan or Stripe price ID',
    example: 'basic or price_1R0ssRCQIZTVFLLFqYDDGQF4',
  })
  @IsString()
  @IsNotEmpty()
  priceId: string;

  @ApiProperty({
    description: 'The user ID (optional)',
    example: '1',
    required: false,
  })
  @IsOptional()
  userId?: number | string;

  @ApiProperty({
    description: 'The payment method ID from Stripe',
    example: 'pm_1234567890',
    required: false,
  })
  @IsString()
  @IsOptional()
  paymentMethodId?: string;

  @ApiProperty({
    description: 'The Stripe customer Email',
    example: 'test@example.com',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User Phone Number',
    example: 'U12_U13',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  planId: SubscriptionPlan;
}
