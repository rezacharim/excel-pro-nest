import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { AgeCategory } from './enums/ageCategory.enum';

@Entity({ name: 'matches' })
export class Match {
  @PrimaryGeneratedColumn()
  id: number;

  // @Column({ type: 'text', name: 'event_name' })
  // event_name: string;

  @Column({ type: 'timestamp', name: 'event_date' })
  match_date: Date;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // @Column({ type: 'integer', name: 'home_score', nullable: true })
  // home_score?: number;

  // @Column({ type: 'integer', name: 'away_score', nullable: true })
  // away_score?: number;

  // @Column({ type: 'text', name: 'penalty_info', nullable: true })
  // penalty_info?: string;

  @Column({ type: 'text', name: 'location' })
  location: string;

  @Column({ type: 'text', name: 'address' })
  address: string;

  // @Column({ type: 'timestamp', name: 'registration_deadline', nullable: true })
  // registration_deadline?: Date;

  // @Column({ type: 'enum', enum: MatchStatus, name: 'status' })
  // status: MatchStatus;

  @Column({ type: 'enum', enum: AgeCategory, name: 'age_category' })
  age_category: AgeCategory;

  @Column({ type: 'text', nullable: false, name: 'team1' })
  team1: string;

  @Column({ type: 'text', nullable: false, name: 'team2' })
  team2: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
