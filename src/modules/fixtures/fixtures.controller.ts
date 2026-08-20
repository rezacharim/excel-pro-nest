import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FixturesService } from './fixtures.service';
import {
  CreateFixtureDto,
  CreateTeamDto,
  ImportFixturesDto,
  UpdateFixtureDto,
  UpdateTeamDto,
} from './dto/fixture.dto';
import { Fixture } from './entities/fixture.entity';
import { Team } from './entities/team.entity';

@ApiTags('Fixtures')
@Controller('fixtures')
export class FixturesController {
  constructor(private readonly service: FixturesService) {}

  /* ---------------------------------------------------------------- teams */
  // Every literal path is declared above the numeric :id routes, or Nest
  // hands "teams" to ParseIntPipe and answers 400.

  @Get('teams')
  @ApiOperation({ summary: 'Visible teams in display order (public)' })
  @ApiResponse({ status: 200, type: [Team] })
  findActiveTeams() {
    return this.service.findActiveTeams();
  }

  @Get('teams/all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Every team, including hidden (admin)' })
  findAllTeams() {
    return this.service.findAllTeams();
  }

  @Post('teams')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a team (admin)' })
  createTeam(@Body() dto: CreateTeamDto) {
    return this.service.createTeam(dto);
  }

  @Patch('teams/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a team — name, photo, league name (admin)' })
  updateTeam(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.service.updateTeam(id, dto);
  }

  @Delete('teams/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a team (admin)' })
  removeTeam(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeTeam(id);
  }

  /* ------------------------------------------------------------- fixtures */

  @Get()
  @ApiOperation({ summary: 'Upcoming games, soonest first (public)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, type: [Fixture] })
  findUpcoming(@Query('limit') limit?: string) {
    const n = Number(limit);
    return this.service.findUpcoming(Number.isFinite(n) && n > 0 ? n : undefined);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Games already played, newest first (public)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findRecent(@Query('limit') limit?: string) {
    const n = Number(limit);
    return this.service.findRecent(Number.isFinite(n) && n > 0 ? n : 10);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Every fixture, past and future (admin)' })
  findAllFixtures() {
    return this.service.findAllFixtures();
  }

  @Get('seasons')
  @ApiOperation({ summary: 'Season labels in use (public)' })
  findSeasons() {
    return this.service.findSeasons();
  }

  /**
   * A calendar a parent can subscribe to once and forget.
   *
   * Declared before the numeric :id route. Served as a file download so a tap
   * on a phone opens the calendar app, and cached briefly so a fixture change
   * reaches subscribers the same day.
   */
  @Get('calendar.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=1800')
  @ApiOperation({ summary: 'iCalendar feed of fixtures (public)' })
  @ApiQuery({ name: 'ageGroup', required: false, example: 'U13' })
  async calendar(
    @Res() res: Response,
    @Query('ageGroup') ageGroup?: string,
  ): Promise<void> {
    const body = await this.service.calendar(ageGroup);
    const name = ageGroup ? `excel-pro-${ageGroup}.ics` : 'excel-pro.ics';
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    res.send(body);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Import rows from the league spreadsheet. Matches on game number, so ' +
      'the same file can be imported repeatedly without duplicating.',
  })
  importFixtures(@Body() dto: ImportFixturesDto) {
    return this.service.importFixtures(dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add one fixture by hand (admin)' })
  createFixture(@Body() dto: CreateFixtureDto) {
    return this.service.createFixture(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a fixture or enter a score (admin)' })
  updateFixture(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFixtureDto,
  ) {
    return this.service.updateFixture(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a fixture (admin)' })
  removeFixture(@Param('id', ParseIntPipe) id: number) {
    return this.service.removeFixture(id);
  }
}
