import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ActivityInterceptor } from '../activity/activity.interceptor';
import { MembershipService } from './membership.service';
import {
  ExtendMembershipDto,
  HoldMembershipDto,
  ImportPlayersDto,
  RecordPaymentDto,
  SetPlanDto,
  SuspendMembershipDto,
  UpdatePlayerNotesDto,
  SetRenewalDateDto,
  BulkActionDto,
  QuickAddPlayerDto,
  InviteParentsDto,
} from './dto/membership.dto';

@ApiTags('Membership')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
// Every change made here lands in the Activity log automatically.
@UseInterceptors(ActivityInterceptor)
@Controller('membership')
export class MembershipController {
  constructor(private readonly membershipService: MembershipService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Membership overview for all users' })
  @ApiResponse({
    status: 200,
    description: 'List of users with membership status, sorted overdue first',
  })
  getOverview() {
    return this.membershipService.getOverview();
  }

  @Get('export/emails')
  @ApiOperation({ summary: 'Export member contact list as CSV' })
  @ApiQuery({ name: 'format', required: false, example: 'csv' })
  async exportEmails(
    @Res() res: Response,
    @Query('format') format?: string,
  ) {
    const csv = await this.membershipService.exportEmailsCsv();
    const filename = `excel-pro-members-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    res.send(csv);
  }

  @Post('import')
  @ApiOperation({
    summary:
      'Bulk-import existing members. Duplicate/invalid rows are skipped and reported. No emails are sent.',
  })
  @ApiBody({ type: ImportPlayersDto })
  @ApiResponse({
    status: 201,
    description: '{ created, createdIds, skipped: [{ index, fullname?, reason }] }',
  })
  import(@Body() dto: ImportPlayersDto) {
    return this.membershipService.importPlayers(dto);
  }

  @Post(':userId/hold')
  @ApiOperation({ summary: 'Put a membership on hold' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiBody({ type: HoldMembershipDto })
  hold(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: HoldMembershipDto,
  ) {
    return this.membershipService.hold(userId, dto);
  }

  @Post(':userId/resume')
  @ApiOperation({
    summary: 'Resume a held membership (held time is credited back)',
  })
  @ApiParam({ name: 'userId', type: Number })
  resume(@Param('userId', ParseIntPipe) userId: number) {
    return this.membershipService.resume(userId);
  }

  @Post(':userId/extend')
  @ApiOperation({ summary: 'Extend a membership by N days' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiBody({ type: ExtendMembershipDto })
  extend(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: ExtendMembershipDto,
  ) {
    return this.membershipService.extend(userId, dto);
  }

  @Post(':userId/stop')
  @ApiOperation({ summary: 'Stop a membership (data is kept)' })
  @ApiParam({ name: 'userId', type: Number })
  stop(@Param('userId', ParseIntPipe) userId: number) {
    return this.membershipService.stop(userId);
  }

  @Post(':userId/reactivate')
  @ApiOperation({ summary: 'Reactivate a stopped membership (no date change)' })
  @ApiParam({ name: 'userId', type: Number })
  reactivate(@Param('userId', ParseIntPipe) userId: number) {
    return this.membershipService.reactivate(userId);
  }

  @Post('players')
  @ApiOperation({
    summary: 'Add a player by hand (walk-ins, or members who joined pre-website)',
  })
  @ApiBody({ type: QuickAddPlayerDto })
  quickAddPlayer(@Body() dto: QuickAddPlayerDto) {
    return this.membershipService.quickAddPlayer(dto);
  }

  @Post('invite')
  @ApiOperation({
    summary: 'Email families an invitation to start using their online account',
  })
  @ApiBody({ type: InviteParentsDto })
  inviteParents(@Body() dto: InviteParentsDto) {
    return this.membershipService.inviteParents(dto);
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Apply one action (stop / reactivate / suspend / set-plan) to many players',
  })
  @ApiBody({ type: BulkActionDto })
  bulkAction(@Body() dto: BulkActionDto) {
    return this.membershipService.bulkAction(dto);
  }

  @Post(':userId/set-renewal-date')
  @ApiOperation({
    summary:
      'Set the date a membership is paid up to (for payments taken outside the dashboard)',
  })
  @ApiParam({ name: 'userId', type: Number })
  @ApiBody({ type: SetRenewalDateDto })
  setRenewalDate(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SetRenewalDateDto,
  ) {
    return this.membershipService.setRenewalDate(userId, dto);
  }

  @Post(':userId/suspend')
  @ApiOperation({
    summary:
      'Suspend an account (late payment, discipline, paperwork, medical, other)',
  })
  @ApiParam({ name: 'userId', type: Number })
  @ApiBody({ type: SuspendMembershipDto })
  suspend(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SuspendMembershipDto,
  ) {
    return this.membershipService.suspend(userId, dto);
  }

  @Post(':userId/unsuspend')
  @ApiOperation({ summary: 'Lift a suspension and reactivate the membership' })
  @ApiParam({ name: 'userId', type: Number })
  unsuspend(@Param('userId', ParseIntPipe) userId: number) {
    return this.membershipService.unsuspend(userId);
  }

  @Post(':userId/notes')
  @ApiOperation({ summary: 'Update private notes / attendance for a player' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiBody({ type: UpdatePlayerNotesDto })
  updateNotes(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdatePlayerNotesDto,
  ) {
    return this.membershipService.updateNotes(userId, dto);
  }

  @Post(':userId/set-plan')
  @ApiOperation({ summary: "Set or correct a player's program (age group)" })
  @ApiParam({ name: 'userId', type: Number })
  @ApiBody({ type: SetPlanDto })
  setPlan(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SetPlanDto,
  ) {
    return this.membershipService.setPlan(userId, dto.plan);
  }

  @Post(':userId/record-payment')
  @ApiOperation({
    summary:
      'Record an offline payment (e-transfer/cash) and extend the membership by 2 months',
  })
  @ApiParam({ name: 'userId', type: Number })
  @ApiBody({ type: RecordPaymentDto })
  recordPayment(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.membershipService.recordPayment(userId, dto);
  }
}
