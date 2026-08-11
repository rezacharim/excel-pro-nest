import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TwilioService } from '../sms/sms.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  // private twilioClient: twilio.Twilio;
  private fromNumber: string;

  constructor(
    private configService: ConfigService,
    private readonly twilioService: TwilioService,
  ) {
    // const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    // const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    // this.fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');
    // if (accountSid && authToken) {
    //   this.twilioClient = twilio(accountSid, authToken);
    // } else {
    //   this.logger.warn(
    //     'Twilio credentials not found, SMS notifications will be logged only',
    //   );
    // }
  }

  async notifyAdminsAboutPayment(
    transferId: number,
    userName: string,
    amount: number,
    plan: string,
  ): Promise<void> {
    try {
      const adminPhoneNumbers = this.configService.get<string>(
        'ADMIN_PHONE_NUMBERS',
      );

      if (!adminPhoneNumbers) {
        this.logger.warn('No admin phone numbers configured for notifications');
        return;
      }

      const adminPhones = adminPhoneNumbers
        .split(',')
        .filter((phone) => phone.trim());

      if (adminPhones.length === 0) {
        this.logger.warn('Admin phone numbers list is empty');
        return;
      }

      const message = `⚠️ New Payment Confirmation:\n\nID: ${transferId}\nUser: ${userName}\nAmount: $${amount}\nPlan: ${plan}\n\nPlease verify the payment in admin panel. please verify the payment in admin panel. please check your email for more details.`;

      for (const adminPhone of adminPhones) {
        await this.twilioService.sendSMS(adminPhone.trim(), message);
      }
    } catch (error) {
      this.logger.error(
        `Error notifying admins about payment: ${error.message}`,
        error.stack,
      );
    }
  }

  async sendTransferInstructions(
    phone: string,
    token: string,
    amount: number,
    plan: string,
  ): Promise<void> {
    const message = `Your payment request for ${plan} plan ($${amount}) has been created. Please complete the e-transfer within 48 hours and confirm on the website. Token: ${token}`;
    await this.twilioService.sendSMS(phone, message);
  }

  async sendTransferExpiryNotification(
    phone: string,
    amount: number,
    plan: string,
  ): Promise<void> {
    const message = `Your payment request for ${plan} plan ($${amount}) has expired. Please create a new payment request if you still wish to subscribe.`;
    await this.twilioService.sendSMS(phone, message);
  }

  async sendPaymentApprovalNotification(
    phone: string,
    plan: string,
    amount: number,
    endDate: Date,
  ): Promise<void> {
    const formattedDate = endDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const message = `Your payment of $${amount} for ${plan} plan has been approved! Your subscription is active until ${formattedDate}. Thank you for choosing our service.`;
    await this.twilioService.sendSMS(phone, message);
  }

  async sendPaymentRejectionNotification(
    phone: string,
    plan: string,
    amount: number,
    reason: string,
  ): Promise<void> {
    const message = `Your payment of $${amount} for ${plan} plan could not be verified. Reason: ${reason}. Please contact support for assistance.`;
    await this.twilioService.sendSMS(phone, message);
  }

  async sendSubscriptionRenewalReminder(
    phone: string,
    plan: string,
    endDate: Date,
  ): Promise<void> {
    const formattedDate = endDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const message = `Reminder: Your ${plan} subscription is expiring on ${formattedDate}. Please renew your subscription to continue enjoying our services.`;
    await this.twilioService.sendSMS(phone, message);
  }

  async sendPostExpiryRenewalReminder(
    phone: string,
    plan: string,
    endDate: Date,
  ): Promise<void> {
    const formattedDate = endDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const message = `Your ${plan} subscription expired on ${formattedDate}. Please renew within the next few days to avoid service interruption. Contact support for assistance.`;
    await this.twilioService.sendSMS(phone, message);
  }
}
