import { query } from '../lib/server/database.ts';
import { schema } from '../lib/server/schema.ts';
for (const statement of schema) await query(statement);
console.log('Database schema is up to date.');
process.exit(0);
