import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

/* ------------------------------------------------------------------ teams */

export class CreateTeamDto {
  @ApiProperty({ description: 'Age group', example: 'U13' })
  @IsString()
  @IsNotEmpty()
  ageGroup: string;

  @ApiPropertyOptional({ example: 'Excel Pro NY U13' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({
    description: 'Exactly how the league spreadsheet writes this team',
    example: 'NY Hearts A BU13T2 TOSL',
  })
  @IsOptional()
  @IsString()
  leagueName?: string;

  @ApiPropertyOptional({ description: 'Squad photo URL' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTeamDto extends PartialType(CreateTeamDto) {}

/* --------------------------------------------------------------- fixtures */

export class CreateFixtureDto {
  @ApiPropertyOptional({ description: "The league's game number" })
  @IsOptional()
  @IsString()
  gameNumber?: string;

  @ApiPropertyOptional({
    description:
      'Which team played it. Resolved from the age group when omitted.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  teamId?: number | null;

  @ApiProperty({ example: 'U13' })
  @IsString()
  @IsNotEmpty()
  ageGroup: string;

  @ApiPropertyOptional({ example: 'Boys Under 13 Tier 2/Tier 3' })
  @IsOptional()
  @IsString()
  division?: string;

  @ApiPropertyOptional({ example: 'TOSL' })
  @IsOptional()
  @IsString()
  competition?: string;

  @ApiProperty({
    description: 'Kick-off as local time, "YYYY-MM-DD HH:mm"',
    example: '2026-09-02 18:30',
  })
  @IsString()
  @IsNotEmpty()
  kickoff: string;

  @ApiProperty({ example: 'Wexford GSSA' })
  @IsString()
  @IsNotEmpty()
  opponent: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isHome?: boolean;

  @ApiPropertyOptional({ example: 'North York Civic Field 3E' })
  @IsOptional()
  @IsString()
  venue?: string;

  @ApiPropertyOptional({ description: 'Our goals' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ourScore?: number | null;

  @ApiPropertyOptional({ description: 'Their goals' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  theirScore?: number | null;

  @ApiPropertyOptional({ description: 'Season label', example: '2026/27' })
  @IsOptional()
  @IsString()
  season?: string;

  @ApiPropertyOptional({ example: 'scheduled' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'import' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFixtureDto extends PartialType(CreateFixtureDto) {}

export class ImportFixturesDto {
  @ApiProperty({
    description: 'Rows to import. Existing game numbers are updated in place.',
    type: [CreateFixtureDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFixtureDto)
  fixtures: CreateFixtureDto[];
}
