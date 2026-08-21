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
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: false, maxListeners: 20 }),
    // isGlobal: sem isso o ConfigService nao chega aos modulos das bibliotecas
    // (ex.: BrandAssetService, do SettingModule do core), e o boot falha com
    // UnknownDependenciesException.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
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