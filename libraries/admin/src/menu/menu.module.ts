import { AuthModule } from '../auth/auth.module';
import { PaginationModule } from '@hed-hog/api-pagination';
import { PrismaModule } from '@hed-hog/api-prisma';
import { Module, forwardRef } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  providers: [MenuService],
  exports: [MenuService],
  controllers: [MenuController],
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => PrismaModule),
    forwardRef(() => PaginationModule),
  ],
})
export class MenuModule {}
