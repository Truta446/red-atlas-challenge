import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Property } from '../../properties/entities/property.entity';

@Injectable()
export class AnalyticsService {
  @InjectRepository(Property) private readonly props: Repository<Property>;

  public async distributionBySectorType(
    tenantId: string,
  ): Promise<Array<{ sector: string; type: string; count: number }>> {
    const rows = await this.props.query(
      `SELECT sector, type, COUNT(*)::int AS count
       FROM properties
       WHERE tenant_id = $1 AND deleted_at IS NULL
       GROUP BY sector, type
       ORDER BY count DESC`,
      [tenantId],
    );
    return rows;
  }

  public async monthlyPercentiles(
    tenantId: string,
    months: number = 12,
  ): Promise<Array<{ month: string; p50: number; p90: number }>> {
    // Uses created_at for bucketing; replace if business requires another timestamp
    const rows = await this.props.query(
      `WITH months AS (
         SELECT date_trunc('month', g)::date AS month
         FROM generate_series(date_trunc('month', now()) - ($2::int - 1) * interval '1 month', date_trunc('month', now()), interval '1 month') g
       )
       SELECT to_char(m.month, 'YYYY-MM') AS month,
              COALESCE(p.p50, 0) AS p50,
              COALESCE(p.p90, 0) AS p90
       FROM months m
       LEFT JOIN (
         SELECT date_trunc('month', created_at)::date AS mth,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY price) AS p50,
                percentile_cont(0.9) WITHIN GROUP (ORDER BY price) AS p90
         FROM properties
         WHERE tenant_id = $1 AND deleted_at IS NULL
         GROUP BY 1
       ) p ON p.mth = m.month
       ORDER BY m.month ASC`,
      [tenantId, months],
    );
    return rows;
  }

  public async sectorYoYValuation(
    tenantId: string,
    year?: number,
  ): Promise<Array<{ sector: string; yoy: number; year: number; prev_year: number }>> {
    // Choose current year by default
    const targetYear = year ?? new Date().getFullYear();
    const rows = await this.props.query(
      `WITH base AS (
         SELECT sector,
                EXTRACT(YEAR FROM created_at)::int AS yr,
                AVG(valuation) AS avg_val
         FROM properties
         WHERE tenant_id = $1 AND deleted_at IS NULL AND valuation IS NOT NULL
         GROUP BY sector, yr
       ),
       curr AS (
         SELECT sector, avg_val FROM base WHERE yr = $2
       ),
       prev AS (
         SELECT sector, avg_val FROM base WHERE yr = $2 - 1
       )
       SELECT c.sector,
              CASE WHEN p.avg_val IS NULL OR p.avg_val = 0 THEN 0
                   ELSE ((c.avg_val - p.avg_val) / p.avg_val) * 100 END AS yoy,
              $2::int AS year,
              ($2 - 1)::int AS prev_year
       FROM curr c
       LEFT JOIN prev p ON p.sector = c.sector
       ORDER BY yoy DESC NULLS LAST`,
      [tenantId, targetYear],
    );
    return rows;
  }
}
