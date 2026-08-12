import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ActivityService } from './activity.service';

/** Turns "record-payment" into "Record payment" for the activity feed. */
const humanize = (segment: string): string => {
  const words = segment.replace(/[-_]/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Writes an audit-trail entry for every successful state-changing request on
 * the controller it is attached to.
 *
 * Doing this in one interceptor (rather than a log call inside each handler)
 * means a new admin action can never be added without being recorded.
 */
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(private readonly activityService: ActivityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method: string = request.method;

    // Reads never produce audit entries.
    if (method === 'GET' || method === 'OPTIONS') {
      return next.handle();
    }

    const controller = context.getClass().name
      .replace('Controller', '')
      .toLowerCase();
    // Last path segment is the verb, e.g. /membership/12/record-payment
    const segments: string[] = (request.route?.path || request.url || '')
      .split('?')[0]
      .split('/')
      .filter(Boolean);
    const verbSegment =
      segments.filter((s: string) => !s.startsWith(':')).pop() || method;
    const action = `${controller}.${verbSegment}`.toLowerCase();

    return next.handle().pipe(
      tap((result: unknown) => {
        const row = (result || {}) as {
          id?: number;
          fullname?: string;
          username?: string;
        };
        const targetId =
          row.id ??
          (request.params?.userId ? Number(request.params.userId) : null) ??
          (request.params?.id ? Number(request.params.id) : null);

        const body = (request.body || {}) as Record<string, unknown>;
        const extras = ['amount', 'days', 'plan', 'reason', 'months', 'note']
          .filter((k) => body[k] !== undefined && body[k] !== '')
          .map((k) => `${k}: ${String(body[k]).slice(0, 60)}`)
          .join(', ');

        void this.activityService.log(request.user, {
          action,
          targetType: controller === 'admin' ? 'admin' : 'member',
          targetId: Number.isFinite(targetId as number)
            ? (targetId as number)
            : null,
          targetName: row.fullname || row.username || null,
          details: `${humanize(verbSegment)}${
            row.fullname ? ` — ${row.fullname}` : ''
          }${extras ? ` (${extras})` : ''}`,
        });
      }),
    );
  }
}
