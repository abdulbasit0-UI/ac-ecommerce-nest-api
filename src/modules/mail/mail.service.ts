import { existsSync, readFileSync } from 'fs';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compile } from 'handlebars';
import { join } from 'path';
import type { Transporter } from 'nodemailer';
import { MAIL_TRANSPORT } from './mail.constants';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly templatesDir: string;

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: Transporter,
    private readonly config: ConfigService,
  ) {
    const compiled = join(__dirname, 'templates');
    const source = join(process.cwd(), 'src', 'modules', 'mail', 'templates');
    this.templatesDir = existsSync(compiled) ? compiled : source;
  }

  async sendVerifyEmail(to: string, name: string, token: string): Promise<void> {
    const url = `${this.config.get<string>('frontendUrl')}/verify-email?token=${token}`;
    await this.send('verify-email', to, 'Verify your AC Commerce email', {
      name,
      url,
      appName: this.config.get<string>('name'),
    });
  }

  async sendPasswordReset(to: string, name: string, token: string): Promise<void> {
    const url = `${this.config.get<string>('frontendUrl')}/reset-password?token=${token}`;
    await this.send('password-reset', to, 'Reset your AC Commerce password', {
      name,
      url,
      appName: this.config.get<string>('name'),
    });
  }

  async sendOrderConfirmed(
    to: string,
    name: string,
    orderNumber: string,
    total: string,
  ): Promise<void> {
    await this.send('order-confirmed', to, `Order ${orderNumber} confirmed`, {
      name,
      orderNumber,
      total,
      appName: this.config.get<string>('name'),
    });
  }

  async sendRefundProcessed(
    to: string,
    name: string,
    orderNumber: string,
    amount: string,
  ): Promise<void> {
    await this.send('refund-processed', to, `Refund for order ${orderNumber}`, {
      name,
      orderNumber,
      amount,
      appName: this.config.get<string>('name'),
    });
  }

  private render(template: string, context: Record<string, string | undefined>): string {
    const file = join(this.templatesDir, `${template}.hbs`);
    const source = readFileSync(file, 'utf8');
    return compile(source, { strict: true })(context);
  }

  private async send(
    template: string,
    to: string,
    subject: string,
    context: Record<string, string | undefined>,
  ): Promise<void> {
    try {
      await this.transport.sendMail({
        from: this.config.get<string>('mail.from'),
        to,
        subject,
        html: this.render(template, context),
      });
    } catch (error) {
      this.logger.error(`Failed to send ${template} to ${to}`, error as Error);
    }
  }
}
