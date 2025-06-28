import { PaginationModule } from '@hed-hog/api-pagination';
import { PrismaModule } from '@hed-hog/api-prisma';
import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsController } from './setting.controller';
import { SettingService } from './setting.service';
import { SystemController } from './system.controller';
import { LocaleModule } from '@hed-hog/api-locale';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => PrismaModule),
    forwardRef(() => PaginationModule),
    forwardRef(() => LocaleModule),
  ],
  controllers: [SettingsController, SystemController],
  providers: [SettingService],
  exports: [SettingService],
})
export class SettingModule {}
