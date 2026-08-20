import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Testimonial } from './entities/testimonial.entity';
import {
  CreateTestimonialDto,
  ReorderTestimonialsDto,
  UpdateTestimonialDto,
} from './dto/testimonial.dto';

@Injectable()
export class TestimonialsService {
  constructor(
    @InjectRepository(Testimonial)
    private readonly repo: Repository<Testimonial>,
  ) {}

  /** Public list: visible testimonials only, in display order. */
  findActive(): Promise<Testimonial[]> {
    return this.repo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  /** Admin list: includes hidden ones so they can be brought back. */
  findAll(): Promise<Testimonial[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async create(dto: CreateTestimonialDto): Promise<Testimonial> {
    // A new testimonial goes to the end unless the caller says otherwise, so
    // adding one never silently reshuffles the ones already on the page.
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder());
    const testimonial = this.repo.create({
      name: dto.name,
      role: dto.role ?? '',
      quote: dto.quote ?? '',
      imageUrl: dto.imageUrl ?? null,
      sortOrder,
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(testimonial);
  }

  async update(id: number, dto: UpdateTestimonialDto): Promise<Testimonial> {
    const testimonial = await this.repo.findOne({ where: { id } });
    if (!testimonial) {
      throw new NotFoundException(`Testimonial ${id} not found`);
    }
    if (dto.name !== undefined) testimonial.name = dto.name;
    if (dto.role !== undefined) testimonial.role = dto.role;
    if (dto.quote !== undefined) testimonial.quote = dto.quote;
    // An empty string clears the photo; undefined leaves it alone.
    if (dto.imageUrl !== undefined) {
      testimonial.imageUrl = dto.imageUrl || null;
    }
    if (dto.sortOrder !== undefined) testimonial.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) testimonial.isActive = dto.isActive;
    return this.repo.save(testimonial);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    const testimonial = await this.repo.findOne({ where: { id } });
    if (!testimonial) {
      throw new NotFoundException(`Testimonial ${id} not found`);
    }
    await this.repo.remove(testimonial);
    return { deleted: true, id };
  }

  /**
   * Rewrites sortOrder from the given sequence.
   *
   * Ids that no longer exist are skipped rather than throwing: one may have
   * been deleted in another tab, and failing the whole reorder over that
   * would lose the rest of the arrangement.
   */
  async reorder(dto: ReorderTestimonialsDto): Promise<Testimonial[]> {
    const ids = dto.ids ?? [];
    if (ids.length) {
      const existing = await this.repo.find({ where: { id: In(ids) } });
      const byId = new Map(existing.map((t) => [t.id, t]));
      const updates: Testimonial[] = [];
      ids.forEach((id, index) => {
        const testimonial = byId.get(id);
        if (testimonial) {
          testimonial.sortOrder = (index + 1) * 10;
          updates.push(testimonial);
        }
      });
      if (updates.length) {
        await this.repo.save(updates);
      }
    }
    return this.findAll();
  }

  /** Ten past the current highest, leaving room to slot one in by hand. */
  private async nextSortOrder(): Promise<number> {
    const last = await this.repo.find({
      order: { sortOrder: 'DESC' },
      take: 1,
    });
    return (last[0]?.sortOrder ?? 0) + 10;
  }
}
