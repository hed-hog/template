import { PaginationModule } from '@hed-hog/api-pagination';
import { PrismaModule } from '@hed-hog/api-prisma';
import { Module, forwardRef } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  providers: [UserService],
  exports: [UserService],
  controllers: [UserController],
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => PrismaModule),
    forwardRef(() => PaginationModule),
  ],
})
export class UserModule {}
