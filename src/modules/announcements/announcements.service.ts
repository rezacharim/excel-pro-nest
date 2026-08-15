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
    return this.announcementRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(): Promise<Announcement[]> {
    return this.announcementRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateAnnouncementDto): Promise<Announcement> {
    const announcement = this.announcementRepository.create({
      title: dto.title,
      body: dto.body,
      category: dto.category,
      ctaLabel: dto.ctaLabel ?? null,
      ctaUrl: dto.ctaUrl ?? null,
      imageUrl: dto.imageUrl ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.announcementRepository.save(announcement);
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
    if (dto.isActive !== undefined) announcement.isActive = dto.isActive;

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
