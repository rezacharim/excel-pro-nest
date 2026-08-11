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

  @Column()
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

  @Column({ nullable: false })
  photoUrl: string;

  @Column({ nullable: false })
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: false, default: 0 })
  subscriptionCounter: number;

  // Membership lifecycle: 'active' | 'on_hold' | 'stopped'
  @Column({ type: 'varchar', default: 'active' })
  membershipStatus: string;

  @Column({ nullable: true, type: 'timestamp' })
  holdStartedAt: Date | null;

  // null = indefinite hold
  @Column({ nullable: true, type: 'timestamp' })
  holdResumeAt: Date | null;

  @Column({ nullable: true, type: 'text' })
  holdNote: string | null;
}
