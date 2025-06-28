import { PaginationModule } from '@hed-hog/api-pagination';
import { PrismaModule } from '@hed-hog/api-prisma';
import { Module, forwardRef } from '@nestjs/common';
import { ScreenController } from './screen.controller';
import { ScreenService } from './screen.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  providers: [ScreenService],
  exports: [ScreenService],
  controllers: [ScreenController],
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => PrismaModule),
    forwardRef(() => PaginationModule),
  ],
})
export class ScreenModule {}
