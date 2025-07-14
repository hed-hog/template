import { AdminModule } from '@hed-hog/admin';
import { PaginationModule } from '@hed-hog/api-pagination';
import { PrismaModule } from '@hed-hog/api-prisma';
import { forwardRef, Module } from '@nestjs/common';
import { PersonDocumentTypeService } from './person-document-type.service';
import { PersonDocumentTypeController } from './person-document-type.controller';

@Module({
  imports: [
    forwardRef(() => AdminModule),
    forwardRef(() => PrismaModule),
    forwardRef(() => PaginationModule)
  ],
  controllers: [PersonDocumentTypeController],
  providers: [PersonDocumentTypeService],
  exports: [PersonDocumentTypeService]
})
export class PersonDocumentTypeModule {}
