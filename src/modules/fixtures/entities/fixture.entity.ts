import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export type FixtureSource = 'import' | 'manual';

/**
 * One scheduled game.
 *
 * Stored as **opponent + isHome** rather than team1/team2. We are always one
 * of the two sides, so keeping both names means every screen has to work out
 * which one is us before it can print anything. This way the page just says
 * "vs Slavia FC" or "at Slavia FC".
 *
 * `gameNumber` is the league's own id from the spreadsheet, which makes
 * importing idempotent: the same file dropped in twice updates twenty rows
 * instead of creating twenty more. It is nullable because a friendly typed in
 * by hand has no league number.
 */
@Entity('fixture')
@Index(['kickoff'])
export class Fixture {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: "The league's own game number, used to match on re-import",
    example: '3127',
    required: false,
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  gameNumber: string | null;

  @ApiProperty({
    description:
      'Which of our teams played it. This, not the age group, is the durable ' +
      'link: the squad that is U10 this season is U11 the next, and matching ' +
      'on the label alone would hand last season\'s games to whichever team ' +
      'inherits the name.',
    required: false,
    nullable: true,
  })
  @Column({ type: 'int', nullable: true })
  teamId: number | null;

  @ApiProperty({
    description:
      'The age group as the league wrote it at the time. Kept alongside ' +
      'teamId so an old result still reads "U10" even after that squad has ' +
      'moved up.',
    example: 'U13',
  })
  @Column({ type: 'text', default: '' })
  ageGroup: string;

  @ApiProperty({
    description: 'Division as the league writes it',
    example: 'Boys Under 13 Tier 2/Tier 3',
    default: '',
  })
  @Column({ type: 'text', default: '' })
  division: string;

  @ApiProperty({ description: 'Competition', example: 'TOSL', default: 'TOSL' })
  @Column({ type: 'text', default: 'TOSL' })
  competition: string;

  @ApiProperty({
    description:
      'Kick-off, stored as local Toronto time exactly as the league prints ' +
      'it. Deliberately not converted to UTC: the spreadsheet carries no zone, ' +
      'and guessing one is how a 6:30pm game becomes 2:30pm on the website.',
  })
  @Column({ type: 'timestamp' })
  kickoff: Date;

  @ApiProperty({ description: 'Who we are playing', example: 'Slavia FC' })
  @Column({ type: 'text', default: '' })
  opponent: string;

  @ApiProperty({ description: 'True when we are the home side', default: true })
  @Column({ type: 'boolean', default: true })
  isHome: boolean;

  @ApiProperty({
    description: 'Field or venue. Empty when the league has not set one yet.',
    default: '',
  })
  @Column({ type: 'text', default: '' })
  venue: string;

  @ApiProperty({ description: 'Our goals', required: false, nullable: true })
  @Column({ type: 'int', nullable: true })
  ourScore: number | null;

  @ApiProperty({ description: 'Their goals', required: false, nullable: true })
  @Column({ type: 'int', nullable: true })
  theirScore: number | null;

  @ApiProperty({
    description:
      'Which season this game belongs to, e.g. "2026/27". Derived from the ' +
      'kick-off on import and overridable, so last year\'s results can be ' +
      'kept without cluttering this year\'s list.',
    default: '',
  })
  @Column({ type: 'text', default: '' })
  season: string;

  @ApiProperty({
    description: 'scheduled | played | postponed | cancelled',
    default: 'scheduled',
  })
  @Column({ type: 'text', default: 'scheduled' })
  status: string;

  @ApiProperty({
    description:
      'Where the row came from. A row edited by hand is marked manual and is ' +
      'never overwritten by a later import — the league owns the schedule, ' +
      'but a correction typed in the dashboard wins.',
    default: 'import',
  })
  @Column({ type: 'text', default: 'import' })
  source: string;

  @ApiProperty({ description: 'Anything worth noting', default: '' })
  @Column({ type: 'text', default: '' })
  notes: string;

  @ApiProperty({ description: 'Hidden from the site when false', default: true })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  @UpdateDateColumn()
  updatedAt: Date;
}
