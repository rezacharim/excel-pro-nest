import { ApiProperty } from '@nestjs/swagger';

export class SubscriptionResponseDto {
  @ApiProperty({
    description: 'The client secret used to complete the payment',
    example: 'pi_1234_secret_5678',
  })
  clientSecret: string;

  @ApiProperty({
    description: 'The Stripe subscription ID',
    example: 'sub_1234567890',
  })
  subscriptionId: string;

  @ApiProperty({
    description: 'The date when the current billing period ends',
    type: Date,
  })
  currentPeriodEnd: Date;

  @ApiProperty({
    description: 'The user ID associated with this subscription',
    example: '1',
    required: false,
  })
  userId?: number | string;

  @ApiProperty({
    description: 'The Stripe customer ID',
    example: 'cus_1234567890',
    required: false,
  })
  stripeCustomerId?: string;

  @ApiProperty({
    description:
      'The total amount charged including subscription and any one-time fees',
    example: 110,
    required: false,
  })
  totalAmount?: number;

  @ApiProperty({
    description: 'The currency of the payment',
    example: 'usd',
    required: false,
  })
  currency?: string;

  @ApiProperty({
    description: "Indicates if this is the user's first subscription",
    example: true,
    required: false,
  })
  isFirstTimeSubscription?: boolean;
}
