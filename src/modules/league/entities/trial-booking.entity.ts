import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export type TrialStatus =
  | 'booked'
  | 'attended'
  | 'no_show'
  | 'offered'
  | 'joined'
  | 'declined';

/**
 * A trial request from a player who is not yet in the academy.
 *
 * Deliberately not a `users` row: most trialists never join, and filling the
 * members table with them would distort every membership and money figure on
 * the dashboard. When one does join, `convertedUserId` links the two so the
 * academy can see how many members trials actually produce.
 */
@Entity('trial_booking')
@Index(['status'])
export class TrialBooking {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty() @Column({ type: 'varchar' }) firstName: string;
  @ApiProperty() @Column({ type: 'varchar' }) lastName: string;

  @ApiProperty({ example: '2013-10-15', required: false })
  @Column({ type: 'date', nullable: true })
  dateOfBirth: string | null;

  @ApiProperty({ enum: ['M', 'F'], required: false })
  @Column({ type: 'varchar', nullable: true })
  gender: string | null;

  @ApiProperty({ example: 'U13' })
  @Column({ type: 'varchar' })
  ageGroup: string;

  @ApiProperty() @Column({ type: 'varchar' }) parentName: string;
  @ApiProperty() @Column({ type: 'varchar' }) email: string;
  @ApiProperty() @Column({ type: 'varchar' }) phone: string;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', nullable: true })
  previousClub: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', nullable: true })
  position: string | null;

  /** Free text — the parent's preferred day/time, matched by a coach later. */
  @ApiProperty({ required: false })
  @Column({ type: 'varchar', nullable: true })
  preferredWhen: string | null;

  /** Where the family heard about the academy — cheap, useful marketing data. */
  @ApiProperty({ required: false })
  @Column({ type: 'varchar', nullable: true })
  howHeard: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'timestamp', nullable: true })
  scheduledFor: Date | null;

  @ApiProperty({
    enum: ['booked', 'attended', 'no_show', 'offered', 'joined', 'declined'],
    default: 'booked',
  })
  @Column({ type: 'varchar', default: 'booked' })
  status: TrialStatus;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  coachNotes: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'int', nullable: true })
  convertedUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
