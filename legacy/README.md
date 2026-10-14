# NWS PNS Plotter v15 — Google Apps Script

## Update / install
Replace **both Code.gs and Index.html**. Select **Deploy → Manage deployments → Edit → New version → Deploy**, then refresh your existing /exec web app link.

For a new project, open https://script.google.com, paste Code.gs, add an HTML file named **Index**, paste Index.html and deploy as a **Web app**. Execute as yourself and choose appropriate office access. Authorize the requested services.

No API key, spreadsheet or paid hosting is required. Apps Script quotas and external-service availability still apply.

## Office selection and PNS scanning
**MOB** is the default and is scanned on startup. Enter a three-letter office such as LIX, TAE, BMX or OUN. Changing it automatically scans that office; **Scan office PNS products** also refreshes the list.

The app discovers retained version links on the NWS page and checks every advertised version, in batches of eight, for valid metadata. It lists issuance time, headline and metadata count/status. Products without metadata and failed requests remain identifiable.

Choose a product under **Available PNS products**, then **Load chosen PNS**. A metadata-ready product is selected by default when available. If version numbers shift between scanning and loading, rescan rather than silently loading a different issuance.

The NWS link opens the loaded source. Direct URL loading, Latest, and **Versions before latest** remain available: 1 back = version 2; 2 back = version 3.

This scans products retained by the NWS website, up to its 50-version limit, not an unlimited historical archive. Offices without a metadata-bearing PNS are explicitly identified. Narrative statements cannot create a report map without supported numeric tables or metadata.

## Metadata and report periods
Valid metadata supplies coordinates and values automatically. It takes precedence over saved positions. Supported numeric reports: wind, rain, snow and hail. Wind becomes mph; precipitation/hail becomes inches. Invalid/unsupported rows are counted and skipped.

**Report type / accumulation period** keeps RAIN_24, RAIN_48 and other codes separate. Unmatched visible-table reports remain under **table (period unspecified)**. Matches use name, provider, value, type and observation time. Exact duplicate metadata records are deduplicated; observations at different times remain separate and should be reviewed.

The **Supplemental metadata / search** section is at the very end of the sidebar, after the report list:
- **Add to loaded PNS** merges pasted metadata; at least one pasted report must match the loaded product.
- **Plot metadata only** loads a standalone block or another event.
- **Search source for metadata** rechecks the same issuance in text-only and CI formats.

Paste a complete block or colon-prefixed CSV rows. Quoted names containing commas are supported. Unrelated event metadata is not attached to a loaded product.

Without metadata coordinates, use a reviewed geocoder suggestion or manual placement. Select a report, click its actual map position or enter coordinates, then **Confirm & save location**. Suggestions may identify towns rather than stations and do not calculate directional offsets. Saved locations are shared by deployment users and keyed by office/name/provider; earlier MOB locations remain readable.

## County outlines, cities and font
**County outlines** toggles NOAA's counties for the selected CWA. Hover for county/state. The CWA remains outlined in red; clipping is optional.

**Major cities** and **Minor cities / towns** have independent toggles and size sliders. The sliders change both names and dots. Major means at least 20,000 residents in the 2020 Census; minor includes smaller places. These are display categories. Labels avoid overlapping each other; zoom to reveal more places.

City locations/populations are queried from U.S. Census TIGERweb for the selected CWA rectangle. A bundled MOB inventory is a fallback if its city service fails. Cities outside the CWA but within the rectangle provide context. City centroids are not station coordinates.

Dateline-spanning office/county geometries and displayed report longitudes are normalized for Pacific/Alaska views. Larger office extents can take longer to query/render.

**Poppins** is used throughout the interface, map labels, legend and exported figure. Google Fonts supplies it over HTTPS; sans-serif is the fallback if blocked.

## Color tables and appearance
Rainfall colors were sampled from the supplied legend, with these lower thresholds:

| Inches | Hex color |
|---:|---|
| 0.01 | #c7e9c0 |
| 0.10 | #a1d99b |
| 0.25 | #74c476 |
| 0.50 | #31a353 |
| 1.00 | #006d2c |
| 1.50 | #fffa8a |
| 2.00 | #ffcc4f |
| 3.00 | #fe8d3c |
| 4.00 | #fc4e2a |
| 6.00 | #d61a1c |
| 8.00 | #ad0026 |
| 10.00 | #700026 |
| 15.00 | #3b0030 |
| 20.00 | #4c0073 |
| 30.00+ | #ffdbff |

Interpolated rainfall below 0.01 inch is transparent.

Wind has a separate cyan → light blue → dark blue → purple → magenta/pink → orange → pale-yellow palette. Its mph thresholds are 0, 10, 20, 30, 40, 50, 58, 74, 90, 100, 111, 130, 157 and 180+. Colors do not imply a damage rating.

Defaults: **100% fill intensity, 9 px report-dot radius, 17 px value text, county outlines on**. Existing controls remain: fill intensity 0–100%, dot radius 2–16 px, value text 8–28 px, report-label visibility, IDW power and maximum reach. The larger bottom-right legend has bigger text/swatches and scrolls on short screens.

## Exports and limits
CSV includes selected type/period reports, coordinates, values, report codes, date/time, county/state and location status.

PNG includes fill, CWA, enabled county outlines, report dots/text, enabled city labels and legend with the chosen appearance settings and Poppins. It intentionally omits basemap tiles to avoid cross-origin restrictions.

The default background is Esri's more detailed World Street Map, with Light Gray retained as an option. These public raster endpoints do not require an API-key-based style request. Attribution is retained. Street tiles have embedded place names; city toggles control the app's own overlays.

Interpolation is now cached over the CWA (or report area when unclipped), so panning does not rebuild the fill or report markers. A spatial bucket index and reusable nearest-neighbor buffers replace per-cell allocation/sorting, and a raster CWA mask replaces repeated polygon checks. Render strips yield to the UI and stale builds are cancelled. The default fill is 1024 px wide; Fast (512) and Extra sharp (1536) are available. Pixel smoothing is disabled to keep color-bin edges crisp. Large zoom-ins can reveal grid cells; select Extra sharp if needed.

A conservative spatial index narrows candidate stations; final weights retain the previous latitude-adjusted distance calculation and selected nearest-neighbor count. Appearance-only changes reuse the fill. CSV is unchanged; PNG crops the cached field to the current viewport.

IDW uses 3–64 nearest located reports (12 by default) within the selected reach. Cells require three nearby reports except at a report's own location; blank areas have insufficient reports. Power ranges from 0.1 to 8; reach ranges from 5 to 500 km. Defaults: reach 40 km, power 6. Lower power and more neighbors blend values more broadly. It estimates between observations and does not account for terrain, exposure or observation timing. It is not radar QPE or a measured wind swath.

If CWA geometry fails, clipped fill is disabled; unclipped fill remains available. County/city service failures are reported. Keep deployment access appropriate since users can save shared station locations.

## Validation
Local checks cover parsing/conversions, metadata merging, period separation, coordinate priority, office validation and saved-location namespaces, retained-product scanning, issuance-change checks, county geometry, palette thresholds, dateline normalization and client JavaScript syntax.

Captured live responses contained five MOB versions (one metadata-ready) and seven LIX versions (none metadata-ready), plus 20 MOB and 30 LIX county features. The rainfall fixture parsed 71 metadata records with all coordinates populated.

A full browser render and Google-account deployment have not been exercised here. Verify first-use authorization and network/service availability in the deployed app.

GIS sources:
- NOAA CWA: https://mapservices.weather.noaa.gov/static/rest/services/nws_reference_maps/nws_reference_map/MapServer/1
- NOAA counties: https://mapservices.weather.noaa.gov/static/rest/services/nws_reference_maps/nws_reference_map/MapServer/2
- Census incorporated places: https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/26
- Census-designated places: https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/28

## Editing observations

Enable Edit mode, then click a report dot (or its sidebar row) to remove it. The fill automatically recalculates without that observation. Undo last removal and Restore all removed reports recover observations. Exclusions apply across groups within the loaded map and also affect CSV/PNG exports. Loading or re-parsing a product resets exclusions; source PNS text and shared saved locations are unchanged. County outlines are black. Wind colors follow the supplied 0–140 mph legend; values above 140 retain its top pink color.

Refresh / rescan latest PNS updates the retained-product inventory and automatically loads the newest metadata-ready product. If none has metadata, it loads the latest PNS so supplemental metadata can be added. Refresh resets removed reports. Repeated dot removals defer marker replacement until Leaflet finishes handling the click, keeping its Canvas hit testing intact.

Report dots now use a dedicated SVG renderer in a pane above county/CWA outlines and color fill. This prevents geographic overlays from capturing clicks after interpolation completes, and avoids Canvas hit testing during repeated removal. Value labels remain noninteractive in a separate pane.

## Google Earth KML export

Finish editing and wait until interpolation is ready, then select Export color fill KML. Open the downloaded .kml in Google Earth Pro (File > Open). It contains self-contained ground-clamped colored polygons covering the entire current interpolation area, using the exact cached color bins, blank-area mask and fill intensity. Adjacent same-color pixels are merged into rectangles for a smaller file. Retained observations are in a separate folder, hidden initially. Removed reports are excluded from the interpolation and observations. The export snapshots the map at click time; subsequent edits require a new export. It needs no image companion or hosted URL. This is a raster-derived polygon field, not mathematically smoothed contour lines; very high resolution may create a large file, so use Fast 512 px for smaller exports. Counties, basemap and city labels are not included. Google Earth itself was not available for an end-to-end rendering check.

## PSH wind and pressure CSV

Open Post Storm Report (PSH) CSV in the sidebar, upload a .csv and click Read uploaded CSV, or paste the CSV and click Plot pasted PSH CSV. Choose Maximum wind gust, Maximum sustained wind, or Minimum pressure in the report-group selector. Quoted multiline headers, commas and escaped quotes are supported. PSH wind inputs are knots; Convert PSH wind from knots to mph is on by default and can be changed without resetting exclusions. Values are calculated from original knots, never by repeated conversion. Pressure remains mb, with its own color scale. Missing M/blank/sentinel measurements are skipped; observation date/time, direction, source and quality flags are retained. A PSH import replaces the current loaded product. CSV, PNG and KML exports and Edit mode support PSH groups. Supplemental PNS metadata import is intended for PNS sources.

The supplied example has K1R8 (Bay Minette) longitude +87.8193. Its measurements are retained but not plotted until the coordinates are reviewed using the location editor. The importer does not silently change coordinates. PSH extrema may occur at different times or averaging periods; interpolation shows station extrema, not a simultaneous wind/pressure analysis.

## PSH rainfall and Top 10

PSH import now also accepts Total Rainfall (inches) CSVs using the same upload/paste section. Totals use inches, the existing rainfall color table and a distinct PSH_RAIN storm-total group. Missing values are skipped. The wind conversion toggle does not change rainfall.

Show Top 10 observations opens a Poppins-styled modal with a group selector, ranks, locations, county/state, values and sources. It ranks retained measurements, excluding removed reports, and keeps the highest value per station/source. Accumulation groups are kept separate. Coordinates are not required to rank a measured observation. Download graphic PNG saves a public-facing image of the displayed table, including report identity and quality notes. The list may contain fewer than ten reports if fewer remain. Pressure groups are omitted from this highest-wind/precipitation display. Imported PSH quality flags are shown as supplied rather than filtered automatically.

Converted PSH wind values round upward to whole mph (117.6 becomes 118). This applies to plots, interpolation inputs, Top 10 and exports. Original knots remain unchanged and are restored when conversion is toggled off.

## Sidebar and blended colors

Data Ingest, Adjust Map and Export Data sections start open and can be collapsed individually. Hide menu / Show menu toggles the entire sidebar and resizes the map. All interface typography remains Poppins. Data sources, PSH CSV and supplemental metadata are in Data Ingest; report group, interpolation, basemap, overlays and editing are in Adjust Map; Top 10, CSV, PNG and KML are in Export Data.

Blended gradient colors interpolates RGB colors between palette stops instead of discrete bands. Default is off. This changes colors, not IDW estimates or station values. The map, report dots and PNG reflect the selected style, and KML uses the same cached pixels. Gradient KML files can be much larger because there are many distinct colors; choose Fast 512 px for smaller files. Numeric legend thresholds remain visible with a gradient strip when blending is on.

## Selecting PSH variables

For combined Wind and Pressure CSV files, Adjust Map now includes quick buttons for Wind Gusts, Sustained Wind and Pressure (mb). Rainfall files show Rainfall (inches). The main variable dropdown remains available. Pressure has a dedicated 950–1050 mb scale: dark red at low pressure, near-white at 1000 mb, and dark blue at high pressure, with 10 mb steps or blended gradients. Out-of-range values retain endpoint colors without changing measured values. Pressure is unaffected by the knots/mph toggle. Water Levels and Tornadoes imports remain off.

## Optional contour lines

The Suggest next 10 locations button is removed. Manual location editing remains. Enable Contour lines under Adjust Map to overlay labeled isolines: wind every 10 mph (equivalent spacing when displayed in knots), rainfall every 0.25 inch, pressure every 1/3/5 mb (default 5). Pressure contours are anchored at 1000 mb, so 3 mb levels include 994, 997, 1000, 1003. Contours use the edited IDW field, work with blended or banded colors, and update after removals or variable changes. They stop at gaps/CWA masks. For performance, contour tracing samples the cached raster at up to 512 columns and yields between levels; panning reuses paths. PNG and KML exports include enabled contours. If there are too few located reports for a field, contours are also unavailable.
