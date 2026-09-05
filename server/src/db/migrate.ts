import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, 'schema.sql');

try {
  const schema = await readFile(schemaPath, 'utf8');

  await pool.query(schema);

  console.log('資料庫 Schema 建立成功。');
} catch (error) {
  console.error('資料庫 Migration 失敗：');
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
