# Official KL-region transit snapshot

Downloaded from data.gov.my / Prasarana using `python scripts/download_transport.py`.
Exact retrieval times, original URLs, ZIP contents and counts are recorded in `manifest.json`.

| Feed | Stop records | Routes |
| --- | ---: | ---: |
| rapid-rail-kl | 187 | 8 |
| rapid-bus-kl | 4,068 | 137 |
| rapid-bus-mrtfeeder | 2,117 | 91 |

- Original `.zip` files include the supplied schedules (`stop_times.txt`), trips and other GTFS tables.
- Selected tables are also available as readable `*-stops.csv`, `*-routes.csv`, `*-calendar.csv`, etc.
- `stops.geojson` combines 6,372 valid-coordinate stop records for map integration. Coordinates use longitude, latitude. IDs must be scoped by `feed`; these are not 6,372 unique physical stations.
- Feed coverage includes the wider Klang Valley. No official KL boundary clipping has been applied.
- These are real downloaded data, not demo points. They are a snapshot, not a live vehicle tracking feed, and are not yet loaded by the application.
- Check service calendar dates before using schedules to claim current service frequency. Stop proximity alone is not measured walking accessibility.
- On the client date 2026-10-15, the downloaded rail feed includes both expired calendar rows (ending 2026-03-31) and rows ending 2026-12-31. MRT feeder calendars also include services beginning 2026-10-17. Filter by date, weekday and calendar exceptions before presenting active trips.
- data.gov.my documents some omitted Rapid KL bus trips due to data-quality issues.

Static documentation: https://developer.data.gov.my/realtime-api/gtfs-static

Live vehicle positions are a separate protobuf feed:
https://api.data.gov.my/gtfs-realtime/vehicle-position/prasarana?category=rapid-bus-kl

Realtime documentation: https://developer.data.gov.my/realtime-api/gtfs-realtime
