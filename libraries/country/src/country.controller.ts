import { Controller, Get } from '@nestjs/common';
import { CountryService } from './country.service';
import { Locale } from '@hed-hog/api-locale';
import { Pagination } from '@hed-hog/api-pagination';

@Controller('/country')
export class CountryController {
  constructor(private readonly countryService: CountryService) {}

  @Get()
  async list(@Locale() locale, @Pagination() paginationParams) {
    return this.countryService.list(locale, paginationParams);
  }
}
