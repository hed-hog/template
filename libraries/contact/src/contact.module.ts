import { AdminModule } from '@hed-hog/admin';
import { LocaleModule } from '@hed-hog/api-locale';
import { MailModule } from '@hed-hog/api-mail';
import { PaginationModule } from '@hed-hog/api-pagination';
import { PrismaModule } from '@hed-hog/api-prisma';
import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ContactService } from './contact.service';
import { PersonAddressTypeModule } from './person-address-type/person-address-type.module';
import { PersonContactTypeModule } from './person-contact-type/person-contact-type.module';
import { PersonCustomTypeModule } from './person-custom-type/person-custom-type.module';
import { PersonDocumentTypeModule } from './person-document-type/person-document-type.module';
import { PersonTypeModule } from './person-type/person-type.module';
import { PersonModule } from './person/person.module';

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
    forwardRef(() => AdminModule),
    forwardRef(() => LocaleModule),
    forwardRef(() => PrismaModule),
    forwardRef(() => PaginationModule),
    forwardRef(() => PersonTypeModule),
    forwardRef(() => PersonModule),
    forwardRef(() => PersonDocumentTypeModule),
    forwardRef(() => PersonContactTypeModule),
    forwardRef(() => PersonAddressTypeModule),
    forwardRef(() => PersonCustomTypeModule),
    forwardRef(() => MailModule),
    ConfigModule.forRoot(),
  ],
  controllers: [],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
