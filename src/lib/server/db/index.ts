/**
 * Drizzle ORM client — PostgreSQL connection pool singleton.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

const { Pool } = pg;

let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    const connectionString = env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL non définie');
    }
    _pool = new Pool({
      connectionString,
      max: parseInt(env.DB_POOL_MAX || '10', 10),
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    });
  }
  return _pool;
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

export type DrizzleDB = ReturnType<typeof getDb>;

/** Eagerly establish the first DB connection so requests don't pay the cost. */
export async function warmupDb(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  client.release();
}

/** Graceful shutdown — drain pool connections. */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}
