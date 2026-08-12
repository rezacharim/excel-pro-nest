import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ResetAdminPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Admin } from '../auth/entities/admin.entity';

/** JwtAuthGuard puts the signed-in Admin entity on the request. */
interface RequestWithAdmin {
  user: Admin;
}

const PUBLIC_ADMIN_SHAPE =
  '{ id, username, email, first_name, last_name, account_status, last_login, createdAt }';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({
    summary: 'List all admin accounts (never includes passwords)',
  })
  @ApiResponse({ status: 200, description: `Array of ${PUBLIC_ADMIN_SHAPE}` })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll() {
    return this.adminService.findAll();
  }

  // Must stay above ':id' so that "me" is not swallowed by the id route.
  @Get('me')
  @ApiOperation({ summary: 'The currently signed-in admin' })
  @ApiResponse({ status: 200, description: PUBLIC_ADMIN_SHAPE })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  me(@Req() req: RequestWithAdmin) {
    return this.adminService.findOne(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one admin by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: PUBLIC_ADMIN_SHAPE })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new admin account' })
  @ApiBody({ type: CreateAdminDto })
  @ApiResponse({ status: 201, description: PUBLIC_ADMIN_SHAPE })
  @ApiResponse({
    status: 400,
    description: 'Validation failed (password < 10 characters)',
  })
  @ApiResponse({ status: 409, description: 'Username or email already in use' })
  create(@Body() dto: CreateAdminDto, @Req() req: RequestWithAdmin) {
    return this.adminService.create(dto, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an admin account' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateAdminDto })
  @ApiResponse({ status: 200, description: PUBLIC_ADMIN_SHAPE })
  @ApiResponse({
    status: 400,
    description: 'No update data, or last active admin',
  })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminDto,
    @Req() req: RequestWithAdmin,
  ) {
    return this.adminService.update(id, dto, req.user);
  }

  @Post(':id/reset-password')
  @ApiOperation({
    summary: 'Set a new password for an admin, clearing lockout',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: ResetAdminPasswordDto })
  @ApiResponse({ status: 201, description: PUBLIC_ADMIN_SHAPE })
  @ApiResponse({
    status: 400,
    description: 'Password shorter than 10 characters',
  })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetAdminPasswordDto,
    @Req() req: RequestWithAdmin,
  ) {
    return this.adminService.resetPassword(id, dto.password, req.user);
  }

  @Post(':id/unlock')
  @ApiOperation({
    summary: 'Unlock an admin locked out by failed logins',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 201, description: PUBLIC_ADMIN_SHAPE })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  unlock(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithAdmin) {
    return this.adminService.unlock(id, req.user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an admin account' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: '{ message }' })
  @ApiResponse({
    status: 400,
    description: 'Own account, or the last active admin',
  })
  @ApiResponse({ status: 404, description: 'Admin not found' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithAdmin) {
    return this.adminService.remove(id, req.user);
  }
}
