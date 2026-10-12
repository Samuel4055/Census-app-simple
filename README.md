# Bauchi Census Collector

Offline-first census data collection with real-time validation, GPS
boundary checking, role-based review and an audit trail. Plain HTML/CSS/JS
frontend + Node.js/Express + MySQL. One server serves both the pages and the
API, so the whole thing lives at **one link** that opens on any phone or laptop.

| Role | What they do |
|---|---|
| **Enumerator** | Captures households on a phone (works with no signal, syncs later), GPS-tagged and validated on the spot |
| **Supervisor** | Reviews submitted households on a map and table, approves or rejects |
| **Administrator** | Everything a supervisor does, plus creates user accounts |

---

## Put it online (about 15 minutes, free)

You need two things: a MySQL database and a place to run the app. This guide
uses **Aiven** (free MySQL, no card) and **Render** (free web hosting).
Any host that runs Node 18+ and any MySQL/MariaDB database will work; the
only app settings involved are listed in the table at the end.

### 1. Create the database (Aiven)

1. Sign up at aiven.io and create a **free MySQL** service.
2. When it is running, copy its **Service URI**. It looks like
   `mysql://avnadmin:PASSWORD@host:12345/defaultdb?ssl-mode=REQUIRED`.
   Keep it private; it contains the database password.

You do not need to create any tables. The app does that itself on first start.

### 2. Put the code on GitHub

Create a new **private** repository and upload the contents of this folder
(drag-and-drop on github.com works; `node_modules` and `.env` are already
excluded by `.gitignore`).

### 3. Deploy on Render

**Fastest way (Blueprint):**
1. In Render choose **New > Blueprint** and pick your repository.
2. It reads `render.yaml` and asks for three values:
   - `DATABASE_URL`: the Service URI from step 1
   - `ADMIN_PASSWORD`: a strong password for the administrator account
   - `DEMO_PASSWORD`: password shared by the demo supervisor and enumerator accounts
3. Click **Apply**. The first build takes a few minutes.

**Manual way:** New > Web Service > your repo, runtime **Node**, build command
`npm install`, start command `npm start`, then add the settings from the table
below (use `AUTO_SETUP=true` and `DB_SSL=true`).

When the deploy turns green, Render shows your link, something like
`https://census-app.onrender.com`. **That is the link you send the client.**

### 4. First sign-in

Open the link and sign in as `admin` with the `ADMIN_PASSWORD` you chose.
The demo accounts `supervisor1` and `enumerator1` use `DEMO_PASSWORD`, and come
with a sample census centre and enumeration area in Bauchi town so every role
can be tried straight away. Set `SEED_DEMO=false` *before the first start* if
you want no demo data.

---

## Or put it on Vercel

Vercel hosts the pages and runs the API as a serverless function (`api/index.js`,
configured by `vercel.json`). It does **not** host MySQL, so you still need the
database from step 1 above (pick a region near Frankfurt, which is what
`vercel.json` uses).

1. Put the code on GitHub (step 2 above).
2. In Vercel: **Add New > Project**, import the repository. Leave every build
   setting as it is; `vercel.json` already sets them.
3. Before clicking Deploy, add these Environment Variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the MySQL Service URI |
   | `JWT_SECRET` | a long random string (see `.env.example` for a one-line generator) |
   | `ADMIN_PASSWORD` | strong password for `admin` |
   | `DEMO_PASSWORD` | password for `supervisor1` / `enumerator1` (or set `SEED_DEMO=false`) |
   | `AUTO_SETUP` | `true` |
   | `DB_SSL` | `true` |

4. Deploy, then open the link and sign in as `admin`.

Know these for Vercel:
- **Hobby (free) plan is for personal, non-commercial use only** under Vercel's
  terms. For a paying client, use a Pro plan or the Render route above.
- **Deployment Protection**: new projects may ask visitors to sign in to Vercel.
  Turn it off under Project > Settings > Deployment Protection so the client can
  open the link.
- The first request after a quiet period is slower (cold start plus database
  wake-up). Errors show a generic message; details are in the Vercel logs.

---

## Before you send the link, know these

- **Free hosting sleeps.** Render's free plan stops the app after 15 minutes
  without visits; the next visitor waits about a minute while it wakes up.
  Tell the client, or open the link yourself a few minutes before a demo.
  Paid plans do not sleep.
- **Free database limits.** Aiven's free MySQL is 1 GB, and may be powered off
  if it sees no activity. You are notified and can switch it back on.
  Both are fine for a demonstration, not for a live national count.
- **Use made-up data.** Real census records are sensitive personal data
  covered by the Nigeria Data Protection Act. Show the client with synthetic
  households only, and move to properly secured hosting before real use.
- **Phones need internet for the first sign-in**, and once on the capture page
  they can work offline. Records wait on the phone and upload automatically
  when the connection returns.
- **Enumeration-area boundaries** are stored as GeoJSON in the
  `enumeration_areas` table. There is no screen for drawing them yet, so new
  areas are added directly in the database (see the demo area in
  `scripts/setup-db.js` for the format).

---

## Settings

| Setting | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | yes* | Connection URL from your database host. `ssl-mode=REQUIRED` in it is understood. |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | yes* | Use these instead of the URL for a local or cPanel database. |
| `JWT_SECRET` | yes | Long random string that signs logins. The app refuses to start without it. |
| `DB_SSL` | for hosted DBs | `true` to encrypt the database connection. |
| `AUTO_SETUP` | recommended | `true` creates tables and the first accounts on start. Safe to leave on. |
| `ADMIN_PASSWORD` | with AUTO_SETUP | Password for the first administrator. `ADMIN_USERNAME` defaults to `admin`. |
| `DEMO_PASSWORD` | with AUTO_SETUP | Password for demo supervisor and enumerator. Not needed if `SEED_DEMO=false`. |
| `SEED_DEMO` | no | `false` to skip the demo centre, area and accounts. |
| `PORT`, `JWT_EXPIRES_IN` | no | Defaults: hosting platform's port, `8h`. |

\* Either `DATABASE_URL` or the `DB_*` group.

Existing accounts are never changed by setup: it only creates accounts when the
users table is empty.

---

## Run it on your own computer

```bash
npm install
cp .env.example .env     # fill in JWT_SECRET and your MySQL details
npm run setup            # creates tables and accounts (prints random passwords if you left them blank)
npm start                # http://localhost:4000
```

To try it on a phone on the same Wi-Fi, use your computer's address instead of
`localhost`, e.g. `http://192.168.1.23:4000`. (Phone browsers only allow GPS on
`https://` pages or `localhost`, so test GPS on the deployed link.)

## What is inside

```
server.js              starts the app (and AUTO_SETUP when enabled)
api/index.js           Vercel entry point (wraps the same Express app)
vercel.json            Vercel settings
src/                   API: auth, users, households, validation, audit trail
src/bootstrap.js       config check + automatic setup, shared by Vercel
scripts/setup-db.js    creates tables + first accounts
public/                the pages (capture, dashboard, admin) and offline support
public/vendor/leaflet  the map library, bundled so it never depends on a CDN
render.yaml            optional one-click Render setup
```

Every sign-in, sync, approval and user change is written to the `audit_trail`
table. Server-side validation re-checks every record a phone uploads, flags
points outside the assigned area and near-duplicate heads of household, and
rejects incomplete records back to the enumerator with the reasons.
