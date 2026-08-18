# 10th Street Diner — Website + Lead-Gen Backend

A full site for 10th Street Diner (Indianapolis, all-vegan diner) with a working
backend that captures leads from the site itself: text-club signups (no-wait
alerts + specials), private event/catering inquiries, and general questions.

```
10th-street-diner/
├── public/            ← the website (served by the backend)
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   └── admin.html      ← password-gated leads dashboard
└── server/             ← Node/Express backend + SQLite database
    ├── server.js
    ├── db.js
    ├── package.json
    └── .env.example
```

## How the lead gen works

The homepage's "Get on Our List" section (`#order-pad`) is the lead-capture
form, styled as a diner order pad. Visitors pick one of three intents:

- **Text alerts** — no-wait times & specials (the highest-volume, lowest-friction lead)
- **Private event / catering** — shows extra fields (party size, date) — your highest-value lead
- **General question**

On submit, the form `POST`s JSON to `/api/leads`. The backend validates it,
stores it in a local SQLite database (`server/leads.db`), and — if you fill in
SMTP settings — emails a notification to the restaurant immediately. A
honeypot field and rate limiting (8 submissions / 15 min / IP) keep out bots
and abuse.

Leads can be viewed two ways:
1. **`/admin.html`** on the live site — a simple password-gated dashboard (enter the `ADMIN_KEY` from your `.env`)
2. **`GET /api/leads`** — raw JSON, if you want to pipe leads into Airtable, Make.com, a CRM, etc. via the `x-admin-key` header

## Run it locally

```bash
cd server
npm install
cp .env.example .env      # then edit .env — at minimum set ADMIN_KEY
npm start
```

Visit **http://localhost:3000** for the site and **http://localhost:3000/admin.html** for the leads dashboard.

## Turning on email notifications (optional)

Fill in the `SMTP_*` and `NOTIFY_EMAIL` values in `.env` (Gmail app password,
SendGrid, etc. all work). Leave them blank and the site still works fine —
leads just won't trigger an email, only the dashboard.

## Deploying

This is a standard Node/Express app, so it deploys anywhere that runs Node —
Render, Railway, Fly.io, a DigitalOcean droplet, etc.:

1. Push this folder to your host of choice
2. Set the start command to `node server.js`, working directory `server/`
3. Set environment variables (`ADMIN_KEY`, and SMTP ones if using email) in the host's dashboard
4. Point the diner's domain at the deployed URL

Note: `server/leads.db` is a real file on disk. Most hosts (Render, Railway,
Fly) support a small persistent volume — mount one at `server/` so the
database survives deploys. If you'd rather not manage that, swapping
`better-sqlite3` for a hosted Postgres (e.g. Neon, Supabase) is a small change
in `db.js` and worth it once lead volume grows.

## Wiring into ConvertStack's stack

Since `GET /api/leads` returns clean JSON, a Make.com scenario can poll it on
a schedule (or you can add a webhook `POST` call inside `server.js` right
after a lead is inserted) to drop new leads straight into the Airtable Leads
Pipeline — same schema you're already using for the automation clients.

## Content notes

- Menu items, review pull-quotes, hours, address, and phone number are taken
  directly from the Google Business listing provided in the brief.
- The "Order Pickup / Order Delivery / Website" links currently point to the
  diner's Facebook page since that was the only real URL available — swap
  these for real ordering-platform links (Toast, ChowNow, DoorDash, etc.)
  whenever you have them.
