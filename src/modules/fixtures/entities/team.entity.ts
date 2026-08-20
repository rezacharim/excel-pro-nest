import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * One of the academy's competitive teams.
 *
 * Exists mainly so two things stop being hardcoded:
 *
 *  - **The photo.** Before this, the site picked a picture by age *bracket*
 *    from /public/images/person/team, and the bracket file for U9-U12 covered
 *    both the U10 and the U12 side. Four teams, three photos, and no way to
 *    fix it without a deploy.
 *  - **The name in the league's spreadsheet.** The TOSL export calls the U13s
 *    "NY Hearts A BU13T2 TOSL". The importer decides home or away by finding
 *    our own name in the row, so that string has to be editable — if TOSL
 *    renames the club and it is buried in the code, every import silently
 *    reverses every fixture.
 */
@Entity('team')
export class Team {
  @ApiProperty({ description: 'Unique identifier', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    description: 'Age group, used to match fixtures to a team',
    example: 'U13',
  })
  @Column({ type: 'text' })
  ageGroup: string;

  @ApiProperty({
    description: 'Name shown on the website',
    example: 'Excel Pro NY U13',
    default: '',
  })
  @Column({ type: 'text', default: '' })
  displayName: string;

  @ApiProperty({
    description:
      'Exactly how this team is written in the league spreadsheet. Used to ' +
      'work out whether we are the home or the away side on an imported row.',
    example: 'NY Hearts A BU13T2 TOSL',
    default: '',
  })
  @Column({ type: 'text', default: '' })
  leagueName: string;

  @ApiProperty({
    description:
      'Squad photo for the home page card. Null falls back to the age-bracket ' +
      'image shipped with the site, so a team with no photo never looks broken.',
    required: false,
    nullable: true,
  })
  @Column({ type: 'text', nullable: true })
  photoUrl: string | null;

  @ApiProperty({ description: 'Display order, lowest first', default: 0 })
  @Column({ type: 'int', default: 0 })
  sortOrder: number;

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
