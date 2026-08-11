import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { SubscriptionPlan } from '../../users/entities/enums/enums';

export class CreateTransferDto {
  @IsNotEmpty()
  @IsString()
  plan: SubscriptionPlan;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsBoolean()
  isFirstTime?: boolean;

  @IsOptional()
  @IsString()
  fullname?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsNumber()
  userId?: number;
}
