import { Controller, Get } from '@nestjs/common';
import { HealthyService } from './healthy.service';
import { Public } from '@hed-hog/api';

@Public()
@Controller('healthy')
export class HealthyController {
  constructor(private readonly healthy: HealthyService) {}

  @Get('database')
  databaseHealthCheck() {
    return this.healthy.getDatabaseHealthCheck();
  }
}
