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
import { CreatePlayerMonthDto } from './dto/create-player_month.dto';
import { UpdatePlayerMonthDto } from './dto/update-player_month.dto';
import { PlayerMonth } from './entities/player_month.entity';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class PlayerMonthService {
  private supabase;
  private bucketName = 'player-month';

  constructor(
    @InjectRepository(PlayerMonth)
    private readonly playerMonthRepository: Repository<PlayerMonth>,
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
    createPlayerMonthDto: CreatePlayerMonthDto,
    file: Express.Multer.File,
  ): Promise<PlayerMonth> {
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

      const galleryItem = this.playerMonthRepository.create({
        player_name: createPlayerMonthDto.player_name,
        file_name: file.originalname,
        storage_filename: uniqueFileName,
        file_path: `/player_month/${uniqueFileName}`,
        image_url: publicUrl, // URL عمومی Supabase
        mime_type: file.mimetype,
        file_size: file.size,
        caption: createPlayerMonthDto.caption || null,
      });

      return await this.playerMonthRepository.save(galleryItem);
    } catch (error) {
      console.error('Error creating gallery item:', error);
      throw new InternalServerErrorException('Failed to upload image');
    }
  }

  async findAll(): Promise<PlayerMonth[]> {
    try {
      return await this.playerMonthRepository.find();
    } catch (error) {
      console.error('Error fetching gallery items:', error);
      throw new InternalServerErrorException('Failed to fetch images');
    }
  }

  async findOne(id: string): Promise<PlayerMonth> {
    try {
      const galleryItem = await this.playerMonthRepository.findOne({
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
    updatePlayerMonthDto: UpdatePlayerMonthDto,
  ): Promise<PlayerMonth> {
    try {
      const playerMonthItem = await this.findOne(id);

      // اگر caption در DTO باشد، آن را به‌روزرسانی کن
      if (updatePlayerMonthDto.caption !== undefined) {
        playerMonthItem.caption = updatePlayerMonthDto.caption;
      }

      // اگر player_name در DTO باشد، آن را به‌روزرسانی کن
      if (updatePlayerMonthDto.player_name !== undefined) {
        playerMonthItem.player_name = updatePlayerMonthDto.player_name;
      }

      return await this.playerMonthRepository.save(playerMonthItem);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error updating player month item:', error);
      throw new InternalServerErrorException('Failed to update player month');
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    try {
      const galleryItem = await this.findOne(id);

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
        }
      }

      await this.playerMonthRepository.remove(galleryItem);

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
