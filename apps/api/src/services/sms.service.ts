/*
  SMS delivery.

  No SMS provider is configured (the docs call for Africa's Talking, which needs an account), so messages are
  written to the server log, as the project brief says. Swap `deliver` for a real provider call when one is available.
  Outside production the last messages are also kept in memory so tests can read the OTP.
*/
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';

export interface SentSms {
  to: string;
  message: string;
  at: Date;
}

class SmsService {
  readonly outbox: SentSms[] = [];

  async sendOTP(phone: string, code: string): Promise<void> {
    await this.deliver(phone, `Your AgriMatch code is ${code}. It expires in 5 minutes.`);
  }

  private async deliver(to: string, message: string): Promise<void> {
    if (!config.isProd) {
      this.outbox.push({ to, message, at: new Date() });
      if (this.outbox.length > 50) this.outbox.shift();
    }
    // Console "provider"
    logger.info(`SMS to ${to}: ${message}`);
  }

  /** Test helper: last OTP sent to a phone number */
  lastOtpFor(phone: string): string | undefined {
    for (let i = this.outbox.length - 1; i >= 0; i--) {
      const sms = this.outbox[i];
      if (sms.to === phone) return /code is (\d{6})/.exec(sms.message)?.[1];
    }
    return undefined;
  }
}

export const smsService = new SmsService();
