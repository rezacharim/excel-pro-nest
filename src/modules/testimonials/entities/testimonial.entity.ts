import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * What a parent or player said about the academy.
 *
 * This replaces four invented quotes that shipped with the website template —
 * "James Rock from Toronto", "Sarah Johnson from Vancouver" and two others,
 * none of whom exist. They were live on excelproso.com for months because
 * changing them meant editing a hardcoded array and redeploying.
 *
 * Every column is nullable or has a default. This is a new table, so
 * synchronize creating it is safe, but the rule from the 2026-08-16 outage
 * still applies: nothing here can fail against rows that already exist.
 */
@Entity('testimonial')
export class Testimonial {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Who said it',
    example: 'Somayeh Hosseini',
  })
  @Column({ type: 'text' })
  name: string;

  @ApiProperty({
    description:
      'Their relationship to the academy, shown under the name. Concrete ' +
      'beats generic: "Parent of Arsham, U13" carries far more weight with ' +
      'another parent than "Parent" or a city name.',
    example: 'Parent of Arsham, U13',
    default: '',
  })
  @Column({ type: 'text', default: '' })
  role: string;

  @ApiProperty({
    description: 'The testimonial itself, in their own words',
    default: '',
  })
  @Column({ type: 'text', default: '' })
  quote: string;

  @ApiProperty({
    description:
      'Photo of the parent or player. Optional — a real quote with no photo ' +
      'is worth more than a real quote with a stock one, so the card falls ' +
      'back to their initials.',
    required: false,
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @ApiProperty({
    description:
      'Display order, lowest first. Ties fall back to id so the order is ' +
      'always stable.',
    example: 10,
    default: 0,
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
