/*
  Seed script: generates initial dataset
  - 100k properties
  - 200k listings
  - 150k transactions
  Idempotent using a marker table `seed_runs`.
  Usage:
    - Local:    npx ts-node scripts/seed.ts
    - Docker:   docker compose run --rm api node --require ts-node/register --require tsconfig-paths/register scripts/seed.ts
  Config via env:
    - DEFAULT_TENANT (default: 'public')
    - SEED_FORCE=true to re-run even if already applied
*/
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, QueryRunner } from 'typeorm';

dotenv.config();

// SSL options (useful for AWS RDS)
const sslEnabled =
  (process.env.POSTGRES_SSL || '').toLowerCase() === 'true' ||
  (process.env.PGSSLMODE || '').toLowerCase() === 'require';
const sslRejectUnauthorized = (process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'true';

const tenant = process.env.DEFAULT_TENANT || 'public';
const PROPERTIES_TARGET = 100_000;
const LISTINGS_TARGET = 200_000;
const TX_TARGET = 150_000;
const BATCH = 5_000;
const SEED_NAME = 'initial_seed_v1';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
function pick<T>(arr: readonly T[]): T { return arr[randInt(0, arr.length - 1)]; }

// São Paulo bounding box (approx)
const LAT_MIN = -23.8; const LAT_MAX = -23.3;
const LNG_MIN = -46.9; const LNG_MAX = -46.3;

const sectors = [
  'Centro', 'Zona Norte', 'Zona Sul', 'Zona Leste', 'Zona Oeste',
  'Moema', 'Pinheiros', 'Vila Madalena', 'Itaim', 'Tatuapé', 'Santana',
] as const;
const types = ['apartment', 'house', 'studio', 'office', 'land'] as const;
const listingStatuses = ['active', 'paused', 'sold'] as const;

// Escape string for SQL literal: wrap in single quotes and escape internal quotes
function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

async function ensureSeedMarker(qr: QueryRunner): Promise<boolean> {
  await qr.query(`CREATE TABLE IF NOT EXISTS seed_runs (name varchar(128) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const exists = await qr.query(`SELECT 1 FROM seed_runs WHERE name = $1`, [SEED_NAME]);
  if (exists.length > 0) {
    if (process.env.SEED_FORCE === 'true') {
      await qr.query(`DELETE FROM seed_runs WHERE name = $1`, [SEED_NAME]);
      return false; // proceed
    }
    return true; // already applied
  }
  return false;
}

async function markApplied(qr: QueryRunner): Promise<void> {
  await qr.query(`INSERT INTO seed_runs(name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [SEED_NAME]);
}

async function createDataSource(): Promise<DataSource> {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    username: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: process.env.POSTGRES_DB || 'redatlas',
    synchronize: false,
    logging: ['error'],
    ssl: sslEnabled ? { rejectUnauthorized: sslRejectUnauthorized } : false,
  });
  await ds.initialize();
  return ds;
}

async function insertProperties(qr: QueryRunner): Promise<string[]> {
  console.time('properties');
  const ids: string[] = [];
  for (let offset = 0; offset < PROPERTIES_TARGET; offset += BATCH) {
    const rows: string[] = [];
    for (let i = 0; i < BATCH && offset + i < PROPERTIES_TARGET; i++) {
      const addressNo = randInt(1, 9999);
      const street = pick(['Rua', 'Av.', 'Alameda', 'Travessa']);
      const bairro = pick(sectors);
      const t = pick(types);
      const price = (randInt(80_000, 2_000_000) + randFloat(0, 0.99)).toFixed(2);
      const lat = randFloat(LAT_MIN, LAT_MAX);
      const lng = randFloat(LNG_MIN, LNG_MAX);
      const address = `${street} ${bairro} ${addressNo}`;
      // Values: tenant_id, address, sector, type, price, lng, lat
      // Text fields must be single-quoted; numbers remain numeric literals
      rows.push(`(${sqlStr(tenant)}, ${sqlStr(address)}, ${sqlStr(bairro)}, ${sqlStr(t)}, ${price}, ${lng}, ${lat})`);
    }
    await qr.startTransaction();
    try {
      const insertSql = `INSERT INTO properties(tenant_id, address, sector, type, price, location)\n        SELECT x.tenant_id, x.address, x.sector, x.type, x.price, ST_SetSRID(ST_MakePoint(x.lng, x.lat), 4326)\n        FROM (VALUES ${rows.join(',')}) AS x(tenant_id, address, sector, type, price, lng, lat)\n        RETURNING id;`;
      const res = await qr.query(insertSql);
      for (const r of res) ids.push(r.id);
      await qr.commitTransaction();
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    }
    if ((offset + BATCH) % 20000 === 0) {
      console.log(`Inserted properties: ${Math.min(offset + BATCH, PROPERTIES_TARGET)}/${PROPERTIES_TARGET}`);
    }
  }
  console.timeEnd('properties');
  return ids;
}

async function insertListings(qr: QueryRunner, propertyIds: string[]): Promise<string[]> {
  console.time('listings');
  const ids: string[] = [];
  for (let offset = 0; offset < LISTINGS_TARGET; offset += BATCH) {
    const rows: string[] = [];
    for (let i = 0; i < BATCH && offset + i < LISTINGS_TARGET; i++) {
      const pid = propertyIds[randInt(0, propertyIds.length - 1)];
      const status = pick(listingStatuses);
      const price = (randInt(80_000, 2_000_000) + randFloat(0, 0.99)).toFixed(2);
      rows.push(`(${sqlStr(tenant)}, ${sqlStr(pid)}, ${sqlStr(status)}, ${price})`);
    }
    await qr.startTransaction();
    try {
      const insertSql = `INSERT INTO listings(tenant_id, propertyid, status, price) VALUES ${rows.join(',')} RETURNING id;`;
      const res = await qr.query(insertSql);
      for (const r of res) ids.push(r.id);
      await qr.commitTransaction();
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    }
    if ((offset + BATCH) % 20000 === 0) {
      console.log(`Inserted listings: ${Math.min(offset + BATCH, LISTINGS_TARGET)}/${LISTINGS_TARGET}`);
    }
  }
  console.timeEnd('listings');
  return ids;
}

function randomDateWithinYears(years: number): string {
  const now = Date.now();
  const past = now - years * 365 * 24 * 60 * 60 * 1000;
  const d = new Date(randInt(past, now));
  return d.toISOString().substring(0, 10);
}

async function insertTransactions(qr: QueryRunner, propertyIds: string[], listingIds: string[]): Promise<void> {
  console.time('transactions');
  for (let offset = 0; offset < TX_TARGET; offset += BATCH) {
    const rows: string[] = [];
    for (let i = 0; i < BATCH && offset + i < TX_TARGET; i++) {
      const pid = propertyIds[randInt(0, propertyIds.length - 1)];
      const lid = Math.random() < 0.7 ? `'${listingIds[randInt(0, listingIds.length - 1)]}'` : 'NULL';
      const price = (randInt(80_000, 2_000_000) + randFloat(0, 0.99)).toFixed(2);
      const date = randomDateWithinYears(3);
      rows.push(`(${sqlStr(tenant)}, ${sqlStr(pid)}, ${lid}, ${price}, ${sqlStr(date)})`);
    }
    await qr.startTransaction();
    try {
      const insertSql = `INSERT INTO transactions(tenant_id, propertyid, listingid, price, date) VALUES ${rows.join(',')};`;
      await qr.query(insertSql);
      await qr.commitTransaction();
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    }
    if ((offset + BATCH) % 20000 === 0) {
      console.log(`Inserted transactions: ${Math.min(offset + BATCH, TX_TARGET)}/${TX_TARGET}`);
    }
  }
  console.timeEnd('transactions');
}

async function main(): Promise<void> {
  const ds = await createDataSource();
  const qr = ds.createQueryRunner();
  try {
    await qr.connect();
    const already = await ensureSeedMarker(qr);
    if (already) {
      console.log(`Seed '${SEED_NAME}' already applied. Use SEED_FORCE=true to re-run.`);
      await ds.destroy();
      return;
    }

    console.log('Seeding properties...');
    const propertyIds = await insertProperties(qr);

    console.log('Seeding listings...');
    const listingIds = await insertListings(qr, propertyIds);

    console.log('Seeding transactions...');
    await insertTransactions(qr, propertyIds, listingIds);

    await markApplied(qr);
    console.log('Seed completed successfully.');
  } finally {
    await qr.release();
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
