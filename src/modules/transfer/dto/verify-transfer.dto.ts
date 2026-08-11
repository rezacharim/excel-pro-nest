import { IsBoolean, IsString, IsOptional } from 'class-validator';

export class VerifyTransferDto {
  @IsBoolean()
  isApproved: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
