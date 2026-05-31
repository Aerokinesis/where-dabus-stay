# GTFS data refresh

This directory holds TheBus's GTFS static feed. The `.txt` files are gitignored — they're large (~80 MB total, `stop_times.txt` alone is ~73 MB) and TheBus publishes a new feed every 4–8 weeks, so storing them in git would mean permanent ~80 MB commits on every refresh.

## When to refresh

Check `feed_info.txt`:

```bash
cat feed_info.txt
```

The line that matters is `feed_end_date`. If today is at or past that date, your feed is expired and you're serving stale schedule data. (Real-time arrivals via the OTS API still work either way — but route, stop, and schedule data is frozen at whatever was in the old feed.)

TheBus's publishing cadence is roughly every 4–8 weeks, sometimes more often around service changes.

## How to refresh

From this directory:

```bash
curl -O https://www.thebus.org/transitdata/production/google_transit.zip
unzip -o google_transit.zip
rm google_transit.zip
```

Then **restart the Express server** so it re-reads the files into memory:

```bash
cd ..
# Ctrl+C the running server, then:
node server.js
```

## Verify the new feed

```bash
cat feed_info.txt
```

You should see a `feed_end_date` in the future.

## Files in this directory

Standard GTFS bundle:

- `agency.txt` — agency info
- `calendar.txt` — service schedule patterns (which days each service runs)
- `calendar_dates.txt` — exceptions to those patterns (holidays, special days)
- `feed_info.txt` — feed metadata (publisher, validity window, version)
- `routes.txt` — bus routes
- `shapes.txt` — geographic shape of each route (for drawing on the map)
- `stop_times.txt` — scheduled arrival/departure time at every stop on every trip (largest file)
- `stops.txt` — bus stop locations and names
- `trips.txt` — individual trips on each route

Nothing in this bundle contains real-time alerts, detours, or stop-moved notices — those are GTFS-Realtime, not static GTFS.
