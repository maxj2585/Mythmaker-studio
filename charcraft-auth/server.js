// CharCraft Google Sign-In backend
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { Pool } = require('pg');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'https://charcraft-mythmaker.puter.site,http://localhost:8080')
  .split(',').map(s => s.trim()).filter(Boolean);

if (!GOOGLE_CLIENT_ID || !JWT_SECRET) {
  console.error('Missing GOOGLE_CLIENT_ID or JWT_SECRET');
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);
const app = express();

app.use(cors({
  origin: (origin, cb) => (!origin || ALLOWED_ORIGINS.includes(origin)) ? cb(null, true) : cb(null, false),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use('/api/sync', express.json({ limit: '15mb' }));
app.use(express.json({ limit: '20kb' }));

// Simple in-memory rate limit for the login endpoint
const hits = new Map();
function rateLimit(req, res, next) {
  const key = req.ip, now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < 60000);
  arr.push(now); hits.set(key, arr);
  if (arr.length > 20) return res.status(429).json({ message: 'Too many attempts, try again in a minute.' });
  next();
}

const publicUser = p => ({ id: p.sub, email: p.email, name: p.name, picture: p.picture });

app.get('/', (req, res) => res.json({ ok: true, service: 'charcraft-auth' }));
app.get('/healthz', (req, res) => res.json({ ok: true, db: !!pool }));

app.post('/api/auth/google', rateLimit, async (req, res) => {
  const { token } = req.body || {};
  if (!token || typeof token !== 'string') return res.status(400).json({ message: 'Google token is required.' });
  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload(); // signature, expiry, issuer checked by the library
    if (!payload || !payload.email_verified) return res.status(401).json({ message: 'Google email is not verified.' });
    const user = publicUser(payload);
    // Stateless session: the site's own JWT carries the profile, keyed by Google's stable "sub"
    const siteToken = jwt.sign(user, JWT_SECRET, { expiresIn: '7d', issuer: 'charcraft-auth', subject: user.id });
    res.json({ user, token: siteToken });
  } catch (err) {
    console.warn('Token verification failed:', err.message);
    res.status(401).json({ message: 'Invalid Google token.' });
  }
});

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ message: 'Not signed in.' });
  try { req.user = jwt.verify(t, JWT_SECRET, { issuer: 'charcraft-auth' }); next(); }
  catch { res.status(401).json({ message: 'Session expired. Please sign in again.' }); }
}

app.get('/api/auth/me', requireAuth, (req, res) => {
  const { id, email, name, picture } = req.user;
  res.json({ user: { id, email, name, picture } });
});


// ---- Character sync (Neon Postgres) ----
const DATABASE_URL = process.env.DATABASE_URL;
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 3 }) : null;
let dbReady = null;
function ensureDb() {
  if (!pool) return Promise.reject(new Error('no database'));
  if (!dbReady) dbReady = pool.query(`CREATE TABLE IF NOT EXISTS charcraft_sync (
      user_id TEXT PRIMARY KEY,
      email TEXT,
      characters JSONB NOT NULL DEFAULT '[]',
      deleted JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`).catch(e => { dbReady = null; throw e; });
  return dbReady;
}

app.get('/api/sync', requireAuth, async (req, res) => {
  try {
    await ensureDb();
    const r = await pool.query('SELECT characters, deleted, updated_at FROM charcraft_sync WHERE user_id = $1', [req.user.id]);
    const row = r.rows[0];
    res.json(row ? { characters: row.characters, deleted: row.deleted, updatedAt: row.updated_at } : { characters: [], deleted: [], updatedAt: null });
  } catch (e) { console.error('sync get', e.message); res.status(503).json({ message: 'Sync is unavailable right now.' }); }
});

app.put('/api/sync', requireAuth, async (req, res) => {
  const { characters, deleted } = req.body || {};
  if (!Array.isArray(characters) || characters.length > 2000 || !characters.every(c => c && typeof c === 'object' && typeof c.id === 'string'))
    return res.status(400).json({ message: 'characters must be an array of objects with an id.' });
  const del = Array.isArray(deleted) ? deleted.filter(x => typeof x === 'string').slice(-1000) : [];
  try {
    await ensureDb();
    const r = await pool.query(`INSERT INTO charcraft_sync (user_id, email, characters, deleted, updated_at)
      VALUES ($1, $2, $3::jsonb, $4::jsonb, now())
      ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, characters = EXCLUDED.characters, deleted = EXCLUDED.deleted, updated_at = now()
      RETURNING updated_at`, [req.user.id, req.user.email || null, JSON.stringify(characters), JSON.stringify(del)]);
    res.json({ ok: true, count: characters.length, updatedAt: r.rows[0].updated_at });
  } catch (e) { console.error('sync put', e.message); res.status(503).json({ message: 'Sync is unavailable right now.' }); }
});

app.post('/api/auth/logout', (req, res) => res.json({ ok: true })); // client drops its token

app.listen(PORT, () => console.log('charcraft-auth listening on ' + PORT));
