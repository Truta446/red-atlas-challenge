import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqplib, { Channel, Connection } from 'amqplib';

@Injectable()
export class ImportsRmqTopology implements OnModuleInit {
  private readonly logger = new Logger(ImportsRmqTopology.name);

  @Inject(ConfigService) private readonly config: ConfigService;

  public async onModuleInit(): Promise<void> {
    // Prefer full URL; else build it from host + password (username defaults to admin)
    let url = this.config.get<string>('RABBITMQ_URL');
    if (!url) {
      const host = this.config.get<string>('RABBITMQ_HOST');
      const user = this.config.get<string>('RABBITMQ_USER', 'admin');
      const pass = this.config.get<string>('RABBITMQ_PASSWORD');
      if (host && pass) {
        const hasScheme = /^amqp(s)?:\/\//i.test(host);
        const base = hasScheme ? host : `amqps://${host}`;
        url = base.replace(/^(amqp(s)?:\/\/)/i, `$1${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`);
      }
    }
    if (!url) {
      this.logger.warn('RABBITMQ_URL not set and could not construct from RABBITMQ_HOST/RABBITMQ_PASSWORD; skipping RMQ topology assertion');
      return;
    }

    let conn: Connection | undefined;
    let ch: Channel | undefined;
    try {
      conn = await amqplib.connect(url);
      ch = await conn.createChannel();

      // Declare queues
      const main = 'imports.batch';
      const retry10 = 'imports.retry.10s';
      const retry60 = 'imports.retry.60s';
      const dlq = 'imports.batch.dlq';

      await ch.assertQueue(main, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': retry10,
        },
      });

      await ch.assertQueue(retry10, {
        durable: true,
        arguments: {
          'x-message-ttl': 10000,
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': main,
        },
      });

      await ch.assertQueue(retry60, {
        durable: true,
        arguments: {
          'x-message-ttl': 60000,
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': main,
        },
      });

      await ch.assertQueue(dlq, { durable: true });

      this.logger.log('RMQ topology asserted (main, retry, dlq)');
    } catch (e) {
      this.logger.error(`Failed to assert RMQ topology: ${String((e as Error).message)}`);
    } finally {
      try {
        await ch?.close();
        await conn?.close();
      } catch (e) {
        this.logger.error(`Failed to close RMQ connection: ${String((e as Error).message)}`);
      }
    }
  }
}
