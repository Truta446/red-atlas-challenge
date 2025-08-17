import { createWriteStream } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

interface Options {
  rows: number;
  out: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
}

function parseArgs(): Options {
  const args = new Map<string, string>();
  for (const a of process.argv.slice(2)) {
    const [k, v] = a.split('=');
    if (k && v) args.set(k.replace(/^--/, ''), v);
  }
  const rows = Number(args.get('rows') ?? '100000');
  const out = args.get('out') ?? 'data/properties-import.csv';
  const centerLat = Number(args.get('centerLat') ?? '-23.55052'); // São Paulo
  const centerLng = Number(args.get('centerLng') ?? '-46.633308');
  const radiusKm = Number(args.get('radiusKm') ?? '20');
  if (!Number.isFinite(rows) || rows <= 0) throw new Error('Invalid --rows');
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) throw new Error('Invalid center coords');
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) throw new Error('Invalid --radiusKm');
  return { rows, out, centerLat, centerLng, radiusKm };
}

function randomInRadius(lat: number, lng: number, radiusKm: number): { lat: number; lng: number } {
  // Uniform within circle on a plane approximation (ok for small radius)
  const r = radiusKm * 1000;
  const t = 2 * Math.PI * Math.random();
  const u = Math.random() + Math.random();
  const d = (u > 1 ? 2 - u : u) * r; // triangular distribution to keep more uniform
  const dx = d * Math.cos(t);
  const dy = d * Math.sin(t);
  const dLat = dy / 111_320; // meters per degree lat
  const dLng = dx / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

function pad(n: number, len = 4): string { return String(n).padStart(len, '0'); }

async function main(): Promise<void> {
  const { rows, out, centerLat, centerLng, radiusKm } = parseArgs();
  const outPath = resolve(out);
  mkdirSync(dirname(outPath), { recursive: true });
  const stream = createWriteStream(outPath, { encoding: 'utf8' });

  const sectors = ['Norte', 'Sul', 'Leste', 'Oeste', 'Centro'];
  const types = ['house', 'apartment', 'land', 'commercial'];

  // Header
  stream.write('address,sector,type,price,latitude,longitude\n');

  for (let i = 1; i <= rows; i++) {
    const sector = sectors[Math.floor(Math.random() * sectors.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    // Base price by type with noise
    const base = type === 'house' ? 600000 : type === 'apartment' ? 400000 : type === 'commercial' ? 800000 : 250000;
    const price = Math.round(base * (0.7 + Math.random() * 0.8));
    const { lat, lng } = randomInRadius(centerLat, centerLng, radiusKm);
    const address = `Rua ${sector} ${pad(i, 5)}`;
    const line = `${address},${sector},${type},${price},${lat.toFixed(6)},${lng.toFixed(6)}\n`;
    if (!stream.write(line)) {
      await new Promise<void>((resolve) => stream.once('drain', () => resolve()));
    }
    if (i % 10000 === 0) {
      // eslint-disable-next-line no-console
      console.log(`generated ${i}/${rows}`);
    }
  }
  await new Promise<void>((resolveDone, reject) => {
    stream.end(() => resolveDone());
    stream.on('error', reject);
  });
  // eslint-disable-next-line no-console
  console.log(`CSV generated: ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
