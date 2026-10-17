# PocketConvoy

A mobile-first web app that keeps a group of cars together on a road trip: live map of every car, push-to-talk walkie-talkie, a shared route set by the convoy leader, quick alerts, a speedometer and trip statistics with replay.

This is the demo version. The other cars of the convoy are simulated on the phone, so the whole app can be tested alone, without any server or account. Real-time sync between phones will be added once the behaviour is validated.

## Demo

- Simulated drive: your car drives itself along a real road route from Lausanne to Gruyères, with a stop in Vevey. Simulation speed can be set from pause to ten times faster.
- Real GPS: your real position is used, and the simulated cars stay around you and follow you once a destination is set.
- You or a simulated friend can be the convoy leader. The leader sets the destination and the stops.
- Scenarios to trigger on demand: a friend talks, a friend sends an alert, a friend drops a pin, a car falls behind, the leader stops, a breakdown, a car loses signal, a car leaves the convoy, a leader change. Random talk and alerts can also happen on their own.
- The walkie-talkie works in echo mode: what you say is played back when you release the button. Simulated friends speak with the phone's synthetic voice.

## Features

- Full-screen live map with every car's speed and status. Dark and light map styles.
- Shared pins: anyone can drop a pin (press and hold on the map) with a type and a name; the leader can turn it into a stop or the destination.
- Turn-by-turn guidance on screen, rerouting when you leave the route.
- Convoy alerts shown as large banners, each with its own sound: a car too far from the leader, the leader stopped, quick messages (break, fuel, lost, slow down, all good). A breakdown shows full screen. Convoy housekeeping (someone joins, leaves, new leader) stays as small notifications.
- Adjustable haptic feedback (off, light, normal, strong) for buttons, walkie-talkie and alerts. Vibration on Android; on iPhone, Safari only allows a light tick (iOS 18 and later).
- Speedometer view, 0 to 300 km/h, with heading and live trip figures.
- Trip statistics and a convoy table at the end of the trip; trips are saved on the device with an animated replay of every car.
- French, English and German interface.
- Animated launch screen.
- Four themes (Graphite, Light, OLED, Red night) and five accent colours.
- Installable on the iPhone home screen, opens full screen.

## Services used

All free and without keys: MapLibre GL JS with CARTO basemaps built on OpenStreetMap data, the public OSRM server for routing and Photon for address search.

## Files

- `index.html`: layout and styles
- `app.js`: application logic and convoy simulation
- `sw.js`: offline app shell
- `manifest.webmanifest` and `icons/`: home screen install
