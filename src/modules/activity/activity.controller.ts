import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivityService } from './activity.service';

@ApiTags('Activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get()
  @ApiOperation({ summary: 'Audit trail of admin actions (newest first)' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'admin', required: false })
  @ApiQuery({ name: 'action', required: false })
  list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('admin') admin?: string,
    @Query('action') action?: string,
    @Query('targetId') targetId?: string,
  ) {
    return this.activityService.list({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      adminUsername: admin || undefined,
      action: action || undefined,
      targetId: targetId ? parseInt(targetId, 10) : undefined,
    });
  }

  @Get('actors')
  @ApiOperation({ summary: 'Admin usernames present in the activity log' })
  actors() {
    return this.activityService.actors();
  }
}
