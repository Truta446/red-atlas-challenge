import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] });
  const config = app.get(ConfigService);
  const url = config.get<string>('RABBITMQ_URL') as string;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [url],
      queue: 'imports.batch',
      queueOptions: {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': 'imports.retry.10s',
        },
      },
      prefetchCount: 8,
    },
  });

  await app.startAllMicroservices();
  // Keep process alive; no HTTP server needed for worker
}

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
