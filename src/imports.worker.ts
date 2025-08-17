import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] });
  const config = app.get(ConfigService);
  const url = config.get<string>('RABBITMQ_URL') as string;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [url],
      queue: 'imports.batch',
      queueOptions: { durable: true },
      prefetchCount: 8,
    },
  });

  await app.startAllMicroservices();
  // Keep process alive; no HTTP server needed for worker
}

bootstrap().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
