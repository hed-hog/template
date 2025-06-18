import { PaginationModule } from '@hedhog/api-pagination';
import { PrismaModule } from '@hedhog/api-prisma';
import { forwardRef, Module } from '@nestjs/common';
import { DashboardUserService } from './dashboard-user.service';
import { DashboardUserController } from './dashboard-user.controller';

@Module({
  imports: [forwardRef(() => PrismaModule), forwardRef(() => PaginationModule)],
  controllers: [DashboardUserController],
  providers: [DashboardUserService],
  exports: [DashboardUserService],
})
export class DashboardUserModule {}
