import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CollectionsService } from './collections.service';
import { CreateContactLogDto, SendRemindersDto } from './dto/collections.dto';

/** Admin attached by JwtAuthGuard (Admin entity: id + username). */
type AuthedRequest = { user?: { id: number; username: string } };

@ApiTags('Collections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Players who owe money (overdue or suspended), most overdue first. Stopped and on-hold players are excluded.',
  })
  @ApiResponse({ status: 200, description: 'Collections worklist' })
  list() {
    return this.collectionsService.getCollections();
  }

  @Post('send-reminders')
  @ApiOperation({ summary: 'Email overdue reminders to several players' })
  @ApiBody({ type: SendRemindersDto })
  @ApiResponse({ status: 201, description: '{ sent, failed, errors }' })
  sendReminders(@Body() dto: SendRemindersDto, @Req() req: AuthedRequest) {
    return this.collectionsService.sendReminders(dto.userIds, req.user ?? null);
  }

  @Delete('contact-log/:id')
  @ApiOperation({ summary: 'Delete a contact log entry' })
  @ApiParam({ name: 'id', type: Number })
  deleteContactLog(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthedRequest,
  ) {
    return this.collectionsService.deleteContactLog(id, req.user ?? null);
  }

  @Post(':userId/send-reminder')
  @ApiOperation({ summary: 'Email an overdue payment reminder to one parent' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiResponse({
    status: 201,
    description: '{ success, sentTo, remindersSent }',
  })
  @ApiResponse({ status: 400, description: 'Email disabled or not delivered' })
  sendReminder(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: AuthedRequest,
  ) {
    return this.collectionsService.sendReminder(userId, req.user ?? null);
  }

  @Get(':userId/contact-log')
  @ApiOperation({ summary: 'Contact history for a player, newest first' })
  @ApiParam({ name: 'userId', type: Number })
  getContactLog(@Param('userId', ParseIntPipe) userId: number) {
    return this.collectionsService.getContactLog(userId);
  }

  @Post(':userId/contact-log')
  @ApiOperation({ summary: 'Record a call/email/text/in-person follow-up' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiBody({ type: CreateContactLogDto })
  addContactLog(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: CreateContactLogDto,
    @Req() req: AuthedRequest,
  ) {
    return this.collectionsService.addContactLog(userId, dto, req.user ?? null);
  }
}
