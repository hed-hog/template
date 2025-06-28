import { forwardRef, Module } from '@nestjs/common';

import { LocaleModule } from '@hed-hog/api-locale';
import { PrismaModule } from '@hed-hog/api-prisma';
import { DashboardCoreController } from './dashboard-core.controller';
import { DashboardCoreService } from './dashboard-core.service';

@Module({
  imports: [forwardRef(() => LocaleModule), forwardRef(() => PrismaModule)],
  controllers: [DashboardCoreController],
  providers: [DashboardCoreService],
  exports: [DashboardCoreService],
})
export class DashboardCoreModule {}
