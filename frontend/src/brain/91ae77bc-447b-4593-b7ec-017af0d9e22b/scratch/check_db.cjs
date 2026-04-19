
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = 'e:/DUYCHUQUAN/WORKSPACE/VIBECODE/ZaloCRM/zalocrm.db';
const db = new Database(dbPath);

console.log('--- Group Contacts ---');
const groups = db.prepare(`
  SELECT id, fullName, avatarUrl, zaloUid 
  FROM contacts 
  WHERE metadata LIKE '%isGroup":true%' 
  LIMIT 10
`).all();

console.log(JSON.stringify(groups, null, 2));

console.log('\n--- Recent Conversations ---');
const convs = db.prepare(`
  SELECT c.id, c.threadType, ct.fullName, ct.avatarUrl 
  FROM conversations c
  LEFT JOIN contacts ct ON c.contactId = ct.id
  WHERE c.threadType = 'group'
  LIMIT 5
`).all();

console.log(JSON.stringify(convs, null, 2));

db.close();
