import { PaginationModule } from '@hed-hog/api-pagination';
import { PrismaModule } from '@hed-hog/api-prisma';
import { Module, forwardRef } from '@nestjs/common';
import { RouteController } from './route.controller';
import { RouteService } from './route.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  providers: [RouteService],
  exports: [RouteService],
  controllers: [RouteController],
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => PrismaModule),
    forwardRef(() => PaginationModule),
  ],
})
export class RouteModule {}
