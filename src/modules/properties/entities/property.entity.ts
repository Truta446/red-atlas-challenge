import { Column, Entity, Index, OneToMany } from 'typeorm';

import { BaseEntityWithTenant } from '../../../common/entities/base.entity';
import { Listing } from '../../listings/entities/listing.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

@Entity('properties')
export class Property extends BaseEntityWithTenant {
  @Column({ type: 'varchar', length: 255 })
  public address!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  public sector!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  public type!: string;

  @Index()
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  public price!: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, nullable: true })
  public valuation?: string | null;

  // PostGIS geometry(Point, 4326)
  @Index({ spatial: true })
  @Column({ type: 'geometry', spatialFeatureType: 'Point', srid: 4326, select: false })
  public location!: string;

  @OneToMany(() => Listing, (l) => l.property)
  public listings!: Listing[];

  @OneToMany(() => Transaction, (t) => t.property)
  public transactions!: Transaction[];
}
