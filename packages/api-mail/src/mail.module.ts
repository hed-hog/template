import { HttpModule } from '@nestjs/axios';
import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import {
  MailModuleAsyncOptions,
  MailModuleOptions,
} from './interfaces/mail-module-options.interface';
import { MAIL_MODULE_OPTIONS } from './mail.consts';
import { MailService } from './mail.service';
import { PrismaModule } from '@hed-hog/api-prisma';

@Global()
@Module({})
export class MailModule {
  static forRoot(options: MailModuleOptions): DynamicModule {
    return {
      module: MailModule,
      imports: [HttpModule, PrismaModule],
      providers: [
        MailService,
        {
          provide: MAIL_MODULE_OPTIONS,
          useValue: options,
        },
      ],
      exports: [MailService],
    };
  }

  static forRootAsync(options: MailModuleAsyncOptions): DynamicModule {
    return {
      module: MailModule,
      imports: [...(options.imports || []), HttpModule, PrismaModule],
      providers: [MailService, this.createAsyncOptionsProvider(options)],
      exports: [MailService],
    };
  }

  private static createAsyncOptionsProvider(
    options: MailModuleAsyncOptions,
  ): Provider {
    return {
      provide: MAIL_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };
  }
}
