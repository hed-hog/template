import { itemTranslations } from '@hedhog/api';
import { PaginationDTO, PaginationService } from '@hedhog/api-pagination';
import { PrismaService } from '@hedhog/api-prisma';
import {
  BadRequestException,
  Inject,
  Injectable,
  forwardRef,
} from '@nestjs/common';
import { CreateDTO } from './dto/create.dto';
import { DeleteDTO } from './dto/delete.dto';
import { SettingDTO } from './dto/setting.dto';
import { UpdateDTO } from './dto/update.dto';
import { LocaleService } from '@hedhog/api-locale';

@Injectable()
export class SettingService {
  constructor(
    @Inject(forwardRef(() => PrismaService))
    private readonly prismaService: PrismaService,
    @Inject(forwardRef(() => PaginationService))
    private readonly paginationService: PaginationService,
    @Inject(forwardRef(() => LocaleService))
    private readonly localeService: LocaleService,
  ) {}

  async getSystemSettings(locale: string): Promise<any> {
    const locales = await this.localeService.getEnables(locale);
    const [setting] = await this.prismaService.$transaction([
      this.prismaService.setting.findMany({
        where: {
          slug: {
            in: [
              'system-name',
              'system-slogan',
              'icon-url',
              'image-url',
              'theme-primary',
              'theme-primary-foreground',
              'theme-secondary',
              'theme-secondary-foreground',
              'theme-accent',
              'theme-accent-foreground',
              'theme-muted',
              'theme-muted-foreground',
              'theme-radius',
              'theme-font',
              'theme-text-size',
            ],
          },
        },
      }),
    ]);

    const data: Record<string, any> = {};

    for (const s of setting) {
      switch (s.type) {
        case 'boolean':
          data[s.slug] = s.value === 'true';
          break;
        case 'number':
          data[s.slug] = Number(s.value);
          break;
        case 'array':
        case 'json':
          try {
            data[s.slug] = JSON.parse(s.value);
          } catch (err) {
            console.error('Error parsing JSON', s.value, err);
            data[s.slug] = s.value;
          }
          break;
        default:
          data[s.slug] = s.value;
      }
    }

    return { locales, setting: data };
  }

  async setManySettings(data: SettingDTO) {
    const transaction = [];

    for (const { slug, value } of data.setting) {
      transaction.push(
        this.prismaService.setting.updateMany({
          where: {
            slug,
          },
          data: {
            value,
          },
        }),
      );
    }

    await this.prismaService.$transaction(transaction);
    return { success: true };
  }

  async getSettingFromGroup(locale: any, paginationParams: any, slug: string) {
    const fields = ['slug', 'value'];

    paginationParams.pageSize = 100;

    const OR: any[] = this.prismaService.createInsensitiveSearch(
      fields,
      paginationParams,
    );

    const result = await this.paginationService.paginate(
      this.prismaService.setting,
      paginationParams,
      {
        where: {
          AND: {
            setting_group: {
              slug,
            },
            OR,
          },
        },
        include: {
          setting_group: {
            include: {
              setting_group_locale: {
                where: {
                  locale: {
                    code: locale,
                  },
                },
                select: {
                  name: true,
                  description: true,
                },
              },
            },
          },
          setting_locale: {
            where: {
              locale: {
                code: locale,
              },
            },
            select: {
              name: true,
              description: true,
            },
          },
        },
      },
      'setting_locale',
    );

    result.data = result.data.map((setting: any) => {
      setting.setting_group = itemTranslations(
        'setting_group_locale',
        setting.setting_group,
      );
      return setting;
    });

    return result;
  }

  async listSettingGroups(locale: string, paginationParams: PaginationDTO) {
    const fields = ['slug', 'icon'];

    paginationParams.pageSize = 100;

    const OR: any[] = this.prismaService.createInsensitiveSearch(
      fields,
      paginationParams,
    );

    const result = await this.paginationService.paginate(
      this.prismaService.setting_group,
      paginationParams,
      {
        where: {
          OR,
        },
        include: {
          setting_group_locale: {
            where: {
              locale: {
                code: locale,
              },
            },
            select: {
              name: true,
              description: true,
            },
          },
        },
      },
      'setting_group_locale',
    );

    return result;
  }

  async listSettings(locale: string, paginationParams: PaginationDTO) {
    const fields = ['slug', 'value'];

    const OR: any[] = this.prismaService.createInsensitiveSearch(
      fields,
      paginationParams,
    );

    const result = await this.paginationService.paginate(
      this.prismaService.setting,
      paginationParams,
      {
        where: {
          OR,
        },
        include: {
          setting_group: {
            include: {
              setting_group_locale: {
                where: {
                  locale: {
                    code: locale,
                  },
                },
                select: {
                  name: true,
                  description: true,
                },
              },
            },
          },
          setting_locale: {
            where: {
              locale: {
                code: locale,
              },
            },
            select: {
              name: true,
              description: true,
            },
          },
        },
      },
      'setting_locale',
    );

    result.data = result.data.map((setting: any) => {
      setting.setting_group = itemTranslations(
        'setting_group_locale',
        setting.setting_group,
      );
      return setting;
    });

    return result;
  }

  async get(settingId: number) {
    return this.prismaService.setting.findUnique({
      where: { id: settingId },
    });
  }

  async create(data: CreateDTO) {
    return this.prismaService.setting.create({
      data: {
        slug: data.slug,
        type: data.type as any,
        value: data.value,
        user_override: data.user_override,
        setting_group: {
          connect: {
            id: data.group_id,
          },
        },
      },
    });
  }

  async update({ id, data }: { id: number; data: UpdateDTO }) {
    return this.prismaService.setting.update({
      where: { id },
      data: {
        slug: data.slug,
        type: data.type as any,
        value: data.value,
        user_override: data.user_override,
        setting_group: {
          connect: {
            id: data.group_id,
          },
        },
      },
    });
  }

  async updateFromSlug(slug: string, data: UpdateDTO) {
    const { id } = await this.prismaService.setting.findFirst({
      where: {
        slug,
      },
    });

    if (!id) {
      throw new BadRequestException(`Setting with slug ${slug} not found.`);
    }

    return this.update({
      id,
      data,
    });
  }

  async delete({ ids }: DeleteDTO) {
    if (ids == undefined || ids == null) {
      throw new BadRequestException(
        `You must select at least one setting to delete.`,
      );
    }

    return this.prismaService.setting.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }

  async setSettingUserValue(user_id: number, slug: string, value: string) {
    const user = await this.prismaService.user.findUnique({
      where: {
        id: user_id,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new BadRequestException(`User with id ${user_id} not found.`);
    }

    const setting = await this.prismaService.setting.findFirst({
      where: {
        slug,
        user_override: true,
      },
    });

    if (!setting) {
      throw new BadRequestException(
        `Setting with slug ${slug} not found or user can not override.`,
      );
    }

    return await this.prismaService.setting_user.upsert({
      where: {
        user_id_setting_id: {
          setting_id: setting.id,
          user_id: user.id,
        },
      },
      create: {
        setting_id: setting.id,
        value,
        user_id: user.id,
      },
      update: {
        value,
      },
      select: {
        setting_id: true,
        user_id: true,
        value: true,
      },
    });
  }

  async getSettingValues(
    slug: string | string[],
  ): Promise<Record<string, any>> {
    slug = Array.isArray(slug) ? slug : [slug];

    let setting = await this.prismaService.setting.findMany({
      where: {
        slug: {
          in: slug,
        },
      },
      select: {
        id: true,
        value: true,
        slug: true,
        type: true,
        user_override: true,
      },
    });

    const slugUserOverride = setting.filter((s) => s.user_override);

    const settingUser = await this.prismaService.setting_user.findMany({
      where: {
        setting_id: {
          in: slugUserOverride.map((setting) => setting?.id),
        },
      },
      select: {
        value: true,
        setting_id: true,
      },
    });

    const data: Record<string, any> = {};

    for (const s of setting) {
      switch (s.type) {
        case 'boolean':
          data[s.slug] = s.value === 'true';
          break;
        case 'number':
          data[s.slug] = Number(s.value);
          break;
        case 'array':
        case 'json':
          try {
            data[s.slug] = JSON.parse(s.value);
          } catch (err) {
            console.error('Error parsing JSON', s.value, err);
            data[s.slug] = s.value;
          }
          break;
        default:
          data[s.slug] = s.value;
      }
    }

    settingUser.forEach((ss) => {
      data[slugUserOverride.find((s) => s.id === ss.setting_id).slug] =
        ss.value;
    });

    return data;
  }

  async getUserSettings(user_id: number) {
    return this.prismaService.setting_user.findMany({
      where: {
        user_id,
      },
      include: {
        setting: {
          select: {
            slug: true,
          },
        },
      },
    });
  }
}
