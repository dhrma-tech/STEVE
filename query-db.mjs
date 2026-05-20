import { createRequire } from 'module';
import { resolve } from 'path';
const require = createRequire(import.meta.url);
const BetterSqlite3 = require('./node_modules/.pnpm/better-sqlite3@12.9.0/node_modules/better-sqlite3');
const db = new BetterSqlite3(resolve('prisma/dev.db'), { readonly: true });

console.log('=== Departments ===');
const depts = db.prepare('SELECT id, slug, name, organizationId FROM Department LIMIT 20').all();
console.log(JSON.stringify(depts, null, 2));

console.log('\n=== Organizations ===');
const orgs = db.prepare('SELECT id, name, status FROM Organization LIMIT 10').all();
console.log(JSON.stringify(orgs, null, 2));

console.log('\n=== Users ===');
const users = db.prepare('SELECT id, email, onboardingStatus FROM User LIMIT 5').all();
console.log(JSON.stringify(users, null, 2));

db.close();
