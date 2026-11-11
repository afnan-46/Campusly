require('dotenv').config();
// Campus time for office hours and "is this slot in the past".
process.env.TZ = process.env.APP_TZ || 'Asia/Dhaka';

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const store = require('./store');
const { UPLOAD_DIR } = require('./middleware/upload');
const { seedDatabase } = require('./seed');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '4mb' }));
if (!isProd && process.env.QUIET !== 'true') app.use(morgan('dev'));

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.use('/api/meta', require('./routes/meta'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/faculty', require('./routes/faculty'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/insights', require('./routes/insights'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/public', require('./routes/public'));
app.use('/api/company', require('./routes/company'));
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

// After "npm run build", the server also serves the React app.
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// Turns thrown errors into JSON the React app can show.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong.';
  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON.';
  }
  if (status >= 500) {
    console.error(err);
    if (isProd) message = 'Something went wrong on the server.';
  }
  res.status(status).json({ message, fields: err.fields });
});

async function start() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campusly';
  try {
    await store.load(uri);
  } catch (e) {
    console.error(`\nCould not connect to MongoDB at ${uri}\n${e.message}\nStart MongoDB (or MongoDB Compass's local server) and try again.\n`);
    process.exit(1);
  }
  if (!store.db.users.length && String(process.env.SEED_ON_EMPTY).toLowerCase() !== 'false') {
    console.log('No data yet: adding demo institutions, accounts and sample data.');
    await seedDatabase();
  }
  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => {
    console.log(`Campusly API on http://localhost:${port}`);
    console.log(`MongoDB database: ${store.name}`);
  });
}

if (require.main === module) {
  start().catch((e) => {
    console.error('Could not start the server:', e.message);
    process.exit(1);
  });
}

module.exports = app;
