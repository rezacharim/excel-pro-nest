import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export type AnnouncementCategory = 'league' | 'trial' | 'news';

export const ANNOUNCEMENT_CATEGORIES: AnnouncementCategory[] = [
  'league',
  'trial',
  'news',
];

@Entity('announcement')
export class Announcement {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Announcement title' })
  @Column({ type: 'text' })
  title: string;

  @ApiProperty({ description: 'Announcement body' })
  @Column({ type: 'text' })
  body: string;

  @ApiProperty({
    description: 'Announcement category',
    enum: ANNOUNCEMENT_CATEGORIES,
    example: 'news',
  })
  @Column({ type: 'varchar' })
  category: AnnouncementCategory;

  @ApiProperty({
    description: 'Optional call-to-action label',
    required: false,
    nullable: true,
  })
  @Column({ type: 'varchar', nullable: true })
  ctaLabel: string | null;

  @ApiProperty({
    description: 'Optional call-to-action URL',
    required: false,
    nullable: true,
  })
  @Column({ type: 'varchar', nullable: true })
  ctaUrl: string | null;

  @ApiProperty({
    description:
      'Optional photo shown on the news card. Any image URL — usually one picked from the Gallery.',
    required: false,
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @ApiProperty({ description: 'Whether the announcement is visible', default: true })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn()
  updatedAt: Date;
}
