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

  async create(dto: CreateCoachDto): Promise<Coach> {
    // A new coach goes to the end unless the caller says otherwise, so adding
    // someone never silently reshuffles the people already on the page.
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder());
    const coach = this.repo.create({
      name: dto.name,
      role: dto.role,
      bio: dto.bio ?? '',
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
    Object.assign(coach, {
      ...dto,
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

  private async nextSortOrder(): Promise<number> {
    const last = await this.repo.find({
      order: { sortOrder: 'DESC' },
      take: 1,
    });
    return last.length ? Number(last[0].sortOrder) + 10 : 10;
  }
}
