// CharCraft Google Sign-In backend
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

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
app.get('/healthz', (req, res) => res.json({ ok: true }));

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

app.post('/api/auth/logout', (req, res) => res.json({ ok: true })); // client drops its token

app.listen(PORT, () => console.log('charcraft-auth listening on ' + PORT));
