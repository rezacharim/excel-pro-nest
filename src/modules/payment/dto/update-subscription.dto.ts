import { PartialType } from '@nestjs/swagger';
import { CreateSubscriptionDto } from './CreateSubscription.dto';

export class UpdatePaymentDto extends PartialType(CreateSubscriptionDto) {}
