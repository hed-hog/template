import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '@hedhog/api-prisma';
import { PaginationModule } from '@hedhog/api-pagination';
import { MailModule } from '@hedhog/api-mail';
import { LocaleModule } from '@hedhog/api-locale';
import { AdminModule } from '@hedhog/api-admin';
import { HealthyModule } from '@hedhog/api-healthy';
import { DeveloperModule } from '@hedhog/api-developer';

@Module({
  imports: [
    DeveloperModule,
    HealthyModule,
    AdminModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    PrismaModule,
    PaginationModule,
    MailModule.forRoot({
      global: true,
      type: 'GMAIL',
      clientId: String(process.env.MAIL_CLIENT_ID),
      clientSecret: String(process.env.MAIL_CLIENT_SECRET),
      refreshToken: String(process.env.REFRESH_TOKEN),
      from: String(process.env.MAIL_FROM),
    }),
    LocaleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
