import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';

import { BaseEntityWithTenant } from '../../../common/entities/base.entity';
import { Property } from '../../properties/entities/property.entity';

@Entity('listings')
export class Listing extends BaseEntityWithTenant {
  @ManyToOne(() => Property, (p: Property) => p.listings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'propertyid' })
  public property!: Property;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  public status!: 'active' | 'paused' | 'sold';

  @Index()
  @Column({ type: 'numeric', precision: 14, scale: 2 })
  public price!: string;
}
