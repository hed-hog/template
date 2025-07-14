import { AdminModule } from '@hed-hog/admin';
import { PaginationModule } from '@hed-hog/api-pagination';
import { PrismaModule } from '@hed-hog/api-prisma';
import { forwardRef, Module } from '@nestjs/common';
import { PersonAddressTypeService } from './person-address-type.service';
import { PersonAddressTypeController } from './person-address-type.controller';

@Module({
  imports: [
    forwardRef(() => AdminModule),
    forwardRef(() => PrismaModule),
    forwardRef(() => PaginationModule)
  ],
  controllers: [PersonAddressTypeController],
  providers: [PersonAddressTypeService],
  exports: [PersonAddressTypeService]
})
export class PersonAddressTypeModule {}
