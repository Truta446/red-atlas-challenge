import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

// Determine SSL settings for Postgres (useful for AWS RDS where SSL may be enforced)
const sslEnabled =
  (process.env.POSTGRES_SSL || '').toLowerCase() === 'true' ||
  (process.env.PGSSLMODE || '').toLowerCase() === 'require';
const sslRejectUnauthorized = (process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'true';

const dataSource: DataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'redatlas',
  entities: [__dirname + '/../**/*.entity.{ts,js}'],
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: false,
  ssl: sslEnabled ? { rejectUnauthorized: sslRejectUnauthorized } : false,
  extra: {
    max: Number(process.env.PG_POOL_MAX || 50),
  },
});

export default dataSource;
