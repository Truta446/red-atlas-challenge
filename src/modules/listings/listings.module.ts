import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Property } from '../properties/entities/property.entity';
import { ListingsController } from './controllers/listings.controller';
import { Listing } from './entities/listing.entity';
import { ListingsService } from './services/listings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Listing, Property])],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
