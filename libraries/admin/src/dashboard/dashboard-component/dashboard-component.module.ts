import { PaginationModule } from '@hed-hog/api-pagination';
import { PrismaModule } from '@hed-hog/api-prisma';
import { LocaleModule } from '@hed-hog/api-locale';
import { forwardRef, Module } from '@nestjs/common';
import { DashboardComponentService } from './dashboard-component.service';
import { DashboardComponentController } from './dashboard-component.controller';

@Module({
  imports: [forwardRef(() => LocaleModule), forwardRef(() => PrismaModule)],
  controllers: [DashboardComponentController],
  providers: [DashboardComponentService],
  exports: [DashboardComponentService],
})
export class DashboardComponentModule {}
