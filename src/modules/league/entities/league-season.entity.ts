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
   * URL key for the public page: 'winter-league' is served at /league,
   * 'indoor' at /indoor. Having a slug is what lets two programs take
   * registrations at the same time, and what lets a season be replaced next
   * year by adding a row rather than changing code.
   */
  @ApiProperty({ example: 'indoor' })
  @Column({ type: 'varchar', nullable: true, unique: true })
  slug: string | null;

  @ApiProperty({ enum: ['league', 'indoor'], default: 'league' })
  @Column({ type: 'varchar', default: 'league' })
  kind: string;

  /** Headline shown on the public page, e.g. 'Indoor Season 2026/27'. */
  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  tagline: string | null;

  /**
   * What the money being collected now actually buys. The indoor deposit pays
   * for March and April even though it is taken in September, and a parent
   * who is not told that assumes it is a mistake.
   */
  @ApiProperty({ required: false, example: 'Covers March & April' })
  @Column({ type: 'text', nullable: true })
  paymentCoversNote: string | null;

  /**
   * The parts a booking is made of. Kept as separate amounts rather than one
   * total so the page can itemise them: an $835 figure with no explanation
   * generates a message asking what it is, every single time.
   *
   *   deposit      what every player pays now to hold the spot
   *   firstTerm    a new player's first two months, charged up front
   *   uniform      one-time kit, paid online and collected at first practice
   *
   * Existing member pays: deposit
   * New player pays:      deposit + firstTerm + uniform
   */
  @ApiProperty({ required: false, example: 380 })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  depositAmount: number | null;

  @ApiProperty({ required: false, example: 380 })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  firstTermAmount: number | null;

  @ApiProperty({ required: false, example: 75 })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  uniformFee: number | null;

  /**
   * Explicit override for what a new player pays. Normally left null and
   * worked out from the three amounts above.
   */
  @ApiProperty({ required: false, example: 835 })
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  newPlayerFee: number | null;

  /** 1 = a single payment (indoor deposit), 2 = the league's two installments. */
  @ApiProperty({ enum: [1, 2], default: 2 })
  @Column({ type: 'int', default: 2 })
  installmentCount: number;

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
   * The date the late fee starts applying. Usually the same as
   * firstPaymentDue, but an academy may hold the normal price until the
   * second installment date instead — so it is stated explicitly rather than
   * inferred, because getting it wrong on a public page is a money dispute.
   */
  @ApiProperty({ required: false, example: '2026-08-25' })
  @Column({ type: 'date', nullable: true })
  lateFeeFrom: string | null;

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

  /**
   * Per-age-group overrides, e.g. 'U9:12,U13:16'. A squad is not always the
   * same size, and the number shown to parents should be the real target for
   * that group rather than one blanket figure.
   */
  @ApiProperty({ required: false, example: 'U9:12,U16:20' })
  @Column({ type: 'text', nullable: true })
  capacityOverrides: string | null;

  /**
   * How the remaining-spots figure is presented:
   *
   *  count     always show the exact number
   *  threshold show the number only once it is at or below spotsThreshold,
   *            otherwise a neutral "Spots available" (the default — a big
   *            number reads as "no rush", which is the opposite of useful)
   *  status    never a number, just Open / Filling fast / Almost full / Full
   *  hidden    show nothing; rely on the deadline instead
   */
  @ApiProperty({
    enum: ['count', 'threshold', 'status', 'hidden'],
    default: 'threshold',
  })
  @Column({ type: 'varchar', default: 'threshold' })
  spotsDisplay: string;

  /** Below or equal to this, the exact number is shown. */
  @ApiProperty({ example: 6, default: 6 })
  @Column({ type: 'int', default: 6 })
  spotsThreshold: number;

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
