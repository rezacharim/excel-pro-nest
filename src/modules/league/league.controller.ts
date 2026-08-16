import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
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
import { PortalGuard } from '../portal/portal.guard';
import { ActivityInterceptor } from '../activity/activity.interceptor';
import { LeagueService } from './league.service';
import { LeagueExportService } from './league-export.service';
import {
  BookTrialDto,
  CreateSeasonDto,
  PortalAddPlayerDto,
  PortalRegisterDto,
  RecordInstallmentDto,
  UpdatePlayerDetailsDto,
  RegisterForLeagueDto,
  UpdateRegistrationDto,
  UpdateTrialDto,
} from './dto/league.dto';

// ---------------------------------------------------------------------------
// Public — the /league and /trials pages on the website
// ---------------------------------------------------------------------------
@ApiTags('League (public)')
@Controller('league')
export class LeaguePublicController {
  constructor(private readonly leagueService: LeagueService) {}

  @Get('season')
  @ApiOperation({
    summary:
      'Active season, fees, deadlines and spots left per age group (public)',
  })
  season() {
    return this.leagueService.getPublicSeason();
  }

  @Get('season/:slug')
  @ApiOperation({
    summary: 'A specific season by its URL key, e.g. indoor (public)',
  })
  @ApiParam({ name: 'slug', example: 'indoor' })
  seasonBySlug(@Param('slug') slug: string) {
    return this.leagueService.getPublicSeason(slug);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a player for the league (public form)' })
  @ApiBody({ type: RegisterForLeagueDto })
  @ApiResponse({ status: 201, description: 'Registration created' })
  @ApiResponse({ status: 409, description: 'Player already registered' })
  register(@Body() dto: RegisterForLeagueDto) {
    return this.leagueService.register(dto);
  }

  @Post('trials')
  @ApiOperation({ summary: 'Book a trial (public form)' })
  @ApiBody({ type: BookTrialDto })
  bookTrial(@Body() dto: BookTrialDto) {
    return this.leagueService.bookTrial(dto);
  }
}

// ---------------------------------------------------------------------------
// Parent portal — the family dashboard
// ---------------------------------------------------------------------------
@ApiTags('League (parent portal)')
@ApiBearerAuth()
@UseGuards(PortalGuard)
@Controller('portal/league')
export class LeaguePortalController {
  constructor(private readonly leagueService: LeagueService) {}

  @Get()
  @ApiOperation({
    summary: "This parent's players and their league status for the season",
  })
  overview(@Req() req: { parentEmail: string }) {
    return this.leagueService.portalOverview(req.parentEmail);
  }

  @Post('register')
  @ApiOperation({
    summary: 'Register one of my players for the league (details prefilled)',
  })
  @ApiBody({ type: PortalRegisterDto })
  register(
    @Req() req: { parentEmail: string },
    @Body() dto: PortalRegisterDto,
  ) {
    return this.leagueService.portalRegister(req.parentEmail, dto);
  }

  @Patch('player/:userId')
  @ApiOperation({
    summary: "Correct one of my players' details (name, date of birth, address)",
  })
  @ApiParam({ name: 'userId', type: Number })
  @ApiBody({ type: UpdatePlayerDetailsDto })
  updatePlayer(
    @Req() req: { parentEmail: string },
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdatePlayerDetailsDto,
  ) {
    return this.leagueService.portalUpdatePlayer(req.parentEmail, userId, dto);
  }

  @Post('player')
  @ApiOperation({
    summary:
      'Add a player who trains with us but has never been on file (no dashboard yet)',
  })
  @ApiBody({ type: PortalAddPlayerDto })
  addPlayer(
    @Req() req: { parentEmail: string },
    @Body() dto: PortalAddPlayerDto,
  ) {
    return this.leagueService.portalAddPlayer(req.parentEmail, dto);
  }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
@ApiTags('League (admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ActivityInterceptor)
@Controller('league/admin')
export class LeagueAdminController {
  constructor(
    private readonly leagueService: LeagueService,
    private readonly exportService: LeagueExportService,
  ) {}

  // ---- seasons ----
  @Get('seasons')
  @ApiOperation({ summary: 'All league seasons' })
  seasons() {
    return this.leagueService.listSeasons();
  }

  @Post('seasons')
  @ApiOperation({
    summary: 'Create a season (makes it the active one for registrations)',
  })
  @ApiBody({ type: CreateSeasonDto })
  createSeason(@Body() dto: CreateSeasonDto) {
    return this.leagueService.createSeason(dto);
  }

  @Patch('seasons/:id')
  @ApiParam({ name: 'id', type: Number })
  updateSeason(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSeasonDto,
  ) {
    return this.leagueService.updateSeason(id, dto);
  }

  // ---- registrations ----
  @Get('registrations')
  @ApiOperation({ summary: 'Registrations with money totals' })
  @ApiQuery({ name: 'seasonId', required: false, type: Number })
  @ApiQuery({ name: 'ageGroup', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  registrations(
    @Query('seasonId') seasonId?: string,
    @Query('ageGroup') ageGroup?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.leagueService.listRegistrations({
      seasonId: seasonId ? Number(seasonId) : undefined,
      ageGroup,
      status,
      search,
    });
  }

  @Patch('registrations/:id')
  @ApiOperation({
    summary: 'Change status, assign a team, or correct player details',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateRegistrationDto })
  updateRegistration(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRegistrationDto,
  ) {
    return this.leagueService.updateRegistration(id, dto);
  }

  @Post('registrations/:id/payments')
  @ApiOperation({
    summary:
      'Record an installment as received (creates the payment and confirms the spot)',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: RecordInstallmentDto })
  recordPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordInstallmentDto,
  ) {
    return this.leagueService.recordInstallment(id, dto);
  }

  @Post('registrations/:id/payments/:installment/reverse')
  @ApiOperation({ summary: 'Undo a payment recorded by mistake' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'installment', enum: [1, 2] })
  reversePayment(
    @Param('id', ParseIntPipe) id: number,
    @Param('installment', ParseIntPipe) installment: number,
  ) {
    return this.leagueService.reverseInstallment(id, installment);
  }

  @Get('outstanding')
  @ApiOperation({ summary: 'Who still owes money, most overdue first' })
  @ApiQuery({ name: 'seasonId', required: false, type: Number })
  outstanding(@Query('seasonId') seasonId?: string) {
    return this.leagueService.outstanding(
      seasonId ? Number(seasonId) : undefined,
    );
  }

  // ---- roster export ----
  @Get('roster/check')
  @ApiOperation({
    summary: 'Rows the league importer would reject, before exporting',
  })
  @ApiQuery({ name: 'seasonId', required: false, type: Number })
  @ApiQuery({ name: 'ageGroup', required: false })
  @ApiQuery({ name: 'includePending', required: false, type: Boolean })
  async check(
    @Query('seasonId') seasonId?: string,
    @Query('ageGroup') ageGroup?: string,
    @Query('includePending') includePending?: string,
  ) {
    const { season, rows } = await this.leagueService.rosterRows({
      seasonId: seasonId ? Number(seasonId) : undefined,
      ageGroup,
      includePending: includePending === 'true',
    });
    return {
      season: season.name,
      ageGroup: ageGroup ?? 'all',
      players: rows.filter((r) => r.teamRole === 'PLAYER').length,
      staff: rows.filter((r) => r.teamRole !== 'PLAYER').length,
      issues: this.exportService.validate(rows),
    };
  }

  @Get('roster/export')
  @ApiOperation({
    summary:
      'Download the roster as the league\'s "Rep Sports Engine import format" .xlsx',
  })
  @ApiQuery({ name: 'seasonId', required: false, type: Number })
  @ApiQuery({ name: 'ageGroup', required: false })
  @ApiQuery({ name: 'includePending', required: false, type: Boolean })
  async exportRoster(
    @Res() res: Response,
    @Query('seasonId') seasonId?: string,
    @Query('ageGroup') ageGroup?: string,
    @Query('includePending') includePending?: string,
  ) {
    const { season, rows } = await this.leagueService.rosterRows({
      seasonId: seasonId ? Number(seasonId) : undefined,
      ageGroup,
      includePending: includePending === 'true',
    });
    const buffer = await this.exportService.build(season, rows);
    const filename = this.exportService.filename(season, ageGroup);

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    });
    res.end(buffer);
  }

  // ---- trials ----
  @Get('trials')
  @ApiOperation({ summary: 'Trial requests' })
  @ApiQuery({ name: 'status', required: false })
  trials(@Query('status') status?: string) {
    return this.leagueService.listTrials(status);
  }

  @Patch('trials/:id')
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateTrialDto })
  updateTrial(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTrialDto,
  ) {
    return this.leagueService.updateTrial(id, dto);
  }
}
