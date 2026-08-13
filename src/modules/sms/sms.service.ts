import { Injectable, Logger } from '@nestjs/common';

/**
 * SMS is switched off for Excel Pro Soccer Academy.
 *
 * The academy communicates with families by email only: text messaging was a
 * paid Twilio service inherited from the previous developers, and the account
 * no longer exists. Every notification that used to go out by SMS is now an
 * email (see MailService).
 *
 * This class is deliberately kept as an inert stub rather than deleted, so
 * that any older code path still calling it logs a warning instead of
 * crashing a registration or a payment approval.
 */
@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);

  async sendSMS(to: string, message: string): Promise<null> {
    this.logger.warn(
      `SMS disabled — not sending to ${to}: "${message.slice(0, 60)}..."`,
    );
    return null;
  }
}
