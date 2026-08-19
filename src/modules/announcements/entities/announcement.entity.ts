import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export type AnnouncementCategory =
  | 'league'
  | 'trial'
  | 'news'
  | 'match'
  | 'medal'
  | 'interview';

export const ANNOUNCEMENT_CATEGORIES: AnnouncementCategory[] = [
  'league',
  'trial',
  'news',
  'match',
  'medal',
  'interview',
];

/** One picture in a post's photo gallery. */
export interface AnnouncementPhoto {
  url: string;
  caption?: string;
}

@Entity('announcement')
export class Announcement {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Announcement title' })
  @Column({ type: 'text' })
  title: string;

  @ApiProperty({
    description:
      'URL segment for the full post, e.g. "u13-win-markham-cup" serves ' +
      '/announcements/u13-win-markham-cup. Generated from the title.',
    required: false,
    nullable: true,
  })
  // Deliberately nullable. A unique NOT NULL column added to a table that
  // already has rows is what took the API down on 2026-08-16: schema sync
  // cannot fill it, so it crashes on boot. Nullable costs nothing here.
  @Column({ type: 'varchar', nullable: true, unique: true })
  slug: string | null;

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

  @ApiProperty({
    description:
      'The full story shown on the post\'s own page — match report, medal ' +
      'day write-up, interview. Supports ## headings, - bullets and **bold**. ' +
      'Empty means the post is a short notice with no page of its own.',
    default: '',
  })
  @Column({ type: 'text', default: '' })
  fullBody: string;

  @ApiProperty({
    description: 'Photo gallery for the full post, in display order',
    example: [{ url: 'https://…/medal.jpg', caption: 'U13 medal presentation' }],
  })
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  photos: AnnouncementPhoto[];

  @ApiProperty({
    description:
      'When the thing happened, if that differs from when it was posted — ' +
      'the date of the match or the presentation.',
    required: false,
    nullable: true,
  })
  @Column({ type: 'date', nullable: true })
  eventDate: string | null;

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
