import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AppController } from './app.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from '@hed-hog/api-prisma';
import { PaginationModule } from '@hed-hog/api-pagination';
import { MailModule } from '@hed-hog/api-mail';
import { LocaleModule } from '@hed-hog/api-locale';
import { HealthyModule } from '@hed-hog/api-healthy';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: false, maxListeners: 20 }),
    ConfigModule,
    HealthyModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    PrismaModule,
    PaginationModule,
    MailModule,
    LocaleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}