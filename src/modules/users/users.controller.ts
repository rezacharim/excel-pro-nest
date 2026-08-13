import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadPhotoDto } from './dto/upload-photo.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('send-otp')
  @ApiOperation({ summary: 'Send OTP code to phone number' })
  @ApiResponse({ status: 200, description: 'OTP Code sent successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { phone_number: { type: 'string' } },
    },
  })
  sendOtp(@Body('phone_number') phone_number: string) {
    return this.usersService.sendOtp();
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP code' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        phone_number: { type: 'string' },
        otp: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(
    @Body('phone_number') phone_number: string,
    @Body('otp') otp: string,
  ) {
    return this.usersService.verifyOtp();
  }

  @Post('send-email-otp')
  @ApiOperation({ summary: 'Send OTP code to email address' })
  @ApiResponse({ status: 200, description: 'OTP Code sent successfully' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { email: { type: 'string' } },
    },
  })
  sendEmailOtp(@Body('email') email: string) {
    return this.usersService.sendEmailOtp(email);
  }

  @Post('verify-email-otp')
  @ApiOperation({ summary: 'Verify email OTP code' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        otp: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyEmailOtp(
    @Body('email') email: string,
    @Body('otp') otp: string,
  ) {
    return this.usersService.verifyEmailOtp(email, otp);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user with photos as base64' })
  @ApiResponse({ status: 201, description: 'User successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid input data or OTP error.' })
  async register(@Body() createUserDto: CreateUserDto) {
    console.log('Received registration data with base64 images');

    // Log the presence of image data
    if (createUserDto.photoUrl) {
      console.log('Profile photo data received (base64)');
    } else {
      console.log('No profile photo data received');
    }

    if (createUserDto.NationalIdCard) {
      console.log('National ID card data received (base64)');
    } else {
      console.log('No National ID card data received');
    }

    // Create user with base64 photos directly from DTO
    return this.usersService.createWithBase64(createUserDto);
  }

  // Old register method with file upload - keeping for backward compatibility
  @Post('register-with-files')
  @ApiOperation({ summary: 'Register a new user with photo files' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'User successfully created.' })
  @ApiResponse({ status: 400, description: 'Invalid input data or OTP error.' })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profilePhoto', maxCount: 1 },
        { name: 'nationalIdPhoto', maxCount: 1 },
      ],
      {
        storage: memoryStorage(),
        limits: {
          fileSize: 10 * 1024 * 1024, // 10MB limit
        },
      },
    ),
  )
  async registerWithFiles(
    @Body() createUserDto: CreateUserDto,
    @UploadedFiles()
    files: {
      profilePhoto?: Express.Multer.File[];
      nationalIdPhoto?: Express.Multer.File[];
    },
  ) {
    console.log('Received files:', files);

    // Process files
    const processedFiles = {
      profilePhoto: files?.profilePhoto?.[0],
      nationalIdPhoto: files?.nationalIdPhoto?.[0],
    };

    return this.usersService.create(createUserDto, processedFiles);
  }

  @Post('upload-user-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload profile photo for a user' })
  async uploadPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body() createUploadPhotoDto: UploadPhotoDto,
  ) {
    return this.usersService.uploadPhoto(createUploadPhotoDto, file);
  }

  @Post('upload-national-id')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload national ID card photo for a user' })
  async uploadNationalIdCard(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadPhotoDto: UploadPhotoDto,
  ) {
    return this.usersService.uploadNationalIdCard(uploadPhotoDto, file);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'List of users.' })
  findAllUser() {
    return this.usersService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({ status: 200, description: 'User data.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findOneUser(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Get('phone/:phoneNumber')
  @ApiOperation({ summary: 'Get a user by phone number' })
  @ApiResponse({ status: 200, description: 'User data.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findUserByPhone(@Param('phoneNumber') phoneNumber: string) {
    return this.usersService.findByPhoneNumber(phoneNumber);
  }

  @Get('email/:email')
  @ApiOperation({ summary: 'Get a user by email address (case-insensitive)' })
  @ApiResponse({ status: 200, description: 'User data.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  findUserByEmail(@Param('email') email: string) {
    return this.usersService.findByEmail(email);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiOperation({ summary: 'Update a user by ID' })
  @ApiResponse({ status: 200, description: 'User successfully updated.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or user not found.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Put('phone/:phoneNumber')
  @ApiOperation({ summary: 'Update a user by phone number' })
  @ApiResponse({ status: 200, description: 'User successfully updated.' })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or user not found.',
  })
  @ApiResponse({ status: 404, description: 'User not found.' })
  updateUserByPhone(
    @Param('phoneNumber') phoneNumber: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateByPhone(phoneNumber, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user by ID' })
  @ApiResponse({ status: 200, description: 'User successfully deleted.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  removeUser(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}
