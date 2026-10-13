# LZ-N Global Lead Extractor — Version 1

A working web application for searching public business listings by country and industry, showing available public emails, phone numbers, websites, and exporting CSV.

## Run locally

1. Install Node.js 20+.
2. Run `npm install`.
3. Run `npm start`.
4. Open http://localhost:10000.

## Deploy to Render

1. Upload this folder to a GitHub repository.
2. Render → New → Web Service → connect repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Node runtime. No secrets required.

## Important limitations

- This version uses OpenStreetMap's publicly available Overpass API. It does **not** scrape search engines or social networks, guess addresses, find private emails, or claim to know decision-makers.
- Coverage is uneven; most businesses will have no public email listed. Some industry categories have very sparse OSM tagging.
- Searches are limited to 100 results and subject to public Overpass service capacity. Production-scale extraction requires a licensed dataset or self-hosted OSM extracts/Overpass infrastructure.
- The `/api/check-email` endpoint checks syntax and MX records only, **not** individual mailbox deliverability.
- No automated mass emailing is included. Follow privacy and anti-spam laws, including CASL when applicable.
- Add authentication, database persistence, monitoring, stronger rate limiting and a reliable licensed data provider before production use.
- © OpenStreetMap contributors; ODbL applies to underlying data.
