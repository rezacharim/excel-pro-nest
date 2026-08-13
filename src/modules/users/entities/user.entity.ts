import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Payment } from 'src/modules/payment/entities/payment.entity';
import {
  ExperienceLevel,
  Gender,
  PlayerPosition,
  TShirtSize,
} from './enums/enums';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  fullname: string;

  // Optional: a walk-in added at the field may not have a date of birth to
  // hand. The full online registration form still requires it.
  @Column({ nullable: true })
  dateOfBirth: string;

  @Column()
  height: number;

  @Column()
  weight: number;

  @Column({
    type: 'enum',
    enum: TShirtSize,
  })
  tShirtSize: TShirtSize;

  @Column({
    type: 'enum',
    enum: TShirtSize,
  })
  shortSize: TShirtSize;

  @Column({
    type: 'enum',
    enum: TShirtSize,
  })
  jacketSize: TShirtSize;

  @Column({
    type: 'enum',
    enum: TShirtSize,
  })
  pantsSize: TShirtSize;

  @Column({ type: 'text' })
  address: string;

  @Column()
  postalCode: string;

  @Column()
  city: string;

  @Column()
  emergencyContactName: string;

  @Column()
  emergencyPhone: string;

  @Column({
    type: 'enum',
    enum: ExperienceLevel,
  })
  experienceLevel: ExperienceLevel;

  // Optional: parents can finish signing up without a photo and add one later.
  @Column({ nullable: true })
  photoUrl: string;

  /**
   * No longer collected. The academy stopped asking families to upload
   * government ID — it is sensitive data with no operational use here. The
   * column stays nullable so existing records are untouched.
   */
  @Column({ nullable: true })
  NationalIdCard: string;

  @Column({
    type: 'enum',
    enum: Gender,
  })
  gender: Gender;

  @Column({ type: 'boolean', default: false })
  isTemporary?: boolean;

  @Column({ type: 'text' })
  parent_name: string;

  @Column({ type: 'text' })
  phone_number: string;

  @Column({ type: 'text' })
  email: string;

  @Column({
    type: 'enum',
    enum: PlayerPosition,
    nullable: true,
  })
  player_positions?: PlayerPosition;

  @Column({ type: 'varchar', length: 50, nullable: true })
  custom_position?: string;

  @Column()
  policy: boolean;

  @Column({ type: 'text', nullable: true })
  stripeCustomerId: string;

  @OneToMany(() => Payment, (payment) => payment.user)
  payments: Payment[];

  @Column({ nullable: true })
  activePlan: string;

  @Column({ nullable: true, type: 'timestamp' })
  currentSubscriptionEndDate: Date;

  /**
   * When the current paid period began. Lets an admin state a full period
   * ("paid from 1 June to 1 August") rather than only an end date, which
   * matters when catching up on records kept outside the dashboard.
   */
  @Column({ nullable: true, type: 'timestamp' })
  currentSubscriptionStartDate: Date | null;

  /** When this family was last emailed an invitation to use the website. */
  @Column({ nullable: true, type: 'timestamp' })
  invitedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: false, default: 0 })
  subscriptionCounter: number;

  // Membership lifecycle: 'active' | 'on_hold' | 'stopped' | 'suspended'
  @Column({ type: 'varchar', default: 'active' })
  membershipStatus: string;

  // --- Suspension (manual: discipline, unpaid fees, etc.) ---
  @Column({ nullable: true, type: 'timestamp' })
  suspendedAt: Date | null;

  /** 'late_payment' | 'discipline' | 'paperwork' | 'medical' | 'other' */
  @Column({ nullable: true, type: 'varchar' })
  suspensionReason: string | null;

  @Column({ nullable: true, type: 'text' })
  suspensionNote: string | null;

  // --- Payment chasing ---
  @Column({ nullable: true, type: 'timestamp' })
  lastReminderAt: Date | null;

  @Column({ nullable: false, default: 0 })
  remindersSent: number;

  // --- Coach/admin notes ---
  @Column({ nullable: true, type: 'text' })
  internalNote: string | null;

  /** 'attending' | 'irregular' | 'not_attending' */
  @Column({ type: 'varchar', default: 'attending' })
  attendanceStatus: string;

  /**
   * Allergies, asthma, medication — anything a coach must know on the field.
   * Optional, but shown prominently to admins when present.
   */
  @Column({ nullable: true, type: 'text' })
  medicalNotes: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  holdStartedAt: Date | null;

  // null = indefinite hold
  @Column({ nullable: true, type: 'timestamp' })
  holdResumeAt: Date | null;

  @Column({ nullable: true, type: 'text' })
  holdNote: string | null;
}
