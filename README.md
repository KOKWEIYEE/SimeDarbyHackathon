# Abso — KL transit connectivity pilot

A React/Mapbox workspace for one question: **How can this site connect better to public transport?**

## Run

1. Install frontend dependencies with `npm.cmd install`.
2. Set `VITE_MAPBOX_API_KEY`, `GEMINI_API_KEY` and optionally `OPEN_ELEVATION_API` in `.env`, following `.env.example`. Never put the Gemini key in a `VITE_` variable.
3. Install `python -m pip install -r backend/requirements.txt`, then run `python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000`.
4. In a second terminal, run `npm.cmd run dev`. Restart both services after changing `.env`.

If dependencies are installed in the workspace-local `.local-python` directory, first run `$env:PYTHONPATH = "$PWD/.local-python"` in the Python terminal.

Vite proxies `/api` to the Python backend. Production requires the Python service and a reverse proxy; static hosting alone cannot answer questions. This local prototype has no public API authentication.

## Workflow

1. Pick a study origin on the map, enter coordinates, or use one of three example shortcuts. The pilot bounding box is latitude 3.0–3.3, longitude 101.55–101.85; it is not a legal KL boundary. Select a likely site entrance.
2. Ask a question or select a suggestion and send it. Every analysis uses Gemini; there is no demo response fallback.
3. Compare up to three nearby transit stop records, with rail represented when available within 2 km. Select a candidate to highlight its Mapbox walking route.
4. Review the AI priorities and field checks. New walkways are only one possible intervention; maintaining existing links or investigating shuttle service may be appropriate.
5. Optionally compare material carbon using your own sourced, compatible factors and quantity after defining the intervention.

The map retains light/dark themes and 2D/3D modes. A compact overview shows nearby records, selected walking distance/time, coarse elevation and unverified site conditions. JSON exports the analysis and route geometry; CSV exports candidate route metrics. PNG/PDF export the map, with PDF requiring the jsPDF CDN library.

## Data and calculations

- **Transit:** local official data.gov.my / Prasarana GTFS snapshot in `data/transport`. Count within 800 m uses straight-line haversine distance from the selected origin. Records are deduplicated by feed/stop ID, but multiple records may represent one physical station. Current timetables and frequency are not evaluated. See `data/transport/README.md` for downloads.
- **Walking:** Mapbox Directions `mapbox/walking`, requested on each analysis. Distance and duration come from its returned route; minutes = duration seconds / 60. The server uses `MAPBOX_API_KEY` if set, otherwise `VITE_MAPBOX_API_KEY`. A URL-restricted browser token may require a separate server token. Requests may count against Mapbox usage.
- **Snapping:** both endpoints must snap within 100 m. Returned offsets are displayed. Access between the selected point and snapped road is not included in the route length. GTFS coordinates may indicate platforms or station centres, not entrances.
- **Terrain:** Open-Elevation with `dataset=auto`, five samples at the origin and approximately 110 m north/south/east/west. Displays centre elevation and sample min/max with dataset and retrieval time. This does not measure route slope, whole-site extremes, accessibility or flood risk. Missing data remain unavailable.
- **Carbon:** optional calculator uses quantity in kg × factor in kgCO2e/kg. Baseline minus alternative is the difference, using the same mass. Factors, lifecycle scope and quantity must be entered by the user; equivalent material performance must be checked. No ICE factors, default prices or invented savings are used by this workflow. These calculator inputs are not included in the AI request or report exports.

A returned walking route does not verify sidewalk continuity, safe crossings, fences, shade, step-free access or permission to enter. No returned route is not proof that a path is missing. Candidate selection is a small screening set, not an exhaustive shortest-route search.

## What is still needed

For a stronger recommendation, provide the actual site entrance/boundary and on-site evidence of sidewalks, crossings, barriers, shade and accessibility. For material comparison, provide the intervention quantities and compatible sourced EPD/carbon factors. Detailed route slope needs finer elevation or surveyed levels. Rainfall/flood modelling, zoning and construction cost estimation are outside this focused workflow.

## API and verification

`POST /api/connectivity` accepts `message`, `latitude`, `longitude`, and optional `site_name`. It obtains GTFS candidates, Mapbox routes and elevation, supplies that evidence to Gemini, and returns measurements separately from AI recommendations. Service failures are reported rather than replaced with demo data.

The previous `/api/chat`, catalog and calculation modules remain for compatibility and their existing tests. Their illustrative prices/carbon factors are **not used by the new interface**.

Checks:

- `python -m unittest discover -s backend -p 'test_*.py'`
- `node --test tests/planning.test.mjs`
- `npm.cmd run build`

Backend tests mock external services. A live request through the Vite proxy also verified Gemini, Mapbox walking routes and Open-Elevation together. Browser visual verification remains a manual check.

Design reference: https://www.aino.world/
Routing documentation: https://docs.mapbox.com/api/navigation/directions/
