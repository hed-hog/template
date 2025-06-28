import { Public } from '@hed-hog/api';
import { Controller, Get } from '@nestjs/common';
import { SettingService } from './setting.service';
import { Locale } from '@hed-hog/api-locale';

@Public()
@Controller(`setting-system`)
export class SystemController {
  constructor(private readonly setting: SettingService) {}

  @Get()
  getSystemSettings(@Locale() locale: string) {
    return this.setting.getSystemSettings(locale);
  }
}
