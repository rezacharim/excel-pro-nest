// @ts-nocheck
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  private heapLimitMB = 100;

  use(req: any, res: any, next: (err?: any) => void) {
    const { ip, method, baseUrl } = req;
    const userAgent = req.get('user-agent') || '';
    const startAt = process.hrtime();

    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length') || 'N/A';
      const diff = process.hrtime(startAt);
      const responseTime = diff[0] * 1e3 + diff[1] * 1e-6;

      const mem = process.memoryUsage();
      const heapUsed = +(mem.heapUsed / 1024 / 1024).toFixed(2);
      const heapTotal = +(mem.heapTotal / 1024 / 1024).toFixed(2);
      const rss = +(mem.rss / 1024 / 1024).toFixed(2);
      const external = +(mem.external / 1024 / 1024).toFixed(2);

      const warning = heapUsed > this.heapLimitMB;

      const color = {
        reset: '\x1b[0m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        red: '\x1b[31m',
        cyan: '\x1b[36m',
        magenta: '\x1b[35m',
      };

      const memoryInfo = `
        ${color.cyan}🧠 Memory Usage:
        - Heap Used   : ${heapUsed} MB
        - Heap Total  : ${heapTotal} MB
        - RSS         : ${rss} MB
        - External    : ${external} MB${color.reset}
      `;

      const warningLog = warning
        ? `${color.red}⚠️ WARNING: Heap Used exceeded ${this.heapLimitMB}MB!${color.reset}`
        : '';

      this.logger.log(`
${color.magenta}───── Request Info ─────${color.reset}
${color.green}${method} ${baseUrl}${color.reset}
Status Code   : ${statusCode}
Content Length: ${contentLength} KB
Response Time : ${responseTime.toFixed(2)} ms
User-Agent    : ${userAgent}
IP            : ${ip}
${memoryInfo}
${warningLog}
${color.magenta}────────────────────────${color.reset}
      `);
    });

    next();
  }
}
