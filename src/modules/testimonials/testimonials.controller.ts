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
import { TestimonialsService } from './testimonials.service';
import {
  CreateTestimonialDto,
  ReorderTestimonialsDto,
  UpdateTestimonialDto,
} from './dto/testimonial.dto';
import { Testimonial } from './entities/testimonial.entity';

@ApiTags('Testimonials')
@Controller('testimonials')
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get()
  @ApiOperation({ summary: 'Get visible testimonials in display order (public)' })
  @ApiResponse({ status: 200, type: [Testimonial] })
  findActive() {
    return this.testimonialsService.findActive();
  }

  // Declared above the numeric :id routes so "all" is never parsed as an id.
  @Get('all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get every testimonial, including hidden (admin)' })
  @ApiResponse({ status: 200, type: [Testimonial] })
  findAll() {
    return this.testimonialsService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a testimonial (admin)' })
  @ApiBody({ type: CreateTestimonialDto })
  @ApiResponse({ status: 201, type: Testimonial })
  create(@Body() dto: CreateTestimonialDto) {
    return this.testimonialsService.create(dto);
  }

  // Must stay above @Patch(':id') or Nest hands "reorder" to ParseIntPipe
  // and answers 400.
  @Patch('reorder')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set the display order (admin)' })
  @ApiBody({ type: ReorderTestimonialsDto })
  @ApiResponse({ status: 200, type: [Testimonial] })
  reorder(@Body() dto: ReorderTestimonialsDto) {
    return this.testimonialsService.reorder(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit a testimonial (admin)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateTestimonialDto })
  @ApiResponse({ status: 200, type: Testimonial })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTestimonialDto,
  ) {
    return this.testimonialsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a testimonial (admin)' })
  @ApiParam({ name: 'id', type: Number })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.testimonialsService.remove(id);
  }
}
