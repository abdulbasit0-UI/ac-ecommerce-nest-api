import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import { MailService } from './mail.service';
import { MAIL_TRANSPORT } from './mail.constants';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Transporter => {
        const user = config.get<string>('mail.user');
        return createTransport({
          host: config.get<string>('mail.host'),
          port: config.get<number>('mail.port'),
          secure: false,
          auth: user
            ? {
                user,
                pass: config.get<string>('mail.password'),
              }
            : undefined,
        });
      },
    },
    MailService,
  ],
  exports: [MailService],
})
export class MailModule {}
