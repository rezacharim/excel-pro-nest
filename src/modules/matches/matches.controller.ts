import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { Match } from './entities/match.entity';
import { AgeCategory } from './entities/enums/ageCategory.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { MatchStatus } from './entities/enums/matchStatus.enum';

@ApiTags('Matches') // API Group in Swagger
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @ApiOperation({ summary: 'Retrieve all matches' })
  @ApiResponse({
    status: 200,
    description: 'List of all matches',
    type: [Match],
  })
  @Get()
  findAll() {
    return this.matchesService.findAll();
  }

  @ApiOperation({ summary: 'Filter matches based on criteria' })
  @ApiQuery({
    name: 'category',
    enum: AgeCategory,
    required: false,
    description: 'Age category of the match',
  })
  @ApiQuery({ name: 'refereeId', required: false, description: 'Referee ID' })
  @ApiQuery({
    name: 'homeTeamId',
    required: false,
    description: 'Home team ID',
  })
  @ApiQuery({
    name: 'awayTeamId',
    required: false,
    description: 'Away team ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Filtered list of matches',
    type: [Match],
  })
  @Get('filter')
  findFilteredMatches(
    @Query('category') category?: AgeCategory,
    @Query('refereeId') refereeId?: number,
    @Query('homeTeamId') homeTeamId?: number,
    @Query('awayTeamId') awayTeamId?: number,
  ) {
    return this.matchesService.findFilteredMatches({
      category,
      refereeId,
      homeTeamId,
      awayTeamId,
    });
  }

  @ApiOperation({ summary: 'Retrieve match details by ID' })
  @ApiParam({ name: 'id', description: 'Match ID', example: 1 })
  @ApiResponse({ status: 200, description: 'Match details', type: Match })
  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.matchesService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new match' })
  @ApiBody({ type: CreateMatchDto })
  @ApiResponse({
    status: 201,
    description: 'Match successfully created',
    type: Match,
  })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createMatchDto: CreateMatchDto) {
    return this.matchesService.create(createMatchDto);
  }

  @ApiOperation({ summary: 'Update an existing match' })
  @ApiParam({ name: 'id', description: 'Match ID', example: 1 })
  @ApiBody({ type: UpdateMatchDto })
  @ApiResponse({
    status: 200,
    description: 'Match successfully updated',
    type: Match,
  })
  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: number, @Body() updateMatchDto: UpdateMatchDto) {
    return this.matchesService.update(id, updateMatchDto);
  }

  @ApiOperation({ summary: 'Delete a match' })
  @ApiParam({ name: 'id', description: 'Match ID', example: 1 })
  @ApiResponse({ status: 200, description: 'Match successfully deleted' })
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.matchesService.remove(id);
  }
}
