import { Injectable } from '@nestjs/common';
import { InstallDTO } from './dto/install.dto';
import { PrismaService } from '@hedhog/api-prisma';
import { genSalt, hash } from 'bcrypt';
import { promises as fs } from 'fs';
import { realpath, writeFile } from 'fs/promises';
import * as sharp from 'sharp';
import * as pngToIco from 'png-to-ico';
import { join } from 'path';

@Injectable()
export class InstallService {
  constructor(private readonly prisma: PrismaService) {}

  async createfavicoFromIcon(iconPath: string) {
    const { height, width } = await this.getSizeFromPNG(iconPath);
    if (height !== width) {
      throw new Error('Icon must be a square PNG image.');
    }
    const resizedBuffer = await sharp(iconPath)
      .resize(width, height)
      .toBuffer();

    // Converte PNG para ICO
    const icoBuffer = await pngToIco(resizedBuffer);
    const filePath = join(
      await realpath(`${process.cwd()}/../web/public/`),
      'favicon.ico',
    );
    await writeFile(filePath, icoBuffer);
    console.log('Favicon created at:', filePath);
    return filePath;
  }

  async createFileFromBase64(base64: string, fileName: string) {
    const base64Data = base64.replace(/^data:image\/png;base64,/, '');
    const filePath = join(
      await realpath(`${process.cwd()}/../web/public/`),
      fileName,
    );
    await fs.writeFile(filePath, base64Data, 'base64');
    return filePath;
  }

  async getSizeFromPNG(pngPath: string) {
    const metadata = await sharp(pngPath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
    };
  }

  async install({
    appName,
    language,
    primaryColor,
    rootEmail,
    rootPassword,
    logoFull,
    logoIcon,
  }: InstallDTO) {
    try {
      if (logoIcon) {
        logoIcon = await this.createFileFromBase64(logoIcon, 'icon.png');

        await this.createfavicoFromIcon(logoIcon);
      }

      if (logoFull) {
        logoFull = await this.createFileFromBase64(logoFull, 'logo.png');
      }

      console.log({
        logoIcon,
        logoFull,
      });

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
        ...[...(language || ['en-US'])].map((lang) => {
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
    } catch (error: any) {
      throw new Error(
        `Installation failed. Please check the logs for details. ${error?.message}`,
      );
    }
  }
}
