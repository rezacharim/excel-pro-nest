import { Test, TestingModule } from '@nestjs/testing';
import { PlayerMonthService } from './player_month.service';

describe('PlayerMonthService', () => {
  let service: PlayerMonthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlayerMonthService],
    }).compile();

    service = module.get<PlayerMonthService>(PlayerMonthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
