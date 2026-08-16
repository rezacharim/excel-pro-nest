import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { CoachesService } from './coaches.service';
import { CreateCoachDto, ReorderCoachesDto, UpdateCoachDto } from './dto/coach.dto';
import { Coach } from './entities/coach.entity';

@ApiTags('Coaches')
@Controller('coaches')
export class CoachesController {
  constructor(private readonly coachesService: CoachesService) {}

  @Get()
  @ApiOperation({ summary: 'Get visible coaches in display order (public)' })
  @ApiResponse({ status: 200, type: [Coach] })
  findActive() {
    return this.coachesService.findActive();
  }

  @Get('all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get every coach, including hidden ones (admin)' })
  @ApiResponse({ status: 200, type: [Coach] })
  findAll() {
    return this.coachesService.findAll();
  }

  // Declared after /all so "all" is never swallowed as a slug, and before the
  // numeric :id routes below.
  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Get one coach by URL segment (public)' })
  @ApiParam({ name: 'slug', example: 'reza-abedian' })
  @ApiResponse({ status: 200, type: Coach })
  findBySlug(@Param('slug') slug: string) {
    return this.coachesService.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a coach (admin)' })
  @ApiBody({ type: CreateCoachDto })
  @ApiResponse({ status: 201, type: Coach })
  create(@Body() dto: CreateCoachDto) {
    return this.coachesService.create(dto);
  }

  @Patch('reorder')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set the display order (admin)' })
  @ApiBody({ type: ReorderCoachesDto })
  @ApiResponse({ status: 200, type: [Coach] })
  reorder(@Body() dto: ReorderCoachesDto) {
    return this.coachesService.reorder(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a coach (admin)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateCoachDto })
  @ApiResponse({ status: 200, type: Coach })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCoachDto) {
    return this.coachesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a coach (admin)' })
  @ApiParam({ name: 'id', type: Number })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.coachesService.remove(id);
  }
}
