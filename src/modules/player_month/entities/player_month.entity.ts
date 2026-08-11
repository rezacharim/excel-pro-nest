import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('player_month')
export class PlayerMonth {
  @ApiProperty({
    description: 'Unique identifier for the player_month entry',
    example: '1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'player name of the image',
    example: 'John Doe',
  })
  @Column({ name: 'player_name' })
  player_name: string;

  @ApiProperty({
    description: 'System filename of the stored image',
    example: '550e8400-e29b-41d4-a716-446655440000.jpg',
  })
  @Column({ name: 'storage_filename' })
  storage_filename: string;

  @ApiProperty({
    description: 'Original filename of the uploaded image',
    example: 'beach-sunset.jpg',
  })
  @Column({ name: 'file_name' })
  file_name: string;

  @ApiProperty({
    description: 'Path to the file in storage',
    example: 'user-id/image-123.jpg',
  })
  @Column({ name: 'file_path' })
  file_path: string;

  @ApiProperty({
    description: 'The URL to access the image',
    example: 'https://example.com/uploads/gallery/image-123.jpg',
  })
  @Column({ name: 'image_url' })
  image_url: string;

  @ApiProperty({
    description: 'MIME type of the image',
    example: 'image/jpeg',
  })
  @Column({ name: 'mime_type' })
  mime_type: string;

  @ApiProperty({
    description: 'Size of the file in bytes',
    example: 1024000,
  })
  @Column({ name: 'file_size' })
  file_size: number;

  @ApiProperty({
    description: 'Caption for the image',
    example: 'Sunset at the beach',
    required: false,
  })
  @Column({ name: 'caption', nullable: true })
  caption?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2023-10-15T14:30:00Z',
  })
  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2023-10-15T15:45:00Z',
  })
  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
