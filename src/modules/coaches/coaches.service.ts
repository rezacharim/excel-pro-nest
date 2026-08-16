import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Coach } from './entities/coach.entity';
import { CreateCoachDto, ReorderCoachesDto, UpdateCoachDto } from './dto/coach.dto';

@Injectable()
export class CoachesService {
  constructor(
    @InjectRepository(Coach)
    private readonly repo: Repository<Coach>,
  ) {}

  /** Public list: visible coaches only, in display order. */
  findActive(): Promise<Coach[]> {
    return this.repo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  /** Admin list: includes hidden coaches so they can be brought back. */
  findAll(): Promise<Coach[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  /** One coach by URL segment. Hidden coaches are not reachable publicly. */
  async findBySlug(slug: string): Promise<Coach> {
    const coach = await this.repo.findOne({ where: { slug, isActive: true } });
    if (!coach) {
      throw new NotFoundException(`No coach at "${slug}"`);
    }
    return coach;
  }

  async create(dto: CreateCoachDto): Promise<Coach> {
    // A new coach goes to the end unless the caller says otherwise, so adding
    // someone never silently reshuffles the people already on the page.
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder());
    const coach = this.repo.create({
      name: dto.name,
      slug: await this.uniqueSlug(dto.slug || dto.name),
      role: dto.role,
      bio: dto.bio ?? '',
      longBio: dto.longBio ?? '',
      photos: dto.photos ?? [],
      imageUrl: dto.imageUrl ?? null,
      sortOrder,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(coach);
  }

  async update(id: number, dto: UpdateCoachDto): Promise<Coach> {
    const coach = await this.repo.findOne({ where: { id } });
    if (!coach) {
      throw new NotFoundException(`Coach ${id} not found`);
    }
    // Renaming a coach deliberately does NOT move their profile URL. A link
    // already shared with parents should keep working; the slug is editable
    // on its own if it really needs to change.
    const slug =
      dto.slug === undefined || dto.slug === coach.slug
        ? coach.slug
        : await this.uniqueSlug(dto.slug, id);
    Object.assign(coach, {
      ...dto,
      slug,
      // An empty photo field means "no photo", not "leave it alone".
      imageUrl: dto.imageUrl === undefined ? coach.imageUrl : dto.imageUrl || null,
    });
    return this.repo.save(coach);
  }

  async remove(id: number): Promise<{ deleted: true; id: number }> {
    const result = await this.repo.delete(id);
    if (!result.affected) {
      throw new NotFoundException(`Coach ${id} not found`);
    }
    return { deleted: true, id };
  }

  /**
   * Rewrite the display order from a list of ids. Ids that do not exist are
   * ignored rather than throwing: the dashboard may be a few seconds stale if
   * a coach was deleted in another tab, and failing the whole reorder over
   * that would lose the rest of the user's arrangement.
   */
  async reorder(dto: ReorderCoachesDto): Promise<Coach[]> {
    const ids = dto.ids ?? [];
    if (ids.length) {
      const existing = await this.repo.find({ where: { id: In(ids) } });
      const byId = new Map(existing.map((c) => [c.id, c]));
      const updates: Coach[] = [];
      ids.forEach((id, index) => {
        const coach = byId.get(id);
        if (coach) {
          coach.sortOrder = (index + 1) * 10;
          updates.push(coach);
        }
      });
      if (updates.length) {
        await this.repo.save(updates);
      }
    }
    return this.findAll();
  }

  /**
   * Turn a name into a URL segment, then make sure nothing else is using it.
   * Collisions get -2, -3 and so on: the academy has two coaches called Reza
   * already, so two people with the same full name is not far-fetched.
   */
  private async uniqueSlug(source: string, ignoreId?: number): Promise<string> {
    const base =
      source
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'coach';

    let candidate = base;
    for (let n = 2; n < 100; n += 1) {
      const clash = await this.repo.findOne({ where: { slug: candidate } });
      if (!clash || clash.id === ignoreId) {
        return candidate;
      }
      candidate = `${base}-${n}`;
    }
    return `${base}-${Date.now()}`;
  }

  private async nextSortOrder(): Promise<number> {
    const last = await this.repo.find({
      order: { sortOrder: 'DESC' },
      take: 1,
    });
    return last.length ? Number(last[0].sortOrder) + 10 : 10;
  }
}
