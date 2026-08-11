import { Module } from '@nestjs/common';
import { PlayerMonthService } from './player_month.service';
import { PlayerMonthController } from './player_month.controller';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerMonth } from './entities/player_month.entity';
import { AuthModule } from '../auth/auth.module';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { diskStorage } from 'multer';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlayerMonth]),
    AuthModule,
    MulterModule.registerAsync({
      imports: [ConfigModule, AuthModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        storage: diskStorage({
          destination: (req, file, cb) => {
            const uploadPath = configService.get(
              'UPLOAD_PATH',
              './uploads/player-month',
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
          // Check file types
          if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
          }
          cb(null, true);
        },
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB
        },
      }),
    }),
  ],
  controllers: [PlayerMonthController],
  providers: [PlayerMonthService],
})
export class PlayerMonthModule {}
