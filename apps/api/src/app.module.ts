import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '@hed-hog/api-prisma';
import { PaginationModule } from '@hed-hog/api-pagination';
import { MailModule } from '@hed-hog/api-mail';
import { LocaleModule } from '@hed-hog/api-locale';
import { AdminModule } from '@hed-hog/admin';
import { HealthyModule } from '@hed-hog/api-healthy';
import { DeveloperModule } from '@hed-hog/api-developer';

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
