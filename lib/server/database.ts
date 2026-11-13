import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import { AppError } from './config.ts';
import { schema } from './schema.ts';
type Row = Record<string, unknown>;
type Query = <T extends Row = Row>(sql: string, params?: unknown[]) => Promise<T[]>;
type Store = { query: Query; transaction<T>(work: (query: Query) => Promise<T>): Promise<T> };
const globals = globalThis as typeof globalThis & { eloStore?: Promise<Store> };
async function open(): Promise<Store> {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 });
    pool.on('error', () => console.error('elo_database_connection_error'));
    return {
      async query<T extends Row>(sql: string, params: unknown[] = []) { return (await pool.query(sql, params)).rows as T[]; },
      async transaction(work) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await work(async <T extends Row>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows as T[]);
          await client.query('COMMIT'); return result;
        } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
        finally { client.release(); }
      },
    };
  }
  if (process.env.NODE_ENV === 'production') throw new AppError('O banco de dados ainda não foi configurado no servidor.', 503);
  const { DatabaseSync: SQLite } = await import('node:sqlite');
  const filename = resolve(process.env.DATABASE_PATH || '.data/elo.sqlite');
  mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const sqlite: DatabaseSync = new SQLite(filename);
  sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  const run: Query = async <T extends Row>(sql: string, params: unknown[] = []) => {
    const ordered: (string | number | null)[] = [];
    const statement = sqlite.prepare(sql.replace(/\$(\d+)/g, (_, n) => { ordered.push(params[Number(n) - 1] as string | number | null); return '?'; }));
    return statement.all(...ordered) as T[];
  };
  // One local connection: queue transactions so concurrent requests never interleave inside BEGIN…COMMIT.
  let queue: Promise<unknown> = Promise.resolve();
  const store: Store = { query: run, transaction(work) {
    const next = queue.then(async () => {
      sqlite.exec('BEGIN');
      try { const result = await work(run); sqlite.exec('COMMIT'); return result; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    });
    queue = next.catch(() => {}); return next;
  } };
  for (const statement of schema) await store.query(statement);
  return store;
}
export function database() {
  if (!globals.eloStore) globals.eloStore = open().catch(error => { delete globals.eloStore; throw error; });
  return globals.eloStore;
}
export async function query<T extends Row = Row>(sql: string, params: unknown[] = []) { return (await database()).query<T>(sql, params); }
export async function transaction<T>(work: (query: Query) => Promise<T>) { return (await database()).transaction(work); }
