import { Injectable } from '@nestjs/common';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private twilioClient: Twilio;

  constructor() {
    this.twilioClient = new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN,
    );
  }

  async sendSMS(to: string, message: string): Promise<any> {
    try {
      // Try to format the phone number
      let formattedPhoneNumber;
      try {
        formattedPhoneNumber = this.formatPhoneNumber(to);
      } catch (formatError) {
        // Return a meaningful error if formatting fails
        console.error('Phone number format error:', formatError.message);
        throw new Error(`Phone number format error: ${formatError.message}`);
      }

      console.log(`Sending message to ${formattedPhoneNumber}: ${message}`);

      const response = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedPhoneNumber,
      });

      return response;
    } catch (error) {
      console.error('Twilio SMS Error:', error);
      throw error;
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Remove spaces and invalid characters
    const cleanedPhone = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');

    // If the number starts with +, it's probably in international format
    if (cleanedPhone.startsWith('+')) {
      // Check minimum length for a valid international number (country code + at least 7 digits)
      if (cleanedPhone.length >= 9) {
        return cleanedPhone;
      } else {
        throw new Error(`Phone number '${phone}' is too short`);
      }
    }

    // US numbers (10 digits)
    if (cleanedPhone.length === 10) {
      return '+1' + cleanedPhone;
    }

    // US numbers with prefix 1 (11 digits)
    if (cleanedPhone.startsWith('1') && cleanedPhone.length === 11) {
      return '+' + cleanedPhone;
    }

    // Iranian numbers (starting with 0 and 11 digits like 0912XXXXXXX)
    if (cleanedPhone.startsWith('0') && cleanedPhone.length === 11) {
      return '+98' + cleanedPhone.substring(1); // Remove leading 0 and add +98
    }

    // German numbers (starting with 0 and length between 10 and 12)
    if (
      cleanedPhone.startsWith('0') &&
      cleanedPhone.length >= 10 &&
      cleanedPhone.length <= 12
    ) {
      return '+49' + cleanedPhone.substring(1);
    }

    // Number with prefix 49 (Germany)
    if (cleanedPhone.startsWith('49')) {
      return '+' + cleanedPhone;
    }

    // Number with prefix 98 (Iran)
    if (cleanedPhone.startsWith('98')) {
      return '+' + cleanedPhone;
    }

    // If we get here, we can't properly format the number
    throw new Error(`Invalid phone number format: '${phone}'`);
  }
}
