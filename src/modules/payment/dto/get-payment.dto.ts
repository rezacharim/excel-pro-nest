import { PaymentStatus } from '../entities/enums/payment-status.enum';
import { SubscriptionPlan } from '../../users/entities/enums/enums';

export class PaymentResponseDto {
  id: number;
  amount: number;
  currency: string;
  status: PaymentStatus;
  subscriptionPlan: SubscriptionPlan;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  userEmail: string;
  phone_number: string;
  userId: number;
  fullname: string;
  isFirstTimePayment: boolean;
  subscriptionEndDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
