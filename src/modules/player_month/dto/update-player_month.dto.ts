import { PartialType } from '@nestjs/swagger';
import { CreatePlayerMonthDto } from './create-player_month.dto';

export class UpdatePlayerMonthDto extends PartialType(CreatePlayerMonthDto) {}
