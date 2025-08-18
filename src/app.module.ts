import { createKeyv } from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';
import { LoggerModule } from 'nestjs-pino';

import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuditInterceptor } from './modules/audit/services/audit.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { ImportsModule } from './modules/imports/imports.module';
import { ListingsModule } from './modules/listings/listings.module';
import { MetricsInterceptor } from './modules/metrics/interceptors/metrics.interceptor';
import { MetricsModule } from './modules/metrics/metrics.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { TransactionsModule } from './modules/transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'warn',
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'password'],
          censor: '[Redacted]',
        },
        genReqId: (req: any) => {
          const hdr = req?.headers?.['x-correlation-id'] as string | undefined;
          const id = hdr && typeof hdr === 'string' ? hdr : undefined;
          if (id) return id;
          // fall back to fastify request id if present; reply hook will set header
          return req?.id;
        },
        customProps: (req: any) => ({
          correlationId: req?.headers?.['x-correlation-id'] || req?.id,
          tenantId: req?.headers?.['x-tenant-id'] || req?.user?.tenantId,
          userId: req?.user?.id,
        }),
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'short',
          ttl: 1000,
          limit: 3,
        },
        {
          name: 'medium',
          ttl: 10000,
          limit: 20,
        },
        {
          name: 'long',
          ttl: 60000,
          limit: 100,
        },
      ],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('POSTGRES_HOST', 'localhost'),
        port: Number(config.get<string>('POSTGRES_PORT', '5432')),
        username: config.get<string>('POSTGRES_USER', 'postgres'),
        password: config.get<string>('POSTGRES_PASSWORD', 'postgres'),
        database: config.get<string>('POSTGRES_DB', 'redatlas'),
        autoLoadEntities: true,
        synchronize: false,
        logging: false,
      }),
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async (config: ConfigService) => {
        return {
          stores: [
            new Keyv({
              store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }),
            }),
            createKeyv(config.get<string>('REDIS_URL') || 'redis://localhost:6379'),
          ],
        };
      },
      inject: [ConfigService],
    }),
    PropertiesModule,
    ListingsModule,
    TransactionsModule,
    ImportsModule,
    AuthModule,
    AuditModule,
    MetricsModule,
    AnalyticsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
