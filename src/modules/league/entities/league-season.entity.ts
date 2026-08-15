import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * One registration window for a competitive league season
 * (e.g. "Winter League 2026/27", PISL + YRSL).
 *
 * The academy runs one of these at a time, but old ones are kept so a
 * player's league history — and the money taken for it — stays auditable.
 */
@Entity('league_season')
export class LeagueSeason {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Winter League 2026/27' })
  @Column({ type: 'text' })
  name: string;

  /**
   * Age groups open for registration, stored as a comma-separated list so the
   * column needs no Postgres array handling: 'U9,U10,U11,U12,U13,U14,U15,U16'.
   */
  @ApiProperty({ example: 'U9,U10,U11,U12,U13,U14,U15,U16' })
  @Column({ type: 'text', default: 'U9,U10,U11,U12,U13,U14,U15,U16' })
  ageGroups: string;

  @ApiProperty({ description: 'First match day', required: false })
  @Column({ type: 'date', nullable: true })
  startsOn: string | null;

  @ApiProperty({ description: 'Registration + 1st payment deadline' })
  @Column({ type: 'date', nullable: true })
  firstPaymentDue: string | null;

  @ApiProperty({ description: '2nd payment deadline' })
  @Column({ type: 'date', nullable: true })
  secondPaymentDue: string | null;

  @ApiProperty({ example: 900, description: 'Total fee when registering on time' })
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 900 })
  feeTotal: number;

  @ApiProperty({ example: 1100, description: 'Total fee after the deadline' })
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1100 })
  feeLate: number;

  /**
   * Optional discounted total for families who pay everything up front.
   * Null disables the option. Paying in full removes an entire round of
   * chasing in September, so it is usually worth a small discount.
   */
  @ApiProperty({ example: 875, required: false })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  feePayInFull: number | null;

  @ApiProperty({ example: 18, description: 'Default roster cap per age group' })
  @Column({ type: 'int', default: 18 })
  capacityPerGroup: number;

  /** Shown to parents on the confirmation screen and in the receipt email. */
  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  paymentInstructions: string | null;

  @ApiProperty({ default: true })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** Closes the public form without hiding the season from the admin screens. */
  @ApiProperty({ default: true })
  @Column({ type: 'boolean', default: true })
  registrationOpen: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
