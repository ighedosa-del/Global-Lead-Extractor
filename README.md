# LZ-N Global Lead Extractor V3

Node 20+, Express. Preserve existing blue/white dashboard.

## Deploy on Render
1. Upload extracted project contents (including `package.json`) to your existing GitHub repository root.
2. Render: build `npm install`, start `npm start`.
3. No key required for OpenStreetMap-based city searches. Optional environment variable `GOOGLE_PLACES_API_KEY` enables Google Places Text Search. This provider requires a Google Cloud project, enabled Places API (New), billing, and appropriate terms-of-service compliance.
4. Visit `/api/health` to confirm V3. Select a country and industry; the app automatically searches all currently configured regions. Check Render logs for `SEARCH` and `RESULT` diagnostics.

## What changed
- Replaced huge country-wide Overpass queries with small metro bounding-box searches.
- Removed the City selector and added automatic multi-region country search, public-provider fallback, detailed diagnostics, and an optional Google Places source.
- Returned source links and real published contact fields only; no invented emails.
- Results are up to 500 per request; NOT a million-lead crawler. There is no persistent database or background extraction yet.
- Public Overpass endpoints may still timeout or rate-limit; optional Google Places requires API credentials and usage charges.
- Email syntax and MX records do not establish mailbox ownership or deliverability.
- Follow applicable privacy, anti-spam and data-provider terms. Google Places storage/reuse restrictions may apply.

## Local run
`npm install && npm start`
Then visit http://localhost:10000

## Country coverage limitation
Country-only selection is supported, but the current built-in region catalog is not exhaustive. A true all-cities country crawler requires a licensed nationwide data source or a much larger responsibly scheduled geographic index. Searches can still return zero if providers fail.
