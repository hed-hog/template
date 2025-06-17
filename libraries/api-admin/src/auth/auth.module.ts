import { MailModule as MailSendModule } from '@hedhog/api-mail';
import { PrismaModule } from '@hedhog/api-prisma';
import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { SettingModule } from '../setting/setting.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { MailVarModule } from '../mail-var/mail-var.module';
import { MailSentModule } from '../mail-sent/mail-sent.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    forwardRef(() =>
      JwtModule.registerAsync({
        global: true,
        useFactory: () => {
          return {
            secret: String(process.env.JWT_SECRET),
            global: true,
            signOptions: {
              expiresIn: process.env.JWT_EXPIRES_IN || '30d',
            },
          };
        },
      }),
    ),
    forwardRef(() => PrismaModule),
    forwardRef(() => MailModule),
    forwardRef(() => SettingModule),
    forwardRef(() => MailVarModule),
    forwardRef(() => MailSentModule),
    forwardRef(() => MailSendModule),
    ConfigModule,
    HttpModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
