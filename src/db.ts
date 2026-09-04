import pg from 'pg';

export const db = new pg.Pool({
  host: 'localhost',
  port: 5432,
  user: 'skill4handel',
  password: 'skill4handel',
  database: 'skill4handel',
});