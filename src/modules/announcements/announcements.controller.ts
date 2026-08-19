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
import { AnnouncementsService } from './announcements.service';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';
import { Announcement } from './entities/announcement.entity';

@ApiTags('Announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @ApiOperation({ summary: 'Get active announcements (public)' })
  @ApiResponse({
    status: 200,
    description: 'Active announcements, newest first',
    type: [Announcement],
  })
  findActive() {
    return this.announcementsService.findActive();
  }

  @Get('all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all announcements (admin)' })
  @ApiResponse({
    status: 200,
    description: 'All announcements, newest first',
    type: [Announcement],
  })
  findAll() {
    return this.announcementsService.findAll();
  }

  // Declared before the :id routes so a slug is never parsed as a number.
  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Get one post by URL segment (public)' })
  @ApiParam({ name: 'slug', example: 'u13-markham-cup-final' })
  @ApiResponse({ status: 200, type: Announcement })
  findBySlug(@Param('slug') slug: string) {
    return this.announcementsService.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an announcement (admin)' })
  @ApiBody({ type: CreateAnnouncementDto })
  @ApiResponse({ status: 201, type: Announcement })
  create(@Body() dto: CreateAnnouncementDto) {
    return this.announcementsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an announcement (admin)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateAnnouncementDto })
  @ApiResponse({ status: 200, type: Announcement })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    return this.announcementsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an announcement (admin)' })
  @ApiParam({ name: 'id', type: Number })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.announcementsService.remove(id);
  }
}
