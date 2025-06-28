import { LocaleModule } from '@hed-hog/api-locale';
import { MailModule as MailSendModule } from '@hed-hog/api-mail';
import { PaginationModule } from '@hed-hog/api-pagination';
import { PrismaModule } from '@hed-hog/api-prisma';
import { HttpModule } from '@nestjs/axios';
import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CoreModule } from './core/core.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { MenuModule } from './menu/menu.module';
import { RoleModule } from './role/role.module';
import { RouteModule } from './route/route.module';
import { ScreenModule } from './screen/screen.module';
import { SettingModule } from './setting/setting.module';
import { UserModule } from './user/user.module';
import { MailModule } from './mail/mail.module';
import { MailSentModule } from './mail-sent/mail-sent.module';
import { MailVarModule } from './mail-var/mail-var.module';
import { InstallModule } from './install/install.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot(),
    forwardRef(() => InstallModule),
    forwardRef(() => AuthModule),
    forwardRef(() => DashboardModule),
    forwardRef(() => MailSendModule),
    forwardRef(() => MenuModule),
    forwardRef(() => PaginationModule),
    forwardRef(() => RoleModule),
    forwardRef(() => RouteModule),
    forwardRef(() => PrismaModule),
    forwardRef(() => ScreenModule),
    forwardRef(() => LocaleModule),
    forwardRef(() => UserModule),
    forwardRef(() => CoreModule),
    forwardRef(() => SettingModule),
    forwardRef(() => MailModule),
    forwardRef(() => MailSentModule),
    forwardRef(() => MailVarModule),
  ],
  exports: [
    UserModule,
    AuthModule,
    MailModule,
    RouteModule,
    RoleModule,
    MenuModule,
    ScreenModule,
    LocaleModule,
    SettingModule,
  ],
})
export class AdminModule {}
