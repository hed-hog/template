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
    // isGlobal: without it ConfigService never reaches the library modules
    // (e.g. BrandAssetService, from core's SettingModule) and the app fails to
    // boot with UnknownDependenciesException.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // forRoot() is what actually registers the emitter; the bare module is a
    // no-op and every @OnEvent handler stays silent.
    EventEmitterModule.forRoot({ wildcard: false, maxListeners: 20 }),
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