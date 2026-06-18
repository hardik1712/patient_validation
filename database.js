const path = require('path');

const usePostgres = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
let sql;
let sqliteDb;

if (usePostgres) {
  const { neon } = require('@neondatabase/serverless');
  sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);
} else {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, 'database.sqlite');
  sqliteDb = new sqlite3.Database(dbPath);
  
  // Promisify SQLite methods for a unified async API
  sql = async (strings, ...values) => {
    // A very basic tagged template literal parser for SQLite
    // This converts `SELECT * FROM foo WHERE id = ${id}` into `SELECT * FROM foo WHERE id = ?` and `[id]`
    let query = strings[0];
    for (let i = 0; i < values.length; i++) {
      query += '?' + strings[i + 1];
    }
    
    return new Promise((resolve, reject) => {
      if (query.trim().toUpperCase().startsWith('SELECT')) {
        sqliteDb.all(query, values, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      } else {
        sqliteDb.run(query, values, function(err) {
          if (err) reject(err);
          else resolve(this);
        });
      }
    });
  };
}

let initialized = false;

async function ensureInit() {
  if (initialized) return;
  initialized = true;

  if (usePostgres) {
    // Postgres Schema
    await sql`
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        session_id TEXT UNIQUE,
        annotator_id TEXT,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data TEXT
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token TEXT PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS response_cache (
        cache_key TEXT PRIMARY KEY,
        data TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('Postgres tables initialized (Neon).');
  } else {
    // SQLite Schema
    await sql`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE,
        annotator_id TEXT,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        data TEXT
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token TEXT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS response_cache (
        cache_key TEXT PRIMARY KEY,
        data TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('SQLite tables initialized (Local).');
  }
}

// ─── Submissions ───

async function insertSubmission(sessionId, annotatorId, dataStr) {
  await ensureInit();
  if (usePostgres) {
    return await sql`
      INSERT INTO submissions (session_id, annotator_id, data)
      VALUES (${sessionId}, ${annotatorId}, ${dataStr})
      ON CONFLICT (session_id) DO UPDATE SET data = ${dataStr}, annotator_id = ${annotatorId}
    `;
  } else {
    return await sql`
      INSERT INTO submissions (session_id, annotator_id, data)
      VALUES (${sessionId}, ${annotatorId}, ${dataStr})
      ON CONFLICT(session_id) DO UPDATE SET data=excluded.data, annotator_id=excluded.annotator_id
    `;
  }
}

async function getAllSubmissions() {
  await ensureInit();
  const rows = await sql`
    SELECT annotator_id, completed_at, data FROM submissions
  `;
  return rows;
}

// ─── Admin Sessions ───

async function createSession(token) {
  await ensureInit();
  if (usePostgres) {
    await sql`DELETE FROM admin_sessions WHERE created_at < NOW() - INTERVAL '24 hours'`;
    await sql`INSERT INTO admin_sessions (token) VALUES (${token}) ON CONFLICT (token) DO NOTHING`;
  } else {
    await sql`DELETE FROM admin_sessions WHERE created_at < datetime('now', '-1 day')`;
    await sql`INSERT OR IGNORE INTO admin_sessions (token) VALUES (${token})`;
  }
}

async function checkSession(token) {
  if (!token) return false;
  await ensureInit();
  let rows;
  if (usePostgres) {
    rows = await sql`
      SELECT token FROM admin_sessions WHERE token = ${token} AND created_at > NOW() - INTERVAL '24 hours'
    `;
  } else {
    rows = await sql`
      SELECT token FROM admin_sessions WHERE token = ${token} AND created_at > datetime('now', '-1 day')
    `;
  }
  return rows.length > 0;
}

async function deleteSession(token) {
  if (!token) return;
  await ensureInit();
  await sql`DELETE FROM admin_sessions WHERE token = ${token}`;
}

// ─── Response Cache ───

async function getCache(key) {
  await ensureInit();
  const rows = await sql`SELECT data FROM response_cache WHERE cache_key = ${key}`;
  if (rows && rows.length > 0) {
    return JSON.parse(rows[0].data);
  }
  return null;
}

async function setCache(key, value) {
  await ensureInit();
  const dataStr = JSON.stringify(value);
  if (usePostgres) {
    await sql`
      INSERT INTO response_cache (cache_key, data) VALUES (${key}, ${dataStr})
      ON CONFLICT (cache_key) DO UPDATE SET data = ${dataStr}, updated_at = CURRENT_TIMESTAMP
    `;
  } else {
    await sql`
      INSERT INTO response_cache (cache_key, data) VALUES (${key}, ${dataStr})
      ON CONFLICT(cache_key) DO UPDATE SET data=excluded.data, updated_at=CURRENT_TIMESTAMP
    `;
  }
}

module.exports = {
  ensureInit,
  insertSubmission,
  getAllSubmissions,
  createSession,
  checkSession,
  deleteSession,
  getCache,
  setCache
};
