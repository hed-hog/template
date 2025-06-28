import { PaginationModule } from '@hed-hog/api-pagination';
import { PrismaModule } from '@hed-hog/api-prisma';
import { forwardRef, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { LocaleModule } from '@hed-hog/api-locale';
import { RoleGuard } from './guards/role.guard';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => PrismaModule),
    forwardRef(() => PaginationModule),
    forwardRef(() => LocaleModule),
  ],
  controllers: [RoleController],
  providers: [
    RoleService,
    {
      provide: APP_GUARD,
      useClass: RoleGuard,
    },
  ],
  exports: [RoleService],
})
export class RoleModule {}
