require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const nodemailer = require('nodemailer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'change-me-admin-key';

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Optional email notification setup -------------------------------------
// If SMTP_HOST / SMTP_USER / SMTP_PASS are set in .env, every new lead will
// also be emailed to the restaurant so they never have to check a dashboard.
let mailer = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function notifyNewLead(lead) {
  if (!mailer || !process.env.NOTIFY_EMAIL) return;
  const label = { text_club: 'Text Club Signup', event: 'Private Event / Catering', question: 'General Question' }[lead.lead_type] || lead.lead_type;
  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: process.env.NOTIFY_EMAIL,
      subject: `New website lead: ${label} — ${lead.name}`,
      text: [
        `Type: ${label}`,
        `Name: ${lead.name}`,
        `Phone: ${lead.phone || '-'}`,
        `Email: ${lead.email || '-'}`,
        lead.party_size ? `Party size: ${lead.party_size}` : null,
        lead.preferred_date ? `Preferred date: ${lead.preferred_date}` : null,
        `Message: ${lead.message || '-'}`,
        `Submitted: ${lead.created_at}`,
      ].filter(Boolean).join('\n'),
    });
  } catch (err) {
    console.error('Email notification failed:', err.message);
  }
}

// --- Basic abuse protection --------------------------------------------------
const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8, // 8 submissions per IP per 15 minutes is plenty for a real visitor
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many submissions. Please try again in a bit, or call us at (317) 737-1161.' },
});

// --- Validation helpers -------------------------------------------------------
const LEAD_TYPES = new Set(['text_club', 'event', 'question']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9()+\-.\s]{7,20}$/;

function validateLead(body) {
  const errors = [];
  const leadType = String(body.leadType || '').trim();
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  const message = String(body.message || '').trim();
  const partySize = body.partySize ? Number(body.partySize) : null;
  const preferredDate = body.preferredDate ? String(body.preferredDate).trim() : null;
  const website = String(body.website || ''); // honeypot field, should stay empty

  if (website) errors.push('bot detected');
  if (!LEAD_TYPES.has(leadType)) errors.push('Please choose what you\'re reaching out about.');
  if (name.length < 2 || name.length > 100) errors.push('Please enter your name.');
  if (!phone && !email) errors.push('Please provide a phone number or email so we can reach you.');
  if (phone && !PHONE_RE.test(phone)) errors.push('That phone number doesn\'t look right.');
  if (email && !EMAIL_RE.test(email)) errors.push('That email doesn\'t look right.');
  if (message.length > 2000) errors.push('Message is too long.');
  if (partySize !== null && (!Number.isFinite(partySize) || partySize < 1 || partySize > 500)) errors.push('Party size looks off.');

  return {
    valid: errors.length === 0,
    errors,
    data: { leadType, name, phone, email, message, partySize, preferredDate },
  };
}

// --- API routes ----------------------------------------------------------------

app.post('/api/leads', leadLimiter, async (req, res) => {
  const { valid, errors, data } = validateLead(req.body);
  if (!valid) {
    return res.status(400).json({ ok: false, error: errors[0] || 'Invalid submission.' });
  }

  const stmt = db.prepare(`
    INSERT INTO leads (lead_type, name, phone, email, party_size, preferred_date, message, source_page, ip_address)
    VALUES (@leadType, @name, @phone, @email, @partySize, @preferredDate, @message, @sourcePage, @ip)
  `);

  const info = stmt.run({
    leadType: data.leadType,
    name: data.name,
    phone: data.phone || null,
    email: data.email || null,
    partySize: data.partySize,
    preferredDate: data.preferredDate,
    message: data.message || null,
    sourcePage: String(req.body.sourcePage || '/').slice(0, 200),
    ip: req.ip,
  });

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(info.lastInsertRowid);
  notifyNewLead(lead); // fire and forget

  res.status(201).json({ ok: true, id: lead.id });
});

// --- Simple admin API (protect with x-admin-key header) ------------------------
function requireAdmin(req, res, next) {
  if (req.get('x-admin-key') !== ADMIN_KEY) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

app.get('/api/leads', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
  res.json({ ok: true, count: rows.length, leads: rows });
});

app.patch('/api/leads/:id/status', requireAdmin, (req, res) => {
  const status = String(req.body.status || '');
  if (!['new', 'contacted', 'closed'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'Invalid status' });
  }
  db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => res.json({ ok: true, service: '10th-street-diner-backend' }));

app.listen(PORT, () => {
  console.log(`10th Street Diner backend running on http://localhost:${PORT}`);
  console.log(`Admin leads view: GET /api/leads (header x-admin-key: ${ADMIN_KEY})`);
});
