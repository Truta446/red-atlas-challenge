import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Listing } from '../listings/entities/listing.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { PropertiesController } from './controllers/properties.controller';
import { Property } from './entities/property.entity';
import { PropertiesService } from './services/properties.service';

@Module({
  imports: [TypeOrmModule.forFeature([Property, Listing, Transaction])],
  controllers: [PropertiesController],
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
