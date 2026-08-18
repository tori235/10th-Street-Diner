const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'leads.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

// Leads captured from the "Order Pad" form (waitlist alerts, event/catering
// inquiries, and general questions) on the public site.
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    lead_type TEXT NOT NULL,           -- 'text_club' | 'event' | 'question'
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    party_size INTEGER,
    preferred_date TEXT,
    message TEXT,
    source_page TEXT,
    status TEXT NOT NULL DEFAULT 'new', -- 'new' | 'contacted' | 'closed'
    ip_address TEXT
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
  CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
`);

module.exports = db;
