import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { LoginDto } from './dto/login.dto';
import { comparePassword } from '../../common/utils/crypto/passwordHash';
import { Admin } from '../auth/entities/admin.entity';

@Injectable()
export class AuthService {
  private readonly loginRateLimiter: RateLimiterMemory;

  constructor(
    @InjectRepository(Admin)
    private readonly auth_repository: Repository<Admin>,
    private readonly jwtService: JwtService,
  ) {
    this.loginRateLimiter = new RateLimiterMemory({
      points: 5,
      duration: 900,
      keyPrefix: 'login_fail',
    });
  }

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    const admin = await this.auth_repository.findOne({
      where: { username },
      select: [
        'id',
        'username',
        'email',
        'password',
        'account_status',
        'failed_attempts',
      ],
    });

    if (!admin || admin.account_status === 'locked') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await comparePassword(password, admin.password);
    console.log(isPasswordValid);
    if (!isPasswordValid) {
      admin.failed_attempts = Number(admin.failed_attempts) + 1;
      await this.auth_repository.save(admin);
      try {
        await this.loginRateLimiter.consume(username);
      } catch {
        admin.account_status = 'locked';
        await this.auth_repository.save(admin);
        throw new UnauthorizedException('Invalid credentials.');
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    admin.failed_attempts = 0;
    await this.auth_repository.save(admin);
    await this.loginRateLimiter.delete(username);

    const payload = { email: admin.email, sub: admin.id };

    const token = this.jwtService.sign(payload, {
      expiresIn: '2d',
    });

    return { token };
  }
}
