import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import { Gallery } from './entities/gallery.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Gallery]),
    AuthModule,
    MulterModule.registerAsync({
      imports: [ConfigModule, AuthModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        storage: diskStorage({
          destination: (req, file, cb) => {
            const uploadPath = configService.get(
              'UPLOAD_PATH',
              './uploads/gallery',
            );
            cb(null, uploadPath);
          },
          filename: (req, file, cb) => {
            // Generate a unique filename
            const fileName = `${uuidv4()}${extname(file.originalname)}`;
            cb(null, fileName);
          },
        }),
        fileFilter: (req, file, cb) => {
          // Accept any image. The old list was jpg/jpeg/png/gif/webp, which
          // silently rejected HEIC from iPhones, AVIF, TIFF and .jfif scans —
          // and the rejection surfaced to the admin as a bare "Upload failed"
          // with no mention of the file type.
          if (!file.mimetype?.startsWith('image/')) {
            return cb(
              new Error(
                `That file is a ${file.mimetype || 'unknown type'}, not an image.`,
              ),
              false,
            );
          }
          cb(null, true);
        },
        limits: {
          // Matches the controller. The real ceiling is Vercel's 4.5MB request
          // body limit, which we cannot raise — the browser shrinks photos
          // before sending for that reason.
          fileSize: 10 * 1024 * 1024,
        },
      }),
    }),
  ],
  controllers: [GalleryController],
  providers: [GalleryService],
  exports: [GalleryService],
})
export class GalleryModule {}
