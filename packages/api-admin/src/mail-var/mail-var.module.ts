import { PaginationModule } from '@hedhog/api-pagination';
import { PrismaModule } from '@hedhog/api-prisma';
import { forwardRef, Module } from '@nestjs/common';
import { MailVarService } from './mail-var.service';
import { MailVarController } from './mail-var.controller';

@Module({
  imports: [forwardRef(() => PrismaModule), forwardRef(() => PaginationModule)],
  controllers: [MailVarController],
  providers: [MailVarService],
  exports: [MailVarService],
})
export class MailVarModule {}
