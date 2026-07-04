import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    this.from = this.configService.get<string>('MAIL_FROM')!;
  }

  async sendVerificationEmail(to: string, code: string): Promise<void> {
    await this.send(
      to,
      `${code} is your verification code`,
      this.otpTemplate(
        'Verify your email',
        'Welcome! Enter this code in the app to verify your email address:',
        code,
      ),
    );
  }

  async sendPasswordResetEmail(to: string, code: string): Promise<void> {
    await this.send(
      to,
      `${code} is your password reset code`,
      this.otpTemplate(
        'Reset your password',
        'We received a request to reset your password. Enter this code in the app to choose a new one:',
        code,
      ),
    );
  }

  private otpTemplate(title: string, intro: string, code: string): string {
    return `
      <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 12px;">${title}</h2>
        <p style="margin: 0 0 20px; color: #444;">${intro}</p>
        <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 16px; background: #f4f4f5; border-radius: 8px;">
          ${code}
        </div>
        <p style="margin: 20px 0 0; color: #888; font-size: 13px;">
          This code expires in 15 minutes. If you didn't request it, you can safely ignore this email.
        </p>
      </div>`;
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.resend.emails.send({ from: this.from, to, subject, html });
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
