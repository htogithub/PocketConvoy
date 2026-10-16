'use strict';
/* PocketConvoy : convoi routier entre amis (PWA) */

const CFG = Object.assign({
  supabaseUrl: '',
  supabaseAnonKey: '',
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  routingUrl: 'https://router.project-osrm.org',
  geocodeUrl: 'https://photon.komoot.io',
}, window.CONVOY_CONFIG || {});

const STYLES = {
  night: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  day: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
};
const COLORS = ['#3D8BFD', '#E5484D', '#30A46C', '#F76B15', '#8E4EC6', '#E93D82', '#12A594', '#FFE629'];
const STATUSES = ['route', 'arret', 'pause', 'essence', 'perdu', 'panne'];
const QUICK = {
  pause:    { status: 'pause', sound: 'msg', kind: 'info' },
  essence:  { status: 'essence', sound: 'msg', kind: 'info' },
  perdu:    { status: 'perdu', sound: 'warn', kind: 'warn' },
  ralentir: { status: null, sound: 'warn', kind: 'warn' },
  ok:       { status: '', sound: 'msg', kind: 'ok' },
  sos:      { status: 'panne', sound: 'sos', kind: 'danger' },
};
const SOUNDS = {
  start: [880, 1320], end: [1320, 880], rxStart: [1250, 1650], rxEnd: [1650, 1050],
  msg: [660, 990], warn: [990, 740, 990, 740], sos: [1100, 760, 1100, 760, 1100, 760],
};
const THEMES = {
  motorway: { map: 'night', meta: '#121B23', prev: ['#121B23', '#0E7A4B', '#F4A62A', '#FFFFFF'] },
  main:     { map: 'night', meta: '#121B23', prev: ['#121B23', '#1F5FAF', '#F4A62A', '#FFFFFF'] },
  amoled:   { map: 'night', meta: '#000000', prev: ['#000000', '#0E7A4B', '#F4A62A', '#FFFFFF'] },
  light:    { map: 'day',   meta: '#EEF2F4', prev: ['#EEF2F4', '#0E7A4B', '#E8940F', '#FFFFFF'] },
  red:      { map: 'night', meta: '#070000', prev: ['#070000', '#3E0805', '#B3261E', '#FF7A6A'] },
};

/* ---------- textes FR / EN ---------- */
const I18N = {
  fr: {
    tagline: 'Rouler ensemble, sans se perdre', resumeTitle: 'Trajet en cours', resume: 'Reprendre', resumeEnd: 'Terminer',
    nickname: 'Ton pseudo', nicknamePh: 'Par exemple Nitsu', colour: 'Ta couleur sur la carte', colourAria: 'Couleur',
    create: 'Créer un convoi', orJoin: 'ou rejoindre avec un code', join: 'Rejoindre', history: 'Historique des trajets', settings: 'Réglages',
    cfgWarn: '<b>Configuration manquante.</b> Ajoute l’URL et la clé publique de ton projet Supabase dans le fichier config.js du dépôt.',
    homeNote: 'Pendant le trajet, garde l’app ouverte au premier plan sur un support. Sur iPhone, verrouiller l’écran ou ouvrir une autre app coupe le partage de position et le talkie.',
    tabMap: 'Carte', tabSpeed: 'Compteur', viewAria: 'Vue', shareAria: 'Partager le code du convoi', soundOn: 'Activer le son',
    pickHint: 'Touche la carte pour placer l’étape', cancel: 'Annuler',
    toolRoute: 'Parcours', toolAlerts: 'Alertes', toolConvoy: 'Convoi', toolSettings: 'Réglages', ptt: 'Talkie-walkie', close: 'Fermer', back: 'Retour',
    route: 'Parcours', searchPh: 'Adresse ou lieu', pickBtn: 'Placer une étape sur la carte',
    quickTitle: 'Alertes rapides', qPause: 'Pause', qFuel: 'Essence', qSlow: 'Ralentissez', qLost: 'Je suis perdu', qOk: 'Tout va bien, je repars',
    qSos: 'Panne ou urgence', qSosConfirm: 'Toucher encore pour confirmer',
    quickNote: 'Chaque alerte part à tout le convoi avec un son. Une panne s’affiche en plein écran chez les autres.',
    convoy: 'Convoi', lang: 'Langue', theme: 'Thème', talkBtn: 'Bouton du talkie', hold: 'Maintenir appuyé', toggle: 'Appui pour basculer',
    map: 'Carte', night: 'Nuit', day: 'Jour', lagAlert: 'Alerte quand une voiture est loin du leader',
    shareCode: 'Partager le code du convoi', endTrip: 'Terminer le trajet', quit: 'Quitter sans enregistrer', yourTrip: 'Ton trajet',
    sosHas: '{name} a un problème', sosSub: 'Panne ou urgence signalée', sosShow: 'Voir sur la carte', sosOk: 'J’ai vu', sosDist: 'À {d} de toi',
    play: 'Lecture', pause: 'Pause', replayAria: 'Position dans le trajet', gaugeAria: 'Compteur de vitesse',
    th_motorway: 'Autoroute', th_main: 'Route principale', th_amoled: 'AMOLED', th_light: 'Clair', th_red: 'Vision de nuit',
    thn_motorway: 'Vert des panneaux d’autoroute, sur fond sombre.', thn_main: 'Bleu des panneaux de route principale.',
    thn_amoled: 'Noir pur : moins d’éblouissement et de batterie sur les écrans OLED.', thn_light: 'Pour rouler en plein jour, avec la carte claire.',
    thn_red: 'Tout en rouge sombre pour garder les yeux habitués à la nuit.',
    st_route: 'En route', st_arret: 'À l’arrêt', st_pause: 'En pause', st_essence: 'À la pompe', st_perdu: 'Perdu', st_panne: 'En panne',
    q_pause: 'Je fais une pause', q_essence: 'Je m’arrête faire le plein', q_perdu: 'Je suis perdu', q_ralentir: 'Attention, ralentissez',
    q_ok: 'Tout va bien, je repars', q_sos: 'Panne ou urgence', msgFrom: '{name} : {text}',
    errName: 'Choisis un pseudo pour que les autres te reconnaissent.', errCfg: 'Ajoute ton URL et ta clé Supabase dans config.js, puis recharge la page.',
    errLibs: 'Les bibliothèques n’ont pas pu se charger. Vérifie ta connexion.', errCode: 'Le code du convoi fait 6 caractères.',
    tooShort: 'Trajet trop court : il n’a pas été enregistré.', resumeText: 'Convoi {code}, parti à {time}. {dist} parcourus.',
    created: 'Convoi créé. Partage le code {code} avec les autres voitures.',
    micDenied: 'Micro refusé : tu entends les autres mais tu ne peux pas parler. Autorise le micro, puis touche le bouton du talkie.',
    planChanged: '{name} a modifié le parcours', endedAll: '{name} a terminé le trajet pour tout le convoi', joined: '{name} a rejoint le convoi',
    leftConvoy: '{name} n’est plus connecté', youLeader: 'Tu es maintenant le leader du convoi', newLeader: '{name} est le nouveau leader',
    noGps: 'Pas de GPS disponible sur cet appareil.', geoDenied: 'Position refusée. Autorise la localisation pour Safari dans Réglages, Confidentialité, Service de localisation.',
    routeFail: 'Itinéraire indisponible pour le moment. Nouvel essai bientôt.', arrivedToast: 'Arrivée à destination. Termine le trajet pour voir tes stats.',
    stopReached: 'Étape atteinte : {label}', arrived: 'Vous êtes arrivés', tapStats: 'Touchez pour voir les stats du trajet',
    computing: 'Calcul de l’itinéraire', routeWait: 'Itinéraire en attente', gpsWait: 'En attente du GPS', eta: 'Arrivée {time}', remaining: '{dist} restants',
    noDestLead: 'Ajoute une destination : tout le convoi recevra le parcours.', noDest: 'Le leader n’a pas encore choisi de destination.',
    dest: 'Destination', stopN: 'Étape {n}', passed: ', passée', up: 'Monter', down: 'Descendre', del: 'Supprimer',
    noteLead: 'Tu es le leader : tes changements partent tout de suite à tout le convoi.', noteMember: 'Seul le leader ({name}) peut modifier le parcours.',
    yourRoute: ' Ton itinéraire : {dist}.', destSent: 'Destination envoyée au convoi', stopSent: 'Étape envoyée au convoi',
    noResult: 'Aucun résultat. Essaie avec la ville ou une adresse plus précise.', searchFail: 'Recherche impossible. Vérifie ta connexion.',
    asStop: 'Étape', asDest: 'Destination', mapPoint: 'Point choisi sur la carte', noName: 'Lieu sans nom',
    micOn: 'Activer le micro', live: 'En direct', holdTalk: 'Maintenir pour parler', tapStop: 'Toucher pour couper', tapTalk: 'Toucher pour parler',
    talks1: '{name} parle', talksN: '{names} parlent', and: ' et ', sent: 'Envoyé au convoi : {text}',
    offline: 'Hors ligne', lostSignal: 'Signal perdu', at: 'à {d}', waiting: 'En attente des autres voitures. Code', leader: 'Leader',
    micReady: 'Micro prêt', micOff: 'Micro inactif', audioOk: 'Audio connecté', audioFail: 'Audio en échec', audioWait: 'Audio en connexion',
    you: ' (toi)', see: 'Voir', makeLeader: 'Leader', currentLeader: 'Leader actuel : {name}. Le leader choisit la destination et les étapes.',
    youShort: 'toi', nobody: 'personne', car: 'Voiture', distance: 'Distance', driving: 'Conduite', avgShort: 'Moy.', max: 'Max',
    rankTitle: 'Le convoi, classé par distance', drivingOf: 'Temps de conduite sur {t}', drivingTime: 'Temps de conduite',
    avgMoving: 'Vitesse moyenne en roulant', maxSpeed: 'Vitesse max', saveQuit: 'Enregistrer et quitter', endAll: 'Terminer pour tout le convoi',
    keepDriving: 'Continuer à rouler', lagYou: 'Tu es à {d} du leader', lagOther: '{name} est à {d} du leader', leaderStopped: 'Le leader {name} est à l’arrêt',
    heading: 'Cap {d}', itsYou: 'C’est toi', average: 'Moyenne', gapLeader: 'Écart au leader', altitude: 'Altitude',
    shareText: 'Rejoins mon convoi sur PocketConvoy avec le code {code}', linkCopied: 'Lien d’invitation copié', codeIs: 'Code du convoi : {code}',
    noTrips: 'Aucun trajet enregistré pour l’instant. Ils apparaissent ici quand tu termines un convoi.', convoyCode: 'Convoi {code}',
    cars1: '1 voiture', carsN: '{n} voitures', tripLine: '{dist} en {dur}, {cars}', fromTo: '{date}, de {a} à {b}', delTrip: 'Supprimer ce trajet',
    confirmQuit: 'Quitter le convoi sans enregistrer ce trajet ?', confirmDel: 'Supprimer ce trajet de l’historique ?',
    viewConvoy: 'Vue du convoi', followMe: 'Me suivre',
  },
  en: {
    tagline: 'Drive together, never lose each other', resumeTitle: 'Trip in progress', resume: 'Resume', resumeEnd: 'End',
    nickname: 'Your nickname', nicknamePh: 'For example Nitsu', colour: 'Your colour on the map', colourAria: 'Colour',
    create: 'Create a convoy', orJoin: 'or join with a code', join: 'Join', history: 'Trip history', settings: 'Settings',
    cfgWarn: '<b>Missing configuration.</b> Add your Supabase project URL and public key to the config.js file in the repository.',
    homeNote: 'While driving, keep the app open in the foreground on a mount. On iPhone, locking the screen or switching apps stops location sharing and the walkie-talkie.',
    tabMap: 'Map', tabSpeed: 'Speed', viewAria: 'View', shareAria: 'Share the convoy code', soundOn: 'Turn sound on',
    pickHint: 'Tap the map to place the stop', cancel: 'Cancel',
    toolRoute: 'Route', toolAlerts: 'Alerts', toolConvoy: 'Convoy', toolSettings: 'Settings', ptt: 'Walkie-talkie', close: 'Close', back: 'Back',
    route: 'Route', searchPh: 'Address or place', pickBtn: 'Place a stop on the map',
    quickTitle: 'Quick alerts', qPause: 'Break', qFuel: 'Fuel', qSlow: 'Slow down', qLost: 'I’m lost', qOk: 'All good, moving on',
    qSos: 'Breakdown or emergency', qSosConfirm: 'Tap again to confirm',
    quickNote: 'Every alert goes to the whole convoy with a sound. A breakdown shows full screen on the other phones.',
    convoy: 'Convoy', lang: 'Language', theme: 'Theme', talkBtn: 'Walkie-talkie button', hold: 'Hold to talk', toggle: 'Tap to toggle',
    map: 'Map', night: 'Night', day: 'Day', lagAlert: 'Alert when a car is far from the leader',
    shareCode: 'Share the convoy code', endTrip: 'End the trip', quit: 'Leave without saving', yourTrip: 'Your trip',
    sosHas: '{name} has a problem', sosSub: 'Breakdown or emergency reported', sosShow: 'Show on the map', sosOk: 'Got it', sosDist: '{d} away from you',
    play: 'Play', pause: 'Pause', replayAria: 'Position in the trip', gaugeAria: 'Speedometer',
    th_motorway: 'Motorway', th_main: 'Main road', th_amoled: 'AMOLED', th_light: 'Light', th_red: 'Night vision',
    thn_motorway: 'Motorway sign green on a dark background.', thn_main: 'Main road sign blue.',
    thn_amoled: 'Pure black: less glare and less battery on OLED screens.', thn_light: 'For driving in daylight, with the light map.',
    thn_red: 'Everything in dim red to keep your eyes adapted to the dark.',
    st_route: 'Driving', st_arret: 'Stopped', st_pause: 'On a break', st_essence: 'Refuelling', st_perdu: 'Lost', st_panne: 'Broken down',
    q_pause: 'I’m taking a break', q_essence: 'I’m stopping for fuel', q_perdu: 'I’m lost', q_ralentir: 'Careful, slow down',
    q_ok: 'All good, moving on', q_sos: 'Breakdown or emergency', msgFrom: '{name}: {text}',
    errName: 'Pick a nickname so the others recognise you.', errCfg: 'Add your Supabase URL and key to config.js, then reload the page.',
    errLibs: 'The libraries could not load. Check your connection.', errCode: 'The convoy code has 6 characters.',
    tooShort: 'Trip too short: it was not saved.', resumeText: 'Convoy {code}, left at {time}. {dist} driven.',
    created: 'Convoy created. Share the code {code} with the other cars.',
    micDenied: 'Microphone blocked: you can hear the others but cannot talk. Allow the microphone, then tap the walkie-talkie button.',
    planChanged: '{name} changed the route', endedAll: '{name} ended the trip for the whole convoy', joined: '{name} joined the convoy',
    leftConvoy: '{name} is no longer connected', youLeader: 'You are now the convoy leader', newLeader: '{name} is the new leader',
    noGps: 'No GPS available on this device.', geoDenied: 'Location blocked. Allow location for Safari in Settings, Privacy, Location Services.',
    routeFail: 'Route unavailable for now. Trying again soon.', arrivedToast: 'You have arrived. End the trip to see your stats.',
    stopReached: 'Stop reached: {label}', arrived: 'You have arrived', tapStats: 'Tap to see the trip stats',
    computing: 'Calculating the route', routeWait: 'Route pending', gpsWait: 'Waiting for GPS', eta: 'Arrival {time}', remaining: '{dist} left',
    noDestLead: 'Add a destination: the whole convoy will get the route.', noDest: 'The leader has not chosen a destination yet.',
    dest: 'Destination', stopN: 'Stop {n}', passed: ', passed', up: 'Move up', down: 'Move down', del: 'Delete',
    noteLead: 'You are the leader: your changes go to the whole convoy right away.', noteMember: 'Only the leader ({name}) can change the route.',
    yourRoute: ' Your route: {dist}.', destSent: 'Destination sent to the convoy', stopSent: 'Stop sent to the convoy',
    noResult: 'No results. Try with the town or a more precise address.', searchFail: 'Search unavailable. Check your connection.',
    asStop: 'Stop', asDest: 'Destination', mapPoint: 'Point picked on the map', noName: 'Unnamed place',
    micOn: 'Turn the mic on', live: 'Live', holdTalk: 'Hold to talk', tapStop: 'Tap to stop', tapTalk: 'Tap to talk',
    talks1: '{name} is talking', talksN: '{names} are talking', and: ' and ', sent: 'Sent to the convoy: {text}',
    offline: 'Offline', lostSignal: 'Signal lost', at: '{d} away', waiting: 'Waiting for the other cars. Code', leader: 'Leader',
    micReady: 'Mic ready', micOff: 'Mic off', audioOk: 'Audio connected', audioFail: 'Audio failed', audioWait: 'Audio connecting',
    you: ' (you)', see: 'Show', makeLeader: 'Leader', currentLeader: 'Current leader: {name}. The leader picks the destination and the stops.',
    youShort: 'you', nobody: 'nobody', car: 'Car', distance: 'Distance', driving: 'Driving', avgShort: 'Avg.', max: 'Max',
    rankTitle: 'The convoy, ranked by distance', drivingOf: 'Driving time out of {t}', drivingTime: 'Driving time',
    avgMoving: 'Average speed while moving', maxSpeed: 'Top speed', saveQuit: 'Save and leave', endAll: 'End for the whole convoy',
    keepDriving: 'Keep driving', lagYou: 'You are {d} from the leader', lagOther: '{name} is {d} from the leader', leaderStopped: 'The leader {name} has stopped',
    heading: 'Heading {d}', itsYou: 'It’s you', average: 'Average', gapLeader: 'Gap to leader', altitude: 'Altitude',
    shareText: 'Join my convoy on PocketConvoy with the code {code}', linkCopied: 'Invite link copied', codeIs: 'Convoy code: {code}',
    noTrips: 'No trips saved yet. They appear here when you end a convoy.', convoyCode: 'Convoy {code}',
    cars1: '1 car', carsN: '{n} cars', tripLine: '{dist} in {dur}, {cars}', fromTo: '{date}, from {a} to {b}', delTrip: 'Delete this trip',
    confirmQuit: 'Leave the convoy without saving this trip?', confirmDel: 'Delete this trip from the history?',
    viewConvoy: 'Convoy view', followMe: 'Follow me',
  },
};
const NAV = {
  fr: {
    mod: { left: 'à gauche', right: 'à droite', 'slight left': 'légèrement à gauche', 'slight right': 'légèrement à droite',
      'sharp left': 'franchement à gauche', 'sharp right': 'franchement à droite', straight: 'tout droit' },
    depart: 'Partez', arrive: 'Arrivée à destination', stop: 'Étape atteinte', uturn: 'Faites demi-tour', straight: 'Continuez tout droit',
    turn: 'Tournez {d}', endroad: 'Au bout, tournez {d}', merge: 'Insérez-vous{s}', onramp: 'Prenez la bretelle{s}', offramp: 'Prenez la sortie{s}',
    fork: 'Restez {d}', rb: 'Au rond-point, prenez la {n} sortie', rbcont: 'Au rond-point, continuez', rbturn: 'Au rond-point, tournez {d}',
    rbexit: 'Sortez du rond-point', cont: 'Continuez{s}', ord: n => n === 1 ? '1re' : n + 'e',
  },
  en: {
    mod: { left: 'left', right: 'right', 'slight left': 'slightly left', 'slight right': 'slightly right',
      'sharp left': 'sharply left', 'sharp right': 'sharply right', straight: 'straight on' },
    depart: 'Head off', arrive: 'You have arrived', stop: 'Stop reached', uturn: 'Make a U-turn', straight: 'Continue straight on',
    turn: 'Turn {d}', endroad: 'At the end of the road, turn {d}', merge: 'Merge{s}', onramp: 'Take the ramp{s}', offramp: 'Take the exit{s}',
    fork: 'Keep {d}', rb: 'At the roundabout, take the {n} exit', rbcont: 'At the roundabout, continue', rbturn: 'At the roundabout, turn {d}',
    rbexit: 'Exit the roundabout', cont: 'Continue{s}',
    ord: n => n + ((n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')),
  },
};
const DIRS = { fr: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'], en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] };

/* ---------- utilitaires ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const initial = n => (String(n || '?').trim().charAt(0) || '?').toUpperCase();
const ic = (p, s = 24) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  flag: '<path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/>',
  convoy: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  locate: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
};

const store = {
  get(k, d) { try { const v = localStorage.getItem('pc_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pc_' + k, JSON.stringify(v)); } catch (e) { /* plein */ } },
};
const prefs = Object.assign({ talkMode: 'hold', mapTheme: 'night', lagKm: 3, view: 'map', lang: 'fr', theme: 'motorway' }, store.get('prefs', {}));
if (!I18N[prefs.lang]) prefs.lang = 'fr';
if (!THEMES[prefs.theme]) prefs.theme = 'motorway';
const savePrefs = () => store.set('prefs', prefs);

function t(k, v) {
  let s = I18N[prefs.lang][k];
  if (s == null) s = I18N.fr[k] != null ? I18N.fr[k] : k;
  if (v) for (const key of Object.keys(v)) s = s.split('{' + key + '}').join(v[key]);
  return s;
}
const locale = () => prefs.lang === 'en' ? 'en-GB' : 'fr-CH';

const DB = {
  _p: null,
  open() {
    if (!this._p) this._p = new Promise((res, rej) => {
      const r = indexedDB.open('pocketconvoy', 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('trips', { keyPath: 'id' }); d.createObjectStore('kv'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this._p;
  },
  async run(name, mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction(name, mode);
      const req = fn(tx.objectStore(name));
      tx.oncomplete = () => res(req ? req.result : undefined);
      tx.onerror = () => rej(tx.error);
    });
  },
  putTrip: tr => DB.run('trips', 'readwrite', s => s.put(tr)),
  allTrips: () => DB.run('trips', 'readonly', s => s.getAll()),
  delTrip: id => DB.run('trips', 'readwrite', s => s.delete(id)),
  getKV: k => DB.run('kv', 'readonly', s => s.get(k)),
  setKV: (k, v) => DB.run('kv', 'readwrite', s => s.put(v, k)),
  delKV: k => DB.run('kv', 'readwrite', s => s.delete(k)),
};

/* géométrie : points [lat, lng], distances en mètres */
const RAD = Math.PI / 180, EARTH = 6371000, DEG_M = EARTH * RAD;
function hav(a, b) {
  const dLat = (b[0] - a[0]) * RAD, dLng = (b[1] - a[1]) * RAD;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(x)));
}
function bearing(a, b) {
  const y = Math.sin((b[1] - a[1]) * RAD) * Math.cos(b[0] * RAD);
  const x = Math.cos(a[0] * RAD) * Math.sin(b[0] * RAD) - Math.sin(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.cos((b[1] - a[1]) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}
function projectOnSeg(p, a, b) {
  const k = Math.cos(p[0] * RAD);
  const ax = (a[1] - p[1]) * k, ay = a[0] - p[0], bx = (b[1] - p[1]) * k, by = b[0] - p[0];
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let u = L ? -(ax * dx + ay * dy) / L : 0;
  u = Math.max(0, Math.min(1, u));
  const x = ax + u * dx, y = ay + u * dy;
  return { d: Math.sqrt(x * x + y * y) * DEG_M, t: u };
}

function fmtDist(m) {
  if (m == null || isNaN(m)) return '';
  if (m < 5) return '0 m';
  if (m < 950) return Math.max(10, Math.round(m / 10) * 10) + ' m';
  const k = m / 1000;
  const s = k < 10 ? k.toFixed(1) : String(Math.round(k));
  return (prefs.lang === 'fr' ? s.replace('.', ',') : s) + ' km';
}
function fmtDur(ms) {
  const min = Math.round((ms || 0) / 60000);
  if (min < 60) return min + ' min';
  return Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0');
}
const fmtKmh = ms => Math.round((ms || 0) * 3.6) + ' km/h';
const fmtClock = ts => new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
const fmtDate = ts => new Date(ts).toLocaleDateString(locale(), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const statusLabel = st => t('st_' + (STATUSES.includes(st) ? st : 'route'));

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function photon(path, params) {
  const base = `${CFG.geocodeUrl}${path}?${params}`;
  try { return await getJSON(base + '&lang=' + prefs.lang); } catch (e) { return getJSON(base); }
}
function placeLabel(p) {
  const title = p.name || [p.street, p.housenumber].filter(Boolean).join(' ') || p.city || t('noName');
  const sub = [p.name && p.street ? [p.street, p.housenumber].filter(Boolean).join(' ') : '', p.city || p.town || p.village || '', p.country || '']
    .filter(Boolean).filter(x => x !== title).join(', ');
  return { title, sub };
}

/* ---------- état ---------- */
const me = { id: store.get('id', null), name: store.get('name', ''), color: store.get('color', COLORS[0]) };
if (!me.id) { me.id = rid(); store.set('id', me.id); }

const S = {
  code: null, sb: null, channel: null, conn: false, firstSync: true, joinTs: 0,
  members: new Map(), online: new Set(), joinedAt: {},
  leaderId: null, leaderSeq: 0, leaderMissing: 0,
  plan: { v: 0, wps: [] }, passed: new Set(),
  route: null, routing: false, routeAgain: false, nav: { off: 0, last: 0 }, arrived: false,
  pos: null, geoWatch: null, follow: true, zoomNext: true,
  manual: '', stoppedSince: null, movingSince: null,
  lastSentT: 0, lastSent: null,
  trip: null,
  localStream: null, peers: new Map(), pendingCands: new Map(),
  talking: false, talkTimer: null, pttArmed: false, ac: null, wake: null,
  alerts: { lag: {}, leaderStop: false },
  map: null, wpMarkers: [], pick: false, sheet: null,
  timers: [], stripT: null, resumeData: null, spTarget: 0, spDisp: 0,
};

function member(id) {
  let m = S.members.get(id);
  if (!m) {
    m = { id, name: '…', color: '#8899A6', lat: null, lng: null, spd: 0, hdg: null, st: 'route', t: 0,
      talking: false, talkUntil: 0, online: id === me.id, stale: false, stats: { dist: 0, mv: 0, mx: 0 }, mk: null, el: null };
    S.members.set(id, m);
  }
  return m;
}
const isLeader = () => S.leaderId === me.id;
const leaderName = () => S.leaderId ? (S.leaderId === me.id ? t('youShort') : member(S.leaderId).name) : t('nobody');

/* ---------- écrans, messages, langue et thème ---------- */
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  if (id === 'main' && S.map) setTimeout(() => S.map.resize(), 50);
}
function toast(text, kind = 'info', ms = 5000, html = false) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = html ? text : esc(text);
  box.prepend(el);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => el.remove(), ms);
}
function homeErr(msg) { const e = $('#homeErr'); e.textContent = msg; e.hidden = !msg; }

function applyLang() {
  document.documentElement.lang = prefs.lang;
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  $$('.swatch').forEach(el => el.setAttribute('aria-label', t('colourAria')));
  updatePTT();
  setFollow(S.follow, true);
  updatePlayBtn();
  if (S.code) {
    renderStrip(); updateNavSign(); updateTalkBar(); updateSpeedo();
    for (const m of S.members.values()) updateMarker(m);
    if (S.sheet === 'route') renderRouteSheet();
    if (S.sheet === 'members') renderMembers();
    if (S.sheet === 'end') renderEnd();
  }
  if ($('#home').classList.contains('on')) checkResume();
  if ($('#history').classList.contains('on')) openHistory();
  if (S.sheet === 'settings') syncSettings();
}
function applyTheme() {
  const th = THEMES[prefs.theme];
  document.documentElement.dataset.theme = prefs.theme;
  $('#metaTheme').setAttribute('content', th.meta);
  styleRouteLayers();
}
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

/* ---------- son ---------- */
function unlockAudio() {
  try {
    if (!S.ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) S.ac = new AC(); }
    if (S.ac && S.ac.state !== 'running') S.ac.resume();
  } catch (e) { /* ignoré */ }
  let blocked = false;
  for (const p of S.peers.values()) if (p.audio) p.audio.play().catch(() => { blocked = true; });
  if (!blocked) $('#audioChip').hidden = true;
}
function beep(name) {
  const ac = S.ac, seq = SOUNDS[name];
  if (!ac || !seq) return;
  let tm = ac.currentTime + 0.01;
  const dur = name === 'sos' ? 0.18 : 0.075;
  for (const f of seq) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = name === 'sos' ? 'square' : 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0, tm);
    g.gain.linearRampToValueAtTime(name === 'sos' ? 0.12 : 0.2, tm + 0.01);
    g.gain.linearRampToValueAtTime(0, tm + dur);
    o.connect(g).connect(ac.destination);
    o.start(tm); o.stop(tm + dur + 0.02);
    tm += dur;
  }
}
async function keepAwake() {
  try {
    if ('wakeLock' in navigator && !S.wake && document.visibilityState === 'visible') {
      S.wake = await navigator.wakeLock.request('screen');
      S.wake.addEventListener('release', () => { S.wake = null; });
    }
  } catch (e) { /* non supporté */ }
}

/* ---------- accueil ---------- */
function renderHome() {
  $('#name').value = me.name;
  $('#swatches').innerHTML = COLORS.map(c =>
    `<button class="swatch" style="--c:${c}" data-c="${c}" aria-label="${esc(t('colourAria'))}" aria-pressed="${c === me.color}"></button>`).join('');
  const c = (new URLSearchParams(location.search).get('c') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c) $('#code').value = c.slice(0, 6);
  $('#cfgWarn').hidden = configOk();
  homeErr('');
  checkResume();
}
function configOk() {
  return /^https:\/\//.test(CFG.supabaseUrl) && CFG.supabaseAnonKey && CFG.supabaseAnonKey.length > 20 && !/X{4}/.test(CFG.supabaseUrl + CFG.supabaseAnonKey);
}
function newCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (const b of crypto.getRandomValues(new Uint8Array(6))) s += A[b % A.length];
  return s;
}
async function checkResume() {
  let c = null;
  try { c = await DB.getKV('current'); } catch (e) { /* ignoré */ }
  const box = $('#resume');
  if (!c) { box.hidden = true; S.resumeData = null; return; }
  if (Date.now() - c.savedAt > 12 * 3600e3) { await saveTripRecord(c.trip, c.rows || []); await DB.delKV('current'); box.hidden = true; return; }
  S.resumeData = c;
  $('#resumeText').textContent = t('resumeText', { code: c.code, time: fmtClock(c.trip.start), dist: fmtDist(c.trip.dist) });
  box.hidden = false;
}

/* ---------- démarrage d'une session ---------- */
async function start(code, creating, resume) {
  const name = $('#name').value.trim();
  if (!name) { homeErr(t('errName')); $('#name').focus(); return; }
  if (!configOk()) { homeErr(t('errCfg')); return; }
  if (typeof maplibregl === 'undefined' || typeof supabase === 'undefined') { homeErr(t('errLibs')); return; }
  me.name = name.slice(0, 16);
  store.set('name', me.name); store.set('color', me.color);
  homeErr('');

  unlockAudio();
  if (navigator.audioSession) { try { navigator.audioSession.type = 'play-and-record'; } catch (e) { /* ignoré */ } }
  const micReady = ensureMic(false);

  S.code = code; S.firstSync = true; S.joinTs = Date.now();
  S.online = new Set([me.id]);
  if (resume) {
    S.trip = Object.assign(resume.trip, { last: null });
    S.plan = resume.plan || { v: 0, wps: [] };
    S.passed = new Set(resume.passed || []);
    S.leaderId = resume.leaderId || null;
    S.leaderSeq = resume.leaderSeq || 0;
  } else {
    S.trip = { id: 't' + Date.now(), code, start: Date.now(), dist: 0, moving: 0, max: 0, last: null, tracks: {}, names: {}, colors: {}, dest: '' };
    S.plan = { v: 0, wps: [] }; S.passed = new Set();
    S.leaderId = creating ? me.id : null; S.leaderSeq = creating ? 1 : 0;
  }
  Object.assign(member(me.id), { name: me.name, color: me.color, online: true });

  $('#codeText').textContent = code;
  history.replaceState(null, '', location.pathname + '?c=' + code);
  closeSheets();
  show('main');
  initMap();
  setView(prefs.view);
  startGeo();
  keepAwake();
  setFollow(true);
  updatePTT();
  renderStrip();
  renderWaypoints();
  await micReady;
  connect();
  S.timers.push(setInterval(tick, 3000), setInterval(saveCurrent, 20000));
  if (creating) setTimeout(() => toast(t('created', { code }), 'ok', 7000), 400);
}

async function ensureMic(resetPeers) {
  if (S.localStream) return true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { updatePTT(); return false; }
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    st.getAudioTracks().forEach(tr => { tr.enabled = false; });
    S.localStream = st;
    updatePTT();
    if (resetPeers) for (const id of S.online) if (id !== me.id) resetPeer(id);
    return true;
  } catch (e) {
    updatePTT();
    toast(t('micDenied'), 'warn', 9000);
    return false;
  }
}

function connect() {
  if (!S.sb) S.sb = supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  const ch = S.sb.channel('pocketconvoy:' + S.code, { config: { broadcast: { self: false, ack: false }, presence: { key: me.id } } });
  for (const ev of Object.keys(H)) {
    ch.on('broadcast', { event: ev }, ({ payload }) => { try { H[ev](payload || {}); } catch (e) { console.warn(ev, e); } });
  }
  ch.on('presence', { event: 'sync' }, onPresence);
  ch.subscribe(async status => {
    if (status === 'SUBSCRIBED') {
      setConn(true);
      try { await ch.track({ n: me.name, c: me.color, j: S.joinTs }); } catch (e) { /* ignoré */ }
      send('hello', { id: me.id });
      maybeSendPos(true);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      setConn(false);
    }
  });
  S.channel = ch;
}
function reconnect() {
  if (!S.code) return;
  try { if (S.channel) S.sb.removeChannel(S.channel); } catch (e) { /* ignoré */ }
  S.channel = null; S.firstSync = true;
  connect();
}
function setConn(ok) {
  S.conn = ok;
  const d = $('#connDot');
  d.classList.toggle('ok', ok); d.classList.toggle('bad', !ok);
}
function send(event, payload) {
  if (!S.channel) return;
  try { S.channel.send({ type: 'broadcast', event, payload }).catch(() => {}); } catch (e) { /* ignoré */ }
}

/* ---------- messages reçus ---------- */
const H = {
  pos(d) {
    if (!d.id || d.id === me.id) return;
    const m = member(d.id);
    Object.assign(m, { name: d.n || m.name, color: d.c || m.color, lat: d.la, lng: d.ln, spd: d.s || 0, hdg: d.h, st: d.st || 'route', t: Date.now(), stale: false });
    m.stats = { dist: d.d || 0, mv: d.mv || 0, mx: d.mx || 0 };
    recordTrack(m.id, d.la, d.ln);
    updateMarker(m);
    scheduleStrip();
  },
  talk(d) {
    if (!d.id || d.id === me.id) return;
    const m = member(d.id);
    m.talking = !!d.on;
    m.talkUntil = d.on ? Date.now() + 65000 : 0;
    beep(d.on ? 'rxStart' : 'rxEnd');
    updateTalkBar(); updateMarker(m);
  },
  msg(d) {
    const q = QUICK[d.k];
    if (!q || !d.id) return;
    const m = member(d.id);
    if (q.status !== null) m.st = q.status || 'route';
    if (d.k === 'sos') { showSOS(m, d.la, d.ln); beep('sos'); }
    else { toast(t('msgFrom', { name: `<b>${esc(m.name)}</b>`, text: esc(t('q_' + d.k)) }), q.kind, 8000, true); beep(q.sound); }
    updateMarker(m); scheduleStrip();
  },
  rtc(d) { onRtc(d); },
  hello(d) {
    if (!d.id || d.id === me.id) return;
    if (S.leaderId) send('state', { to: d.id, leaderId: S.leaderId, leaderSeq: S.leaderSeq, plan: S.plan });
    maybeSendPos(true);
  },
  state(d) {
    if (d.to !== me.id) return;
    if (d.leaderId) setLeader(d.leaderId, d.leaderSeq || 0, true);
    if (d.plan && d.plan.v > S.plan.v) { S.plan = d.plan; onPlanChanged(); }
  },
  leader(d) { if (d.id) setLeader(d.id, d.seq || 0); },
  plan(d) {
    if (!d.plan || d.plan.v <= S.plan.v) return;
    S.plan = d.plan;
    onPlanChanged();
    if (d.by && d.by !== me.id) toast(t('planChanged', { name: member(d.by).name }), 'info', 4500);
  },
  end(d) {
    if (!d.by) return;
    toast(t('endedAll', { name: member(d.by).name }), 'info', 7000);
    openSheet('end');
  },
};

function onPresence() {
  if (!S.channel) return;
  const st = S.channel.presenceState();
  const ids = new Set([me.id]);
  for (const [key, metas] of Object.entries(st)) {
    const meta = metas[metas.length - 1] || {};
    ids.add(key);
    S.joinedAt[key] = meta.j || 0;
    if (key !== me.id) { const m = member(key); if (meta.n) m.name = meta.n; if (meta.c) m.color = meta.c; }
  }
  for (const id of ids) {
    if (id === me.id || S.online.has(id)) continue;
    const m = member(id);
    m.online = true; m.stale = false;
    if (!S.firstSync) { toast(t('joined', { name: m.name }), 'ok', 4000); beep('msg'); }
    if (me.id < id) callPeer(id);
    updateMarker(m);
  }
  for (const id of S.online) {
    if (id === me.id || ids.has(id)) continue;
    const m = member(id);
    m.online = false; m.talking = false;
    closePeer(id);
    toast(t('leftConvoy', { name: m.name }), 'warn', 5000);
    updateMarker(m); updateTalkBar();
  }
  S.online = ids;
  S.firstSync = false;
  renderStrip();
  if (S.sheet === 'members') renderMembers();
}

/* ---------- leader ---------- */
function setLeader(id, seq, quiet) {
  if (seq < S.leaderSeq) return;
  if (seq === S.leaderSeq && S.leaderId && id >= S.leaderId) return;
  const was = S.leaderId;
  S.leaderId = id; S.leaderSeq = seq; S.leaderMissing = 0;
  if (!quiet && was !== id) {
    if (id === me.id) { toast(t('youLeader'), 'ok', 5000); beep('msg'); }
    else toast(t('newLeader', { name: member(id).name }), 'info', 4500);
  }
  for (const m of S.members.values()) updateMarker(m);
  renderStrip();
  if (S.sheet === 'route') renderRouteSheet();
  if (S.sheet === 'members') renderMembers();
}
function giveLeader(id) {
  const seq = S.leaderSeq + 1;
  setLeader(id, seq);
  send('leader', { id, seq });
}
function checkLeader() {
  if (!S.conn) return;
  if (S.leaderId && S.online.has(S.leaderId)) { S.leaderMissing = 0; return; }
  if (!S.leaderMissing) { S.leaderMissing = Date.now(); return; }
  if (Date.now() - S.leaderMissing < (S.leaderId ? 15000 : 5000)) return;
  const cand = [...S.online].sort((a, b) => (S.joinedAt[a] || S.joinTs) - (S.joinedAt[b] || S.joinTs) || (a < b ? -1 : 1))[0];
  S.leaderMissing = 0;
  if (cand === me.id) {
    const seq = S.leaderSeq + 1;
    setLeader(me.id, seq);
    send('leader', { id: me.id, seq });
  }
}

/* ---------- GPS ---------- */
function startGeo() {
  if (!('geolocation' in navigator)) { toast(t('noGps'), 'danger', 8000); return; }
  stopGeo();
  S.geoWatch = navigator.geolocation.watchPosition(onFix, onGeoErr, { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 });
}
function stopGeo() { if (S.geoWatch != null) navigator.geolocation.clearWatch(S.geoWatch); S.geoWatch = null; }
function onGeoErr(e) { if (e.code === 1) toast(t('geoDenied'), 'danger', 10000); }
function onFix(p) {
  const c = p.coords, now = Date.now();
  const cur = [c.latitude, c.longitude];
  const prev = S.pos;
  let spd = (c.speed != null && c.speed >= 0) ? c.speed : null;
  if (spd == null && prev) { const dt = (now - prev.t) / 1000; if (dt > 0.5) spd = hav([prev.lat, prev.lng], cur) / dt; }
  let hdg = (c.heading != null && !isNaN(c.heading) && c.heading >= 0) ? c.heading : null;
  if (hdg == null && prev && hav([prev.lat, prev.lng], cur) > 8) hdg = bearing([prev.lat, prev.lng], cur);
  if (hdg == null && prev) hdg = prev.hdg;
  S.pos = { lat: cur[0], lng: cur[1], spd: spd || 0, hdg, acc: c.accuracy || 50, t: now, gpsSpd: c.speed != null && c.speed >= 0,
    alt: c.altitude != null && !isNaN(c.altitude) ? c.altitude : null };

  updateStats(S.pos);
  autoStatus(S.pos);
  const self = member(me.id);
  Object.assign(self, { lat: cur[0], lng: cur[1], spd: S.pos.spd * 3.6, hdg, st: myStatus(), t: now, online: true });
  recordTrack(me.id, cur[0], cur[1]);
  updateMarker(self);
  if (S.follow) followCamera();
  checkWaypoints();
  if (S.route) navigate();
  else if (pendingWps().length && !S.routing && now - S.nav.last > 15000) computeRoute();
  updateSpeedo();
  maybeSendPos(false);
}
function updateStats(cur) {
  const T = S.trip;
  if (!T || cur.acc > 50) return;
  if (cur.gpsSpd && cur.acc < 30 && cur.spd < 100) T.max = Math.max(T.max, cur.spd);
  const last = T.last;
  if (!last) { T.last = cur; return; }
  const dt = (cur.t - last.t) / 1000;
  if (dt <= 0) return;
  if (dt > 120) { T.last = cur; return; }
  const d = hav([last.lat, last.lng], [cur.lat, cur.lng]);
  if (d / dt > 100) { T.last = cur; return; }
  if (d > Math.max(6, cur.acc * 0.5) || (cur.gpsSpd && cur.spd > 1.5 && d > 2)) {
    T.dist += d;
    T.moving += Math.min(dt, 5) * 1000;
    T.last = cur;
  }
}
function autoStatus(p) {
  const now = Date.now();
  if (p.spd < 0.8) { if (!S.stoppedSince) S.stoppedSince = now; } else S.stoppedSince = null;
  if (['pause', 'essence', 'perdu'].includes(S.manual)) {
    if (p.spd > 8) { if (!S.movingSince) S.movingSince = now; if (now - S.movingSince > 20000) { S.manual = ''; maybeSendPos(true); } }
    else S.movingSince = null;
  }
}
function myStatus() {
  if (S.manual) return S.manual;
  return (S.stoppedSince && Date.now() - S.stoppedSince > 45000) ? 'arret' : 'route';
}
function maybeSendPos(force) {
  const p = S.pos;
  if (!S.channel || !p) return;
  const now = Date.now();
  const moved = S.lastSent ? hav([S.lastSent.lat, S.lastSent.lng], [p.lat, p.lng]) : 1e9;
  if (!force && !(now - S.lastSentT > 2000 && moved > 5) && now - S.lastSentT < 10000) return;
  const T = S.trip || {};
  send('pos', {
    id: me.id, n: me.name, c: me.color,
    la: +p.lat.toFixed(6), ln: +p.lng.toFixed(6),
    s: Math.round(p.spd * 3.6), h: p.hdg == null ? null : Math.round(p.hdg),
    st: myStatus(), d: Math.round(T.dist || 0), mv: Math.round(T.moving || 0), mx: +(T.max || 0).toFixed(1),
  });
  S.lastSentT = now; S.lastSent = { lat: p.lat, lng: p.lng };
}
function recordTrack(id, lat, lng) {
  const T = S.trip;
  if (!T || lat == null) return;
  const m = S.members.get(id);
  if (m) { T.names[id] = m.name; T.colors[id] = m.color; }
  const tr = T.tracks[id] || (T.tracks[id] = []);
  const tt = Math.round((Date.now() - T.start) / 1000);
  const l = tr[tr.length - 1];
  if (!l || (tt - l[0] >= 5 && hav([l[1], l[2]], [lat, lng]) >= 20) || tt - l[0] >= 60) tr.push([tt, +lat.toFixed(5), +lng.toFixed(5)]);
}

/* ---------- carte ---------- */
function initMap() {
  if (S.map) { S.map.resize(); return; }
  const m = new maplibregl.Map({
    container: 'map', style: STYLES[prefs.mapTheme], center: [8.23, 46.8], zoom: 7,
    attributionControl: { compact: true }, dragRotate: false, touchPitch: false, pitchWithRotate: false, maxPitch: 60,
  });
  m.touchZoomRotate.disableRotation();
  m.on('style.load', () => { addRouteLayers(); renderRoute(); });
  m.on('dragstart', () => setFollow(false));
  m.on('rotate', () => { for (const mm of S.members.values()) updateCone(mm); });
  m.on('click', onMapClick);
  m.on('error', e => console.warn('carte', e && e.error && e.error.message));
  S.map = m;
  const hb = $('#hudBottom');
  if ('ResizeObserver' in window) new ResizeObserver(() => $('#main').style.setProperty('--hud-h', hb.offsetHeight + 'px')).observe(hb);
}
function addRouteLayers() {
  const m = S.map;
  if (!m.getSource('route')) m.addSource('route', { type: 'geojson', data: routeGeo() });
  if (!m.getLayer('route-casing')) m.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': cssVar('--route-casing'), 'line-width': 12 } });
  if (!m.getLayer('route-line')) m.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': cssVar('--route'), 'line-width': 7 } });
}
function styleRouteLayers() {
  const m = S.map;
  if (!m || !m.getLayer || !m.isStyleLoaded()) return;
  if (m.getLayer('route-casing')) m.setPaintProperty('route-casing', 'line-color', cssVar('--route-casing'));
  if (m.getLayer('route-line')) m.setPaintProperty('route-line', 'line-color', cssVar('--route'));
}
function routeGeo() {
  const c = S.route ? S.route.coords.map(p => [p[1], p[0]]) : [];
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c.length > 1 ? c : [] } };
}
function renderRoute() {
  const src = S.map && S.map.getSource('route');
  if (src) src.setData(routeGeo());
}
function updateMarker(m) {
  if (!S.map || m.lat == null) return;
  if (!m.mk) {
    const el = document.createElement('div');
    el.innerHTML = '<div class="car-cone"></div><div class="car-dot"><span></span></div><div class="car-flag"></div><div class="car-tag"></div>';
    el.addEventListener('click', ev => { ev.stopPropagation(); focusMember(m.id); });
    m.el = el;
    m.mk = new maplibregl.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(S.map);
  }
  m.mk.setLngLat([m.lng, m.lat]);
  const el = m.el, cl = el.classList;
  cl.add('car');
  cl.toggle('me', m.id === me.id);
  cl.toggle('leader', m.id === S.leaderId);
  cl.toggle('talking', !!m.talking);
  cl.toggle('stale', (m.stale || !m.online) && m.id !== me.id);
  for (const k of STATUSES) cl.toggle('st-' + k, (m.st || 'route') === k);
  el.style.setProperty('--c', m.color);
  el.querySelector('.car-dot span').textContent = initial(m.name);
  const tagText = m.id === me.id ? '' : m.name + (m.st && m.st !== 'route' ? ' : ' + statusLabel(m.st) : '');
  const tag = el.querySelector('.car-tag');
  tag.textContent = prefs.lang === 'en' ? tagText.replace(' : ', ': ') : tagText;
  tag.hidden = !tagText;
  el.style.zIndex = m.id === me.id ? 3 : (m.talking ? 2 : 1);
  updateCone(m);
}
function updateCone(m) {
  const c = m.el && m.el.querySelector('.car-cone');
  if (!c) return;
  const on = m.hdg != null && m.spd > 8;
  c.style.display = on ? '' : 'none';
  if (on) c.style.transform = `rotate(${m.hdg - (S.map ? S.map.getBearing() : 0)}deg)`;
}
function followCamera() {
  const p = S.pos;
  if (!S.map || !p || prefs.view === 'speed') return;
  const moving = p.spd > 2.5 && p.hdg != null;
  const opts = {
    center: [p.lng, p.lat], bearing: moving ? p.hdg : S.map.getBearing(), pitch: moving ? 45 : 0,
    offset: [0, Math.round(window.innerHeight * 0.16)], duration: 900, easing: x => x,
  };
  if (S.zoomNext) { opts.zoom = Math.max(S.map.getZoom(), 15.5); S.zoomNext = false; }
  S.map.easeTo(opts);
}
function setFollow(on, labelOnly) {
  S.follow = on;
  const b = $('#btnLocate');
  b.innerHTML = ic(on ? ICON.convoy : ICON.locate, 26);
  b.setAttribute('aria-label', t(on ? 'viewConvoy' : 'followMe'));
  if (labelOnly) return;
  if (on) { S.zoomNext = true; if (S.map && S.pos) followCamera(); }
}
function fitConvoy() {
  if (!S.map) return;
  const b = new maplibregl.LngLatBounds();
  let n = 0;
  for (const m of S.members.values()) if (m.lat != null && (m.online || m.id === me.id)) { b.extend([m.lng, m.lat]); n++; }
  const dest = S.plan.wps[S.plan.wps.length - 1];
  if (dest) { b.extend([dest.lng, dest.lat]); n++; }
  if (!n) return;
  const top = $('.hud-top').offsetHeight + 30, bottom = $('#hudBottom').offsetHeight + 30;
  S.map.fitBounds(b, { padding: { top, bottom, left: 50, right: 50 }, maxZoom: 15, bearing: 0, pitch: 0, duration: 800 });
}
function focusMember(id) {
  const m = S.members.get(id);
  if (!m || m.lat == null || !S.map) return;
  closeSheets();
  if (prefs.view === 'speed') setView('map');
  setFollow(false);
  S.map.flyTo({ center: [m.lng, m.lat], zoom: 15, bearing: 0, pitch: 0, duration: 900 });
}
function renderWaypoints() {
  S.wpMarkers.forEach(mk => mk.remove());
  S.wpMarkers = [];
  if (!S.map) return;
  S.plan.wps.forEach((w, i) => {
    const last = i === S.plan.wps.length - 1;
    const el = document.createElement('div');
    el.className = 'wp' + (last ? ' dest' : '') + (S.passed.has(w.id) ? ' done' : '');
    el.innerHTML = last ? ic(ICON.flag, 16) : String(i + 1);
    S.wpMarkers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([w.lng, w.lat]).addTo(S.map));
  });
}

/* ---------- parcours et guidage ---------- */
const pendingWps = () => S.plan.wps.filter(w => !S.passed.has(w.id));

function setPlan(wps) {
  S.plan = { v: S.plan.v + 1, wps };
  send('plan', { plan: S.plan, by: me.id });
  onPlanChanged();
}
function onPlanChanged() {
  S.arrived = false;
  const dest = S.plan.wps[S.plan.wps.length - 1];
  if (S.trip && dest) S.trip.dest = dest.label;
  renderWaypoints();
  if (S.sheet === 'route') renderRouteSheet();
  if (!pendingWps().length) { S.route = null; renderRoute(); updateNavSign(); return; }
  computeRoute();
}
async function computeRoute() {
  const wps = pendingWps();
  if (!S.pos || !wps.length) { updateNavSign(); return; }
  if (S.routing) { S.routeAgain = true; return; }
  S.nav.last = Date.now();
  const pts = [[S.pos.lat, S.pos.lng], ...wps.map(w => [w.lat, w.lng])];
  const coords = pts.map(p => p[1].toFixed(6) + ',' + p[0].toFixed(6)).join(';');
  S.routing = true;
  updateNavSign();
  try {
    const j = await getJSON(`${CFG.routingUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true`);
    if (j.code !== 'Ok' || !j.routes || !j.routes[0]) throw new Error(j.message || j.code);
    const rt = j.routes[0];
    const line = rt.geometry.coordinates.map(([x, y]) => [y, x]);
    const cum = [0];
    for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + hav(line[i - 1], line[i]));
    const total = cum[cum.length - 1] || rt.distance;
    const steps = [];
    let acc = 0;
    rt.legs.forEach((leg, li) => leg.steps.forEach(s => {
      steps.push({ start: acc, type: s.maneuver.type, mod: s.maneuver.modifier, exit: s.maneuver.exit, final: li === rt.legs.length - 1, road: s.name || s.ref || '' });
      acc += s.distance;
    }));
    const k = acc ? total / acc : 1;
    steps.forEach(s => { s.start *= k; });
    S.route = { coords: line, cum, total, dur: rt.duration, steps, idx: 0, progress: 0 };
    S.nav.off = 0;
    renderRoute();
    navigate();
  } catch (e) {
    toast(t('routeFail'), 'warn', 5000);
  } finally {
    S.routing = false;
    updateNavSign();
    if (S.routeAgain) { S.routeAgain = false; computeRoute(); }
  }
}
function instr(step) {
  const N = NAV[prefs.lang] || NAV.fr, mod = step.mod, dir = N.mod[mod] || '';
  const side = dir && mod !== 'straight' ? ' ' + dir : '';
  const f = (k, v) => { let s = N[k]; for (const key of Object.keys(v || {})) s = s.split('{' + key + '}').join(v[key]); return s; };
  switch (step.type) {
    case 'depart': return N.depart;
    case 'arrive': return step.final ? N.arrive : N.stop;
    case 'turn':
    case 'end of road':
      if (mod === 'uturn') return N.uturn;
      if (mod === 'straight' || !dir) return N.straight;
      return f(step.type === 'end of road' ? 'endroad' : 'turn', { d: dir });
    case 'merge': return f('merge', { s: side });
    case 'on ramp': return f('onramp', { s: side });
    case 'off ramp': return f('offramp', { s: side });
    case 'fork': return f('fork', { d: dir || N.mod.straight });
    case 'roundabout':
    case 'rotary': return step.exit ? f('rb', { n: N.ord(step.exit) }) : N.rbcont;
    case 'roundabout turn': return f('rbturn', { d: dir || N.mod.straight });
    case 'exit roundabout':
    case 'exit rotary': return N.rbexit;
    default: return mod === 'uturn' ? N.uturn : (side ? f('cont', { s: side }) : N.straight);
  }
}
function arrowSVG(step) {
  const W = 'currentColor';
  if (!step || step.type === 'arrive') return `<svg viewBox="0 0 48 48"><path d="M24 44S11 31 11 21a13 13 0 0 1 26 0c0 10-13 23-13 23z" fill="none" stroke="${W}" stroke-width="4"/><circle cx="24" cy="21" r="5" fill="${W}"/></svg>`;
  if (step.mod === 'uturn') return `<svg viewBox="0 0 48 48"><path d="M31 44V20a8 8 0 0 0-16 0v10" fill="none" stroke="${W}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 28l8 11 8-11z" fill="${W}"/></svg>`;
  const A = { straight: 0, 'slight right': 45, right: 90, 'sharp right': 135, 'slight left': -45, left: -90, 'sharp left': -135 };
  const a = (A[step.mod] ?? 0) * RAD;
  const round = /roundabout|rotary/.test(step.type) && step.type.indexOf('exit') !== 0;
  const sx = Math.sin(a), cyy = Math.cos(a);
  const cx = round ? 24 : 24 - 6 * sx, cy = round ? 22 : 25;
  const r0 = round ? 8 : 0, L = round ? 13 : 14;
  const bx = cx + r0 * sx, by = cy - r0 * cyy, ex = cx + L * sx, ey = cy - L * cyy;
  const f = n => n.toFixed(1);
  const tip = [ex + 8 * sx, ey - 8 * cyy], l = [ex + 7 * cyy, ey + 7 * sx], r = [ex - 7 * cyy, ey - 7 * sx];
  const shaft = round ? `M24 44V${cy + r0}` : `M${f(cx)} 44V${cy}L${f(ex)} ${f(ey)}`;
  return `<svg viewBox="0 0 48 48"><g fill="none" stroke="${W}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">`
    + (round ? `<circle cx="${cx}" cy="${cy}" r="${r0}"/><path d="M${f(bx)} ${f(by)}L${f(ex)} ${f(ey)}"/>` : '')
    + `<path d="${shaft}"/></g><path d="M${f(tip[0])} ${f(tip[1])}L${f(l[0])} ${f(l[1])}L${f(r[0])} ${f(r[1])}z" fill="${W}"/></svg>`;
}
function navigate() {
  const rt = S.route;
  if (!rt || !S.pos || rt.coords.length < 2) { updateNavSign(); return; }
  const p = [S.pos.lat, S.pos.lng];
  const scan = (from, to) => {
    let best = { d: Infinity, i: from, t: 0 };
    for (let i = from; i < to; i++) { const pr = projectOnSeg(p, rt.coords[i], rt.coords[i + 1]); if (pr.d < best.d) best = { d: pr.d, i, t: pr.t }; }
    return best;
  };
  const n = rt.coords.length - 1;
  let best = scan(Math.max(0, rt.idx - 3), Math.min(n, rt.idx + 300));
  if (best.d > 150) best = scan(0, n);
  rt.idx = best.i;
  rt.progress = rt.cum[best.i] + best.t * (rt.cum[best.i + 1] - rt.cum[best.i]);
  const tol = Math.max(45, Math.min(110, (S.pos.acc || 20) * 1.5));
  if (best.d > tol) {
    S.nav.off++;
    if (S.nav.off >= 3 && Date.now() - S.nav.last > 12000 && !S.routing) computeRoute();
  } else S.nav.off = 0;
  updateNavSign();
}
function checkWaypoints() {
  if (!S.pos) return;
  const next = pendingWps()[0];
  if (!next) return;
  if (hav([S.pos.lat, S.pos.lng], [next.lat, next.lng]) > 100) return;
  S.passed.add(next.id);
  renderWaypoints();
  if (!pendingWps().length) {
    S.arrived = true; S.route = null; renderRoute();
    toast(t('arrivedToast'), 'ok', 9000);
    beep('msg');
  } else {
    toast(t('stopReached', { label: next.label }), 'ok', 5000);
  }
  updateNavSign();
  if (S.sheet === 'route') renderRouteSheet();
}
function updateNavSign() { updateNavSignInner(); layoutSpeedo(); }
function updateNavSignInner() {
  const sign = $('#navSign'), eta = $('#navEta'), rt = S.route;
  if (!S.plan.wps.length) { sign.hidden = true; eta.hidden = true; return; }
  sign.hidden = false;
  const set = (icon, dist, text, road) => {
    $('.nav-ico', sign).innerHTML = icon; $('.nav-dist', sign).textContent = dist;
    $('.nav-text', sign).textContent = text; $('.nav-road', sign).textContent = road;
  };
  if (S.arrived) { set(arrowSVG(null), '', t('arrived'), t('tapStats')); eta.hidden = true; return; }
  if (!rt) {
    set(arrowSVG({ type: 'turn', mod: 'straight' }), '', S.routing ? t('computing') : (S.pos ? t('routeWait') : t('gpsWait')), S.plan.wps[S.plan.wps.length - 1].label);
    eta.hidden = true; return;
  }
  const prog = rt.progress || 0;
  let i = 0;
  while (i + 1 < rt.steps.length && rt.steps[i + 1].start <= prog + 5) i++;
  const next = rt.steps[i + 1];
  const step = next || rt.steps[rt.steps.length - 1];
  const dist = next ? next.start - prog : rt.total - prog;
  set(arrowSVG(step), fmtDist(Math.max(0, dist)), instr(step), step.road);
  const left = Math.max(0, rt.total - prog);
  const secs = rt.total ? left * rt.dur / rt.total : 0;
  $('#etaTime').textContent = t('eta', { time: fmtClock(Date.now() + secs * 1000) });
  $('#etaLeft').textContent = t('remaining', { dist: fmtDist(left) });
  eta.hidden = false;
}

/* ---------- feuille Parcours ---------- */
function renderRouteSheet() {
  const lead = isLeader(), wps = S.plan.wps;
  let h = '';
  if (!wps.length) {
    h = `<p class="empty">${esc(t(lead ? 'noDestLead' : 'noDest'))}</p>`;
  } else {
    h = '<div class="list">' + wps.map((w, i) => {
      const last = i === wps.length - 1, done = S.passed.has(w.id);
      return `<div class="item${done ? ' done' : ''}">
        <span class="wp${last ? ' dest' : ''}">${last ? ic(ICON.flag, 16) : i + 1}</span>
        <div class="grow"><div class="t">${esc(w.label)}</div><div class="s">${esc(last ? t('dest') : t('stopN', { n: i + 1 }))}${done ? esc(t('passed')) : ''}</div></div>
        ${lead ? `<button class="mini" data-act="up" data-i="${i}" aria-label="${esc(t('up'))}" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="mini" data-act="down" data-i="${i}" aria-label="${esc(t('down'))}" ${last ? 'disabled' : ''}>↓</button>
        <button class="mini" data-act="del" data-i="${i}" aria-label="${esc(t('del'))}">✕</button>` : ''}
      </div>`;
    }).join('') + '</div>';
  }
  $('#wpList').innerHTML = h;
  $('#wpEdit').hidden = !lead;
  let note = lead ? t('noteLead') : t('noteMember', { name: leaderName() });
  if (S.route) note += t('yourRoute', { dist: fmtDist(S.route.total - (S.route.progress || 0)) });
  $('#wpNote').textContent = note;
}
function addWp(wp, asDest) {
  const wps = [...S.plan.wps];
  if (asDest || !wps.length) { if (asDest && wps.length && !S.passed.has(wps[wps.length - 1].id)) wps[wps.length - 1] = wp; else wps.push(wp); }
  else wps.splice(wps.length - 1, 0, wp);
  setPlan(wps);
  toast(t(asDest ? 'destSent' : 'stopSent'), 'ok', 3000);
}
let searchT = null;
async function runSearch(q) {
  const box = $('#results');
  const near = S.pos ? `&lat=${S.pos.lat.toFixed(4)}&lon=${S.pos.lng.toFixed(4)}` : '';
  try {
    const j = await photon('/api/', `q=${encodeURIComponent(q)}&limit=6${near}`);
    if ($('#search').value.trim() !== q) return;
    const fs = (j.features || []).filter(f => f.geometry && f.geometry.coordinates);
    if (!fs.length) { box.innerHTML = `<p class="s">${esc(t('noResult'))}</p>`; return; }
    box.innerHTML = fs.map((f, i) => {
      const L = placeLabel(f.properties || {});
      return `<div class="item"><div class="grow"><div class="t">${esc(L.title)}</div><div class="s">${esc(L.sub)}</div></div>
        <button class="mini wide" data-res="${i}" data-as="stop">${esc(t('asStop'))}</button><button class="mini wide go" data-res="${i}" data-as="dest">${esc(t('asDest'))}</button></div>`;
    }).join('');
    box._features = fs;
  } catch (e) {
    box.innerHTML = `<p class="s">${esc(t('searchFail'))}</p>`;
  }
}
async function onMapClick(e) {
  if (!S.pick) return;
  S.pick = false; $('#pickBar').hidden = true;
  const { lat, lng } = e.lngLat;
  let label = t('mapPoint');
  try {
    const j = await photon('/reverse', `lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}`);
    const f = j.features && j.features[0];
    if (f) label = placeLabel(f.properties || {}).title;
  } catch (err) { /* garde le libellé par défaut */ }
  addWp({ id: rid(), lat, lng, label }, false);
  openSheet('route');
}

/* ---------- talkie-walkie (WebRTC en maillage) ---------- */
function rtcSend(to, d) { send('rtc', { from: me.id, to, d }); }
function newPC(id) {
  closePeer(id);
  const pc = new RTCPeerConnection({ iceServers: CFG.iceServers });
  const p = { id, pc, audio: null };
  S.peers.set(id, p);
  pc.onicecandidate = e => { if (e.candidate) rtcSend(id, { cand: e.candidate.toJSON() }); };
  pc.ontrack = e => playRemote(p, (e.streams && e.streams[0]) || new MediaStream([e.track]));
  pc.onconnectionstatechange = () => {
    const st = pc.connectionState;
    if (st === 'failed') setTimeout(() => { if (S.peers.get(id) === p && S.online.has(id)) resetPeer(id); }, 2000);
    if (st === 'disconnected') setTimeout(() => { if (S.peers.get(id) === p && pc.connectionState === 'disconnected' && S.online.has(id)) resetPeer(id); }, 8000);
    if (S.sheet === 'members') renderMembers();
  };
  return p;
}
function playRemote(p, stream) {
  if (!p.audio) {
    p.audio = document.createElement('audio');
    p.audio.autoplay = true;
    p.audio.setAttribute('playsinline', '');
    $('#audios').appendChild(p.audio);
  }
  p.audio.srcObject = stream;
  p.audio.play().catch(() => { $('#audioChip').hidden = false; });
}
async function callPeer(id) {
  const p = newPC(id);
  try {
    if (S.localStream) S.localStream.getAudioTracks().forEach(tr => p.pc.addTrack(tr, S.localStream));
    else p.pc.addTransceiver('audio', { direction: 'recvonly' });
    await p.pc.setLocalDescription(await p.pc.createOffer());
    const d = p.pc.localDescription;
    rtcSend(id, { sdp: { type: d.type, sdp: d.sdp } });
  } catch (e) { console.warn('offre', e); }
}
async function onRtc({ from, to, d }) {
  if (to !== me.id || !from || !d || !S.code) return;
  try {
    if (d.reset) { closePeer(from); if (me.id < from) setTimeout(() => callPeer(from), 400); return; }
    if (d.sdp && d.sdp.type === 'offer') {
      const p = newPC(from);
      await p.pc.setRemoteDescription(d.sdp);
      const track = S.localStream && S.localStream.getAudioTracks()[0];
      if (track) {
        const tr = p.pc.getTransceivers().find(x => x.receiver && x.receiver.track && x.receiver.track.kind === 'audio');
        if (tr) { tr.direction = 'sendrecv'; await tr.sender.replaceTrack(track); }
      }
      await p.pc.setLocalDescription(await p.pc.createAnswer());
      const ld = p.pc.localDescription;
      rtcSend(from, { sdp: { type: ld.type, sdp: ld.sdp } });
      flushCands(from);
    } else if (d.sdp && d.sdp.type === 'answer') {
      const p = S.peers.get(from);
      if (p && p.pc.signalingState === 'have-local-offer') { await p.pc.setRemoteDescription(d.sdp); flushCands(from); }
    } else if (d.cand) {
      const p = S.peers.get(from);
      if (p && p.pc.remoteDescription) await p.pc.addIceCandidate(d.cand).catch(() => {});
      else { const q = S.pendingCands.get(from) || []; q.push(d.cand); S.pendingCands.set(from, q); }
    }
  } catch (e) { console.warn('rtc', e); }
}
function flushCands(id) {
  const p = S.peers.get(id), q = S.pendingCands.get(id);
  S.pendingCands.delete(id);
  if (p && q) q.forEach(c => p.pc.addIceCandidate(c).catch(() => {}));
}
function closePeer(id) {
  const p = S.peers.get(id);
  if (p) { try { p.pc.close(); } catch (e) { /* ignoré */ } if (p.audio) p.audio.remove(); S.peers.delete(id); }
  S.pendingCands.delete(id);
}
function resetPeer(id) {
  closePeer(id);
  if (me.id < id) callPeer(id); else rtcSend(id, { reset: true });
}
function checkPeers() {
  for (const id of S.online) {
    if (id === me.id) continue;
    const p = S.peers.get(id);
    const st = p && p.pc.connectionState;
    if (!p ? me.id < id : ['failed', 'closed', 'disconnected'].includes(st)) resetPeer(id);
  }
}
function talkStart() {
  if (S.talking || !S.localStream) return;
  S.talking = true;
  S.localStream.getAudioTracks().forEach(tr => { tr.enabled = true; });
  send('talk', { id: me.id, on: true });
  beep('start');
  clearTimeout(S.talkTimer);
  S.talkTimer = setTimeout(talkStop, 60000);
  updatePTT();
}
function talkStop() {
  if (!S.talking) return;
  S.talking = false;
  clearTimeout(S.talkTimer);
  if (S.localStream) S.localStream.getAudioTracks().forEach(tr => { tr.enabled = false; });
  send('talk', { id: me.id, on: false });
  beep('end');
  updatePTT();
}
function updatePTT() {
  const b = $('#ptt'), l = $('#pttLabel');
  b.classList.toggle('nomic', !S.localStream);
  b.classList.toggle('live', S.talking);
  if (!S.localStream) l.textContent = t('micOn');
  else if (prefs.talkMode === 'hold') l.textContent = t(S.talking ? 'live' : 'holdTalk');
  else l.textContent = t(S.talking ? 'tapStop' : 'tapTalk');
}
function updateTalkBar() {
  const ts = [...S.members.values()].filter(m => m.talking && m.id !== me.id);
  const bar = $('#talkBar');
  bar.hidden = !ts.length;
  if (ts.length) $('.who', bar).textContent = ts.length === 1 ? t('talks1', { name: ts[0].name }) : t('talksN', { names: ts.map(m => m.name).join(t('and')) });
}

/* ---------- alertes rapides ---------- */
let sosArmT = null;
function sendQuick(kind) {
  const q = QUICK[kind];
  if (!q) return;
  if (kind === 'sos') {
    const b = $('#btnSOS');
    if (!b.classList.contains('confirm')) {
      b.classList.add('confirm'); b.textContent = t('qSosConfirm');
      clearTimeout(sosArmT);
      sosArmT = setTimeout(() => { b.classList.remove('confirm'); b.textContent = t('qSos'); }, 4000);
      return;
    }
    clearTimeout(sosArmT); b.classList.remove('confirm'); b.textContent = t('qSos');
  }
  if (q.status !== null) S.manual = q.status;
  S.movingSince = null;
  send('msg', { id: me.id, k: kind, la: S.pos ? +S.pos.lat.toFixed(5) : null, ln: S.pos ? +S.pos.lng.toFixed(5) : null });
  const self = member(me.id); self.st = myStatus(); updateMarker(self);
  maybeSendPos(true);
  closeSheets();
  toast(t('sent', { text: t('q_' + kind) }), 'ok', 3000);
}
function showSOS(m, la, ln) {
  const o = $('#sos');
  $('#sosTitle').textContent = t('sosHas', { name: m.name });
  const d = (S.pos && la != null) ? hav([S.pos.lat, S.pos.lng], [la, ln]) : null;
  $('#sosWhere').textContent = d != null ? t('sosDist', { d: fmtDist(d) }) : '';
  o.dataset.id = m.id;
  o.classList.add('on');
}

/* ---------- bandeau et liste des voitures ---------- */
function scheduleStrip() { if (!S.stripT) S.stripT = setTimeout(() => { S.stripT = null; renderStrip(); }, 800); }
function memberMeta(m) {
  if (!m.online) return t('offline');
  if (m.stale) return t('lostSignal');
  const parts = [m.st && m.st !== 'route' ? statusLabel(m.st) : Math.round(m.spd || 0) + ' km/h'];
  if (S.pos && m.lat != null) parts.push(t('at', { d: fmtDist(hav([S.pos.lat, S.pos.lng], [m.lat, m.lng])) }));
  return parts.join(', ');
}
function sortedOthers() {
  return [...S.members.values()].filter(m => m.id !== me.id && (m.online || m.lat != null)).sort((a, b) =>
    (b.online - a.online) || ((b.id === S.leaderId) - (a.id === S.leaderId)) ||
    (S.pos && a.lat != null && b.lat != null ? hav([S.pos.lat, S.pos.lng], [a.lat, a.lng]) - hav([S.pos.lat, S.pos.lng], [b.lat, b.lng]) : 0));
}
function renderStrip() {
  const el = $('#strip');
  if (!S.code) { el.innerHTML = ''; return; }
  const others = sortedOthers();
  if (!others.length) { el.innerHTML = `<div class="mchip wait">${esc(t('waiting'))} <b>${esc(S.code)}</b></div>`; return; }
  el.innerHTML = others.map(m => `<button class="mchip${m.online && !m.stale ? '' : ' off'}" data-id="${esc(m.id)}">
    <span class="av" style="--c:${esc(m.color)}">${esc(initial(m.name))}</span>
    <span style="min-width:0"><span class="nm">${esc(m.name)}${m.id === S.leaderId ? `<span class="lead-badge">${esc(t('leader'))}</span>` : ''}</span><span class="meta">${esc(memberMeta(m))}</span></span>
  </button>`).join('');
}
function renderMembers() {
  const list = [member(me.id), ...sortedOthers()];
  const lead = isLeader();
  const audio = m => {
    if (m.id === me.id) return t(S.localStream ? 'micReady' : 'micOff');
    const p = S.peers.get(m.id), st = p && p.pc.connectionState;
    return st === 'connected' ? t('audioOk') : st === 'failed' ? t('audioFail') : m.online ? t('audioWait') : '';
  };
  $('#membersList').innerHTML = list.map(m => `<div class="item">
    <span class="av" style="--c:${esc(m.color)}">${esc(initial(m.name))}</span>
    <div class="grow"><div class="t">${esc(m.name)}${m.id === me.id ? esc(t('you')) : ''}${m.id === S.leaderId ? `<span class="lead-badge">${esc(t('leader'))}</span>` : ''}</div>
    <div class="s">${esc(m.id === me.id ? statusLabel(myStatus()) + ', ' + Math.round(m.spd || 0) + ' km/h' : memberMeta(m))}</div>
    <div class="s">${esc(audio(m))}</div></div>
    ${m.lat != null ? `<button class="mini wide" data-see="${esc(m.id)}">${esc(t('see'))}</button>` : ''}
    ${lead && m.id !== me.id && m.online ? `<button class="mini wide" data-lead="${esc(m.id)}">${esc(t('makeLeader'))}</button>` : ''}
  </div>`).join('') + `<p class="s">${esc(t('currentLeader', { name: leaderName() }))}</p>`;
}

/* ---------- statistiques et fin de trajet ---------- */
function statsRows() {
  const T = S.trip || { dist: 0, moving: 0, max: 0 };
  const rows = [{ id: me.id, name: me.name, color: me.color, dist: T.dist, mv: T.moving, mx: T.max, me: true }];
  for (const m of S.members.values()) {
    if (m.id === me.id || m.lat == null) continue;
    rows.push({ id: m.id, name: m.name, color: m.color, dist: m.stats.dist, mv: m.stats.mv, mx: m.stats.mx, me: false });
  }
  return rows;
}
const avgOf = r => r.mv > 60000 ? r.dist / (r.mv / 1000) : 0;
function rankTable(rows) {
  const sorted = [...rows].sort((a, b) => b.dist - a.dist);
  return `<div class="table-wrap"><table class="rank"><thead><tr><th>${esc(t('car'))}</th><th>${esc(t('distance'))}</th><th>${esc(t('driving'))}</th><th>${esc(t('avgShort'))}</th><th>${esc(t('max'))}</th></tr></thead><tbody>`
    + sorted.map(r => `<tr class="${r.me ? 'me' : ''}"><td><span class="who"><i style="--c:${esc(r.color)}"></i>${esc(r.name)}</span></td>
      <td>${fmtDist(r.dist)}</td><td>${fmtDur(r.mv)}</td><td>${avgOf(r) ? fmtKmh(avgOf(r)) : '–'}</td><td>${r.mx ? fmtKmh(r.mx) : '–'}</td></tr>`).join('')
    + '</tbody></table></div>';
}
function bigStats(r, totalMs) {
  return `<div class="big-stats">
    <div class="stat"><div class="v">${fmtDist(r.dist)}</div><div class="l">${esc(t('distance'))}</div></div>
    <div class="stat"><div class="v">${fmtDur(r.mv)}</div><div class="l">${esc(totalMs ? t('drivingOf', { t: fmtDur(totalMs) }) : t('drivingTime'))}</div></div>
    <div class="stat"><div class="v">${avgOf(r) ? fmtKmh(avgOf(r)) : '–'}</div><div class="l">${esc(t('avgMoving'))}</div></div>
    <div class="stat"><div class="v">${r.mx ? fmtKmh(r.mx) : '–'}</div><div class="l">${esc(t('maxSpeed'))}</div></div>
  </div>`;
}
function renderEnd() {
  const T = S.trip;
  const rows = statsRows();
  $('#endBody').innerHTML = bigStats(rows[0], T ? Date.now() - T.start : 0)
    + (rows.length > 1 ? `<div class="field-label">${esc(t('rankTitle'))}</div>` + rankTable(rows) : '')
    + `<button class="btn btn-primary" id="endSave">${esc(t('saveQuit'))}</button>`
    + (isLeader() && S.online.size > 1 ? `<button class="btn btn-amber" id="endAll">${esc(t('endAll'))}</button>` : '')
    + `<button class="btn btn-ghost" data-close>${esc(t('keepDriving'))}</button>`;
}
async function saveTripRecord(trip, rows) {
  if (!trip) return false;
  const mine = rows.find(r => r.me) || { dist: trip.dist };
  if ((mine.dist || 0) < 300) return false;
  const rec = {
    id: trip.id, code: trip.code, start: trip.start, end: trip.savedEnd || Date.now(), dest: trip.dest || '',
    tracks: trip.tracks, names: trip.names, colors: trip.colors, stats: rows,
  };
  try { await DB.putTrip(rec); return true; } catch (e) { return false; }
}
async function saveCurrent() {
  if (!S.trip || !S.code) return;
  const trip = Object.assign({}, S.trip, { last: null, savedEnd: Date.now() });
  try {
    await DB.setKV('current', { code: S.code, trip, rows: statsRows(), plan: S.plan, passed: [...S.passed], leaderId: S.leaderId, leaderSeq: S.leaderSeq, savedAt: Date.now() });
  } catch (e) { /* stockage indisponible */ }
}
async function finish(saveIt) {
  let saved = false;
  if (saveIt) saved = await saveTripRecord(Object.assign({}, S.trip, { savedEnd: Date.now() }), statsRows());
  try { await DB.delKV('current'); } catch (e) { /* ignoré */ }
  leave();
  if (saveIt) {
    if (saved) openHistory(); else { show('home'); renderHome(); homeErr(t('tooShort')); }
  }
}
function leave() {
  talkStop();
  for (const id of [...S.peers.keys()]) closePeer(id);
  try { if (S.channel) S.sb.removeChannel(S.channel); } catch (e) { /* ignoré */ }
  S.channel = null; setConn(false);
  stopGeo();
  if (S.wake) { S.wake.release().catch(() => {}); S.wake = null; }
  if (S.localStream) { S.localStream.getTracks().forEach(tr => tr.stop()); S.localStream = null; }
  S.timers.forEach(clearInterval); S.timers = [];
  for (const m of S.members.values()) if (m.mk) m.mk.remove();
  S.members.clear(); S.online = new Set(); S.joinedAt = {};
  S.wpMarkers.forEach(mk => mk.remove()); S.wpMarkers = [];
  Object.assign(S, { code: null, trip: null, route: null, plan: { v: 0, wps: [] }, passed: new Set(), leaderId: null, leaderSeq: 0,
    pos: null, manual: '', arrived: false, alerts: { lag: {}, leaderStop: false }, lastSentT: 0, lastSent: null, pick: false });
  renderRoute(); closeSheets();
  $('#navSign').hidden = true; $('#navEta').hidden = true; $('#talkBar').hidden = true; $('#toasts').innerHTML = '';
  history.replaceState(null, '', location.pathname);
  show('home'); renderHome();
}

/* ---------- boucle périodique ---------- */
function tick() {
  const now = Date.now();
  let talkChanged = false;
  for (const m of S.members.values()) {
    if (m.id === me.id) continue;
    if (m.talking && m.talkUntil < now) { m.talking = false; talkChanged = true; updateMarker(m); }
    const stale = m.online && m.t && now - m.t > 45000;
    if (stale !== m.stale) { m.stale = stale; updateMarker(m); }
  }
  if (talkChanged) updateTalkBar();

  const L = S.leaderId && S.members.get(S.leaderId);
  if (L && L.lat != null && L.online) {
    for (const m of S.members.values()) {
      if (m.id === L.id || m.lat == null || (!m.online && m.id !== me.id)) continue;
      const d = hav([L.lat, L.lng], [m.lat, m.lng]);
      if (d > prefs.lagKm * 1000) {
        if (!S.alerts.lag[m.id]) {
          S.alerts.lag[m.id] = true;
          toast(m.id === me.id ? t('lagYou', { d: fmtDist(d) }) : t('lagOther', { name: m.name, d: fmtDist(d) }), 'warn', 8000);
          beep('warn');
        }
      } else if (d < prefs.lagKm * 600) delete S.alerts.lag[m.id];
    }
    if (L.id !== me.id && S.plan.wps.length && !S.arrived) {
      if ((L.spd || 0) < 3) {
        if (!L.stopSince) L.stopSince = now;
        if (now - L.stopSince > 60000 && !S.alerts.leaderStop) { S.alerts.leaderStop = true; toast(t('leaderStopped', { name: L.name }), 'warn', 8000); beep('warn'); }
      } else { L.stopSince = null; S.alerts.leaderStop = false; }
    }
  }
  checkLeader();
  maybeSendPos(false);
  renderStrip();
  if (S.sheet === 'members') renderMembers();
  if (S.route) updateNavSign();
  updateSpeedo();
}

/* ---------- compteur (0 à 300 km/h) ---------- */
const GAUGE = { cx: 150, cy: 140, r: 118, max: 300, a0: 135, sweep: 270, step: 10, mid: 50, lbl: 50 };
const polar = (r, deg) => [GAUGE.cx + r * Math.cos(deg * RAD), GAUGE.cy + r * Math.sin(deg * RAD)];
let gaugeRaf = null;
function buildGauge() {
  const G = GAUGE, f = n => n.toFixed(1);
  const [sx, sy] = polar(G.r, G.a0), [ex, ey] = polar(G.r, G.a0 + G.sweep);
  const arc = `M${f(sx)} ${f(sy)}A${G.r} ${G.r} 0 1 1 ${f(ex)} ${f(ey)}`;
  G.len = G.r * G.sweep * RAD;
  let ticks = '';
  for (let v = 0; v <= G.max; v += G.step) {
    const a = G.a0 + v / G.max * G.sweep;
    const major = v % G.lbl === 0 || v === G.max, mid = !major && v % G.mid === 0;
    const [x1, y1] = polar(101, a), [x2, y2] = polar(major ? 88 : mid ? 92 : 95, a);
    ticks += `<line class="g-tick${major ? ' major' : mid ? ' mid' : ''}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
    if (major) { const [lx, ly] = polar(74, a); ticks += `<text class="g-lbl" x="${f(lx)}" y="${f(ly + 4)}" text-anchor="middle">${v}</text>`; }
  }
  $('#gaugeSvg').innerHTML = `<path class="g-track" d="${arc}"/>
    <path class="g-val" id="gVal" d="${arc}" stroke-dasharray="${f(G.len)}" stroke-dashoffset="${f(G.len)}"/>
    ${ticks}<circle class="g-dot" id="gDot" r="9" cx="${f(sx)}" cy="${f(sy)}"/>
    <text class="g-num" id="gNum" x="150" y="160" text-anchor="middle">–</text>
    <text class="g-unit" x="150" y="186" text-anchor="middle">km/h</text>
    <text class="g-dir" id="gDir" x="150" y="232" text-anchor="middle"></text>`;
}
function drawGauge(v) {
  const G = GAUGE, frac = Math.max(0, Math.min(1, v / G.max));
  const val = $('#gVal'), dot = $('#gDot');
  if (!val) return;
  val.setAttribute('stroke-dashoffset', (G.len * (1 - frac)).toFixed(1));
  val.style.opacity = frac > 0.002 ? 1 : 0;
  const [x, y] = polar(G.r, G.a0 + frac * G.sweep);
  dot.setAttribute('cx', x.toFixed(1)); dot.setAttribute('cy', y.toFixed(1));
  $('#gNum').textContent = S.pos ? String(Math.round(v)) : '–';
}
function gaugeLoop() {
  gaugeRaf = null;
  if (prefs.view !== 'speed') return;
  const tgt = S.spTarget || 0, cur = S.spDisp || 0, d = tgt - cur;
  S.spDisp = Math.abs(d) < 0.3 ? tgt : cur + d * 0.12;
  drawGauge(S.spDisp);
  if (S.spDisp !== tgt) gaugeRaf = requestAnimationFrame(gaugeLoop);
}
function updateSpeedo() {
  if (prefs.view !== 'speed' || !S.code) return;
  const p = S.pos;
  S.spTarget = p && Date.now() - p.t < 8000 ? p.spd * 3.6 : 0;
  if (!gaugeRaf) gaugeRaf = requestAnimationFrame(gaugeLoop);
  const dirs = DIRS[prefs.lang] || DIRS.fr;
  $('#gDir').textContent = p && p.hdg != null && p.spd > 1 ? t('heading', { d: dirs[Math.round(p.hdg / 45) % 8] }) : '';
  const T = S.trip || { dist: 0, moving: 0, max: 0 };
  const avg = T.moving > 60000 ? T.dist / (T.moving / 1000) : 0;
  let lead = '–';
  if (isLeader()) lead = t('itsYou');
  else { const L = S.leaderId && S.members.get(S.leaderId); if (L && L.lat != null && p) lead = fmtDist(hav([p.lat, p.lng], [L.lat, L.lng])); }
  const tiles = [
    [fmtDist(T.dist), t('distance'), ''], [fmtDur(T.moving), t('driving'), ''], [avg ? fmtKmh(avg) : '–', t('average'), ''],
    [lead, t('gapLeader'), 'opt'], [T.max ? fmtKmh(T.max) : '–', t('max'), 'opt'], [p && p.alt != null ? Math.round(p.alt) + ' m' : '–', t('altitude'), 'opt'],
  ];
  $('#spStats').innerHTML = tiles.map(([v, l, c]) => `<div class="sp-tile ${c}"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`).join('');
}
function layoutSpeedo() {
  const sp = $('#speedo');
  if (!sp || sp.hidden) return;
  const main = $('#main').getBoundingClientRect(), row = $('#topRow').getBoundingClientRect(), ctr = $('.controls').getBoundingClientRect();
  sp.style.setProperty('--sp-top', Math.round(row.bottom - main.top + 10) + 'px');
  sp.style.setProperty('--sp-bottom', Math.round(main.bottom - ctr.top + 10) + 'px');
}
function setView(v) {
  prefs.view = v === 'speed' ? 'speed' : 'map';
  savePrefs();
  const sp = prefs.view === 'speed';
  $('#main').classList.toggle('view-speed', sp);
  $('#speedo').hidden = !sp;
  $$('#viewTabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === prefs.view)));
  if (sp) { layoutSpeedo(); S.spDisp = 0; updateSpeedo(); }
  else if (S.map) { S.map.resize(); if (S.follow) followCamera(); renderStrip(); }
}

/* ---------- feuilles et réglages ---------- */
function openSheet(id) {
  closeSheets();
  if (id === 'route') renderRouteSheet();
  if (id === 'members') renderMembers();
  if (id === 'end') renderEnd();
  if (id === 'settings') syncSettings();
  $('#scrim').classList.add('open');
  $('#sheet-' + id).classList.add('open');
  S.sheet = id;
}
function closeSheets() {
  $$('.sheet.open').forEach(s => s.classList.remove('open'));
  $('#scrim').classList.remove('open');
  S.sheet = null;
}
function syncSettings() {
  $$('#sheet-settings .seg').forEach(seg => {
    const k = seg.dataset.pref;
    $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(prefs[k]))));
  });
  $('#themeGrid').innerHTML = Object.keys(THEMES).map(k => {
    const [pb, ps, pa, pi] = THEMES[k].prev;
    return `<button class="theme-tile" data-theme-pick="${k}" aria-pressed="${k === prefs.theme}">
      <span class="tp" style="--pb:${pb};--ps:${ps};--pa:${pa};--pi:${pi}"><i></i><b></b></span>${esc(t('th_' + k))}</button>`;
  }).join('');
  $('#themeNote').textContent = t('thn_' + prefs.theme);
  $('#sessOnly').hidden = !S.code;
}
function setPref(k, v) {
  if (prefs[k] === v) return;
  prefs[k] = v; savePrefs();
  if (k === 'talkMode') { talkStop(); updatePTT(); }
  if (k === 'mapTheme' && S.map) S.map.setStyle(STYLES[v], { diff: false });
  if (k === 'lagKm') S.alerts.lag = {};
  if (k === 'lang') applyLang();
  if (k === 'theme') {
    applyTheme();
    const m = THEMES[v].map;
    if (prefs.mapTheme !== m) setPref('mapTheme', m);
  }
  syncSettings();
}
async function shareCode() {
  if (!S.code) return;
  const url = location.origin + location.pathname + '?c=' + S.code;
  const text = t('shareText', { code: S.code });
  if (navigator.share) { try { await navigator.share({ title: 'PocketConvoy', text, url }); } catch (e) { /* annulé */ } return; }
  try { await navigator.clipboard.writeText(url); toast(t('linkCopied'), 'ok', 3000); }
  catch (e) { toast(t('codeIs', { code: S.code }), 'info', 6000); }
}

/* ---------- historique et replay ---------- */
let RP = null;
async function openHistory() {
  show('history');
  const list = $('#histList');
  let trips = [];
  try { trips = await DB.allTrips(); } catch (e) { /* ignoré */ }
  trips.sort((a, b) => b.start - a.start);
  if (!trips.length) { list.innerHTML = `<p class="empty">${esc(t('noTrips'))}</p>`; return; }
  list.innerHTML = trips.map(tr => {
    const mine = tr.stats.find(r => r.me) || {};
    const n = tr.stats.length;
    return `<button class="item" data-trip="${esc(tr.id)}"><div class="grow">
      <div class="t">${esc(tr.dest || t('convoyCode', { code: tr.code }))}</div>
      <div class="s">${esc(fmtDate(tr.start))}</div>
      <div class="s">${esc(t('tripLine', { dist: fmtDist(mine.dist || 0), dur: fmtDur(tr.end - tr.start), cars: n > 1 ? t('carsN', { n }) : t('cars1') }))}</div>
    </div><span class="chev" aria-hidden="true">›</span></button>`;
  }).join('');
}
async function openTrip(id) {
  let tr = null;
  try { tr = (await DB.allTrips()).find(x => x.id === id); } catch (e) { /* ignoré */ }
  if (!tr) return;
  show('trip');
  $('#tripTitle').textContent = tr.dest || t('convoyCode', { code: tr.code });
  const mine = tr.stats.find(r => r.me) || { dist: 0, mv: 0, mx: 0 };
  $('#tripStats').innerHTML = `<p class="s">${esc(t('fromTo', { date: fmtDate(tr.start), a: fmtClock(tr.start), b: fmtClock(tr.end) }))}</p>`
    + bigStats(mine, 0)
    + (tr.stats.length > 1 ? `<div class="field-label">${esc(t('rankTitle'))}</div>` + rankTable(tr.stats) : '')
    + `<button class="btn btn-ghost btn-text-danger" data-deltrip="${esc(tr.id)}">${ic(ICON.trash, 20)}${esc(t('delTrip'))}</button>`;

  if (RP && RP.map) RP.map.remove();
  const dur = Math.max(1, Math.round((tr.end - tr.start) / 1000));
  const speeds = [10, 30, 60, 120, 300, 600];
  const target = dur / 60;
  const speed = speeds.reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
  const map = new maplibregl.Map({ container: 'tripMap', style: STYLES[prefs.mapTheme], center: [8.23, 46.8], zoom: 7, attributionControl: { compact: true }, dragRotate: false });
  map.touchZoomRotate.disableRotation();
  RP = { map, t: tr, T: 0, dur, playing: false, markers: {}, speed, speeds, raf: null, lastTs: 0 };
  $('#rpSlider').max = dur; $('#rpSlider').value = 0;
  updatePlayBtn();
  map.on('load', () => {
    const b = new maplibregl.LngLatBounds();
    let any = false;
    for (const [mid, track] of Object.entries(tr.tracks)) {
      if (!track || track.length < 2) continue;
      any = true;
      const col = tr.colors[mid] || '#8899A6';
      map.addSource('tr-' + mid, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: track.map(p => [p[2], p[1]]) } } });
      map.addLayer({ id: 'tr-' + mid, type: 'line', source: 'tr-' + mid, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': col, 'line-width': 4, 'line-opacity': 0.85 } });
      track.forEach(p => b.extend([p[2], p[1]]));
      const el = document.createElement('div');
      el.className = 'car rp';
      el.style.setProperty('--c', col);
      el.innerHTML = `<div class="car-dot"><span>${esc(initial(tr.names[mid]))}</span></div>`;
      RP.markers[mid] = new maplibregl.Marker({ element: el }).setLngLat([track[0][2], track[0][1]]).addTo(map);
    }
    if (any) map.fitBounds(b, { padding: 40, duration: 0 });
    setReplay(0);
  });
}
function interp(tr, T) {
  if (T <= tr[0][0]) return [tr[0][1], tr[0][2]];
  const L = tr[tr.length - 1];
  if (T >= L[0]) return [L[1], L[2]];
  let lo = 0, hi = tr.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tr[mid][0] <= T) lo = mid; else hi = mid; }
  const a = tr[lo], b = tr[hi], f = (T - a[0]) / ((b[0] - a[0]) || 1);
  return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
function setReplay(T) {
  if (!RP) return;
  RP.T = T;
  for (const [mid, mk] of Object.entries(RP.markers)) {
    const tr = RP.t.tracks[mid];
    const p = interp(tr, T);
    mk.setLngLat([p[1], p[0]]);
    mk.getElement().classList.toggle('stale', T < tr[0][0] || T > tr[tr.length - 1][0]);
  }
  $('#rpSlider').value = Math.round(T);
  $('#rpClock').textContent = fmtClock(RP.t.start + T * 1000);
}
function rpLoop(ts) {
  if (!RP || !RP.playing) return;
  const dt = RP.lastTs ? (ts - RP.lastTs) / 1000 : 0;
  RP.lastTs = ts;
  let T = RP.T + dt * RP.speed;
  if (T >= RP.dur) { T = RP.dur; RP.playing = false; updatePlayBtn(); }
  setReplay(T);
  if (RP.playing) RP.raf = requestAnimationFrame(rpLoop);
}
function updatePlayBtn() {
  if (!RP) return;
  $('#rpPlay').innerHTML = ic(RP.playing ? ICON.pause : ICON.play, 22);
  $('#rpPlay').setAttribute('aria-label', t(RP.playing ? 'pause' : 'play'));
  $('#rpSpeed').textContent = '×' + RP.speed;
}
function closeTrip() {
  if (RP) { RP.playing = false; cancelAnimationFrame(RP.raf); if (RP.map) RP.map.remove(); RP = null; }
  openHistory();
}

/* ---------- branchements ---------- */
function bind() {
  $('#swatches').addEventListener('click', e => {
    const b = e.target.closest('.swatch');
    if (!b) return;
    me.color = b.dataset.c; store.set('color', me.color);
    $$('.swatch').forEach(s => s.setAttribute('aria-pressed', String(s === b)));
  });
  $('#code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); });
  $('#btnCreate').addEventListener('click', () => start(newCode(), true));
  $('#btnJoin').addEventListener('click', () => {
    const c = $('#code').value.trim();
    if (c.length !== 6) { homeErr(t('errCode')); $('#code').focus(); return; }
    start(c, false);
  });
  $('#code').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnJoin').click(); });
  $('#btnHistory').addEventListener('click', () => openHistory());
  $('#btnHomeSettings').addEventListener('click', () => openSheet('settings'));
  $('#btnResume').addEventListener('click', () => { const c = S.resumeData; if (c) start(c.code, false, c); });
  $('#btnResumeEnd').addEventListener('click', async () => {
    const c = S.resumeData;
    if (!c) return;
    const ok = await saveTripRecord(c.trip, c.rows || []);
    await DB.delKV('current');
    S.resumeData = null;
    if (ok) openHistory(); else { renderHome(); homeErr(t('tooShort')); }
  });

  $('#main').addEventListener('pointerdown', () => { if (S.ac && S.ac.state !== 'running') unlockAudio(); }, { capture: true });
  $('#audioChip').addEventListener('click', unlockAudio);
  $('#codeChip').addEventListener('click', shareCode);
  $('#btnShare').addEventListener('click', shareCode);
  $('#viewTabs').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
  $('#btnLocate').addEventListener('click', () => { if (S.follow) { setFollow(false); fitConvoy(); } else setFollow(true); });
  $('#navSign').addEventListener('click', () => openSheet(S.arrived ? 'end' : 'route'));
  $$('[data-sheet]').forEach(b => b.addEventListener('click', () => openSheet(b.dataset.sheet)));
  $('#scrim').addEventListener('click', closeSheets);
  document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheets(); });
  window.addEventListener('resize', () => setTimeout(layoutSpeedo, 120));
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => layoutSpeedo()); ro.observe($('#topRow')); ro.observe($('.controls')); }

  const ptt = $('#ptt');
  ptt.addEventListener('contextmenu', e => e.preventDefault());
  ptt.addEventListener('pointerdown', e => {
    e.preventDefault();
    unlockAudio();
    S.pttArmed = !!S.localStream;
    if (!S.localStream) { ensureMic(true); return; }
    if (prefs.talkMode === 'hold') { try { ptt.setPointerCapture(e.pointerId); } catch (err) { /* ignoré */ } talkStart(); }
  });
  ptt.addEventListener('pointerup', () => {
    if (!S.pttArmed) return;
    if (prefs.talkMode === 'hold') talkStop();
    else if (S.talking) talkStop(); else talkStart();
  });
  ptt.addEventListener('pointercancel', () => { if (prefs.talkMode === 'hold') talkStop(); });
  ptt.addEventListener('lostpointercapture', () => { if (prefs.talkMode === 'hold') talkStop(); });

  $('#wpList').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || !isLeader()) return;
    const i = +b.dataset.i, wps = [...S.plan.wps];
    if (b.dataset.act === 'del') wps.splice(i, 1);
    if (b.dataset.act === 'up' && i > 0) [wps[i - 1], wps[i]] = [wps[i], wps[i - 1]];
    if (b.dataset.act === 'down' && i < wps.length - 1) [wps[i + 1], wps[i]] = [wps[i], wps[i + 1]];
    setPlan(wps);
  });
  $('#search').addEventListener('input', e => {
    clearTimeout(searchT);
    const q = e.target.value.trim();
    if (q.length < 3) { $('#results').innerHTML = ''; return; }
    searchT = setTimeout(() => runSearch(q), 450);
  });
  $('#results').addEventListener('click', e => {
    const b = e.target.closest('[data-res]');
    if (!b) return;
    const f = $('#results')._features[+b.dataset.res];
    const [lng, lat] = f.geometry.coordinates;
    addWp({ id: rid(), lat, lng, label: placeLabel(f.properties || {}).title }, b.dataset.as === 'dest');
    $('#search').value = ''; $('#results').innerHTML = '';
  });
  $('#btnPick').addEventListener('click', () => {
    closeSheets(); S.pick = true; $('#pickBar').hidden = false; setFollow(false);
    if (prefs.view === 'speed') setView('map');
  });
  $('#pickCancel').addEventListener('click', () => { S.pick = false; $('#pickBar').hidden = true; });

  $$('[data-q]').forEach(b => b.addEventListener('click', () => sendQuick(b.dataset.q)));
  $('#sosShow').addEventListener('click', () => { $('#sos').classList.remove('on'); focusMember($('#sos').dataset.id); });
  $('#sosClose').addEventListener('click', () => $('#sos').classList.remove('on'));

  $('#strip').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) focusMember(b.dataset.id); });
  $('#membersList').addEventListener('click', e => {
    const s = e.target.closest('[data-see]'), l = e.target.closest('[data-lead]');
    if (s) focusMember(s.dataset.see);
    if (l && isLeader()) { giveLeader(l.dataset.lead); renderMembers(); }
  });

  $('#sheet-settings').addEventListener('click', e => {
    const th = e.target.closest('[data-theme-pick]');
    if (th) { setPref('theme', th.dataset.themePick); return; }
    const b = e.target.closest('.seg button');
    if (!b) return;
    const k = b.closest('.seg').dataset.pref;
    setPref(k, k === 'lagKm' ? +b.dataset.v : b.dataset.v);
  });
  $('#btnEndOpen').addEventListener('click', () => openSheet('end'));
  $('#btnQuit').addEventListener('click', async () => {
    if (!confirm(t('confirmQuit'))) return;
    try { await DB.delKV('current'); } catch (e) { /* ignoré */ }
    leave();
  });
  $('#endBody').addEventListener('click', e => {
    if (e.target.closest('#endSave')) finish(true);
    if (e.target.closest('#endAll')) { send('end', { by: me.id }); finish(true); }
  });

  $('#histBack').addEventListener('click', () => { show('home'); renderHome(); });
  $('#histList').addEventListener('click', e => { const b = e.target.closest('[data-trip]'); if (b) openTrip(b.dataset.trip); });
  $('#tripBack').addEventListener('click', closeTrip);
  $('#tripStats').addEventListener('click', async e => {
    const b = e.target.closest('[data-deltrip]');
    if (!b || !confirm(t('confirmDel'))) return;
    await DB.delTrip(b.dataset.deltrip);
    closeTrip();
  });
  $('#rpPlay').addEventListener('click', () => {
    if (!RP) return;
    if (!RP.playing && RP.T >= RP.dur) setReplay(0);
    RP.playing = !RP.playing; RP.lastTs = 0;
    updatePlayBtn();
    if (RP.playing) RP.raf = requestAnimationFrame(rpLoop);
  });
  $('#rpSlider').addEventListener('input', e => { if (RP) setReplay(+e.target.value); });
  $('#rpSpeed').addEventListener('click', () => {
    if (!RP) return;
    const i = RP.speeds.indexOf(RP.speed);
    RP.speed = RP.speeds[(i + 1) % RP.speeds.length];
    updatePlayBtn();
  });

  document.addEventListener('visibilitychange', () => {
    if (!S.code) return;
    if (document.visibilityState === 'visible') {
      keepAwake(); startGeo(); unlockAudio();
      if (!S.conn) reconnect();
      setTimeout(checkPeers, 1500);
    } else {
      talkStop(); saveCurrent();
    }
  });
  window.addEventListener('pagehide', () => { if (S.code) saveCurrent(); });
}

applyTheme();
buildGauge();
bind();
renderHome();
applyLang();
setFollow(true, true);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
