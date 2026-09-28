# Changelog

## 0.1.0 - 2026-09-28

First release of Fabric Dashboards: one window for every local agent service on the Mac
that speaks `fabric-service/0.1`.

- Finds services from the descriptors in the services folder, live, with no setup.
- Shows each service's real state: ready, degraded, not answering, off, two copies,
  another program on its port, a port conflict or an invalid descriptor.
- Starts, stops and restarts services through launchd only; Stop stays off after a
  restart of the Mac.
- Opens each service's dashboard inside the app, signed in with a one-time code, one
  live view per service.
- Activity: every service's events and the app's own observations in one feed.
- Notifications for outages, recoveries, duplicates and events a service marks for
  you, with per-service settings, quiet hours and a one-hour pause.
- Menu bar status, open at login, English and Russian, dark and light themes.
- Updates itself from signed releases.
