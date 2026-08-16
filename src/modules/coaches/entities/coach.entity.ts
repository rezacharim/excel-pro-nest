import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/** One picture in a coach's profile gallery. */
export interface CoachPhoto {
  url: string;
  caption?: string;
}

/**
 * A coach shown on the public /coaches page.
 *
 * Deliberately plain: the academy adds and removes coaches often enough that
 * editing a hardcoded array and redeploying was the real cost. Everything a
 * card needs lives here so the dashboard can own the whole lifecycle.
 */
@Entity('coach')
export class Coach {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'Coach full name', example: 'Iman Badamaki' })
  @Column({ type: 'text' })
  name: string;

  @ApiProperty({
    description:
      'URL segment for the profile page, e.g. "reza-abedian" serves ' +
      '/coaches/reza-abedian. Derived from the name when not supplied.',
    example: 'iman-badamaki',
  })
  @Column({ type: 'varchar', unique: true })
  slug: string;

  @ApiProperty({
    description: 'Title shown under the name',
    example: 'Youth Coach',
  })
  @Column({ type: 'text' })
  role: string;

  @ApiProperty({ description: 'Short biography shown on the card' })
  @Column({ type: 'text', default: '' })
  bio: string;

  @ApiProperty({
    description:
      'Photo URL. Either a path under /images/person/ or a full URL from the Gallery.',
    required: false,
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @ApiProperty({
    description:
      'The long story shown on the profile page: playing career through to ' +
      'coaching. Blank lines separate paragraphs. The short bio above still ' +
      'drives the card on /coaches.',
    default: '',
  })
  @Column({ type: 'text', default: '' })
  longBio: string;

  @ApiProperty({
    description:
      'Gallery photos for the profile page, in display order. Stored as ' +
      'JSON so a caption can travel with each picture.',
    example: [{ url: 'https://…/photo.jpg', caption: 'Persepolis FC, 2004' }],
  })
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  photos: CoachPhoto[];

  @ApiProperty({
    description:
      'Display order on the page, lowest first. Ties fall back to id so the ' +
      'order is always stable.',
    example: 10,
  })
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @ApiProperty({
    description: 'Hidden from the public page when false',
    default: true,
  })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn()
  updatedAt: Date;
}
