import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './entities/match.entity';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { AgeCategory } from './entities/enums/ageCategory.enum';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
  ) {}

  async create(createMatchDto: CreateMatchDto): Promise<Match> {
    const match = this.matchRepository.create(createMatchDto);
    return this.matchRepository.save(match);
  }

  async findAll(): Promise<Match[]> {
    return this.matchRepository.find();
  }

  async findOne(id: number): Promise<Match> {
    return this.matchRepository.findOne({
      where: { id },
    });
  }

  async update(id: number, updateMatchDto: UpdateMatchDto): Promise<Match> {
    await this.matchRepository.update(id, updateMatchDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.matchRepository.delete(id);
  }

  async findFilteredMatches(filters: {
    category?: AgeCategory;
    refereeId?: number;
    homeTeamId?: number;
    awayTeamId?: number;
  }): Promise<Match[]> {
    const query = this.matchRepository.createQueryBuilder('match');

    if (filters.category) {
      query.andWhere('match.ageCategory = :category', {
        category: filters.category,
      });
    }
    if (filters.refereeId) {
      query.andWhere('match.refereeId = :refereeId', {
        refereeId: filters.refereeId,
      });
    }
    if (filters.homeTeamId) {
      query.andWhere('match.homeTeamId = :homeTeamId', {
        homeTeamId: filters.homeTeamId,
      });
    }
    if (filters.awayTeamId) {
      query.andWhere('match.awayTeamId = :awayTeamId', {
        awayTeamId: filters.awayTeamId,
      });
    }

    return query.getMany();
  }
}
