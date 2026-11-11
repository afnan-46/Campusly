// Data storage on MongoDB.
//
// Every record lives in MongoDB (one collection per kind of record, so you can browse
// them in MongoDB Compass). While the server runs it also keeps a working copy in
// memory, so pages load fast and every check-then-save happens in one step.
// store.save() writes only the records that changed back to MongoDB.
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

const COLLECTIONS = [
  'institutions', 'users', 'courses', 'appointments', 'reports', 'notifications',
  'applications', 'payments', 'joinCodes',
];
// How each record is identified in MongoDB (_id). Courses are unique per institution by code.
const keyOf = {
  courses: (c) => `${c.institutionId}:${c.code}`,
  reports: (r) => `${r.institutionId}:${r.code}`,
};
const key = (name, doc) => (keyOf[name] ? keyOf[name](doc) : doc.id);

const newId = () => crypto.randomBytes(12).toString('hex');
const now = () => new Date().toISOString();

const empty = () => ({
  ...Object.fromEntries(COLLECTIONS.map((c) => [c, []])),
  counters: { application: 1000 },
  secret: crypto.randomBytes(32).toString('hex'), // signs login tokens if JWT_SECRET is not set
});

let client = null;
let mdb = null;
let db = null;
// What MongoDB currently holds, as JSON text per record, so save() only sends changes.
let written = {};
let chain = Promise.resolve();
let dirty = false;

async function connect(uri) {
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  mdb = client.db();
  return mdb;
}

// Loads every collection into memory.
async function load(uri) {
  if (!mdb) await connect(uri);
  db = empty();
  written = {};
  for (const name of COLLECTIONS) {
    const docs = await mdb.collection(name).find({}).toArray();
    written[name] = new Map();
    db[name] = docs.map(({ _id, ...doc }) => {
      written[name].set(String(_id), JSON.stringify(doc));
      return doc;
    });
  }
  const settings = await mdb.collection('settings').findOne({ _id: 'app' });
  if (settings) {
    db.secret = settings.secret;
    db.counters = { ...db.counters, ...(settings.counters || {}) };
  } else {
    await mdb.collection('settings').insertOne({ _id: 'app', secret: db.secret, counters: db.counters });
  }
  await ensureIndexes();
  return db;
}

async function ensureIndexes() {
  await Promise.all([
    mdb.collection('users').createIndex({ institutionId: 1, role: 1 }),
    mdb.collection('users').createIndex({ email: 1 }),
    mdb.collection('appointments').createIndex({ institutionId: 1, facultyId: 1, date: 1 }),
    mdb.collection('reports').createIndex({ institutionId: 1, status: 1 }),
    mdb.collection('notifications').createIndex({ to: 1, createdAt: -1 }),
    mdb.collection('applications').createIndex({ status: 1, createdAt: -1 }),
  ]);
}

// Sends every changed, new or removed record to MongoDB.
async function flush() {
  dirty = false;
  for (const name of COLLECTIONS) {
    const seen = new Set();
    const ops = [];
    const prev = written[name] || (written[name] = new Map());
    for (const doc of db[name]) {
      const id = String(key(name, doc));
      seen.add(id);
      const json = JSON.stringify(doc);
      if (prev.get(id) !== json) {
        ops.push({ replaceOne: { filter: { _id: id }, replacement: { _id: id, ...doc }, upsert: true } });
        prev.set(id, json);
      }
    }
    for (const id of [...prev.keys()]) {
      if (!seen.has(id)) {
        ops.push({ deleteOne: { filter: { _id: id } } });
        prev.delete(id);
      }
    }
    if (ops.length) await mdb.collection(name).bulkWrite(ops, { ordered: false });
  }
  await mdb.collection('settings').updateOne({ _id: 'app' }, { $set: { secret: db.secret, counters: db.counters } }, { upsert: true });
}

// Queues a write of everything that changed. Calls made close together share one write.
function save() {
  if (dirty) return chain;
  dirty = true;
  chain = chain.then(flush).catch((e) => {
    console.error('Could not save to MongoDB:', e.message);
  });
  return chain;
}

// Empties every collection (used by the demo reset).
function reset() {
  db = { ...empty(), secret: db ? db.secret : empty().secret };
  return db;
}

async function close() {
  await chain;
  if (client) await client.close();
  client = null;
  mdb = null;
}

const store = {
  load,
  save,
  flush: () => chain,
  reset,
  close,
  newId,
  now,
  COLLECTIONS,
  get db() {
    if (!db) throw new Error('The database is not loaded yet.');
    return db;
  },
  get name() { return mdb ? mdb.databaseName : ''; },
  userById: (id) => store.db.users.find((u) => u.id === id) || null,
  instById: (id) => store.db.institutions.find((i) => i.id === id) || null,
};

module.exports = store;
