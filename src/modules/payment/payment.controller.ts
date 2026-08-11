import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { PaymentsService } from './payment.service';
import { CreateSubscriptionDto } from './dto/CreateSubscription.dto';
import { SubscriptionResponseDto } from './dto/subscription-response.dto';
import { PaymentResponseDto } from './dto/get-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('subscription')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new subscription for a user' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Subscription successfully created',
    type: SubscriptionResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  async createSubscription(
    @Body() dto: CreateSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.paymentsService.createSubscription(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get all payments with user fullname' })
  @ApiResponse({
    status: 200,
    description: 'List of all payments with user fullname',
    type: [PaymentResponseDto],
  })
  async getAllPayments(): Promise<PaymentResponseDto[]> {
    return this.paymentsService.findAllWithUsers();
  }

  @Post('cron/subscription-reminders')
  @ApiOperation({ summary: 'Run subscription reminder job' })
  @ApiResponse({
    status: 200,
    description: 'Subscription reminders processed successfully',
  })
  async runSubscriptionReminders() {
    console.log('Cron job started at', new Date().toISOString());
    await this.paymentsService.handleSubscriptionReminders();
    console.log('Cron job finished at', new Date().toISOString());
    return {
      success: true,
      message: 'Subscription reminders processed successfully ',
    };
  }
}
