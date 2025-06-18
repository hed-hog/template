import { PaginationModule } from '@hedhog/api-pagination';
import { PrismaModule } from '@hedhog/api-prisma';
import { forwardRef, Module } from '@nestjs/common';
import { MailSentService } from './mail-sent.service';
import { MailSentController } from './mail-sent.controller';

@Module({
  imports: [forwardRef(() => PrismaModule), forwardRef(() => PaginationModule)],
  controllers: [MailSentController],
  providers: [MailSentService],
  exports: [MailSentService],
})
export class MailSentModule {}
