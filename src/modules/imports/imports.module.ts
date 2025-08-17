import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MetricsModule } from '../metrics/metrics.module';
import { Property } from '../properties/entities/property.entity';
import { ImportsConsumer } from './controllers/imports.consumer';
import { ImportsController } from './controllers/imports.controller';
import { ImportJob } from './entities/import-job.entity';
import { ImportProcessedBatch } from './entities/processed-batch.entity';
import { ImportsService } from './services/imports.service';
import { ImportsRmqTopology } from './services/rmq.topology.provider';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ImportJob, Property, ImportProcessedBatch]),
    MetricsModule,
    ClientsModule.registerAsync([
      {
        name: 'IMPORTS_RMQ',
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('RABBITMQ_URL') as string],
            queue: 'imports.batch',
            queueOptions: {
              durable: true,
              arguments: {
                'x-dead-letter-exchange': '',
                'x-dead-letter-routing-key': 'imports.retry.10s',
              },
            },
          },
        }),
      },
    ]),
  ],
  controllers: [ImportsController, ImportsConsumer],
  providers: [ImportsService, ImportsRmqTopology],
  exports: [ImportsService],
})
export class ImportsModule {}
