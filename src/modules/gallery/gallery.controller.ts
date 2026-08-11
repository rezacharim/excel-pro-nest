import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { GalleryService } from './gallery.service';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Gallery } from './entities/gallery.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { memoryStorage } from 'multer';

@ApiTags('gallery')
@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createGalleryDto: CreateGalleryDto,
  ) {
    return this.galleryService.create(createGalleryDto, file);
  }

  @Get()
  @ApiOperation({ summary: 'Get all images for a user' })
  @ApiQuery({
    name: 'user_id',
    required: true,
    description: 'User ID to fetch images for',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'List of gallery images',
    type: [Gallery],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll() {
    return this.galleryService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific image by ID' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID of the image to fetch',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Gallery image details',
    type: Gallery,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.galleryService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiOperation({ summary: 'Update image details (e.g., caption)' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID of the image to update',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'The image has been successfully updated',
    type: Gallery,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateGalleryDto: UpdateGalleryDto,
  ) {
    return this.galleryService.update(id, updateGalleryDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete an image from the gallery' })
  @ApiParam({
    name: 'id',
    required: true,
    description: 'ID of the image to delete',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'The image has been successfully deleted',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Image not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.galleryService.remove(id);
  }
}
