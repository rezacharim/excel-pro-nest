import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { Gallery } from './entities/gallery.entity';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class GalleryService {
  private supabase;
  private bucketName = 'gallery';

  constructor(
    @InjectRepository(Gallery)
    private readonly galleryRepository: Repository<Gallery>,
    private readonly configService: ConfigService,
  ) {
    // مقداردهی کلاینت Supabase
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration');
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  async create(
    createGalleryDto: CreateGalleryDto,
    file: Express.Multer.File,
  ): Promise<Gallery> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      if (!this.supabase) {
        throw new InternalServerErrorException(
          'Storage service not configured',
        );
      }

      const uniqueFileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;

      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(uniqueFileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) {
        console.error('Error uploading to Supabase:', error);
        throw new InternalServerErrorException(
          'Failed to upload file to storage',
        );
      }

      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(uniqueFileName);

      const publicUrl = urlData.publicUrl;

      const galleryItem = this.galleryRepository.create({
        title: createGalleryDto.title,
        file_name: file.originalname,
        storage_filename: uniqueFileName,
        file_path: `/gallery/${uniqueFileName}`,
        image_url: publicUrl, // URL عمومی Supabase
        mime_type: file.mimetype,
        file_size: file.size,
        caption: createGalleryDto.caption || null,
      });

      return await this.galleryRepository.save(galleryItem);
    } catch (error) {
      console.error('Error creating gallery item:', error);
      throw new InternalServerErrorException('Failed to upload image');
    }
  }

  async findAll(): Promise<Gallery[]> {
    try {
      return await this.galleryRepository.find();
    } catch (error) {
      console.error('Error fetching gallery items:', error);
      throw new InternalServerErrorException('Failed to fetch images');
    }
  }

  async findOne(id: string): Promise<Gallery> {
    try {
      const galleryItem = await this.galleryRepository.findOne({
        where: { id },
      });

      if (!galleryItem) {
        throw new NotFoundException(`Image with ID ${id} not found`);
      }

      return galleryItem;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error fetching gallery item:', error);
      throw new InternalServerErrorException('Failed to fetch image');
    }
  }

  async getFile(id: string, res: Response): Promise<void> {
    try {
      const galleryItem = await this.findOne(id);

      // هدایت به URL عمومی Supabase
      return res.redirect(galleryItem.image_url);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error fetching gallery file:', error);
      throw new InternalServerErrorException('Failed to fetch image file');
    }
  }

  async update(
    id: string,
    updateGalleryDto: UpdateGalleryDto,
  ): Promise<Gallery> {
    try {
      const galleryItem = await this.findOne(id);

      // بروزرسانی فقط فیلدهایی که ارائه شده‌اند
      if (updateGalleryDto.caption !== undefined) {
        galleryItem.caption = updateGalleryDto.caption;
      }

      return await this.galleryRepository.save(galleryItem);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error updating gallery item:', error);
      throw new InternalServerErrorException('Failed to update image');
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      const galleryItem = await this.findOne(id);

      // اگر Supabase تنظیم شده است، فایل را حذف کن
      if (this.supabase) {
        try {
          const { error } = await this.supabase.storage
            .from(this.bucketName)
            .remove([galleryItem.storage_filename]);

          if (error) {
            console.error('Error removing file from Supabase storage:', error);
          }
        } catch (fileError) {
          console.error('Error removing file from storage:', fileError);
          // ادامه حذف از دیتابیس حتی اگر حذف فایل با خطا مواجه شود
        }
      }

      // حذف از دیتابیس
      await this.galleryRepository.remove(galleryItem);

      return { message: 'Image deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error deleting gallery item:', error);
      throw new InternalServerErrorException('Failed to delete image');
    }
  }
}
