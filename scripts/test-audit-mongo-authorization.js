// File: scripts/test-audit-mongo-authorization.js
const username = process.env.AUDIT_RUNTIME_USER;
const password = process.env.AUDIT_RUNTIME_PASSWORD;
const databaseName = process.env.AUDIT_DATABASE;
const uri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${process.env.AUDIT_MONGO_HOST}:${process.env.AUDIT_MONGO_PORT}/admin?authSource=admin`;
const audit = new Mongo(uri).getDB(databaseName);
const collectionNames = new Set(audit.getCollectionInfos().map((entry) => entry.name));
if (!collectionNames.has('events') || !collectionNames.has('sealed_transfers')) {
  throw new Error('Cannot list audit collections for DBGate');
}

function denied(operation) {
  try {
    operation();
  } catch (error) {
    if (error.code === 13) return;
    throw error;
  }
  throw new Error('Expected MongoDB authorization failure');
}

for (const name of ['events', 'sealed_transfers', 'dead_letters', 'drafts', 'transfer_renditions']) {
  const collection = audit.getCollection(name);
  if (name === 'drafts' || name === 'transfer_renditions') {
    collection.createIndex({ id: 1 }, { unique: true });
  } else {
    denied(() => collection.createIndex({ state: 1 }, { expireAfterSeconds: 1 }));
  }
  collection.insertOne({ id: name, state: 'initial' });
  if (!collection.findOne({ id: name })) throw new Error(`Cannot read ${name}`);
  denied(() => collection.deleteOne({ id: name }));
  if (name === 'drafts' || name === 'transfer_renditions') {
    collection.updateOne({ id: name }, { $set: { state: 'updated' } });
    if (collection.findOne({ id: name }).state !== 'updated') throw new Error(`Cannot update ${name}`);
  } else {
    denied(() => collection.updateOne({ id: name }, { $set: { state: 'updated' } }));
  }
}
denied(() => audit.getCollection('unrelated').findOne({}));
denied(() => audit.getSiblingDB('admin').createUser({ user: 'forbidden', pwd: 'forbidden', roles: [] }));
print('MongoDB audit authorization checks passed.');
