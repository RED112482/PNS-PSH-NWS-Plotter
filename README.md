# NWS PNS / PSH Plotter

A browser-based observation plotting tool for PNS metadata and Post Storm Report CSV files. Default office: MOB.

## Publish on GitHub Pages

1. Open repository **Settings → Pages**.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Select **main** and **/(root)**, then **Save**.
4. Open https://red112482.github.io/PNS-PSH-NWS-Plotter/ after the Pages deployment completes.

No Apps Script deployment, API key, paid server or build step is required. Pages settings must be enabled by a repository administrator.

## Features preserved

- Default-open Data Ingest / Adjust Map / Export Data sections and Hide/Show menu; Poppins throughout.
- Office PNS scans and metadata-ready selection, previous-product navigation, refresh, pasted PNS and supplemental metadata.
- PSH CSV upload/paste: wind gusts, sustained wind, minimum pressure and rainfall. Water Levels and Tornadoes remain off.
- PSH knots/mph toggle with upward whole-mph rounding. Rain stays in inches; pressure stays in mb with a 950–1050 mb scale.
- IDW interpolation (default power 6, reach 40 km), blended/banded colors, fill intensity, report sizing, city labels, black counties and CWA clipping.
- Optional labeled contours: 10 mph, 0.25 inch, or 1/3/5 mb.
- Repeated report exclusions, Undo/Restore All, automatic recalculation.
- Top 10 retained observations and a shareable PNG.
- CSV, map PNG and self-contained Google Earth KML with enabled contours.

## Data and migration differences

The browser uses api.weather.gov for retained PNS listings and product text, NOAA ArcGIS for boundaries/counties, Census TIGERweb for city inventory, and Esri raster basemaps. Browser requests use the services' CORS support; no public proxy or credentials are used.

The NWS API's product retention and newest-first numbering can differ from the forecast.weather.gov page's version numbering and may lag an issuance. The source-page link is provided for reference; the fetched API product ID is retained on the dataset. Refresh queries the API again. Pasted PNS/metadata and PSH CSV import remain available during service outages. A product without numeric reports can be listed but cannot be plotted.

Saved coordinate corrections now use **localStorage in this browser on this device**. Apps Script's shared saved corrections are not automatically transferred. Metadata coordinates remain authoritative. PSH imports replace the current dataset; exclusions reset on reload/import and stay intact when changing units.

The legacy folder contains the original Apps Script version for reference and rollback. It is not used by the Pages app. User-uploaded CSVs are read locally and are not uploaded to this repository or a server.

Interpolation represents station reports/extrema, not measured conditions everywhere. PNS accumulation groups remain separate. PSH wind extrema may differ in time, exposure and averaging period. Review imported quality flags and coordinate issues.

## Development

Serve this directory using python3 -m http.server 8000, then open http://localhost:8000/. Do not open index.html directly with a file URL.

Run npm test (Node 22+; no npm dependencies). GitHub Actions runs the same checks on pushes and pull requests.

Files: index.html, styles.css, app.js (UI/interpolation/export), data-service.js (PNS parsing, APIs, coordinate storage), and tests/.

Gradient KML files can be large because each distinct color is polygonized. Choose Fast 512 px for smaller exports. Contour tracing samples the field at up to 512 columns, with 3 mb pressure levels anchored at 1000 mb. Map PNG intentionally omits basemap tiles; Google Earth KML contains the color field, retained observations and enabled contours.
