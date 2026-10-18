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

Run npm ci, then npm test (Node 22+; dependencies are for tests and bundling JSZip). GitHub Actions runs the same checks on pushes and pull requests.

Files: index.html, styles.css, app.js (UI/interpolation/export), data-service.js (PNS parsing, APIs, coordinate storage), and tests/.

Gradient KML files can be large because each distinct color is polygonized. Choose Fast 512 px for smaller exports. Contour tracing samples the field at up to 512 columns, with 3 mb pressure levels anchored at 1000 mb. Map PNG intentionally omits basemap tiles; Google Earth KML contains the color field, retained observations and enabled contours.

## DAT survey-point overlays

Data Ingest → DAT — Damage Assessment Toolkit accepts local KML and KMZ files. Click Plot DAT points, then Plot DAT density to explicitly enable the density fill and contour lines and zoom to the survey. Zoom to DAT points is also available separately. DAT is independent of the loaded PNS/PSH dataset and remains overlaid when that dataset changes. Importing another DAT file replaces the previous DAT overlay; Clear DAT overlay removes it.

Under Adjust Map → DAT points and density:

- Resize point diameter from 6–40 px; show/hide points and filter Tropical wind / Tornadoes / Other.
- Tropical reports are yellow circles; tornadoes use downward triangles colored from the KML's EF styles or EF icon references. Unknown/unrated points are gray.
- Enable Contour DAT point density for a Gaussian density field in survey points/km². Adjust smoothing (0.5–50 km, default 5), contour interval (0 = automatic), fill, contour lines/labels, and opacity.
- Density counts each valid selected Point placemark equally, including collocated records. It does not use estimated wind or EF rating as a numeric weight. Survey coverage affects apparent concentrations. Other/unrated records are included by default and can be filtered out.
- Density is evaluated on a 256-column raster with a three-bandwidth Gaussian cutoff. Contour interval may be increased if more than 100 levels would be generated. Panning reuses the result. DAT density is not CWA-clipped.
- Point popups show imported attributes as text. KML coordinates are authoritative; descriptions and ExtendedData supply ratings and damage attributes. Polygon/track-only placemarks are not converted to points. The main KML inside KMZ is read; image/photos and network links are not fetched.
- Map PNG includes visible DAT points and enabled density layers, even with no PNS/PSH loaded. Existing CSV, Top 10 and KML exports continue to export PNS/PSH observations, not DAT.

The sample KMZ was checked locally: 345 valid points, 344 Tropical and one unrated. The supplied file is not committed to the repository. JSZip is bundled locally in vendor/ with its license for KMZ reading; there is no additional runtime CDN dependency.

DAT density activation: Plot DAT density enables both fill and contours, opens the relevant controls and fits the selected survey points. Progress/errors are shown both at ingestion and beside the density toggle. The general contour checkbox is labeled PNS/PSH; when no PNS/PSH dataset is loaded, it also forwards to DAT density for convenience. Density renders above normal observation fills. Updated script URLs bypass stale browser copies after deployment.
