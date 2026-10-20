# PocketConvoy

A mobile-first web app that keeps a group of cars together on a road trip: live map of every car, push-to-talk walkie-talkie, a shared route set by the convoy leader, quick alerts, a speedometer and trip statistics with replay.

Create a convoy, share the invite link, the QR code or the 6-character code, and every phone sees the others in real time.

## Setup

1. In a Supabase project, copy the project URL and the legacy anon key into `config.js`. Realtime public channels must be allowed, which is the default. No database table is needed.
2. For the walkie-talkie on mobile data, create a free Metered account (Open Relay TURN) and paste its `iceServers` list into `config.js`.
3. Push the files to the repository and enable GitHub Pages.

## Short links for shared trips (optional, one-time setup)

A trip from the history can be shared as a link. Without this step the app still works: it puts the whole trip inside a longer link.
For short links (`…/?trip=abc123`), open your Supabase project, go to **SQL Editor**, paste this and press **Run**:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trips', 'trips', true, 2097152, array['application/json'])
on conflict (id) do nothing;

create policy "PocketConvoy shared trips upload"
on storage.objects for insert to anon
with check (bucket_id = 'trips');
```

Shared trips get a random, unguessable name. Anyone with the link can see the trip (names, tracks and statistics of the whole convoy); the list of shared trips cannot be read. To remove a shared trip, delete its file in **Storage → trips** in the Supabase dashboard.

## Features

- Full-screen live map with every car's speed and status. Dark and light map styles.
- Shared pins: anyone can drop a pin (press and hold on the map) with a type and a name; the leader can turn it into a stop or the destination.
- Turn-by-turn guidance on screen, rerouting when you leave the route.
- Convoy alerts shown as large banners, each with its own sound: a car too far from the leader, the leader stopped, quick messages (break, fuel, lost, slow down, all good). A breakdown shows full screen. Convoy housekeeping (someone joins, leaves, new leader) stays as small notifications.
- Adjustable haptic feedback (off, light, normal, strong) for buttons, walkie-talkie and alerts. Vibration on Android; on iPhone, Safari only allows a light tick (iOS 18 and later).
- Speedometer view, 0 to 300 km/h, with heading and live trip figures.
- Trip statistics and a convoy table at the end of the trip; trips are saved on the device with an animated replay of every car.
- French, English and German interface; metric or imperial units.
- Animated launch screen and a short tutorial on first launch.
- Off-road mode (Settings): earth and khaki theme, terrain relief, and OpenStreetMap tracks loaded for the area on screen (zoom in), coloured by the vehicle that can use them (car, SUV, 4×4, experienced 4×4, impassable) with solid, dashed or grey lines for access. Tap a track for its details (surface, condition, smoothness, width, incline, seasonal or permanent restrictions). Tracks are kept on the phone for 14 days. OpenStreetMap data comes without guarantee: signs on site and local rules prevail.
- Off-road step 2: "Explore tracks" from the home screen (no convoy needed), track search around you, around a place or in the visible area with filters (vehicle, access, minimum length, tracks without information), whole tracks rebuilt from their OpenStreetMap sections, "My tracks" favourites, and "Drive this track with the convoy" for the leader: guidance to the start, then the track is shown to everyone with the distance left and an off-track warning.
- Trip history: per-member view with speed colours, share link, and story image or timelapse video (1080 × 1920).
- Built-in QR code scanner to join a convoy, continuous colour pickers for your car and the accent colour.
- Four themes (Graphite, Light, OLED, Red night) and five accent colours.
- Installable on the iPhone home screen, opens full screen.

## Services used

All free and without keys: MapLibre GL JS with OpenFreeMap vector tiles built on OpenStreetMap data (restyled in the app's colours, labels in Noto Sans and in the app's language, CARTO basemaps as a fallback), the public OSRM server for routing and Photon for address search.

## Files

- `index.html`: layout and styles
- `app.js`: application logic and convoy simulation
- `sw.js`: offline app shell
- `manifest.webmanifest` and `icons/`: home screen install

© HMD Studios
