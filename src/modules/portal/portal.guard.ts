import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Guards parent-portal routes. Expects an `Authorization: Bearer <token>`
 * header whose JWT payload has role 'parent'. Attaches the parent's email
 * to the request as `parentEmail`.
 */
@Injectable()
export class PortalGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader: string = request.headers?.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (!token || scheme !== 'Bearer') {
      throw new UnauthorizedException('Missing portal token');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired portal token');
    }

    if (payload?.role !== 'parent' || !payload?.email) {
      throw new UnauthorizedException('Invalid portal token');
    }

    request.parentEmail = String(payload.email).toLowerCase();
    return true;
  }
}
