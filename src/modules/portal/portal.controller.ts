import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PortalService } from './portal.service';
import { PortalGuard } from './portal.guard';
import {
  PortalLoginDto,
  RenewDto,
  RequestHoldDto,
  RequestInstallmentsDto,
} from './dto/portal.dto';

@ApiTags('Parent Portal')
@Controller('portal')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Post('login')
  @ApiOperation({ summary: 'Parent portal login with email OTP' })
  @ApiBody({ type: PortalLoginDto })
  @ApiResponse({ status: 201, description: '{ token, email }' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  login(@Body() dto: PortalLoginDto) {
    return this.portalService.login(dto);
  }

  @Get('me')
  @UseGuards(PortalGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Players, requests and payment history for the logged-in parent',
  })
  me(@Req() req: { parentEmail: string }) {
    return this.portalService.me(req.parentEmail);
  }

  @Post('renew')
  @UseGuards(PortalGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Start a membership renewal (creates a pending e-transfer payment request)',
  })
  @ApiBody({ type: RenewDto })
  renew(@Req() req: { parentEmail: string }, @Body() dto: RenewDto) {
    return this.portalService.renew(req.parentEmail, dto);
  }

  @Post('request-hold')
  @UseGuards(PortalGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request a membership hold for one of your players' })
  @ApiBody({ type: RequestHoldDto })
  requestHold(
    @Req() req: { parentEmail: string },
    @Body() dto: RequestHoldDto,
  ) {
    return this.portalService.requestHold(req.parentEmail, dto);
  }

  @Post('request-installments')
  @UseGuards(PortalGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Request an installment payment plan for one of your players',
  })
  @ApiBody({ type: RequestInstallmentsDto })
  requestInstallments(
    @Req() req: { parentEmail: string },
    @Body() dto: RequestInstallmentsDto,
  ) {
    return this.portalService.requestInstallments(req.parentEmail, dto);
  }
}
