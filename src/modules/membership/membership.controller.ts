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
import { MembershipService } from './membership.service';
import {
  ExtendMembershipDto,
  HoldMembershipDto,
  ImportPlayersDto,
  RecordPaymentDto,
  SetPlanDto,
} from './dto/membership.dto';

@ApiTags('Membership')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
