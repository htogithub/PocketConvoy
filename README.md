# PocketConvoy

A mobile-first web app that keeps a group of cars together on a road trip. Every car sees the others on a live map, talks through a push-to-talk walkie-talkie, follows the same route set by the convoy leader, and gets trip statistics with a replay at the end.

## Features

- Live map of every car with speed and status, refreshed every few seconds. Night map by default, day map in settings.
- Speedometer tab: 0 to 300 km/h gauge with heading, plus live trip distance, driving time, average and top speed, altitude and distance to the leader. Route guidance, walkie-talkie and alerts stay on screen.
- Walkie-talkie between all cars, peer to peer. Hold to talk or tap to toggle, with start and end tones. An open microphone is cut after 60 seconds.
- Shared route: the leader picks a destination and stops (address search or tap on the map) and can change them while driving. Each phone computes its own turn-by-turn route through the same points and reroutes when it leaves the line.
- Leader role can be handed over, and is reassigned automatically if the leader drops out.
- Convoy alerts: a car falling too far behind the leader, the leader stopped, quick messages (pause, fuel, lost, slow down, all good) and a full-screen breakdown alert.
- Trip statistics: distance, driving time, average and top speed, and a table of the whole convoy.
- Trip history stored on the phone, with an animated replay of every car.
- Installable on the iPhone home screen, opens full screen.
- French and English interface, switchable in settings.
- Five themes: Motorway (green), Main road (blue), AMOLED (pure black), Light, and Night vision (all red, to keep night vision while driving in the dark).

## How it works

The app is a static site served by GitHub Pages. It relies on:

- Supabase Realtime (broadcast and presence) for positions, alerts and WebRTC signalling. No database tables are used and nothing is stored on the server.
- A WebRTC mesh for audio, suited to about six cars. A TURN relay is needed for phones on mobile data.
- MapLibre GL JS with CARTO basemaps built on OpenStreetMap data.
- The public OSRM server for routing and Photon for address search, both without keys.
- IndexedDB for the local trip history.

## Setup

1. In a Supabase project, copy the project URL and the legacy anon key into `config.js`. Realtime public channels must be allowed, which is the default.
2. Create a free Metered account (Open Relay TURN) and paste the provided `iceServers` list into `config.js`.
3. Push the files to the repository and enable GitHub Pages on the main branch, root folder.
4. On iPhone, open the page in Safari, then Share, Add to Home Screen. Allow location and microphone on first launch.

## Limitations

- iOS pauses web apps in the background. Keep the app open with the screen on; the app asks the screen to stay awake.
- Web apps cannot run on CarPlay or Android Auto. Voice goes through the car speakers over Bluetooth.
- The public OSRM server is a shared demo service without guarantees.

## Files

- `index.html`: layout and styles
- `app.js`: application logic
- `config.js`: Supabase and TURN settings
- `sw.js`: offline app shell
- `manifest.webmanifest` and `icons/`: home screen install
