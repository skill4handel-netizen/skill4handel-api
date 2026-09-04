import pg from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://skill4handel:skill4handel@localhost:5432/skill4handel';

export const db = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('localhost')
    ? undefined
    : { rejectUnauthorized: false },
});