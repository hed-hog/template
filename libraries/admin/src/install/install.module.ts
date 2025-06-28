import { forwardRef, Module } from '@nestjs/common';
import { InstallController } from './install.controller';
import { PrismaModule } from '@hed-hog/api-prisma';
import { SettingModule } from '../setting/setting.module';
import { InstallService } from './install.service';

@Module({
  imports: [forwardRef(() => PrismaModule), forwardRef(() => SettingModule)],
  controllers: [InstallController],
  providers: [InstallService],
})
export class InstallModule {}
