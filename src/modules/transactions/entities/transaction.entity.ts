import { Column, Entity, Index, ManyToOne } from 'typeorm';

import { BaseEntityWithTenant } from '../../../common/entities/base.entity';
import { Listing } from '../../listings/entities/listing.entity';
import { Property } from '../../properties/entities/property.entity';

@Entity('transactions')
export class Transaction extends BaseEntityWithTenant {
  @ManyToOne(() => Property, (p: Property) => p.transactions, { onDelete: 'SET NULL' })
  public property!: Property;

  @ManyToOne(() => Listing, { nullable: true, onDelete: 'SET NULL' })
  public listing?: Listing | null;

  @Index()
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  public price!: string;

  @Index()
  @Column({ type: 'date' })
  public date!: string;
}
