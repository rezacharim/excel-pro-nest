import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from './entities/announcement.entity';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepository: Repository<Announcement>,
  ) {}

  async findActive(): Promise<Announcement[]> {
    return this.backfillSlugs(
      await this.announcementRepository.find({
        where: { isActive: true },
        order: { createdAt: 'DESC' },
      }),
    );
  }

  async findAll(): Promise<Announcement[]> {
    return this.backfillSlugs(
      await this.announcementRepository.find({
        order: { createdAt: 'DESC' },
      }),
    );
  }

  /**
   * Gives a slug to any post that does not have one.
   *
   * The slug column was added after these rows existed and is nullable on
   * purpose, so the three oldest notices — Winter League, Trials and Indoor —
   * had no page to link to. The dashboard mints a slug on save, but that
   * relies on somebody remembering to open and re-save every old post, and
   * nobody did. Until then those notices were the only thing on the page a
   * parent could not read.
   *
   * Writing during a read is not free, so this is guarded tightly: it only
   * touches rows where slug is null, which makes it a one-time write per post
   * and a no-op on every request afterwards. A failure is swallowed and the
   * list is returned unchanged — a post without a URL is a small problem, and
   * an announcements endpoint that 500s is a much larger one.
   */
  private async backfillSlugs(
    posts: Announcement[],
  ): Promise<Announcement[]> {
    const missing = posts.filter((p) => !p.slug);
    if (missing.length === 0) return posts;
    try {
      for (const post of missing) {
        post.slug = await this.uniqueSlug(post.title, post.id);
      }
      await this.announcementRepository.save(missing);
    } catch (error) {
      // Leave them slugless rather than take the endpoint down.
      console.error('Could not backfill announcement slugs', error);
    }
    return posts;
  }

  /** One post by URL segment. Hidden posts are not reachable publicly. */
  async findBySlug(slug: string): Promise<Announcement> {
    const post = await this.announcementRepository.findOne({
      where: { slug, isActive: true },
    });
    if (!post) {
      throw new NotFoundException(`No post at "${slug}"`);
    }
    return post;
  }

  async create(dto: CreateAnnouncementDto): Promise<Announcement> {
    const announcement = this.announcementRepository.create({
      title: dto.title,
      slug: await this.uniqueSlug(dto.slug || dto.title),
      body: dto.body,
      category: dto.category,
      fullBody: dto.fullBody ?? '',
      photos: dto.photos ?? [],
      eventDate: dto.eventDate || null,
      ctaLabel: dto.ctaLabel ?? null,
      ctaUrl: dto.ctaUrl ?? null,
      imageUrl: dto.imageUrl ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.announcementRepository.save(announcement);
  }

  /**
   * Title to URL segment, then made unique. Two match reports called
   * "U13 win at home" a season apart is entirely likely, so collisions get
   * -2, -3 rather than overwriting each other.
   */
  private async uniqueSlug(source: string, ignoreId?: number): Promise<string> {
    const base =
      source
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 70) || 'post';

    let candidate = base;
    for (let n = 2; n < 100; n += 1) {
      const clash = await this.announcementRepository.findOne({
        where: { slug: candidate },
      });
      if (!clash || clash.id === ignoreId) return candidate;
      candidate = `${base}-${n}`;
    }
    return `${base}-${Date.now()}`;
  }

  async update(id: number, dto: UpdateAnnouncementDto): Promise<Announcement> {
    const announcement = await this.announcementRepository.findOne({
      where: { id },
    });
    if (!announcement) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }

    if (dto.title !== undefined) announcement.title = dto.title;
    if (dto.body !== undefined) announcement.body = dto.body;
    if (dto.category !== undefined) announcement.category = dto.category;
    if (dto.ctaLabel !== undefined) announcement.ctaLabel = dto.ctaLabel;
    if (dto.ctaUrl !== undefined) announcement.ctaUrl = dto.ctaUrl;
    if (dto.imageUrl !== undefined) announcement.imageUrl = dto.imageUrl || null;
    if (dto.fullBody !== undefined) announcement.fullBody = dto.fullBody;
    if (dto.photos !== undefined) announcement.photos = dto.photos;
    if (dto.eventDate !== undefined) {
      announcement.eventDate = dto.eventDate || null;
    }
    if (dto.isActive !== undefined) announcement.isActive = dto.isActive;

    // Renaming a post does not move its URL — a link already shared with
    // families keeps working. An older post with no slug gets one now.
    if (dto.slug !== undefined && dto.slug !== announcement.slug) {
      announcement.slug = await this.uniqueSlug(dto.slug, id);
    } else if (!announcement.slug) {
      announcement.slug = await this.uniqueSlug(announcement.title, id);
    }

    return this.announcementRepository.save(announcement);
  }

  async remove(id: number): Promise<{ deleted: boolean; id: number }> {
    const announcement = await this.announcementRepository.findOne({
      where: { id },
    });
    if (!announcement) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }
    await this.announcementRepository.remove(announcement);
    return { deleted: true, id };
  }
}
