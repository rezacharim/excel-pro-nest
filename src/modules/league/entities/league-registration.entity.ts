import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export type LeagueRegistrationStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'waitlist'
  | 'withdrawn'
  | 'submitted';

export type LeagueTeamRole = 'PLAYER' | 'Coach' | 'Manager';

/**
 * One player signed up for one league season.
 *
 * The personal details are SNAPSHOT here rather than read live from `users`.
 * Two reasons: the roster filed with PISL/YRSL must keep reflecting what was
 * submitted, and a parent correcting their address in December must not
 * silently alter a roster the league already holds.
 */
@Entity('league_registration')
@Index(['seasonId'])
@Index(['seasonId', 'ageGroup'])
@Index(['status'])
export class LeagueRegistration {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 1 })
  @Column({ type: 'int' })
  seasonId: number;

  /** The player's row in `users`. Null only for a staff-only row. */
  @ApiProperty({ required: false })
  @Column({ type: 'int', nullable: true })
  userId: number | null;

  @ApiProperty({ example: 'U13' })
  @Column({ type: 'varchar' })
  ageGroup: string;

  /**
   * Team name exactly as the league expects it on the import sheet
   * (e.g. 'Pars FC U13'). Set by an admin once squads are decided; until
   * then the export falls back to 'Excel Pro <ageGroup>'.
   */
  @ApiProperty({ required: false, example: 'Pars FC U13' })
  @Column({ type: 'varchar', nullable: true })
  teamName: string | null;

  @ApiProperty({ required: false, enum: ['PISL', 'YRSL'] })
  @Column({ type: 'varchar', nullable: true })
  league: string | null;

  @ApiProperty({ enum: ['PLAYER', 'Coach', 'Manager'], default: 'PLAYER' })
  @Column({ type: 'varchar', default: 'PLAYER' })
  teamRole: LeagueTeamRole;

  // ---- snapshot: the 14 columns of the league import sheet ----
  @ApiProperty() @Column({ type: 'varchar' }) firstName: string;
  @ApiProperty() @Column({ type: 'varchar' }) lastName: string;
  @ApiProperty() @Column({ type: 'varchar' }) email: string;
  @ApiProperty({ example: '2013-10-15' })
  @Column({ type: 'date', nullable: true })
  dateOfBirth: string | null;
  /** 'M' or 'F' — the league sheet accepts nothing else. */
  @ApiProperty({ enum: ['M', 'F'] })
  @Column({ type: 'varchar', default: 'M' })
  gender: string;
  @ApiProperty() @Column({ type: 'varchar' }) phone: string;
  @ApiProperty() @Column({ type: 'text', nullable: true }) address1: string | null;
  @ApiProperty() @Column({ type: 'varchar', nullable: true }) city: string | null;
  @ApiProperty({ default: 'ON' })
  @Column({ type: 'varchar', default: 'ON' })
  province: string;
  @ApiProperty() @Column({ type: 'varchar', nullable: true }) postalCode: string | null;
  @ApiProperty({ default: 'Canada' })
  @Column({ type: 'varchar', default: 'Canada' })
  country: string;

  // ---- academy side ----
  @ApiProperty({ required: false }) @Column({ type: 'text', nullable: true })
  parentName: string | null;

  @ApiProperty({
    enum: ['pending_payment', 'confirmed', 'waitlist', 'withdrawn', 'submitted'],
    default: 'pending_payment',
  })
  @Column({ type: 'varchar', default: 'pending_payment' })
  status: LeagueRegistrationStatus;

  /** Registered after the deadline, so charged the late fee. */
  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false })
  isLate: boolean;

  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false })
  payInFull: boolean;

  @ApiProperty({ example: 900 })
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 900 })
  feeTotal: number;

  // ---- the two installments ----
  // Kept as columns rather than rows so a registration is one object to read
  // and one row to update. A real `payments` row is created only when money
  // actually arrives, which keeps the finance dashboard honest.
  @ApiProperty({ example: 450 })
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 450 })
  firstAmount: number;

  @ApiProperty({ required: false })
  @Column({ type: 'date', nullable: true })
  firstDueDate: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'timestamp', nullable: true })
  firstPaidAt: Date | null;

  /** Id of the `payments` row created when installment 1 was recorded. */
  @ApiProperty({ required: false })
  @Column({ type: 'int', nullable: true })
  firstPaymentId: number | null;

  @ApiProperty({ example: 450 })
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 450 })
  secondAmount: number;

  @ApiProperty({ required: false })
  @Column({ type: 'date', nullable: true })
  secondDueDate: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'timestamp', nullable: true })
  secondPaidAt: Date | null;

  @ApiProperty({ required: false })
  @Column({ type: 'int', nullable: true })
  secondPaymentId: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  medicalNotes: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', nullable: true })
  jerseySize: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', nullable: true })
  previousClub: string | null;

  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false })
  consentTerms: boolean;

  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false })
  consentPhoto: boolean;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  adminNote: string | null;

  /** Set when the roster containing this player was filed with the league. */
  @ApiProperty({ required: false })
  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
# Backend changes — excel-pro-nest

Three small edits. **Every new column is nullable or has a default**, because
`synchronize` is effectively on in production and a NOT NULL column on a
populated table is a boot-time crash. See `claude/DANGER-typeorm-synchronize.md`.

---

## BLOCK 1 — Entity columns

Paste these columns at the end of the existing column list.

```ts
  // --- Agreement acceptance (added round 19) ---
  // All nullable: existing rows predate the agreement and must stay valid.

  @Column({ type: 'varchar', nullable: true })
  agreementVersion: string | null;

  @Column({ type: 'varchar', nullable: true })
  parentSignature: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  agreementAcceptedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  agreementIp: string | null;

  @Column({ type: 'boolean', nullable: true })
  acceptedConcussion: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  acceptedMedical: boolean | null;

  // null = never asked (pre-agreement rows). Treat null as "no consent".
  @Column({ type: 'boolean', nullable: true })
  photoConsent: boolean | null;
```

---

## BLOCK 2 — DTO fields

```ts
  @IsOptional() @IsString()
  agreementVersion?: string;

  @IsOptional() @IsString() @MaxLength(120)
  parentSignature?: string;

  @IsOptional() @IsBoolean()
  acceptedConcussion?: boolean;

  @IsOptional() @IsBoolean()
  acceptedMedical?: boolean;

  @IsOptional() @IsBoolean()
  photoConsent?: boolean;
```

Keep them optional in the DTO. The **frontend** enforces that they are present;
making them required here would reject any older client still in a parent's
browser cache and produce a failed registration with no explanation.

---

## BLOCK 3 — Service

In the registration create method, where the entity is built:

```ts
    registration.agreementVersion = dto.agreementVersion ?? null;
    registration.parentSignature = dto.parentSignature?.trim() ?? null;
    registration.acceptedConcussion = dto.acceptedConcussion ?? null;
    registration.acceptedMedical = dto.acceptedMedical ?? null;
    registration.photoConsent = dto.photoConsent ?? null;
    registration.agreementAcceptedAt = dto.agreementVersion ? new Date() : null;
    registration.agreementIp = ip ?? null;
```

## BLOCK 3b — Controller (replaces the existing create method)

```ts
  @Post()
  create(@Body() dto: CreateRegistrationDto, @Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;
    return this.service.create(dto, ip);
  }
```

On Vercel the real client IP is in `x-forwarded-for`; `remoteAddress` is the
edge proxy, so take the first entry of the header.

---

## BLOCK 4 — Roster export columns

Wherever `Export roster` builds its rows, add:

```ts
    'Photo consent': r.photoConsent === true ? 'YES' : 'NO',
    'Agreement': r.agreementAcceptedAt
      ? `${r.agreementVersion} ${r.agreementAcceptedAt.toISOString().slice(0, 10)}`
      : 'MISSING',
```

`photoConsent === true` and not `!!r.photoConsent` is deliberate: a null must
read as NO, never as unknown-so-probably-fine. This is the column you check
before posting a reel.

---

## Do NOT add a uniqueness constraint or an index on any of these

Nothing queries them by value, and a unique constraint on a populated table is
exactly what took the API down on 2026-08-16.

