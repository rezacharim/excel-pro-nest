import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { RedisService } from '../../common/db/redis.service';
import { User } from './entities/user.entity';
import { otpGenerator } from '../../common/utils/otp-generator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UploadPhotoDto } from './dto/upload-photo.dto';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { generateSevenDigitRandomNumber } from '../../common/utils/random';
import { MailService } from '../mail/mail.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UsersService {
  private supabase;
  private bucketName = 'user';
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>, // Fixed typo: userRpository -> userRepository
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration');
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Phone verification is retired — the academy verifies parents by email
   * only (see sendEmailOtp). Kept as a clear error so any old client that
   * still calls it gets a sensible message instead of a silent failure.
   */
  async sendOtp(): Promise<{ message: string }> {
    throw new BadRequestException(
      'Phone verification is no longer used. Please verify by email.',
    );
  }

  async verifyOtp(): Promise<{ success: boolean }> {
    throw new BadRequestException(
      'Phone verification is no longer used. Please verify by email.',
    );
  }

  // Email OTP flow (free alternative to SMS OTP)
  private static readonly EMAIL_OTP_TTL_SECONDS = 600; // 10 minutes

  private normalizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  async sendEmailOtp(email: string): Promise<{ message: string }> {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail || !this.isValidEmail(normalizedEmail)) {
      throw new BadRequestException('Incorrect Email Address.');
    }

    const otp = otpGenerator();
    await this.redisService.setOTP(
      `otp:email:${normalizedEmail}`,
      otp,
      UsersService.EMAIL_OTP_TTL_SECONDS,
    );

    const sent = await this.mailService.sendVerificationCode(
      normalizedEmail,
      otp,
    );

    if (!sent) {
      throw new BadRequestException('Failed to send OTP');
    }

    return {
      message: 'OTP Code sent successfully',
    };
  }

  async verifyEmailOtp(
    email: string,
    otp: string,
  ): Promise<{ success: boolean; token: string; email: string }> {
    const normalizedEmail = this.normalizeEmail(email);
    const storedOtp = await this.redisService.getOTP(
      `otp:email:${normalizedEmail}`,
    );
    if (!storedOtp || storedOtp !== otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    await this.redisService.deleteOTP(`otp:email:${normalizedEmail}`);
    // One verification = one parent-portal session. The same token works for
    // the family dashboard (/account), so registering and managing players
    // is a single sign-in — no second code needed.
    const token = this.jwtService.sign(
      { email: normalizedEmail, role: 'parent' },
      { expiresIn: '30d' },
    );
    return { success: true, token, email: normalizedEmail };
  }

  private getBase64MimeType(base64String: string): {
    extension: string;
    contentType: string;
  } {
    const result = /^data:(image\/[a-zA-Z]+);base64,/.exec(base64String);
    if (!result) {
      throw new BadRequestException('Invalid base64 image string');
    }

    const contentType = result[1];
    const extension = contentType.split('/')[1];

    return { extension, contentType };
  }

  // New method for creating user with base64 images
  async createWithBase64(createUserDto: CreateUserDto): Promise<User> {
    try {
      console.log('Creating user with base64 image data');
      const {
        fullname,
        address,
        city,
        dateOfBirth,
        emergencyContactName,
        emergencyPhone,
        height,
        jacketSize,
        pantsSize,
        postalCode,
        shortSize,
        weight,
        tShirtSize,
        activePlan,
        experienceLevel,
        gender,
        parent_name,
        phone_number,
        email,
        player_positions,
        custom_position,
        photoUrl,
        NationalIdCard,
        medicalNotes,
      } = createUserDto;

      // Convert numeric values
      const numericHeight = Number(height) || 0;
      const numericWeight = Number(weight) || 0;

      // Validate base64 image formats
      if (photoUrl && !this.isValidBase64Image(photoUrl)) {
        throw new BadRequestException(
          'Invalid profile photo format. Must be a valid base64 image',
        );
      }

      if (NationalIdCard && !this.isValidBase64Image(NationalIdCard)) {
        throw new BadRequestException(
          'Invalid National ID card format. Must be a valid base64 image',
        );
      }

      // Upload images to Supabase and get URLs
      let uploadedPhotoUrl = '';
      let uploadedIdCardUrl = '';

      if (photoUrl) {
        uploadedPhotoUrl = await this.uploadBase64ToSupabase(photoUrl);
      }

      if (NationalIdCard) {
        uploadedIdCardUrl = await this.uploadBase64ToSupabase(NationalIdCard);
      }

      // Create user object with uploaded image URLs
      const newUser = {
        fullname,
        gender,
        parent_name,
        phone_number,
        email,
        address,
        city,
        dateOfBirth,
        emergencyContactName,
        emergencyPhone,
        height: numericHeight,
        jacketSize,
        pantsSize,
        postalCode,
        shortSize,
        weight: numericWeight,
        tShirtSize,
        activePlan,
        experienceLevel,
        player_positions,
        custom_position,
        photoUrl: uploadedPhotoUrl || null,
        // Government ID is no longer collected during registration.
        NationalIdCard: uploadedIdCardUrl || null,
        medicalNotes: medicalNotes || null,
        policy: true,
      };

      // Save user
      const savedUser = await this.userRepository.save(newUser);

      console.log('User saved with ID:', savedUser.id);

      // Best-effort welcome email; never block registration on email failure
      try {
        if (savedUser.email) {
          await this.mailService.sendWelcome(
            savedUser.email,
            savedUser.fullname,
            savedUser.activePlan || '',
          );
        }
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError.message);
      }

      return savedUser;
    } catch (error) {
      console.error('Error creating user with base64 photos:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to create user with photos',
      );
    }
  }

  // Helper method to validate base64 image strings
  private isValidBase64Image(base64String: string): boolean {
    // Check if the string starts with a data URI scheme
    if (!base64String.startsWith('data:image/')) {
      return false;
    }

    // Check if it has the base64 format
    if (!base64String.includes(';base64,')) {
      return false;
    }

    // Additional validation could be added here
    return true;
  }

  // Keeping the old method for backward compatibility
  private async uploadFileToSupabase(
    file: Express.Multer.File,
    prefix: string = '',
  ): Promise<string> {
    if (!this.supabase) {
      throw new InternalServerErrorException('Storage service not configured');
    }

    // بررسی نوع فایل
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG and PNG images are allowed');
    }

    // ایجاد نام منحصر به فرد برای فایل
    const uniqueFileName = `${prefix}${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;

    // آپلود فایل به Supabase
    const { error } = await this.supabase.storage
      .from(this.bucketName)
      .upload(uniqueFileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true, // اجازه جایگزینی در صورت وجود فایل قبلی
      });

    if (error) {
      console.error('Error uploading to Supabase:', error);
      throw new InternalServerErrorException(
        'Failed to upload file to storage',
      );
    }

    // دریافت URL عمومی فایل
    const { data: urlData } = this.supabase.storage
      .from(this.bucketName)
      .getPublicUrl(uniqueFileName);

    if (!urlData || !urlData.publicUrl) {
      throw new InternalServerErrorException('Failed to get public URL');
    }

    return urlData.publicUrl;
  }

  private async uploadBase64ToSupabase(base64String: string) {
    const base64Data = base64String.split(',')[1];
    const { contentType } = this.getBase64MimeType(base64String);

    const randomNumber = generateSevenDigitRandomNumber();

    const { error } = await this.supabase.storage
      .from('user')
      .upload(`image-${randomNumber}`, Buffer.from(base64Data, 'base64'), {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new Error('Failed to upload image to Supabase Storage');
    }

    const { data, error: urlError } = this.supabase.storage
      .from('user')
      .getPublicUrl(`image-${randomNumber}`);

    if (urlError) {
      throw new Error('Failed to generate public URL');
    }

    return data.publicUrl;
  }

  // Keeping the old method for backward compatibility
  async create(
    createUserDto: CreateUserDto,
    files?: {
      profilePhoto?: Express.Multer.File;
      nationalIdPhoto?: Express.Multer.File;
    },
  ): Promise<User> {
    try {
      console.log(
        'Processing user creation with files:',
        files ? Object.keys(files) : 'no files',
      );

      const {
        fullname,
        address,
        city,
        dateOfBirth,
        emergencyContactName,
        emergencyPhone,
        height,
        jacketSize,
        pantsSize,
        postalCode,
        shortSize,
        weight,
        tShirtSize,
        activePlan,
        experienceLevel,
        gender,
        parent_name,
        phone_number,
        email,
        player_positions,
        custom_position,
      } = createUserDto;

      // Convert numeric values
      const numericHeight = Number(height) || 0;
      const numericWeight = Number(weight) || 0;

      // Create new user object
      const newUser = {
        fullname,
        gender,
        parent_name,
        phone_number,
        email,
        address,
        city,
        dateOfBirth,
        emergencyContactName,
        emergencyPhone,
        height: numericHeight,
        jacketSize,
        pantsSize,
        postalCode,
        shortSize,
        weight: numericWeight,
        tShirtSize,
        activePlan,
        experienceLevel,
        player_positions,
        custom_position,
        photoUrl: '', // Will be updated if file exists
        NationalIdCard: '', // Will be updated if file exists
        policy: true,
      };

      // First save user to get an ID
      let savedUser = await this.userRepository.save(newUser);
      console.log('User saved with ID:', savedUser.id);

      // Process files if they exist
      if (files) {
        // Handle profile photo
        if (files.profilePhoto) {
          try {
            console.log('Uploading profile photo...');
            const photoUrl = await this.uploadFileToSupabase(
              files.profilePhoto,
              `profile_${savedUser.id}_`,
            );
            savedUser.photoUrl = photoUrl;
            console.log('Profile photo uploaded:', photoUrl);
          } catch (error) {
            console.error('Error uploading profile photo:', error);
            // Continue even if photo upload fails
          }
        }

        // Handle national ID photo
        if (files.nationalIdPhoto) {
          try {
            console.log('Uploading national ID card...');
            const nationalIdUrl = await this.uploadFileToSupabase(
              files.nationalIdPhoto,
              `national_id_${savedUser.id}_`,
            );
            savedUser.NationalIdCard = nationalIdUrl;
            console.log('National ID card uploaded:', nationalIdUrl);
          } catch (error) {
            console.error('Error uploading national ID card:', error);
            // Continue even if photo upload fails
          }
        }

        // Save user again with updated photo URLs
        if (files.profilePhoto || files.nationalIdPhoto) {
          savedUser = await this.userRepository.save(savedUser);
          console.log('User updated with photo URLs');
        }
      }

      // Best-effort welcome email; never block registration on email failure
      try {
        if (savedUser.email) {
          await this.mailService.sendWelcome(
            savedUser.email,
            savedUser.fullname,
            savedUser.activePlan || '',
          );
        }
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError.message);
      }

      return savedUser;
    } catch (error) {
      console.error('Error creating user with photos:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to create user with photos',
      );
    }
  }

  async uploadPhoto(
    createUploadPhotoDto: UploadPhotoDto,
    file: Express.Multer.File,
  ): Promise<User> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      if (!this.supabase) {
        throw new InternalServerErrorException(
          'Storage service not configured',
        );
      }

      // ابتدا کاربر را بر اساس userId در UploadPhotoDto پیدا می‌کنیم
      const user = await this.userRepository.findOne({
        where: { id: createUploadPhotoDto.userId },
      });

      if (!user) {
        throw new BadRequestException(
          `User with ID ${createUploadPhotoDto.userId} not found`,
        );
      }

      // بررسی نوع فایل
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Only JPEG and PNG images are allowed');
      }

      // ایجاد نام منحصر به فرد برای فایل
      const uniqueFileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;

      // آپلود فایل به Supabase
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(uniqueFileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true, // اجازه جایگزینی در صورت وجود فایل قبلی
        });

      if (error) {
        console.error('Error uploading to Supabase:', error);
        throw new InternalServerErrorException(
          'Failed to upload file to storage',
        );
      }

      // دریافت URL عمومی فایل
      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(uniqueFileName);

      if (!urlData || !urlData.publicUrl) {
        throw new InternalServerErrorException('Failed to get public URL');
      }

      const publicUrl = urlData.publicUrl;

      // بروزرسانی فیلد photoUrl کاربر موجود
      user.photoUrl = publicUrl;

      // ذخیره تغییرات کاربر
      return await this.userRepository.save(user);
    } catch (error) {
      // مدیریت خطاها به صورت مناسب
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      console.error('Error uploading photo:', error);
      throw new InternalServerErrorException('Failed to upload image');
    }
  }

  async uploadNationalIdCard(
    uploadPhotoDto: UploadPhotoDto,
    file: Express.Multer.File,
  ): Promise<User> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      if (!this.supabase) {
        throw new InternalServerErrorException(
          'Storage service not configured',
        );
      }

      // ابتدا کاربر را بر اساس userId در UploadPhotoDto پیدا می‌کنیم
      const user = await this.userRepository.findOne({
        where: { id: uploadPhotoDto.userId },
      });

      if (!user) {
        throw new BadRequestException(
          `User with ID ${uploadPhotoDto.userId} not found`,
        );
      }

      // بررسی نوع فایل
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Only JPEG and PNG images are allowed');
      }

      // ایجاد نام منحصر به فرد برای فایل
      const uniqueFileName = `national_id_${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;

      // آپلود فایل به Supabase
      const { error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(uniqueFileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true, // اجازه جایگزینی در صورت وجود فایل قبلی
        });

      if (error) {
        console.error('Error uploading to Supabase:', error);
        throw new InternalServerErrorException(
          'Failed to upload file to storage',
        );
      }

      // دریافت URL عمومی فایل
      const { data: urlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(uniqueFileName);

      if (!urlData || !urlData.publicUrl) {
        throw new InternalServerErrorException('Failed to get public URL');
      }

      const publicUrl = urlData.publicUrl;

      // بروزرسانی فیلد NationalIdCard کاربر موجود
      user.NationalIdCard = publicUrl;

      // ذخیره تغییرات کاربر
      return await this.userRepository.save(user);
    } catch (error) {
      // مدیریت خطاها به صورت مناسب
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      console.error('Error uploading national ID card:', error);
      throw new InternalServerErrorException(
        'Failed to upload national ID card image',
      );
    }
  }

  // Method to upload base64 image for an existing user
  async uploadBase64Photo(userId: number, base64Image: string): Promise<User> {
    try {
      if (!this.isValidBase64Image(base64Image)) {
        throw new BadRequestException('Invalid base64 image format');
      }

      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new BadRequestException(`User with ID ${userId} not found`);
      }

      // Update the user's photoUrl with base64 image
      user.photoUrl = base64Image;

      // Save the updated user
      return await this.userRepository.save(user);
    } catch (error) {
      console.error('Error uploading base64 photo:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to upload base64 image');
    }
  }

  // Method to upload base64 National ID card for an existing user
  async uploadBase64NationalId(
    userId: number,
    base64Image: string,
  ): Promise<User> {
    try {
      if (!this.isValidBase64Image(base64Image)) {
        throw new BadRequestException('Invalid base64 image format');
      }

      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new BadRequestException(`User with ID ${userId} not found`);
      }

      // Update the user's NationalIdCard with base64 image
      user.NationalIdCard = base64Image;

      // Save the updated user
      return await this.userRepository.save(user);
    } catch (error) {
      console.error('Error uploading base64 national ID:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to upload base64 image');
    }
  }

  async findAll() {
    return await this.userRepository.find();
  }

  async findOne(id: number) {
    return await this.userRepository.findOne({ where: { id } });
  }

  async findByPhoneNumber(phoneNumber: string) {
    const user = await this.userRepository.findOne({
      where: { phone_number: phoneNumber },
    });

    if (!user) {
      return false;
    }

    return user;
  }

  async findByEmail(email: string) {
    const normalizedEmail = this.normalizeEmail(email);

    if (!normalizedEmail) {
      return false;
    }

    // Case-insensitive lookup; return the most recently created match
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: normalizedEmail })
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'DESC')
      .getOne();

    if (!user) {
      return false;
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Update user properties with the values from updateUserDto
    Object.assign(user, updateUserDto);

    // Save the updated user
    await this.userRepository.save(user);

    return user;
  }

  async updateByPhone(phone_number: string, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({ where: { phone_number } });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Update user properties with the values from updateUserDto
    Object.assign(user, updateUserDto);

    // Save the updated user
    await this.userRepository.save(user);

    return user;
  }

  async remove(id: number) {
    await this.userRepository.delete(id);
    return `This action removes a #${id} user`;
  }
}
