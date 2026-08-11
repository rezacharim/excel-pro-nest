import { IsOptional, IsString } from 'class-validator';

export class ConfirmTransferDto {
  @IsOptional()
  @IsString()
  transactionDetails?: string; // Optional details about the payment
}
