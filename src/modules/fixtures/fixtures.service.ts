import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Fixture } from './entities/fixture.entity';
import { Team } from './entities/team.entity';
import { buildCalendar } from './calendar';
import {
  CreateFixtureDto,
  CreateTeamDto,
  ImportFixturesDto,
  UpdateFixtureDto,
  UpdateTeamDto,
} from './dto/fixture.dto';

/**
 * "2026-09-02 18:30" -> a Date carrying exactly those wall-clock numbers.
 *
 * `new Date("2026-09-02 18:30")` would be read in the server's zone, and the
 * server is not in Toronto. The column is a plain timestamp with no zone, so
 * the safe thing is to build the value component by component and let it mean
 * what the league spreadsheet said it meant.
 */
/**
 * The season a game belongs to.
 *
 * Excel Pro runs two: the summer season finishes at the end of September, and
 * the Winter League starts in October. The boundary is **1 October**, not the
 * calendar year and not August.
 *
 *   Apr - Sep  ->  "Summer 2026"
 *   Oct - Mar  ->  "Winter 2026/27"
 *
 * This matters beyond tidiness: age groups are redrawn between the two, so a
 * squad is U10 in the summer and U11 from October. Labelling both halves of
 * the year the same would put two different age groups under one season and
 * make the dashboard filter useless exactly when it is needed.
 */
export const seasonFor = (kickoff: Date): string => {
  const y = kickoff.getFullYear();
  const m = kickoff.getMonth();
  if (m >= 9 || m <= 2) {
    const start = m >= 9 ? y : y - 1;
    return `Winter ${start}/${String((start + 1) % 100).padStart(2, '0')}`;
  }
  return `Summer ${y}`;
};

const parseKickoff = (value: string): Date => {
  const m = String(value)
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/);
  if (!m) {
    const fallback = new Date(value);
    if (Number.isNaN(fallback.getTime())) {
      throw new Error(`Could not read the kick-off time "${value}"`);
    }
    return fallback;
  }
  const [, y, mo, d, h, mi] = m;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    0,
  );
};

@Injectable()
export class FixturesService {
  constructor(
    @InjectRepository(Fixture)
    private readonly fixtures: Repository<Fixture>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
  ) {}

  /* ---------------------------------------------------------------- teams */

  findActiveTeams(): Promise<Team[]> {
    return this.teams.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  findAllTeams(): Promise<Team[]> {
    return this.teams.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async createTeam(dto: CreateTeamDto): Promise<Team> {
    const team = this.teams.create({
      ageGroup: dto.ageGroup.trim(),
      displayName: dto.displayName ?? `Excel Pro NY ${dto.ageGroup.trim()}`,
      leagueName: dto.leagueName ?? '',
      photoUrl: dto.photoUrl || null,
      sortOrder: dto.sortOrder ?? (await this.nextTeamOrder()),
      isActive: dto.isActive ?? true,
    });
    return this.teams.save(team);
  }

  async updateTeam(id: number, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.teams.findOne({ where: { id } });
    if (!team) throw new NotFoundException(`Team ${id} not found`);
    if (dto.ageGroup !== undefined && dto.ageGroup.trim() !== team.ageGroup) {
      // Moving a squad up a group is a rename, and the destination may already
      // exist because an import created it. Saying so is far more useful than
      // a unique-constraint error out of Postgres.
      const clash = await this.teams.findOne({
        where: { ageGroup: dto.ageGroup.trim() },
      });
      if (clash && clash.id !== team.id) {
        throw new ConflictException(
          `There is already a ${dto.ageGroup.trim()} team. Delete that one ` +
            `first if this squad is taking its place — its games will stay ` +
            `and re-link on the next import.`,
        );
      }
      team.ageGroup = dto.ageGroup.trim();
    }
    if (dto.displayName !== undefined) team.displayName = dto.displayName;
    if (dto.leagueName !== undefined) team.leagueName = dto.leagueName;
    // An empty string clears the photo; undefined leaves it alone.
    if (dto.photoUrl !== undefined) team.photoUrl = dto.photoUrl || null;
    if (dto.sortOrder !== undefined) team.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) team.isActive = dto.isActive;
    return this.teams.save(team);
  }

  async removeTeam(id: number): Promise<{ deleted: boolean; id: number }> {
    const team = await this.teams.findOne({ where: { id } });
    if (!team) throw new NotFoundException(`Team ${id} not found`);
    await this.teams.remove(team);
    return { deleted: true, id };
  }

  private async nextTeamOrder(): Promise<number> {
    const last = await this.teams.find({ order: { sortOrder: 'DESC' }, take: 1 });
    return (last[0]?.sortOrder ?? 0) + 10;
  }

  /* ------------------------------------------------------------- fixtures */

  /** Everything still to play, soonest first. */
  async findUpcoming(limit?: number): Promise<Fixture[]> {
    const all = await this.fixtures.find({
      where: { isActive: true },
      order: { kickoff: 'ASC' },
    });
    // Compared in the database's own clock rather than with a SQL predicate,
    // because the column has no zone and a raw >= NOW() would drop this
    // evening's game the moment the server ticked past midnight UTC.
    const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const upcoming = all.filter((f) => f.kickoff >= cutoff);
    return typeof limit === 'number' ? upcoming.slice(0, limit) : upcoming;
  }

  /** Recently played, newest first — for results on the matchday page. */
  async findRecent(limit = 10): Promise<Fixture[]> {
    const all = await this.fixtures.find({
      where: { isActive: true },
      order: { kickoff: 'DESC' },
    });
    const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000);
    return all.filter((f) => f.kickoff < cutoff).slice(0, limit);
  }

  findAllFixtures(): Promise<Fixture[]> {
    return this.fixtures.find({ order: { kickoff: 'ASC' } });
  }

  /** Distinct season labels, newest first, for the dashboard filter. */
  async findSeasons(): Promise<string[]> {
    const rows = await this.fixtures.find({ select: ['season'] });
    return Array.from(
      new Set(rows.map((r) => r.season).filter(Boolean)),
    ).sort((a, b) => b.localeCompare(a));
  }

  /**
   * The subscribable calendar.
   *
   * Everything from a week ago onwards: a parent opening their calendar on a
   * Sunday still wants to see Saturday's game and its score, and dropping
   * played games would make the feed look empty mid-week.
   */
  async calendar(ageGroup?: string): Promise<string> {
    const [all, teams] = await Promise.all([
      this.fixtures.find({ where: { isActive: true }, order: { kickoff: 'ASC' } }),
      this.teams.find(),
    ]);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const wanted = (ageGroup ?? '').trim().toUpperCase();
    const chosen = all.filter(
      (f) =>
        f.kickoff >= since &&
        (!wanted || (f.ageGroup ?? '').toUpperCase() === wanted),
    );
    return buildCalendar(
      chosen,
      teams,
      wanted
        ? `Excel Pro ${wanted} fixtures`
        : 'Excel Pro Soccer Academy fixtures',
    );
  }

  async createFixture(dto: CreateFixtureDto): Promise<Fixture> {
    const fixture = this.fixtures.create(
      this.fromDto({ ...dto, teamId: dto.teamId ?? (await this.teamIdFor(dto.ageGroup)) }),
    );
    return this.fixtures.save(fixture);
  }

  /** The team for an age group, created if this is a new one. */
  private async teamIdFor(ageGroup?: string): Promise<number | null> {
    const key = (ageGroup ?? '').trim();
    if (!key) return null;
    const existing = await this.teams.findOne({ where: { ageGroup: key } });
    if (existing) return existing.id;
    const team = await this.createTeam({ ageGroup: key });
    return team.id;
  }

  async updateFixture(id: number, dto: UpdateFixtureDto): Promise<Fixture> {
    const fixture = await this.fixtures.findOne({ where: { id } });
    if (!fixture) throw new NotFoundException(`Fixture ${id} not found`);
    if (dto.gameNumber !== undefined) fixture.gameNumber = dto.gameNumber || null;
    if (dto.ageGroup !== undefined) {
      fixture.ageGroup = dto.ageGroup;
      // Moving a game to another age group should move it to that team too,
      // unless the caller named a team explicitly.
      if (dto.teamId === undefined) {
        fixture.teamId = await this.teamIdFor(dto.ageGroup);
      }
    }
    if (dto.teamId !== undefined) fixture.teamId = dto.teamId ?? null;
    if (dto.division !== undefined) fixture.division = dto.division;
    if (dto.competition !== undefined) fixture.competition = dto.competition;
    if (dto.kickoff !== undefined) fixture.kickoff = parseKickoff(dto.kickoff);
    if (dto.opponent !== undefined) fixture.opponent = dto.opponent;
    if (dto.isHome !== undefined) fixture.isHome = dto.isHome;
    if (dto.venue !== undefined) fixture.venue = dto.venue;
    if (dto.ourScore !== undefined) fixture.ourScore = dto.ourScore ?? null;
    if (dto.theirScore !== undefined) fixture.theirScore = dto.theirScore ?? null;
    if (dto.season !== undefined) fixture.season = dto.season;
    if (dto.status !== undefined) fixture.status = dto.status;
    if (dto.notes !== undefined) fixture.notes = dto.notes;
    if (dto.isActive !== undefined) fixture.isActive = dto.isActive;
    // Anything touched by hand stops being the league's row. A later import
    // leaves it alone from here on.
    fixture.source = 'manual';
    return this.fixtures.save(fixture);
  }

  async removeFixture(id: number): Promise<{ deleted: boolean; id: number }> {
    const fixture = await this.fixtures.findOne({ where: { id } });
    if (!fixture) throw new NotFoundException(`Fixture ${id} not found`);
    await this.fixtures.remove(fixture);
    return { deleted: true, id };
  }

  /**
   * Takes rows parsed from the league spreadsheet and makes the table match.
   *
   * Matching is on the league's game number, so importing the same export
   * twice updates rather than duplicates — which matters, because the
   * schedules arrive as four separate files and one of the four Reza sent was
   * a duplicate of another.
   *
   * A fixture whose source is 'manual' is skipped. If somebody has corrected a
   * venue or typed in a score, re-importing the league's file should not throw
   * that away.
   */
  async importFixtures(dto: ImportFixturesDto): Promise<{
    created: number;
    updated: number;
    skipped: number;
    total: number;
    teamsCreated: string[];
  }> {
    const rows = dto.fixtures ?? [];
    if (rows.length === 0) {
      return { created: 0, updated: 0, skipped: 0, total: 0, teamsCreated: [] };
    }

    // Resolve every age group in the paste to a team, adding any that do not
    // exist yet. A new age group appears every season — the U10s become the
    // U11s and a brand new side turns up underneath them — and making Reza go
    // and create the team first, before an import that would otherwise work,
    // is a step he would rightly forget.
    const teamsCreated: string[] = [];
    const teamByAge = new Map<string, number>();
    for (const team of await this.teams.find()) {
      if (team.ageGroup) teamByAge.set(team.ageGroup, team.id);
    }
    for (const ageGroup of new Set(
      rows.map((r) => (r.ageGroup ?? '').trim()).filter(Boolean),
    )) {
      if (teamByAge.has(ageGroup)) continue;
      const team = await this.createTeam({ ageGroup });
      teamByAge.set(ageGroup, team.id);
      teamsCreated.push(ageGroup);
    }

    const numbers = rows
      .map((r) => r.gameNumber)
      .filter((n): n is string => Boolean(n));
    const existing = numbers.length
      ? await this.fixtures.find({ where: { gameNumber: In(numbers) } })
      : [];
    const byNumber = new Map(existing.map((f) => [f.gameNumber, f]));

    const toSave: Fixture[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    // Guards against a single paste containing the same game twice.
    const seen = new Set<string>();

    for (const row of rows) {
      const key = row.gameNumber ?? '';
      if (key && seen.has(key)) {
        skipped += 1;
        continue;
      }
      if (key) seen.add(key);

      const resolved: CreateFixtureDto = {
        ...row,
        teamId:
          row.teamId ?? teamByAge.get((row.ageGroup ?? '').trim()) ?? null,
      };

      const match = key ? byNumber.get(key) : undefined;
      if (match) {
        if (match.source === 'manual') {
          skipped += 1;
          continue;
        }
        Object.assign(match, this.fromDto(resolved));
        toSave.push(match);
        updated += 1;
      } else {
        toSave.push(this.fixtures.create(this.fromDto(resolved)));
        created += 1;
      }
    }

    if (toSave.length) await this.fixtures.save(toSave);
    return { created, updated, skipped, total: rows.length, teamsCreated };
  }

  private fromDto(dto: CreateFixtureDto): Partial<Fixture> {
    const kickoff = parseKickoff(dto.kickoff);
    return {
      season: dto.season || seasonFor(kickoff),
      gameNumber: dto.gameNumber || null,
      teamId: dto.teamId ?? null,
      ageGroup: (dto.ageGroup ?? '').trim(),
      division: dto.division ?? '',
      competition: dto.competition ?? 'TOSL',
      kickoff,
      opponent: (dto.opponent ?? '').trim(),
      isHome: dto.isHome ?? true,
      venue: dto.venue ?? '',
      ourScore: dto.ourScore ?? null,
      theirScore: dto.theirScore ?? null,
      status: dto.status ?? 'scheduled',
      source: dto.source ?? 'import',
      notes: dto.notes ?? '',
      isActive: dto.isActive ?? true,
    };
  }
}
