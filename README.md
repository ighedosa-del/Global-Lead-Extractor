# LZ-N Global Lead Extractor — V2 diagnostic build

## Deploy
Upload the **contents** of this project directory to the root of your existing GitHub repository. Render: Node, build `npm install`, start `npm start`. No new service required.

## Improvements
- Fixed front-end selection initialization (carried forward).
- Multi-endpoint Overpass fallback with meaningful diagnostics when providers fail.
- Named-business filtering and up to 500 results **per query**.
- 1,000,000 leads is an aspirational cumulative target, **not** a per-request minimum or a guarantee.
- Contacts are only those publicly listed on OSM; no fabricated data or misleading verified status.

## Limitations
This is a diagnostic/starter build, not a verified million-contact database. Public Overpass servers may time out, rate-limit, or return zero matching records. Public OSM coverage is sparse for some industries and regions. Bulk extraction needs an appropriately licensed provider or hosted OSM dataset, a persistent database, deduplication, quotas, opt-out handling, and permission-aware outreach. MX checks cannot verify a mailbox exists.

## Test
Open `/api/health` for service status; `/api/options` for dropdown values. Try a high-coverage country and Retail or Hospitality. If the result is zero, check the browser message and Render logs.
