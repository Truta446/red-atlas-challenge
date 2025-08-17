import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ImportJob } from './import-job.entity';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';
import { Property } from '../properties/property.entity';
import { ImportsConsumer } from './imports.consumer';
import { ImportProcessedBatch } from './processed-batch.entity';
import { ImportsRmqTopology } from './rmq.topology.provider';
import { MetricsModule } from '../metrics/metrics.module';

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
