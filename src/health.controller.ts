import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  public check(): { status: string } {
    return { status: 'ok' };
  }
}
