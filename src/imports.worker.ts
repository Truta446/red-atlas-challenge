import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] });
  const config = app.get(ConfigService);
  // Prefer full URL; else build it from host + password (username defaults to admin)
  let url = config.get<string>('RABBITMQ_URL');
  if (!url) {
    const host = config.get<string>('RABBITMQ_HOST');
    const user = config.get<string>('RABBITMQ_USER', 'admin');
    const pass = config.get<string>('RABBITMQ_PASSWORD');
    if (host && pass) {
      // host expected like amqps://b-xxxx.mq.us-east-1.on.aws:5671
      // If host already includes scheme, keep it; otherwise prepend amqps://
      const hasScheme = /^amqp(s)?:\/\//i.test(host);
      const base = hasScheme ? host : `amqps://${host}`;
      // Inject credentials after scheme
      url = base.replace(/^(amqp(s)?:\/\/)/i, `$1${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`);
    }
  }

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: url ? [url] : [],
      queue: 'imports.batch',
      queueOptions: {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': 'imports.retry.10s',
        },
      },
      noAck: false,
      prefetchCount: 1,
    },
  });

  await app.startAllMicroservices();
  // Keep process alive; no HTTP server needed for worker
}

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
