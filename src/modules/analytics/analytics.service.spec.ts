import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { Property } from '../properties/property.entity';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  const repo = { query: jest.fn() } as unknown as jest.Mocked<Repository<Property>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getRepositoryToken(Property), useValue: repo },
      ],
    }).compile();

    service = module.get(AnalyticsService);
    jest.clearAllMocks();
  });

  it('distributionBySectorType forwards tenantId to SQL', async () => {
    (repo.query as jest.Mock).mockResolvedValue([{ sector: 'A', type: 'house', count: 10 }]);
    const rows = await service.distributionBySectorType('t1');
    expect(repo.query).toHaveBeenCalledWith(expect.stringContaining('SELECT sector, type'), ['t1']);
    expect(rows).toEqual([{ sector: 'A', type: 'house', count: 10 }]);
  });

  it('monthlyPercentiles uses months and tenant', async () => {
    (repo.query as jest.Mock).mockResolvedValue([{ month: '2025-01', p50: 1, p90: 2 }]);
    const rows = await service.monthlyPercentiles('t2', 6);
    const args = (repo.query as jest.Mock).mock.calls[0];
    expect(args[0]).toContain('percentile_cont');
    expect(args[1]).toEqual(['t2', 6]);
    expect(rows[0].month).toBe('2025-01');
  });

  it('sectorYoYValuation defaults current year and forwards tenant', async () => {
    (repo.query as jest.Mock).mockResolvedValue([{ sector: 'A', yoy: 5, year: 2025, prev_year: 2024 }]);
    const rows = await service.sectorYoYValuation('t3');
    const args = (repo.query as jest.Mock).mock.calls[0];
    expect(args[0]).toContain('AVG(valuation)');
    expect(args[1][0]).toBe('t3');
    expect(rows[0].yoy).toBe(5);
  });
});
