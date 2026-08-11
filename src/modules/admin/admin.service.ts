import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { Admin } from '../auth/entities/admin.entity';
import { CreateAuthDto } from '../auth/dto/create-auth.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { UpdateAuthDto } from '../auth/dto/update-auth.dto';
import {
  comparePassword,
  hashPassword,
} from 'src/common/utils/crypto/passwordHash';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
  ) {}

  async create(createAdminDto: CreateAuthDto) {
    const { username, password, email, first_name, last_name } = createAdminDto;

    const hashedPassword = await hashPassword(password);

    const newAdmin = this.adminRepository.create({
      username,
      password: hashedPassword,
      email,
      first_name,
      last_name,
    });

    return this.adminRepository.save(newAdmin);
  }

  async findAll() {
    return await this.adminRepository.find({
      select: ['id', 'username', 'email', 'first_name', 'last_name'],
    });
  }

  async findOne(id: number) {
    const admin = await this.adminRepository.findOneBy({ id });
    if (!admin) {
      throw new NotFoundException(`Admin with id ${id} not found`);
    }
    return admin;
  }

  async update(id: number, updateAuthDto: UpdateAuthDto) {
    this.logger.log(`Admin update requested for ID: ${id}`);

    // Check if the update DTO is empty
    // This will prevent unnecessary database calls
    // and log messages if no data is provided
    if (Object.keys(updateAuthDto).length === 0) {
      this.logger.warn('Empty update data received');
      throw new BadRequestException('No update data provided');
    }

    const admin = await this.findOne(id);

    if (!admin) {
      this.logger.warn(`Admin with ID ${id} not found`);
      throw new NotFoundException('Admin not found');
    }

    // Log the admin ID being updated
    this.logger.log(`Processing update for admin ID: ${id}`);

    // Check if trying to update sensitive fields (username, email, password)
    const isSensitiveUpdate =
      updateAuthDto.username !== undefined ||
      updateAuthDto.email !== undefined ||
      updateAuthDto.password !== undefined;

    // Log the type of update being performed
    this.logger.log(
      `Update type: ${isSensitiveUpdate ? 'sensitive' : 'basic'}`,
    );

    // If updating sensitive fields, verify current password
    if (isSensitiveUpdate) {
      // Check if currentPassword field exists in the DTO
      if (!updateAuthDto.currentPassword) {
        this.logger.warn('Sensitive update attempted without current password');
        throw new BadRequestException(
          'Current password is required to update username, email, or password',
        );
      }

      this.logger.log('Performing password verification');
      // Verify that the current password matches
      const isPasswordValid = await comparePassword(
        updateAuthDto.currentPassword,
        admin.password,
      );

      if (!isPasswordValid) {
        this.logger.warn(`Password verification failed for admin ID: ${id}`);
        throw new UnauthorizedException('Current password is incorrect');
      }
      this.logger.log('Password verification completed');
    }

    // If password is being updated, hash it
    if (updateAuthDto.password) {
      this.logger.log('Processing password update');
      updateAuthDto.password = await hashPassword(updateAuthDto.password);
    }

    // Remove currentPassword from DTO before saving
    delete updateAuthDto.currentPassword;

    // Filter out any fields that shouldn't be updated
    const allowedFields = [
      'username',
      'password',
      'first_name',
      'last_name',
      'email',
    ];
    const filteredUpdateDto = Object.keys(updateAuthDto)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateAuthDto[key];
        return obj;
      }, {});

    // Log the fields that are being updated
    this.logger.log(
      `Fields being updated: ${Object.keys(filteredUpdateDto).join(', ')}`,
    );

    // If no valid fields to update, throw an error
    if (Object.keys(filteredUpdateDto).length === 0) {
      this.logger.warn('No valid fields to update after filtering');
      throw new BadRequestException('No valid fields to update');
    }

    // Update admin properties with only allowed fields
    Object.assign(admin, filteredUpdateDto);

    try {
      this.logger.log(`Saving updates for admin ID: ${id}`);

      // Save the updated admin
      const savedAdmin = await this.adminRepository.save(admin);

      this.logger.log(`Admin ID: ${id} updated successfully`);

      const updatedFields = Object.keys(filteredUpdateDto);
      if (updatedFields.length > 0) {
        this.logger.log(`Updated fields: ${updatedFields.join(', ')}`);
      }

      return savedAdmin;
    } catch (error) {
      this.logger.error(`Error updating admin ID: ${id} - ${error.name}`);
      throw new BadRequestException('Failed to update admin');
    }
  }

  async remove(id: number) {
    const admin = await this.findOne(id); // will throw if not found
    await this.adminRepository.remove(admin);
    return { message: `Admin with id ${id} has been removed.` };
  }
}
