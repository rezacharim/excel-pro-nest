import { Test, TestingModule } from '@nestjs/testing';
import { PlayerMonthController } from './player_month.controller';
import { PlayerMonthService } from './player_month.service';

describe('PlayerMonthController', () => {
  let controller: PlayerMonthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlayerMonthController],
      providers: [PlayerMonthService],
    }).compile();

    controller = module.get<PlayerMonthController>(PlayerMonthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
