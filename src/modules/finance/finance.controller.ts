import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FinanceService } from './finance.service';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  /** Falls back to the current year for a missing or nonsensical value. */
  private parseYear(raw?: string): number {
    const parsed = parseInt(raw ?? '', 10);
    if (isNaN(parsed) || parsed < 2000 || parsed > 2100) {
      return new Date().getFullYear();
    }
    return parsed;
  }

  @Get('summary')
  @ApiOperation({ summary: 'Revenue, outstanding and expected-income summary' })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  @ApiResponse({
    status: 200,
    description:
      'Totals, 12-month rolling revenue, breakdown by type/method and the 10 newest payments',
  })
  summary(@Query('year') year?: string) {
    return this.financeService.getSummary(this.parseYear(year));
  }

  @Get('export')
  @ApiOperation({ summary: 'Export a year of payments as CSV' })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  async export(@Res() res: Response, @Query('year') year?: string) {
    const targetYear = this.parseYear(year);
    const csv = await this.financeService.exportPaymentsCsv(targetYear);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="excel-pro-payments-${targetYear}.csv"`,
    );
    res.send(csv);
  }
}
