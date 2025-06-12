import { Injectable } from '@nestjs/common';
import { InstallDTO } from './dto/install.dto';
import { PrismaService } from '@hedhog/api-prisma';
import { genSalt, hash } from 'bcrypt';
import { promises as fs } from 'fs';
import { realpath } from 'fs/promises';

@Injectable()
export class InstallService {
  constructor(private readonly prisma: PrismaService) {}

  async install({
    appName,
    language,
    primaryColor,
    rootEmail,
    rootPassword,
  }: InstallDTO) {
    try {
      const salt = await genSalt();
      const password = await hash(rootPassword, salt);

      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: 1 },
          data: {
            email: rootEmail,
            password,
          },
        }),
        this.prisma.setting.update({
          where: { slug: 'system-name' },
          data: { value: appName },
        }),
        this.prisma.setting.update({
          where: { slug: 'theme-primary' },
          data: { value: primaryColor },
        }),
        this.prisma.locale.updateMany({
          data: {
            enabled: false,
          },
        }),
        ...[...language].map((lang) => {
          const [code, region] = lang.split('-');
          return this.prisma.locale.updateMany({
            where: {
              code,
              region,
            },
            data: {
              enabled: true,
            },
          });
        }),
      ]);

      const hedhogFilePath = await realpath(
        `${__dirname}/../../../../hedhog.json`,
      );

      const hedhogData = JSON.parse(await fs.readFile(hedhogFilePath, 'utf-8'));

      hedhogData.installed = true;

      await fs.writeFile(
        hedhogFilePath,
        JSON.stringify(hedhogData, null, 2),
        'utf-8',
      );

      return { success: true };
    } catch (error) {
      throw new Error(
        'Installation failed. Please check the logs for details.',
      );
    }
  }
}
