import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SettingsService } from './settings.service';
import { ActivityService } from '../activity/activity.service';

export class UpdateSettingsDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) membershipPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) firstTimeFee?: number;
  @IsOptional() @IsEmail() etransferEmail?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(30)
  reminderDaysBefore?: number;
  @IsOptional() @IsBoolean() autoSuspendEnabled?: boolean;
  @IsOptional() @IsBoolean() remindersPaused?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90)
  autoSuspendDays?: number;
}

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly activityService: ActivityService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Academy settings (prices, reminders, suspension)' })
  get() {
    return this.settingsService.getAll();
  }

  @Patch()
  @ApiOperation({ summary: 'Update academy settings' })
  async update(
    @Body() dto: UpdateSettingsDto,
    @Req() req: { user?: { id: number; username: string } },
  ) {
    const updated = await this.settingsService.update(dto);
    await this.activityService.log(req.user, {
      action: 'settings.update',
      targetType: 'system',
      details: `Updated settings: ${Object.keys(dto).join(', ') || 'none'}`,
    });
    return updated;
  }
}
