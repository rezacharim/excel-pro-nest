import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AgeCategory } from '../entities/enums/ageCategory.enum';

export class CreateMatchDto {
  // @IsNotEmpty()
  // @IsString()
  // match: string;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  match_date: Date;

  @IsNotEmpty()
  @IsEnum(AgeCategory)
  age_category: AgeCategory;

  @IsOptional()
  @IsString()
  location: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsString()
  team1: string;

  @IsNotEmpty()
  @IsString()
  team2: string;
}
