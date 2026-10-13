# LZ-N Global Lead Extractor V5 — Automatic country collection (beta)

**This build preserves the existing blue/white dashboard, removes the city selector, and does not use Overpass APIs.** It starts a background worker that downloads Overture Maps Places tiles directly from official cloud-hosted GeoParquet using the official `overturemaps` CLI. It also retains V4 manual CSV/GeoJSON import.

## Deploy to existing Render service

**IMPORTANT:** V5 needs Python and Node. In Render, set runtime to **Python** (if supported for this existing service) and:
- Build command: `pip install -r requirements.txt && npm install`
- Start command: `node server.js`
- Environment: `ADMIN_IMPORT_KEY` = your own long random secret
- Environment: `DATABASE_URL` = Render PostgreSQL connection string (**strongly recommended**)
- If PostgreSQL requires TLS, `PGSSL=true`.

Render may not permit changing the runtime of an existing service. In that case, use the included `Dockerfile` and create a Docker-based service, or switch the existing service to Docker where supported. Keep your GitHub repository.

## How to use
1. Open `/api/health`; version should be `5`.
2. Select a country. Industry **All** is recommended initially.
3. Enter the admin key in the Admin import key field.
4. Click **Start Collection**. Status refreshes every 10 seconds. Jobs process sequential geographic tiles and import results.
5. Click **Find Businesses** to view collected records.
6. **Stop** requests termination. **Resume** continues from the last completed tile *only while the same server process is alive*. On restart, existing PostgreSQL leads remain, but job progress resets.
7. CSV export exports currently displayed results (up to 500); no unlimited export yet.

## Real limitations and integrity
- The geographic tile plan uses rectangular country bounding boxes, NOT exact national borders. It may collect nearby-country records, and cannot guarantee all cities, all businesses, or a million leads. For accurate nationwide coverage add polygon point-in-country validation.
- Overture Places are points of interest; many lack email addresses. Emails and phones are source-listed, NOT mailbox-verified. The current industry categorization is Overture `basic_category`, not the dashboard's broad industry taxonomy; use **All** to find records.
- One tile downloads up to 4,000 features, may consume substantial RAM/bandwidth, and has a 240-second timeout. Very large countries may take many hours or days; on free Render the worker can be terminated by restarts, memory limits, or outbound network restrictions.
- This implementation is a **beta**, not a guaranteed production-grade million-lead collector. Jobs are single-process and not persistent across restarts. PostgreSQL records persist.
- Read and comply with Overture data licenses and per-feature source licenses/attribution: https://docs.overturemaps.org/ . Only use data you have rights to use. No automatic outreach or bulk email sending is included.

## Test locally
Install Python 3.11+, Node 20+.
`pip install -r requirements.txt`
`npm install`
`npm run check`
`npm start`
Test `/api/health`. Actual extraction needs internet access, and has NOT been live-tested in this build.
