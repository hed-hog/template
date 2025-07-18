import { AdminModule } from '@hed-hog/admin';
import { PaginationModule } from '@hed-hog/api-pagination';
import { PrismaModule } from '@hed-hog/api-prisma';
import { forwardRef, Module } from '@nestjs/common';
import { PersonContactTypeService } from './person-contact-type.service';
import { PersonContactTypeController } from './person-contact-type.controller';

@Module({
  imports: [
    forwardRef(() => AdminModule),
    forwardRef(() => PrismaModule),
    forwardRef(() => PaginationModule)
  ],
  controllers: [PersonContactTypeController],
  providers: [PersonContactTypeService],
  exports: [PersonContactTypeService]
})
export class PersonContactTypeModule {}
