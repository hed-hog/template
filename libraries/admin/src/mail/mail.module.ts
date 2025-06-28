import { MailModule as MailMainModule } from '@hed-hog/api-mail';
import { PaginationModule } from '@hed-hog/api-pagination';
import { PrismaModule } from '@hed-hog/api-prisma';
import { LocaleModule } from '@hed-hog/api-locale';
import { forwardRef, Module } from '@nestjs/common';
import { MailSentModule } from '../mail-sent/mail-sent.module';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';

@Module({
  imports: [
    forwardRef(() => MailMainModule),
    forwardRef(() => MailSentModule),
    forwardRef(() => PrismaModule),
    forwardRef(() => PaginationModule),
    forwardRef(() => LocaleModule),
  ],
  controllers: [MailController],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
