# LZ-N Global Lead Extractor V4 — Free-first country datasets

This version **removes all Overpass API requests** and preserves the existing dashboard.
It searches business records you import from legally reusable downloadable datasets. The user chooses country and industry; no city selector.

## Deploy on existing Render
1. Upload the extracted ZIP contents to the **root** of your existing GitHub repository; commit.
2. Keep `npm install` and `npm start` on Render.
3. In Render → Environment set `ADMIN_IMPORT_KEY` to a long random secret. Do not share it or commit it.
4. **Strongly recommended:** attach a Render PostgreSQL database and set `DATABASE_URL` to its connection URL. If the provider requires TLS, set `PGSSL=true`. Without it, local JSONL storage can be lost when Render redeploys/restarts.
5. Visit `/api/health`: version 4 and storage mode should appear.
6. Download a licensed business dataset (CSV or GeoJSON) from its publisher, choose country and industry, supply the dataset's original URL, select the file and enter the admin key, then click Import data.
7. Click Find Businesses. It now queries your stored records, not public API servers.

## Data sources to evaluate
- Overture Maps Places (https://docs.overturemaps.org/getting-data/). Cloud-hosted GeoParquet; use the official Overture CLI or DuckDB to export *places* by region/country into GeoJSON or CSV before import. The UI imports CSV/GeoJSON, **not Parquet**. For large datasets split into <=12 MB, <=25,000-row files. Check per-feature upstream licensing and attribution.
- Geofabrik OSM extracts (https://download.geofabrik.de/). These are `.osm.pbf`, **not directly importable**. Convert to CSV/GeoJSON with an OSM data-processing tool before import; comply with ODbL attribution and share-alike obligations.
- Government open-data business registries (where permitted). Many have company names but no email addresses.

## Import format
CSV headers can include `company`, `country`, `industry`, `address`, `email`, `phone`, `website`, `source`, `id`.
Example **headers only**:
`company,country,industry,address,email,phone,website,source,id`

GeoJSON FeatureCollection: business name in `properties.name` or `properties.names.primary`, plus other supported properties.

The country selected in the UI is the default for all records. A source URL is required. All records must come from a legitimately reusable dataset.
The application does not scrape live sites, fabricate emails, verify mailboxes, or claim a million leads exist.
The 500 result limit is per query, not a storage limit. Pagination beyond first 500 is not yet implemented.
Deduplication uses source ID if provided, otherwise country+company+website. Large data should be imported in batches.

## Tests
`npm install`
`npm run check`
`npm start`
`curl http://localhost:10000/api/health`

## Limitations
- This is a functional dataset-import and search backend, **not an automatic country downloader**. No dataset is bundled and searches are empty until you import records.
- Overture/OSM country datasets may be very large. Prepare them outside Render, using the provider's official tooling, and import manageable batches.
- On free Render instances, local files are ephemeral. Use PostgreSQL for persistence.
- Email/phone fields are source-provided and NOT independently verified. Observe applicable privacy, anti-spam, and data licensing requirements.
