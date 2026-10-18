'use strict';
const APP_VERSION = '1.1.0';
/* PocketConvoy : convoi routier entre amis (carte en direct, talkie, parcours commun, pins, chat). */

const CFG = { routingUrl: 'https://router.project-osrm.org', geocodeUrl: 'https://photon.komoot.io' };
/* connexion entre les téléphones : Supabase Realtime (positions, messages) et WebRTC (talkie), réglés dans config.js */
const NET = Object.assign({ supabaseUrl: '', supabaseAnonKey: '', iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }, window.CONVOY_CONFIG || {});
const NET_EVENTS = ['pos', 'talk', 'msg', 'plan', 'pin', 'pinDel', 'chat', 'rtc', 'hello', 'state', 'leader', 'end'];
function configOk() {
  return /^https:\/\//.test(NET.supabaseUrl) && NET.supabaseAnonKey && NET.supabaseAnonKey.length > 20 && !/X{4}/.test(NET.supabaseUrl + NET.supabaseAnonKey);
}
/* fond de carte : tuiles OpenFreeMap restylées aux couleurs de l'app (CARTO en secours) */
const MAP_BASE_URL = 'https://tiles.openfreemap.org/styles/positron';
const FALLBACK_STYLES = {
  night: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  day: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};
const MAP_PAL = {
  dark: { bg: '#141416', land: '#18181B', park: '#162019', water: '#0D1821', waterway: '#1B3040', building: '#1E1E22', minor: '#2B2B31', major: '#3A3A42',
    motorway: '#4C4C55', casing: '#141416', rail: '#2A2A30', boundary: '#45454E', label: '#8E8E97', labelStrong: '#E4E4E8', labelRoad: '#7C7C85', labelWater: '#4F7A96', halo: '#141416' },
  oled: { bg: '#000000', land: '#060607', park: '#08100A', water: '#04090E', waterway: '#10202B', building: '#111113', minor: '#202024', major: '#2E2E34',
    motorway: '#3E3E46', casing: '#000000', rail: '#1E1E22', boundary: '#3A3A42', label: '#85858E', labelStrong: '#E4E4E8', labelRoad: '#6E6E77', labelWater: '#456B84', halo: '#000000' },
  light: { bg: '#F3F3F1', land: '#EEEEEB', park: '#E2EADD', water: '#CBD9E4', waterway: '#B4C8D8', building: '#E3E3DF', minor: '#FFFFFF', major: '#FFFFFF',
    motorway: '#FFFFFF', casing: '#D2D2CC', rail: '#CFCFCA', boundary: '#B5B5AF', label: '#5F5F66', labelStrong: '#18181B', labelRoad: '#6B6B72', labelWater: '#5A7F99', halo: '#F3F3F1' },
};
const COLORS = ['#4C9EFF', '#FF4D6D', '#2BD9A0', '#FFC53D', '#B07CFF', '#00C2FF', '#FF8A3D', '#E8E8E8'];
const ACCENTS = { orange: '#FF5B1F', yellow: '#FFD60A', lime: '#B6F23A', cyan: '#00D1FF', magenta: '#FF2E88' };
const THEMES = { graphite: { map: 'night', meta: '#0F0F10' }, light: { map: 'day', meta: '#F4F4F2' }, oled: { map: 'night', meta: '#000000' }, red: { map: 'night', meta: '#050000' } };
const STATUSES = ['route', 'arret', 'pause', 'essence', 'perdu', 'panne'];
const QUICK = {
  pause:    { status: 'pause', sound: 'msg', kind: 'info' },
  essence:  { status: 'essence', sound: 'msg', kind: 'info' },
  perdu:    { status: 'perdu', sound: 'warn', kind: 'warn' },
  ralentir: { status: null, sound: 'warn', kind: 'warn' },
  ok:       { status: '', sound: 'msg', kind: 'ok' },
  sos:      { status: 'panne', sound: 'sos', kind: 'danger' },
};
/* sons : une signature par type d'alerte (f = fréquence, f2 = glissando, d = durée, g = volume) */
const SFX = {
  ui: [{ f: 1100, d: 0.035, g: 0.06 }],
  talkStart: [{ f: 880, d: 0.06 }, { f: 1320, d: 0.07 }],
  talkEnd: [{ f: 1320, d: 0.06 }, { f: 880, d: 0.08 }],
  rxStart: [{ f: 1250, d: 0.05 }, { f: 1650, d: 0.06 }],
  rxEnd: [{ f: 1650, d: 0.05 }, { f: 1050, d: 0.07 }],
  info: [{ f: 990, d: 0.07, g: 0.1 }],
  sent: [{ f: 1180, d: 0.05, g: 0.1 }, { f: 1480, d: 0.07, g: 0.1 }],
  pin: [{ f: 1500, f2: 950, d: 0.1, type: 'triangle', g: 0.2 }, { gap: 0.04 }, { f: 1500, f2: 950, d: 0.08, type: 'triangle', g: 0.14 }],
  pause: [{ f: 880, d: 0.2 }, { f: 660, d: 0.32 }],
  essence: [{ f: 523, d: 0.08, type: 'triangle', g: 0.24 }, { f: 659, d: 0.08, type: 'triangle', g: 0.24 }, { f: 784, d: 0.16, type: 'triangle', g: 0.24 }],
  ralentir: [{ f: 620, d: 0.12, type: 'square', g: 0.08 }, { f: 930, d: 0.12, type: 'square', g: 0.08 }, { f: 620, d: 0.12, type: 'square', g: 0.08 }, { f: 930, d: 0.18, type: 'square', g: 0.08 }],
  perdu: [{ f: 520, f2: 880, d: 0.22 }, { gap: 0.08 }, { f: 520, f2: 880, d: 0.26 }],
  ok: [{ f: 659, d: 0.07 }, { f: 831, d: 0.07 }, { f: 988, d: 0.18 }],
  lag: [{ f: 330, d: 0.15, type: 'triangle', g: 0.3 }, { gap: 0.09 }, { f: 330, d: 0.15, type: 'triangle', g: 0.3 }, { gap: 0.09 }, { f: 330, d: 0.22, type: 'triangle', g: 0.3 }],
  leaderStop: [{ f: 784, d: 0.13 }, { f: 659, d: 0.13 }, { f: 523, d: 0.28 }],
  arrive: [{ f: 523, d: 0.1 }, { f: 659, d: 0.1 }, { f: 784, d: 0.1 }, { f: 1047, d: 0.3 }],
  sos: [{ f: 700, f2: 1250, d: 0.35, type: 'sawtooth', g: 0.08 }, { f: 1250, f2: 700, d: 0.35, type: 'sawtooth', g: 0.08 },
    { f: 700, f2: 1250, d: 0.35, type: 'sawtooth', g: 0.08 }, { f: 1250, f2: 700, d: 0.35, type: 'sawtooth', g: 0.08 }],
};
const SND_PREVIEW = [['pause', 'qPause'], ['essence', 'qFuel'], ['ralentir', 'qSlow'], ['perdu', 'qLost'], ['ok', 'qOk'], ['sos', 'qSos'],
  ['lag', 'sndLag'], ['leaderStop', 'sndLeaderStop'], ['pin', 'sndPin']];
const PIN_TYPES = ['view', 'food', 'fuel', 'parking', 'danger', 'other'];
const PIN_ICON = {
  view: '<path d="M2.5 19.5 9 10l4 5.5 3-4 5.5 8z"/><circle cx="16.5" cy="5.5" r="1.8"/>',
  food: '<path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17 21V3c-2 0-3.5 2-3.5 5.5V13H17"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10M14 8l3 3v6a1.5 1.5 0 0 0 3 0V8l-3-3"/>',
  parking: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M10 17V8h3a2.5 2.5 0 0 1 0 5h-3"/>',
  danger: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4M12 17v.01"/>',
  other: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
};
const ALERT_ICON = {
  pause: '<path d="M9 6v12M15 6v12"/>',
  essence: PIN_ICON.fuel,
  ralentir: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4M12 17v.01"/>',
  perdu: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17v.01"/>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  lag: '<path d="M14 12H3M7 8l-4 4 4 4"/><path d="M20 5v14"/>',
  leaderStop: '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M9 12h6"/>',
};
const ALERT_KIND = { pause: 'info', essence: 'info', ralentir: 'warn', perdu: 'warn', ok: 'ok', lag: 'warn', leaderStop: 'warn' };
/* centre de la carte avant la première position GPS */
const MAP_HOME = [46.8, 8.23];
/* ---------- textes FR / EN ---------- */
const I18N = {
  fr: {
    tagline: 'Rouler ensemble, sans se perdre',
    nickname: 'Ton pseudo', nicknamePh: 'Nitsu', colour: 'Ta couleur sur la carte', colourAria: 'Couleur',
    history: 'Historique', settings: 'Réglages',
    homeNote: 'Pendant le trajet, garde l’app ouverte au premier plan, écran allumé : sur iPhone, une web app s’arrête quand l’écran se verrouille.',
    tabMap: 'Carte', tabSpeed: 'Compteur', viewAria: 'Vue', pickHint: 'Touche la carte pour placer l’étape', cancel: 'Annuler',
    toolRoute: 'Parcours', toolAlerts: 'Alertes', toolConvoy: 'Convoi', toolSettings: 'Réglages', ptt: 'Talkie-walkie', close: 'Fermer', back: 'Retour',
    route: 'Parcours', searchPh: 'Adresse ou lieu', pickBtn: 'Placer une étape sur la carte',
    quickTitle: 'Alertes rapides', qPause: 'Pause', qFuel: 'Essence', qSlow: 'Ralentissez', qLost: 'Je suis perdu', qOk: 'Tout va bien, je repars',
    qSos: 'Panne ou urgence', qSosConfirm: 'Toucher encore pour confirmer',
    quickNote: 'Chaque alerte part à tout le convoi avec un son. Une panne s’affiche en plein écran chez les autres.',
    convoy: 'Convoi', lang: 'Langue', theme: 'Thème', accent: 'Couleur d’accent', talkBtn: 'Bouton du talkie', hold: 'Maintenir', toggle: 'Appui simple',
    map: 'Carte', night: 'Sombre', day: 'Claire', lagAlert: 'Alerte quand une voiture est loin du leader',
    endTrip: 'Terminer le trajet', quit: 'Quitter sans enregistrer', yourTrip: 'Ton trajet',
    th_graphite: 'Graphite', th_light: 'Clair', th_oled: 'OLED', th_red: 'Nuit rouge',
    thn_graphite: 'Gris neutres, une seule couleur vive pour l’essentiel.', thn_light: 'Pour rouler en plein jour.',
    thn_oled: 'Noir pur : moins d’éblouissement et de batterie sur les écrans OLED.', thn_red: 'Tout en rouge sombre pour garder les yeux habitués à la nuit. L’accent est fixé au rouge.',
    sosHas: '{name} a un problème', sosSub: 'Panne ou urgence signalée', sosShow: 'Voir sur la carte', sosOk: 'J’ai vu', sosDist: 'À {d} de toi',
    play: 'Lecture', pause: 'Pause', replayAria: 'Position dans le trajet', gaugeAria: 'Compteur de vitesse',
    st_route: 'En route', st_arret: 'À l’arrêt', st_pause: 'En pause', st_essence: 'À la pompe', st_perdu: 'Perdu', st_panne: 'En panne',
    q_pause: 'Je fais une pause', q_essence: 'Je m’arrête faire le plein', q_perdu: 'Je suis perdu', q_ralentir: 'Attention, ralentissez',
    q_ok: 'Tout va bien, je repars', q_sos: 'Panne ou urgence', msgFrom: '{name} : {text}',
    errName: 'Choisis un pseudo pour que les autres te reconnaissent.', errLibs: 'La carte n’a pas pu se charger. Vérifie ta connexion.',
    tooShort: 'Trajet trop court : il n’a pas été enregistré.',
    micDenied: 'Micro refusé. Autorise le micro pour Safari dans les réglages de l’iPhone pour tester le talkie.',
    planChanged: '{name} a modifié le parcours', joined: '{name} a rejoint le convoi', leftConvoy: '{name} n’est plus connecté',
    youLeader: 'Tu es maintenant le leader du convoi', newLeader: '{name} est le nouveau leader',
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
    micOn: 'Micro refusé', live: 'En direct', holdTalk: 'Maintenir pour parler', tapStop: 'Toucher pour couper', tapTalk: 'Toucher pour parler',
    talks1: '{name} parle', talksN: '{names} parlent', and: ' et ', sent: 'Envoyé au convoi : {text}',
    offline: 'Hors ligne', lostSignal: 'Signal perdu', at: 'à {d}', leader: 'Leader',
    you: ' (toi)', see: 'Voir', makeLeader: 'Nommer leader', currentLeader: 'Leader actuel : {name}. Le leader choisit la destination et les étapes.',
    youShort: 'toi', nobody: 'personne', car: 'Voiture', distance: 'Distance', driving: 'Conduite', avgShort: 'Moy.', max: 'Max',
    rankTitle: 'Le convoi, classé par distance', drivingOf: 'Temps de conduite sur {t}', drivingTime: 'Temps de conduite',
    avgMoving: 'Vitesse moyenne en roulant', maxSpeed: 'Vitesse max', saveQuit: 'Enregistrer et quitter', keepDriving: 'Continuer à rouler',
    lagYou: 'Tu es à {d} du leader', lagOther: '{name} est à {d} du leader', leaderStopped: 'Le leader {name} est à l’arrêt',
    heading: 'Cap {d}', itsYou: 'C’est toi', carsOnline: 'Voitures connectées', average: 'Moyenne', gapLeader: 'Écart au leader', altitude: 'Altitude',
    noTrips: 'Aucun trajet enregistré pour l’instant. Ils apparaissent ici quand tu termines un trajet.', tripDefault: 'Trajet',
    cars1: '1 voiture', carsN: '{n} voitures', tripLine: '{dist} en {dur}, {cars}', fromTo: '{date}, de {a} à {b}', delTrip: 'Supprimer ce trajet',
    confirmQuit: 'Quitter sans enregistrer ce trajet ?', confirmDel: 'Supprimer ce trajet de l’historique ?',
    viewConvoy: 'Vue du convoi', followMe: 'Me suivre',
    on: 'Activés', off: 'Désactivés',
    haptics: 'Retour haptique', hapOff: 'Désactivé', hapLight: 'Léger', hapNormal: 'Normal', hapStrong: 'Fort', hapFor: 'Utiliser pour',
    hapUi: 'Boutons', hapTalk: 'Talkie', hapAlerts: 'Alertes', hapTest: 'Tester',
    hapNote: 'Sur iPhone, Safari ne permet qu’un léger tic (iOS 18 et plus) : l’intensité règle le nombre de tics. Sur Android, la vibration suit l’intensité.',
    sounds: 'Sons', sndPreview: 'Écouter le son de chaque alerte', sndLag: 'Voiture distancée', sndLeaderStop: 'Leader arrêté', sndPin: 'Nouveau pin', convoyWho: 'Convoi',
    pins: 'Pins du convoi', noPins: 'Aucun pin pour l’instant. Garde le doigt appuyé sur la carte pour en placer un.', newPin: 'Nouveau pin', pinType: 'Type',
    pinLabelPh: 'Nom (facultatif)', addPin: 'Ajouter le pin', pinHere: 'Pin à ma position', pinOnMap: 'Placer un pin sur la carte', pinHint: 'Touche la carte pour placer le pin',
    pinBy: 'Ajouté par {name}, {ago}', agoNow: 'à l’instant', agoMin: 'il y a {n} min', pinAdded: 'Pin ajouté, visible par tout le convoi',
    pinFrom: '{name} a ajouté un pin : {label}', pinAsStop: 'Ajouter comme étape', pinAsDest: 'Choisir comme destination', pinDel: 'Supprimer le pin',
    pinInRoute: 'Ce pin fait partie du parcours.', pinLeaderNote: 'Le leader peut l’ajouter au parcours.', pinAccepted: '{name} a ajouté ton pin au parcours', pinRemoved: 'Pin supprimé',
    pin_view: 'Point de vue', pin_food: 'Restaurant', pin_fuel: 'Station-service', pin_parking: 'Parking', pin_danger: 'Danger', pin_other: 'Autre',
    credits: 'Crédits', version: 'Version {v}',
    units: 'Unités', miles: 'miles', gauge: 'Compteur', gDial: 'Cadran', gDigital: 'Numérique', gMax: 'Graduation maximale',
    gWarn: 'Seuil de vitesse', warnOff: 'Aucun', gWarnNote: 'Au-delà du seuil choisi, la vitesse et l’aiguille passent au rouge.',
    create: 'Créer un convoi', orJoin: 'ou rejoindre avec un code', join: 'Rejoindre', errCode: 'Le code du convoi fait 6 caractères.',
    cfgWarn: 'Pour rouler avec tes amis, ajoute l’URL et la clé de ton projet Supabase dans config.js.',
    errLive: 'La connexion au serveur n’a pas pu se charger. Vérifie ta connexion.', invite: 'Inviter des amis', codeLabel: 'Code du convoi', shareLink: 'Partager le lien d’invitation',
    shareText: 'Rejoins mon convoi sur PocketConvoy avec le code {code}', linkCopied: 'Lien d’invitation copié',
    created: 'Convoi créé. Invite tes amis depuis Convoi, code {code}.', connLost: 'Connexion au convoi perdue, reconnexion…',
    waiting: 'En attente des autres voitures. Code {code}', endAll: 'Terminer pour tout le convoi', endedAll: '{name} a terminé le trajet pour tout le convoi',
    audioOk: 'Talkie connecté', audioFail: 'Talkie en échec', audioWait: 'Talkie en connexion', tapForSound: 'Touche l’écran pour entendre le talkie de tes amis.',
    chat: 'Chat', chatPh: 'Message ou lien', chatEmpty: 'Aucun message pour l’instant. Le chat repart à zéro à chaque nouveau convoi.',
    chatPos: 'Partager ma position', myPosition: 'Ma position :', sendAria: 'Envoyer', creditsHtml: 'Carte : © <a href="https://www.openstreetmap.org/copyright">les contributeurs d’OpenStreetMap</a>, tuiles <a href="https://openfreemap.org">OpenFreeMap</a> et <a href="https://openmaptiles.org">OpenMapTiles</a>. Itinéraires : <a href="https://project-osrm.org">OSRM</a>. Recherche d’adresses : <a href="https://photon.komoot.io">Photon</a> par komoot.',
  },
  en: {
    tagline: 'Drive together, never lose each other',
    nickname: 'Your nickname', nicknamePh: 'Nitsu', colour: 'Your colour on the map', colourAria: 'Colour',
    history: 'History', settings: 'Settings',
    homeNote: 'While driving, keep the app open in the foreground with the screen on: on iPhone, a web app stops when the screen locks.',
    tabMap: 'Map', tabSpeed: 'Speed', viewAria: 'View', pickHint: 'Tap the map to place the stop', cancel: 'Cancel',
    toolRoute: 'Route', toolAlerts: 'Alerts', toolConvoy: 'Convoy', toolSettings: 'Settings', ptt: 'Walkie-talkie', close: 'Close', back: 'Back',
    route: 'Route', searchPh: 'Address or place', pickBtn: 'Place a stop on the map',
    quickTitle: 'Quick alerts', qPause: 'Break', qFuel: 'Fuel', qSlow: 'Slow down', qLost: 'I’m lost', qOk: 'All good, moving on',
    qSos: 'Breakdown or emergency', qSosConfirm: 'Tap again to confirm',
    quickNote: 'Every alert goes to the whole convoy with a sound. A breakdown shows full screen on the other phones.',
    convoy: 'Convoy', lang: 'Language', theme: 'Theme', accent: 'Accent colour', talkBtn: 'Walkie-talkie button', hold: 'Hold', toggle: 'Tap',
    map: 'Map', night: 'Dark', day: 'Light', lagAlert: 'Alert when a car is far from the leader',
    endTrip: 'End the trip', quit: 'Leave without saving', yourTrip: 'Your trip',
    th_graphite: 'Graphite', th_light: 'Light', th_oled: 'OLED', th_red: 'Red night',
    thn_graphite: 'Neutral greys, a single bright colour for what matters.', thn_light: 'For driving in daylight.',
    thn_oled: 'Pure black: less glare and less battery on OLED screens.', thn_red: 'Everything in dim red to keep your eyes adapted to the dark. The accent is locked to red.',
    sosHas: '{name} has a problem', sosSub: 'Breakdown or emergency reported', sosShow: 'Show on the map', sosOk: 'Got it', sosDist: '{d} away from you',
    play: 'Play', pause: 'Pause', replayAria: 'Position in the trip', gaugeAria: 'Speedometer',
    st_route: 'Driving', st_arret: 'Stopped', st_pause: 'On a break', st_essence: 'Refuelling', st_perdu: 'Lost', st_panne: 'Broken down',
    q_pause: 'I’m taking a break', q_essence: 'I’m stopping for fuel', q_perdu: 'I’m lost', q_ralentir: 'Careful, slow down',
    q_ok: 'All good, moving on', q_sos: 'Breakdown or emergency', msgFrom: '{name}: {text}',
    errName: 'Pick a nickname so the others recognise you.', errLibs: 'The map could not load. Check your connection.',
    tooShort: 'Trip too short: it was not saved.',
    micDenied: 'Microphone blocked. Allow the microphone for Safari in the iPhone settings to test the walkie-talkie.',
    planChanged: '{name} changed the route', joined: '{name} joined the convoy', leftConvoy: '{name} is no longer connected',
    youLeader: 'You are now the convoy leader', newLeader: '{name} is the new leader',
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
    micOn: 'Mic blocked', live: 'Live', holdTalk: 'Hold to talk', tapStop: 'Tap to stop', tapTalk: 'Tap to talk',
    talks1: '{name} is talking', talksN: '{names} are talking', and: ' and ', sent: 'Sent to the convoy: {text}',
    offline: 'Offline', lostSignal: 'Signal lost', at: '{d} away', leader: 'Leader',
    you: ' (you)', see: 'Show', makeLeader: 'Make leader', currentLeader: 'Current leader: {name}. The leader picks the destination and the stops.',
    youShort: 'you', nobody: 'nobody', car: 'Car', distance: 'Distance', driving: 'Driving', avgShort: 'Avg.', max: 'Max',
    rankTitle: 'The convoy, ranked by distance', drivingOf: 'Driving time out of {t}', drivingTime: 'Driving time',
    avgMoving: 'Average speed while moving', maxSpeed: 'Top speed', saveQuit: 'Save and leave', keepDriving: 'Keep driving',
    lagYou: 'You are {d} from the leader', lagOther: '{name} is {d} from the leader', leaderStopped: 'The leader {name} has stopped',
    heading: 'Heading {d}', itsYou: 'It’s you', carsOnline: 'Cars connected', average: 'Average', gapLeader: 'Gap to leader', altitude: 'Altitude',
    noTrips: 'No trips saved yet. They appear here when you end a trip.', tripDefault: 'Trip',
    cars1: '1 car', carsN: '{n} cars', tripLine: '{dist} in {dur}, {cars}', fromTo: '{date}, from {a} to {b}', delTrip: 'Delete this trip',
    confirmQuit: 'Leave without saving this trip?', confirmDel: 'Delete this trip from the history?',
    viewConvoy: 'Convoy view', followMe: 'Follow me',
    on: 'On', off: 'Off',
    haptics: 'Haptic feedback', hapOff: 'Off', hapLight: 'Light', hapNormal: 'Normal', hapStrong: 'Strong', hapFor: 'Use for',
    hapUi: 'Buttons', hapTalk: 'Walkie-talkie', hapAlerts: 'Alerts', hapTest: 'Test',
    hapNote: 'On iPhone, Safari only allows a light tick (iOS 18 and later): the strength sets how many ticks you feel. On Android, the vibration follows the strength.',
    sounds: 'Sounds', sndPreview: 'Listen to each alert sound', sndLag: 'Car falling behind', sndLeaderStop: 'Leader stopped', sndPin: 'New pin', convoyWho: 'Convoy',
    pins: 'Convoy pins', noPins: 'No pins yet. Press and hold on the map to drop one.', newPin: 'New pin', pinType: 'Type',
    pinLabelPh: 'Name (optional)', addPin: 'Drop the pin', pinHere: 'Pin at my position', pinOnMap: 'Place a pin on the map', pinHint: 'Tap the map to place the pin',
    pinBy: 'Added by {name}, {ago}', agoNow: 'just now', agoMin: '{n} min ago', pinAdded: 'Pin dropped, visible to the whole convoy',
    pinFrom: '{name} dropped a pin: {label}', pinAsStop: 'Add as a stop', pinAsDest: 'Set as destination', pinDel: 'Delete the pin',
    pinInRoute: 'This pin is part of the route.', pinLeaderNote: 'The leader can add it to the route.', pinAccepted: '{name} added your pin to the route', pinRemoved: 'Pin deleted',
    pin_view: 'Viewpoint', pin_food: 'Restaurant', pin_fuel: 'Fuel station', pin_parking: 'Parking', pin_danger: 'Hazard', pin_other: 'Other',
    credits: 'Credits', version: 'Version {v}',
    units: 'Units', miles: 'miles', gauge: 'Speedometer', gDial: 'Dial', gDigital: 'Digital', gMax: 'Maximum on the dial',
    gWarn: 'Speed threshold', warnOff: 'None', gWarnNote: 'Above the chosen threshold, the speed and the needle turn red.',
    create: 'Create a convoy', orJoin: 'or join with a code', join: 'Join', errCode: 'The convoy code has 6 characters.',
    cfgWarn: 'To drive with your friends, add your Supabase project URL and key to config.js.',
    errLive: 'The server connection could not load. Check your connection.', invite: 'Invite friends', codeLabel: 'Convoy code', shareLink: 'Share the invite link',
    shareText: 'Join my convoy on PocketConvoy with the code {code}', linkCopied: 'Invite link copied',
    created: 'Convoy created. Invite your friends from Convoy, code {code}.', connLost: 'Lost connection to the convoy, reconnecting…',
    waiting: 'Waiting for the other cars. Code {code}', endAll: 'End for the whole convoy', endedAll: '{name} ended the trip for the whole convoy',
    audioOk: 'Walkie-talkie connected', audioFail: 'Walkie-talkie failed', audioWait: 'Walkie-talkie connecting', tapForSound: 'Tap the screen to hear your friends on the walkie-talkie.',
    chat: 'Chat', chatPh: 'Message or link', chatEmpty: 'No messages yet. The chat starts fresh with every new convoy.',
    chatPos: 'Share my position', myPosition: 'My position:', sendAria: 'Send', creditsHtml: 'Map: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, <a href="https://openfreemap.org">OpenFreeMap</a> and <a href="https://openmaptiles.org">OpenMapTiles</a> tiles. Routing: <a href="https://project-osrm.org">OSRM</a>. Address search: <a href="https://photon.komoot.io">Photon</a> by komoot.',
  },
  de: {
    tagline: 'Gemeinsam fahren, ohne sich zu verlieren',
    nickname: 'Dein Name', nicknamePh: 'Nitsu', colour: 'Deine Farbe auf der Karte', colourAria: 'Farbe',
    history: 'Verlauf', settings: 'Einstellungen',
    homeNote: 'Lass die App während der Fahrt im Vordergrund und den Bildschirm an: Auf dem iPhone stoppt eine Web-App, wenn der Bildschirm sperrt.',
    tabMap: 'Karte', tabSpeed: 'Tacho', viewAria: 'Ansicht', pickHint: 'Tippe auf die Karte, um den Zwischenstopp zu setzen', cancel: 'Abbrechen',
    toolRoute: 'Route', toolAlerts: 'Warnungen', toolConvoy: 'Konvoi', toolSettings: 'Optionen', ptt: 'Funkgerät', close: 'Schliessen', back: 'Zurück',
    route: 'Route', searchPh: 'Adresse oder Ort', pickBtn: 'Zwischenstopp auf der Karte setzen',
    quickTitle: 'Schnellwarnungen', qPause: 'Pause', qFuel: 'Tanken', qSlow: 'Langsamer', qLost: 'Verfahren', qOk: 'Alles gut, ich fahre weiter',
    qSos: 'Panne oder Notfall', qSosConfirm: 'Zum Bestätigen nochmals tippen',
    quickNote: 'Jede Warnung geht mit einem Ton an den ganzen Konvoi. Eine Panne erscheint bei den anderen im Vollbild.',
    convoy: 'Konvoi', lang: 'Sprache', theme: 'Design', accent: 'Akzentfarbe', talkBtn: 'Funkgerät-Taste', hold: 'Halten', toggle: 'Antippen',
    map: 'Karte', night: 'Dunkel', day: 'Hell', lagAlert: 'Warnung, wenn ein Auto weit vom Konvoiführer entfernt ist',
    endTrip: 'Fahrt beenden', quit: 'Ohne Speichern verlassen', yourTrip: 'Deine Fahrt',
    th_graphite: 'Graphit', th_light: 'Hell', th_oled: 'OLED', th_red: 'Rote Nacht',
    thn_graphite: 'Neutrale Grautöne, eine einzige kräftige Farbe für das Wichtigste.', thn_light: 'Zum Fahren bei Tageslicht.',
    thn_oled: 'Reines Schwarz: weniger Blendung und weniger Akkuverbrauch auf OLED-Bildschirmen.', thn_red: 'Alles in gedämpftem Rot, damit die Augen an die Dunkelheit gewöhnt bleiben. Die Akzentfarbe ist auf Rot festgelegt.',
    sosHas: '{name} hat ein Problem', sosSub: 'Panne oder Notfall gemeldet', sosShow: 'Auf der Karte zeigen', sosOk: 'Gesehen', sosDist: '{d} von dir entfernt',
    play: 'Abspielen', pause: 'Pause', replayAria: 'Position in der Fahrt', gaugeAria: 'Tachometer',
    st_route: 'Unterwegs', st_arret: 'Steht', st_pause: 'Macht Pause', st_essence: 'Tankt', st_perdu: 'Verfahren', st_panne: 'Panne',
    q_pause: 'Ich mache eine Pause', q_essence: 'Ich halte zum Tanken an', q_perdu: 'Ich habe mich verfahren', q_ralentir: 'Achtung, langsamer fahren',
    q_ok: 'Alles gut, ich fahre weiter', q_sos: 'Panne oder Notfall', msgFrom: '{name}: {text}',
    errName: 'Wähle einen Namen, damit dich die anderen erkennen.', errLibs: 'Die Karte konnte nicht geladen werden. Prüfe deine Verbindung.',
    tooShort: 'Fahrt zu kurz: Sie wurde nicht gespeichert.',
    micDenied: 'Mikrofon blockiert. Erlaube das Mikrofon für Safari in den iPhone-Einstellungen, um das Funkgerät zu testen.',
    planChanged: '{name} hat die Route geändert', joined: '{name} ist dem Konvoi beigetreten', leftConvoy: '{name} ist nicht mehr verbunden',
    youLeader: 'Du bist jetzt Konvoiführer', newLeader: '{name} ist der neue Konvoiführer',
    noGps: 'Auf diesem Gerät ist kein GPS verfügbar.', geoDenied: 'Standort blockiert. Erlaube den Standort für Safari unter Einstellungen, Datenschutz, Ortungsdienste.',
    routeFail: 'Route im Moment nicht verfügbar. Neuer Versuch in Kürze.', arrivedToast: 'Ziel erreicht. Beende die Fahrt, um deine Statistiken zu sehen.',
    stopReached: 'Zwischenstopp erreicht: {label}', arrived: 'Ihr seid angekommen', tapStats: 'Tippen für die Statistiken der Fahrt',
    computing: 'Route wird berechnet', routeWait: 'Route ausstehend', gpsWait: 'Warte auf GPS', eta: 'Ankunft {time}', remaining: 'noch {dist}',
    noDestLead: 'Füge ein Ziel hinzu: Der ganze Konvoi erhält die Route.', noDest: 'Der Konvoiführer hat noch kein Ziel gewählt.',
    dest: 'Ziel', stopN: 'Zwischenstopp {n}', passed: ', erreicht', up: 'Nach oben', down: 'Nach unten', del: 'Löschen',
    noteLead: 'Du bist Konvoiführer: Deine Änderungen gehen sofort an den ganzen Konvoi.', noteMember: 'Nur der Konvoiführer ({name}) kann die Route ändern.',
    yourRoute: ' Deine Route: {dist}.', destSent: 'Ziel an den Konvoi gesendet', stopSent: 'Zwischenstopp an den Konvoi gesendet',
    noResult: 'Keine Ergebnisse. Versuche es mit dem Ort oder einer genaueren Adresse.', searchFail: 'Suche nicht möglich. Prüfe deine Verbindung.',
    asStop: 'Stopp', asDest: 'Ziel', mapPoint: 'Punkt auf der Karte', noName: 'Ort ohne Namen',
    micOn: 'Mikrofon blockiert', live: 'Live', holdTalk: 'Halten zum Sprechen', tapStop: 'Tippen zum Beenden', tapTalk: 'Tippen zum Sprechen',
    talks1: '{name} spricht', talksN: '{names} sprechen', and: ' und ', sent: 'An den Konvoi gesendet: {text}',
    offline: 'Offline', lostSignal: 'Signal verloren', at: '{d} entfernt', leader: 'Konvoiführer',
    you: ' (du)', see: 'Zeigen', makeLeader: 'Zum Führer machen', currentLeader: 'Aktueller Konvoiführer: {name}. Er wählt das Ziel und die Zwischenstopps.',
    youShort: 'du', nobody: 'niemand', car: 'Auto', distance: 'Distanz', driving: 'Fahrzeit', avgShort: 'Ø', max: 'Max',
    rankTitle: 'Der Konvoi, nach Distanz geordnet', drivingOf: 'Fahrzeit von {t}', drivingTime: 'Fahrzeit',
    avgMoving: 'Durchschnitt während der Fahrt', maxSpeed: 'Höchstgeschwindigkeit', saveQuit: 'Speichern und verlassen', keepDriving: 'Weiterfahren',
    lagYou: 'Du bist {d} vom Konvoiführer entfernt', lagOther: '{name} ist {d} vom Konvoiführer entfernt', leaderStopped: 'Konvoiführer {name} steht',
    heading: 'Richtung {d}', itsYou: 'Du', average: 'Durchschnitt', gapLeader: 'Abstand zum Führer', altitude: 'Höhe', carsOnline: 'Verbundene Autos',
    noTrips: 'Noch keine gespeicherten Fahrten. Sie erscheinen hier, wenn du eine Fahrt beendest.', tripDefault: 'Fahrt',
    cars1: '1 Auto', carsN: '{n} Autos', tripLine: '{dist} in {dur}, {cars}', fromTo: '{date}, von {a} bis {b}', delTrip: 'Diese Fahrt löschen',
    confirmQuit: 'Ohne Speichern dieser Fahrt verlassen?', confirmDel: 'Diese Fahrt aus dem Verlauf löschen?',
    viewConvoy: 'Konvoi-Ansicht', followMe: 'Mir folgen',
    on: 'An', off: 'Aus',
    haptics: 'Haptisches Feedback', hapOff: 'Aus', hapLight: 'Leicht', hapNormal: 'Normal', hapStrong: 'Stark', hapFor: 'Verwenden für',
    hapUi: 'Tasten', hapTalk: 'Funkgerät', hapAlerts: 'Warnungen', hapTest: 'Testen',
    hapNote: 'Auf dem iPhone erlaubt Safari nur ein leichtes Ticken (ab iOS 18): Die Stärke bestimmt die Anzahl der Ticks. Auf Android folgt die Vibration der Stärke.',
    sounds: 'Töne', sndPreview: 'Den Ton jeder Warnung anhören', sndLag: 'Auto zurückgefallen', sndLeaderStop: 'Konvoiführer steht', sndPin: 'Neuer Pin', convoyWho: 'Konvoi',
    pins: 'Pins des Konvois', noPins: 'Noch keine Pins. Halte den Finger auf der Karte gedrückt, um einen zu setzen.', newPin: 'Neuer Pin', pinType: 'Art',
    pinLabelPh: 'Name (optional)', addPin: 'Pin setzen', pinHere: 'Pin an meiner Position', pinOnMap: 'Pin auf der Karte setzen', pinHint: 'Tippe auf die Karte, um den Pin zu setzen',
    pinBy: 'Gesetzt von {name}, {ago}', agoNow: 'gerade eben', agoMin: 'vor {n} Min.', pinAdded: 'Pin gesetzt, für den ganzen Konvoi sichtbar',
    pinFrom: '{name} hat einen Pin gesetzt: {label}', pinAsStop: 'Als Zwischenstopp hinzufügen', pinAsDest: 'Als Ziel festlegen', pinDel: 'Pin löschen',
    pinInRoute: 'Dieser Pin ist Teil der Route.', pinLeaderNote: 'Der Konvoiführer kann ihn zur Route hinzufügen.', pinAccepted: '{name} hat deinen Pin zur Route hinzugefügt', pinRemoved: 'Pin gelöscht',
    pin_view: 'Aussichtspunkt', pin_food: 'Restaurant', pin_fuel: 'Tankstelle', pin_parking: 'Parkplatz', pin_danger: 'Gefahr', pin_other: 'Anderes',
    credits: 'Quellen', version: 'Version {v}',
    units: 'Einheiten', miles: 'Meilen', gauge: 'Tacho', gDial: 'Zifferblatt', gDigital: 'Digital', gMax: 'Höchstwert der Skala',
    gWarn: 'Tempogrenze', warnOff: 'Keine', gWarnNote: 'Über der gewählten Grenze werden Tempo und Zeiger rot.',
    create: 'Konvoi erstellen', orJoin: 'oder mit einem Code beitreten', join: 'Beitreten', errCode: 'Der Konvoi-Code hat 6 Zeichen.',
    cfgWarn: 'Um mit Freunden zu fahren, trage die URL und den Schlüssel deines Supabase-Projekts in config.js ein.',
    errLive: 'Die Serververbindung konnte nicht geladen werden. Prüfe deine Verbindung.', invite: 'Freunde einladen', codeLabel: 'Konvoi-Code', shareLink: 'Einladungslink teilen',
    shareText: 'Tritt meinem Konvoi auf PocketConvoy bei, Code {code}', linkCopied: 'Einladungslink kopiert',
    created: 'Konvoi erstellt. Lade deine Freunde unter Konvoi ein, Code {code}.', connLost: 'Verbindung zum Konvoi verloren, neuer Versuch…',
    waiting: 'Warte auf die anderen Autos. Code {code}', endAll: 'Für den ganzen Konvoi beenden', endedAll: '{name} hat die Fahrt für den ganzen Konvoi beendet',
    audioOk: 'Funkgerät verbunden', audioFail: 'Funkgerät-Fehler', audioWait: 'Funkgerät verbindet', tapForSound: 'Tippe auf den Bildschirm, um deine Freunde im Funkgerät zu hören.',
    chat: 'Chat', chatPh: 'Nachricht oder Link', chatEmpty: 'Noch keine Nachrichten. Der Chat beginnt bei jedem neuen Konvoi von vorn.',
    chatPos: 'Meine Position teilen', myPosition: 'Meine Position:', sendAria: 'Senden', creditsHtml: 'Karte: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>, Kacheln von <a href="https://openfreemap.org">OpenFreeMap</a> und <a href="https://openmaptiles.org">OpenMapTiles</a>. Routen: <a href="https://project-osrm.org">OSRM</a>. Adresssuche: <a href="https://photon.komoot.io">Photon</a> von komoot.',
  },
};
const NAV = {
  fr: {
    mod: { left: 'à gauche', right: 'à droite', 'slight left': 'légèrement à gauche', 'slight right': 'légèrement à droite',
      'sharp left': 'franchement à gauche', 'sharp right': 'franchement à droite', straight: 'tout droit' },
    depart: 'Partez', arrive: 'Arrivée à destination', stop: 'Étape atteinte', uturn: 'Faites demi-tour', straight: 'Continuez tout droit',
    turn: 'Tournez {d}', endroad: 'Au bout, tournez {d}', merge: 'Insérez-vous', mergeDir: 'Insérez-vous {d}', onramp: 'Prenez la bretelle', onrampDir: 'Prenez la bretelle {d}',
    offramp: 'Prenez la sortie', offrampDir: 'Prenez la sortie {d}', fork: 'Restez {d}', rb: 'Au rond-point, prenez la {n} sortie', rbcont: 'Au rond-point, continuez',
    rbturn: 'Au rond-point, tournez {d}', rbexit: 'Sortez du rond-point', contDir: 'Continuez {d}', ord: n => n === 1 ? '1re' : n + 'e',
  },
  en: {
    mod: { left: 'left', right: 'right', 'slight left': 'slightly left', 'slight right': 'slightly right',
      'sharp left': 'sharply left', 'sharp right': 'sharply right', straight: 'straight on' },
    depart: 'Head off', arrive: 'You have arrived', stop: 'Stop reached', uturn: 'Make a U-turn', straight: 'Continue straight on',
    turn: 'Turn {d}', endroad: 'At the end of the road, turn {d}', merge: 'Merge', mergeDir: 'Merge {d}', onramp: 'Take the ramp', onrampDir: 'Take the ramp {d}',
    offramp: 'Take the exit', offrampDir: 'Take the exit {d}', fork: 'Keep {d}', rb: 'At the roundabout, take the {n} exit', rbcont: 'At the roundabout, continue',
    rbturn: 'At the roundabout, turn {d}', rbexit: 'Exit the roundabout', contDir: 'Continue {d}',
    ord: n => n + ((n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')),
  },
  de: {
    mod: { left: 'links', right: 'rechts', 'slight left': 'leicht links', 'slight right': 'leicht rechts',
      'sharp left': 'scharf links', 'sharp right': 'scharf rechts', straight: 'geradeaus' },
    depart: 'Losfahren', arrive: 'Ziel erreicht', stop: 'Zwischenstopp erreicht', uturn: 'Wenden', straight: 'Geradeaus weiterfahren',
    turn: '{D} abbiegen', endroad: 'Am Ende der Strasse {d} abbiegen', merge: 'Einfädeln', mergeDir: '{D} einfädeln', onramp: 'Auffahrt nehmen', onrampDir: 'Auffahrt {d} nehmen',
    offramp: 'Ausfahrt nehmen', offrampDir: 'Ausfahrt {d} nehmen', fork: '{D} halten', rb: 'Im Kreisel die {n} Ausfahrt nehmen', rbcont: 'Im Kreisel weiterfahren',
    rbturn: 'Im Kreisel {d} abbiegen', rbexit: 'Kreisel verlassen', contDir: '{D} weiterfahren', ord: n => n + '.',
  },
};
const DIRS = { fr: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'], en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], de: ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'] };
const OSM_LINK = (lat, lng) => `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lng.toFixed(5)}#map=16/${lat.toFixed(5)}/${lng.toFixed(5)}`;
/* ---------- utilitaires ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
const initial = n => (String(n || '?').trim().charAt(0) || '?').toUpperCase();
const rand = (a, b) => a + Math.random() * (b - a);
const ic = (p, s = 24) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  flag: '<path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/>',
  convoy: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  locate: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
};

const store = {
  get(k, d) { try { const v = localStorage.getItem('pc_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('pc_' + k, JSON.stringify(v)); } catch (e) { /* plein */ } },
};
const prefs = Object.assign({ talkMode: 'hold', mapTheme: 'night', lagKm: 3, view: 'map', lang: 'fr', theme: 'graphite', accent: 'orange', haptics: 'normal', hapticCats: ['ui', 'talk', 'alerts'], sound: 'on', distUnit: 'km', speedUnit: 'kmh', gaugeStyle: 'dial', gaugeScale: 3, speedWarn: 0 }, store.get('prefs', {}));
if (!I18N[prefs.lang]) prefs.lang = 'fr';
if (!THEMES[prefs.theme]) prefs.theme = 'graphite';
if (!ACCENTS[prefs.accent]) prefs.accent = 'orange';
if (!Array.isArray(prefs.hapticCats)) prefs.hapticCats = ['ui', 'talk', 'alerts'];
const savePrefs = () => store.set('prefs', prefs);

function t(k, v) {
  let s = I18N[prefs.lang][k];
  if (s == null) s = I18N.fr[k] != null ? I18N.fr[k] : k;
  if (v) for (const key of Object.keys(v)) s = s.split('{' + key + '}').join(v[key]);
  return s;
}
const locale = () => ({ en: 'en-GB', de: 'de-CH' }[prefs.lang] || 'fr-CH');

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
function offsetPoint(p, distM, brgDeg) {
  const d = distM / EARTH, b = brgDeg * RAD, la = p[0] * RAD, lo = p[1] * RAD;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return [la2 / RAD, lo2 / RAD];
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

const MILE = 1609.344, FOOT = 0.3048;
const useMiles = () => prefs.distUnit === 'mi';
const speedKey = () => (prefs.speedUnit === 'mph' ? 'mph' : 'kmh');
const spdUnit = () => (prefs.speedUnit === 'mph' ? 'mph' : 'km/h');
const kmhTo = kmh => (prefs.speedUnit === 'mph' ? kmh / 1.609344 : kmh);
const fmtSpd = kmh => Math.round(kmhTo(kmh || 0)) + ' ' + spdUnit();
const lagMeters = () => prefs.lagKm * (useMiles() ? MILE : 1000);
function fmtDist(m) {
  if (m == null || isNaN(m)) return '';
  if (useMiles()) {
    const dec = x => (prefs.lang === 'en' ? x : x.replace('.', ','));
    if (m < 0.1 * MILE) { const ft = m / FOOT; return ft < 10 ? '0 ft' : Math.round(ft / 10) * 10 + ' ft'; }
    const mi = m / MILE;
    return dec(mi < 10 ? mi.toFixed(1) : String(Math.round(mi))) + ' mi';
  }
  if (m < 5) return '0 m';
  if (m < 950) return Math.max(10, Math.round(m / 10) * 10) + ' m';
  const k = m / 1000;
  const s = k < 10 ? k.toFixed(1) : String(Math.round(k));
  return (prefs.lang === 'en' ? s : s.replace('.', ',')) + ' km';
}
function fmtDur(ms) {
  const min = Math.round((ms || 0) / 60000);
  if (min < 60) return min + ' min';
  return Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0');
}
const fmtKmh = ms => fmtSpd((ms || 0) * 3.6);
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
if (!me.id) { me.id = 'me-' + rid(); store.set('id', me.id); }

const S = {
  active: false, simT: Date.now(),
  members: new Map(),
  leaderId: null,
  plan: { v: 0, wps: [] }, passed: new Set(),
  route: null, routing: false, routeAgain: false, nav: { off: 0, last: 0 }, arrived: false,
  pos: null, geoWatch: null, follow: true, gesture: false, camB: 0, camP: 0, zoomTarget: null,
  manual: '', stoppedSince: null, movingSince: null,
  trip: null,
  talking: false, talkTimer: null, micOk: null, ac: null, wake: null,
  alerts: { lag: {}, leaderStop: false },
  map: null, wpMarkers: [], pick: false, sheet: null,
  timers: [], stripT: null, spTarget: 0, spDisp: 0,
  pins: new Map(), pinMarkers: [], pinDraft: null, pinOpen: null,
  live: false, code: null, sb: null, channel: null, conn: false, firstSync: true, joinTs: 0, online: new Set(), joinedAt: {},
  leaderSeq: 0, leaderMissing: 0, lastSentT: 0, lastSent: null, audioHint: false,
  chat: [], chatUnread: 0,
};
const clock = () => Date.now();

function member(id) {
  let m = S.members.get(id);
  if (!m) {
    m = { id, name: '…', color: '#8B8B93', lat: null, lng: null, spd: 0, hdg: null, st: 'route', t: 0,
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
  el.className = 'toast glass ' + kind;
  const span = document.createElement('span');
  if (html) span.innerHTML = text; else span.textContent = text;
  el.appendChild(span);
  box.prepend(el);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => el.remove(), ms);
}
function homeErr(msg) { const e = $('#homeErr'); e.textContent = msg; e.hidden = !msg; }

function applyLang() {
  document.documentElement.lang = prefs.lang;
  $$('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  $$('.swatch').forEach(el => el.setAttribute('aria-label', t('colourAria')));
  updatePTT();
  setFollow(S.follow, true);
  updatePlayBtn();
  if (S.active) {
    renderStrip(); updateNavSign(); updateTalkBar(); updateSpeedo();
    for (const m of S.members.values()) updateMarker(m);
    if (S.sheet === 'route') renderRouteSheet();
    if (S.sheet === 'members') renderMembers();
    if (S.sheet === 'end') renderEnd();
    if (S.sheet === 'pin') renderPinSheet();
    if (S.sheet === 'chat') renderChat();
    renderPinList();
  }
  if ($('#history').classList.contains('on')) openHistory();
  syncSegs();
}
function applyTheme() {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.style.setProperty('--accent', ACCENTS[prefs.accent]);
  $('#metaTheme').setAttribute('content', THEMES[prefs.theme].meta);
  styleRouteLayers();
}
/* ---------- fond de carte ---------- */
let mapBasePromise = null;
function mapPalette() { return prefs.mapTheme === 'day' ? MAP_PAL.light : (prefs.theme === 'oled' ? MAP_PAL.oled : MAP_PAL.dark); }
function mapPlaceholder() { return { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': mapPalette().bg } }] }; }
function styleFor(base) {
  const P = mapPalette();
  const st = JSON.parse(JSON.stringify(base));
  const nameExpr = ['coalesce', ['get', 'name:' + prefs.lang], ['get', 'name:latin'], ['get', 'name']];
  st.layers = st.layers.filter(l => !(l.type === 'symbol' && /poi|housenum|aerodrome|airport/i.test(l.id)));
  for (const l of st.layers) {
    const id = l.id.toLowerCase();
    const p = l.paint = l.paint || {}, lay = l.layout = l.layout || {};
    if (l.type === 'background') p['background-color'] = P.bg;
    else if (l.type === 'fill') {
      const c = /water|ocean|sea|lake/.test(id) ? P.water : /ice|glacier/.test(id) ? P.land
        : /park|wood|forest|grass|landcover|nature|meadow/.test(id) ? P.park : /building/.test(id) ? P.building : P.land;
      p['fill-color'] = c; p['fill-outline-color'] = c; delete p['fill-pattern'];
    } else if (l.type === 'fill-extrusion') {
      p['fill-extrusion-color'] = P.building;
    } else if (l.type === 'line') {
      let c;
      if (/waterway|river|stream|canal/.test(id)) c = P.waterway;
      else if (/boundary|admin/.test(id)) c = P.boundary;
      else if (/rail|transit/.test(id)) c = P.rail;
      else if (/casing|outline/.test(id)) c = P.casing;
      else if (/motorway/.test(id)) c = P.motorway;
      else if (/major|trunk|primary|secondary/.test(id)) c = P.major;
      else c = P.minor;
      p['line-color'] = c; delete p['line-pattern'];
    } else if (l.type === 'symbol' && lay['text-field'] !== undefined) {
      if (!/ref|housenum/.test(JSON.stringify(lay['text-field']))) lay['text-field'] = nameExpr;
      lay['text-transform'] = 'none';
      if (lay['text-letter-spacing'] !== undefined) lay['text-letter-spacing'] = 0.02;
      p['text-color'] = /city|capital|country|state/.test(id) ? P.labelStrong : /water|ocean|sea|lake|river/.test(id) ? P.labelWater
        : /road|highway|street|transportation/.test(id) ? P.labelRoad : P.label;
      p['text-halo-color'] = P.halo; p['text-halo-width'] = 1.4; p['text-halo-blur'] = 0.4;
    }
  }
  return st;
}
function applyMapStyle(map) {
  if (!map) return;
  if (!mapBasePromise) mapBasePromise = getJSON(MAP_BASE_URL).catch(e => { mapBasePromise = null; throw e; });
  mapBasePromise
    .then(base => map.setStyle(styleFor(base), { diff: false }))
    .catch(() => map.setStyle(FALLBACK_STYLES[prefs.mapTheme], { diff: false }));
}
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

/* ---------- son ---------- */
/* Sur iPhone, les sons générés par Web Audio sont coupés par le mode silencieux, sauf si la page se déclare
   comme lecteur audio. Avec l'API Audio Session (iOS 16.4 et plus) c'est direct ; sinon on joue un silence en boucle. */
const SILENT_WAV = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
let silentEl = null;
function setAudioSession(type) {
  try { if (navigator.audioSession) navigator.audioSession.type = type; } catch (e) { /* ignoré */ }
}
function unlockAudio() {
  try {
    if (navigator.audioSession) { if (!RTC.stream) setAudioSession('playback'); }
    else if (IS_IOS) {
      if (!silentEl) { silentEl = new Audio(SILENT_WAV); silentEl.loop = true; silentEl.setAttribute('playsinline', ''); }
      if (silentEl.paused) silentEl.play().catch(() => {});
    }
    if (!S.ac) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) S.ac = new AC(); }
    if (S.ac && S.ac.state !== 'running') S.ac.resume().catch(() => {});
    for (const p of RTC.peers.values()) if (p.audio && p.audio.paused) p.audio.play().catch(() => {});
  } catch (e) { /* ignoré */ }
}
function unlockSpeech() {
  try { if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } } catch (e) { /* ignoré */ }
}
function sfx(name, force) {
  const ac = S.ac, seq = SFX[name];
  if (!ac || !seq || (prefs.sound === 'off' && !force)) return;
  if (ac.state !== 'running') ac.resume().catch(() => {});
  let tm = ac.currentTime + 0.01;
  for (const n of seq) {
    if (n.gap) { tm += n.gap; continue; }
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = n.type || 'sine';
    o.frequency.setValueAtTime(n.f, tm);
    if (n.f2) o.frequency.linearRampToValueAtTime(n.f2, tm + n.d);
    const peak = n.g != null ? n.g : 0.18;
    g.gain.setValueAtTime(0, tm);
    g.gain.linearRampToValueAtTime(peak, tm + 0.012);
    g.gain.setValueAtTime(peak, tm + n.d * 0.65);
    g.gain.linearRampToValueAtTime(0, tm + n.d);
    o.connect(g).connect(ac.destination);
    o.start(tm); o.stop(tm + n.d + 0.02);
    tm += n.d;
  }
}
/* retour haptique : vibration sur Android, petit tic du contrôle switch sur iPhone (iOS 18 et plus) */
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let lastTick = 0;
function iosTick() {
  const now = performance.now();
  if (now - lastTick < 40) return;
  lastTick = now;
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.display = 'none';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  label.remove();
}
const HAPTIC = {
  tap: { cat: 'ui', vib: [10], ticks: 1 },
  select: { cat: 'ui', vib: [16], ticks: 1 },
  drop: { cat: 'ui', vib: [22, 50, 22], ticks: 2 },
  talk: { cat: 'talk', vib: [24], ticks: 1 },
  pin: { cat: 'alerts', vib: [18, 60, 18], ticks: 2 },
  alert: { cat: 'alerts', vib: [40, 70, 40], ticks: 2 },
  danger: { cat: 'alerts', vib: [140, 80, 140, 80, 180], ticks: 3 },
};
function haptic(kind, force) {
  const h = HAPTIC[kind], lvl = prefs.haptics;
  if (!h || lvl === 'off' || (!force && !prefs.hapticCats.includes(h.cat))) return;
  const mult = { light: 0.6, normal: 1, strong: 1.7 }[lvl] || 1;
  if (!IS_IOS && navigator.vibrate) { navigator.vibrate(h.vib.map((v, i) => i % 2 ? v : Math.round(v * mult))); return; }
  const ticks = lvl === 'light' ? 1 : h.ticks + (lvl === 'strong' ? 1 : 0);
  try { iosTick(); for (let i = 1; i < ticks; i++) setTimeout(iosTick, i * 110); } catch (e) { /* ignoré */ }
}

/* grandes alertes en haut de l'écran (les messages de gestion du convoi restent des petites notifications) */
function bigAlert(kind, who, text, id) {
  const box = $('#alerts');
  const el = document.createElement('button');
  el.className = 'alert glass a-' + (ALERT_KIND[kind] || 'info');
  el.innerHTML = `<span class="a-ico">${ic(ALERT_ICON[kind] || ALERT_ICON.ralentir, 24)}</span><span class="a-main"><span class="a-who">${esc(who)}</span><span class="a-text">${esc(text)}</span></span><i class="a-bar"></i>`;
  el.addEventListener('click', () => { el.remove(); if (id) focusMember(id); });
  box.prepend(el);
  while (box.children.length > 2) box.lastChild.remove();
  setTimeout(() => el.remove(), 9000);
  sfx(kind);
  haptic('alert');
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
  syncSegs();
}
function newCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (const b of crypto.getRandomValues(new Uint8Array(6))) out += A[b % A.length];
  return out;
}

/* ---------- démarrage d'un convoi ---------- */
function start(opts) {
  opts = opts || {};
  const name = $('#name').value.trim();
  if (!name) { homeErr(t('errName')); $('#name').focus(); return; }
  if (typeof maplibregl === 'undefined') { homeErr(t('errLibs')); return; }
  if (typeof supabase === 'undefined') { homeErr(t('errLive')); return; }
  me.name = name.slice(0, 16);
  store.set('name', me.name); store.set('color', me.color);
  homeErr('');
  unlockAudio(); unlockSpeech();

  S.active = true;
  S.live = true; S.code = opts.code;
  S.chat = []; S.chatUnread = 0; updateChatBadge();
  S.trip = { id: 't' + Date.now(), start: clock(), dist: 0, moving: 0, max: 0, last: null, tracks: {}, names: {}, colors: {}, dest: '' };
  S.plan = { v: 0, wps: [] }; S.passed = new Set(); S.arrived = false; S.route = null;
  S.leaderId = opts.creating ? me.id : null; S.leaderSeq = opts.creating ? 1 : 0;
  Object.assign(member(me.id), { name: me.name, color: me.color, online: true });

  closeSheets();
  show('main');
  initMap();
  setView(prefs.view);
  setFollow(true);
  keepAwake();
  updatePTT();
  S.firstSync = true; S.joinTs = Date.now(); S.online = new Set([me.id]); S.joinedAt = {};
  history.replaceState(null, '', location.pathname + '?c=' + S.code);
  startGeo();
  askMicOnce();
  connect();
  if (opts.creating) setTimeout(() => toast(t('created', { code: S.code }), 'ok', 8000), 500);
  renderStrip();
  renderWaypoints();
  S.timers.push(setInterval(tick, 3000));
}
function leave() {
  talkStop(true);
  disconnect();
  stopGeo();
  if (S.wake) { S.wake.release().catch(() => {}); S.wake = null; }
  S.timers.forEach(clearInterval); S.timers = [];
  for (const m of S.members.values()) if (m.mk) m.mk.remove();
  S.members.clear();
  S.wpMarkers.forEach(mk => mk.remove()); S.wpMarkers = [];
  S.pinMarkers.forEach(mk => mk.remove()); S.pinMarkers = []; S.pins.clear();
  S.chat = []; S.chatUnread = 0; updateChatBadge();
  $('#alerts').innerHTML = '';
  Object.assign(S, { active: false, trip: null, route: null, plan: { v: 0, wps: [] }, passed: new Set(), leaderId: null,
    pos: null, manual: '', arrived: false, alerts: { lag: {}, leaderStop: false }, pick: false, stoppedSince: null,
    live: false, code: null, leaderSeq: 0, leaderMissing: 0, lastSentT: 0, lastSent: null, audioHint: false });
  if (location.search) history.replaceState(null, '', location.pathname);
  renderRoute(); closeSheets();
  $('#navCard').hidden = true; $('#navEta').hidden = true; $('#talkBar').hidden = true; $('#toasts').innerHTML = ''; $('#sos').classList.remove('on');
  show('home'); renderHome();
}

/* ---------- événements reçus du convoi ---------- */
const H = {
  pos(d) {
    if (!d.id || d.id === me.id) return;
    const m = member(d.id);
    Object.assign(m, { name: d.n || m.name, color: d.c || m.color, lat: d.la, lng: d.ln, spd: d.s || 0, hdg: d.h, st: d.st || 'route', t: clock(), stale: false });
    m.stats = { dist: d.d || 0, mv: d.mv || 0, mx: d.mx || 0 };
    recordTrack(m.id, d.la, d.ln);
    moveTo(m, d.la, d.ln, (d.s || 0) / 3.6);
    updateMarker(m);
    scheduleStrip();
  },
  talk(d) {
    if (!d.id || d.id === me.id) return;
    const m = member(d.id);
    m.talking = !!d.on;
    m.talkUntil = d.on ? clock() + 120000 : 0;
    sfx(d.on ? 'rxStart' : 'rxEnd');
    if (d.on) haptic('talk');
    updateTalkBar(); updateMarker(m);
  },
  msg(d) {
    const q = QUICK[d.k];
    if (!q || !d.id) return;
    const m = member(d.id);
    if (q.status !== null) m.st = q.status || 'route';
    if (d.k === 'sos') { showSOS(m, d.la, d.ln); sfx('sos'); haptic('danger'); }
    else bigAlert(d.k, m.name, t('q_' + d.k), m.id);
    updateMarker(m); scheduleStrip();
  },
  plan(d) {
    if (!d.plan || d.plan.v <= S.plan.v) return;
    S.plan = d.plan;
    onPlanChanged();
    if (d.by && d.by !== me.id) toast(t('planChanged', { name: member(d.by).name }), 'info', 4500);
  },
  pin(d) {
    if (!d.id) return;
    const known = S.pins.has(d.id);
    S.pins.set(d.id, Object.assign({ inRoute: false }, S.pins.get(d.id) || {}, d));
    renderPins();
    if (d.by !== me.id && !known && !d.upd) { toast(t('pinFrom', { name: member(d.by).name, label: pinLabel(d) }), 'info', 5000); sfx('pin'); haptic('pin'); }
    if (S.sheet === 'route') renderRouteSheet();
  },
  chat(d) {
    if (!d.text) return;
    S.chat.push({ id: d.id || rid(), by: d.by, text: String(d.text).slice(0, 500), at: d.at || clock() });
    if (S.sheet === 'chat') renderChat();
    else if (d.by !== me.id) {
      S.chatUnread++; updateChatBadge();
      const txt = d.text.length > 70 ? d.text.slice(0, 67) + '…' : d.text;
      toast(t('msgFrom', { name: `<b>${esc(member(d.by).name)}</b>`, text: esc(txt) }), 'info', 5000, true);
      sfx('info');
    }
  },
  pinDel(d) {
    S.pins.delete(d.id);
    renderPins();
    if (S.sheet === 'route') renderRouteSheet();
    if (S.sheet === 'pin' && S.pinOpen === d.id) closeSheets();
  },
};

/* ---------- leader ---------- */
function setLeader(id, quiet, seq) {
  const was = S.leaderId;
  if (seq != null) {
    if (seq < S.leaderSeq) return;
    if (seq === S.leaderSeq && was && id >= was) return;
    S.leaderSeq = seq; S.leaderMissing = 0;
  }
  if (was === id) return;
  S.leaderId = id;
  if (!quiet) {
    if (id === me.id) { toast(t('youLeader'), 'ok', 5000); sfx('info'); }
    else toast(t('newLeader', { name: member(id).name }), 'info', 4500);
  }
  for (const m of S.members.values()) updateMarker(m);
  renderStrip();
  if (S.sheet === 'route') renderRouteSheet();
  if (S.sheet === 'members') renderMembers();
}
function giveLeader(id) {
  const seq = S.leaderSeq + 1;
  setLeader(id, false, seq);
  send('leader', { id, seq });
}

/* ---------- position (GPS réel ou trajet simulé) ---------- */
function startGeo() {
  if (!('geolocation' in navigator)) { toast(t('noGps'), 'danger', 8000); return; }
  stopGeo();
  S.geoWatch = navigator.geolocation.watchPosition(onFix, onGeoErr, { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 });
}
function stopGeo() { if (S.geoWatch != null) navigator.geolocation.clearWatch(S.geoWatch); S.geoWatch = null; }
function onGeoErr(e) { if (e.code === 1) toast(t('geoDenied'), 'danger', 10000); }
function onFix(p) {
  if (!S.active) return;
  const c = p.coords, now = clock();
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
  moveTo(self, cur[0], cur[1], S.pos.spd);
  maybeSendPos(false);
  updateMarker(self);
  if (S.follow) followCamera();
  checkWaypoints();
  if (S.route) navigate();
  else if (pendingWps().length && !S.routing && now - S.nav.last > 15000) computeRoute();
  updateSpeedo();
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
  const now = clock();
  if (p.spd < 0.8) { if (!S.stoppedSince) S.stoppedSince = now; } else S.stoppedSince = null;
  if (['pause', 'essence', 'perdu'].includes(S.manual)) {
    if (p.spd > 8) { if (!S.movingSince) S.movingSince = now; if (now - S.movingSince > 20000) S.manual = ''; }
    else S.movingSince = null;
  }
}
function myStatus() {
  if (S.manual) return S.manual;
  return (S.stoppedSince && clock() - S.stoppedSince > 45000) ? 'arret' : 'route';
}
function recordTrack(id, lat, lng) {
  const T = S.trip;
  if (!T || lat == null) return;
  const m = S.members.get(id);
  if (m) { T.names[id] = m.name; T.colors[id] = m.color; }
  const tr = T.tracks[id] || (T.tracks[id] = []);
  const tt = Math.round((clock() - T.start) / 1000);
  const l = tr[tr.length - 1];
  if (!l || (tt - l[0] >= 5 && hav([l[1], l[2]], [lat, lng]) >= 20) || tt - l[0] >= 60) tr.push([tt, +lat.toFixed(5), +lng.toFixed(5)]);
}

/* ---------- carte ---------- */
function initMap() {
  if (S.map) { S.map.resize(); return; }
  const m = new maplibregl.Map({
    container: 'map', style: mapPlaceholder(), center: [MAP_HOME[1], MAP_HOME[0]], zoom: 7,
    attributionControl: false, dragRotate: false, touchPitch: false, pitchWithRotate: false, maxPitch: 60,
  });
  m.touchZoomRotate.disableRotation();
  m.on('style.load', () => { addRouteLayers(); renderRoute(); });
  applyMapStyle(m);
  m.on('dragstart', () => setFollow(false));
  m.on('zoomstart', e => { if (e && e.originalEvent) S.gesture = true; });
  m.on('zoomend', () => { if (S.gesture) { S.gesture = false; kick(); } });
  m.on('rotate', () => { for (const mm of S.members.values()) updateCone(mm); });
  m.on('click', onMapClick);
  let lpT = null, lpPt = null, lpReady = null;
  const ring = $('#lpRing');
  const lpCancel = () => { clearTimeout(lpT); lpT = null; lpReady = null; ring.hidden = true; };
  m.on('touchstart', e => {
    lpCancel();
    if (!e.originalEvent || e.originalEvent.touches.length !== 1) return;
    lpPt = e.point; const ll = e.lngLat;
    lpT = setTimeout(() => {
      lpT = null; lpReady = ll;
      ring.style.left = lpPt.x + 'px'; ring.style.top = lpPt.y + 'px'; ring.hidden = false;
      if (!IS_IOS) haptic('drop');
    }, 500);
  });
  m.on('touchmove', e => { if ((lpT || lpReady) && lpPt && Math.hypot(e.point.x - lpPt.x, e.point.y - lpPt.y) > 12) lpCancel(); });
  m.on('touchend', () => {
    if (!lpReady) { lpCancel(); return; }
    const ll = lpReady;
    lpCancel();
    if (IS_IOS) haptic('drop');
    S.ignoreClickUntil = Date.now() + 500;
    openPinNew(ll.lat, ll.lng);
  });
  m.on('touchcancel', lpCancel); m.on('movestart', lpCancel);
  m.on('contextmenu', e => openPinNew(e.lngLat.lat, e.lngLat.lng));
  m.on('error', e => console.warn('carte', e && e.error && e.error.message));
  S.map = m;
  const hb = $('#hudBottom');
  if ('ResizeObserver' in window) new ResizeObserver(() => $('#main').style.setProperty('--hud-h', hb.offsetHeight + 'px')).observe(hb);
}
function addRouteLayers() {
  const m = S.map;
  if (!m.getSource('route')) m.addSource('route', { type: 'geojson', data: routeGeo() });
  if (!m.getLayer('route-casing')) m.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': cssVar('--route-casing'), 'line-width': 10, 'line-opacity': 0.8 } });
  if (!m.getLayer('route-line')) m.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': cssVar('--accent'), 'line-width': 5 } });
}
function styleRouteLayers() {
  const m = S.map;
  if (!m || !m.isStyleLoaded || !m.isStyleLoaded()) return;
  if (m.getLayer('route-casing')) m.setPaintProperty('route-casing', 'line-color', cssVar('--route-casing'));
  if (m.getLayer('route-line')) m.setPaintProperty('route-line', 'line-color', cssVar('--accent'));
}
function routeGeo() {
  const c = S.route ? S.route.coords.map(p => [p[1], p[0]]) : [];
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c.length > 1 ? c : [] } };
}
function renderRoute() {
  const src = S.map && S.map.getSource && S.map.getSource('route');
  if (src) src.setData(routeGeo());
}
function updateMarker(m) {
  if (!S.map || m.lat == null) return;
  if (!m.mk) {
    const el = document.createElement('div');
    el.innerHTML = '<div class="car-cone"></div><div class="car-dot"><span></span></div><div class="car-flag"></div><div class="car-tag"></div>';
    el.addEventListener('click', ev => { ev.stopPropagation(); focusMember(m.id); });
    m.el = el;
    m.mk = new maplibregl.Marker({ element: el }).setLngLat([m.dLng != null ? m.dLng : m.lng, m.dLat != null ? m.dLat : m.lat]).addTo(S.map);
  }
  if (m.dLat == null) m.mk.setLngLat([m.lng, m.lat]);
  const el = m.el, cl = el.classList;
  cl.add('car');
  cl.toggle('me', m.id === me.id);
  cl.toggle('leader', m.id === S.leaderId);
  cl.toggle('talking', !!m.talking);
  cl.toggle('stale', (m.stale || !m.online) && m.id !== me.id);
  for (const k of STATUSES) cl.toggle('st-' + k, (m.st || 'route') === k);
  el.style.setProperty('--c', m.color);
  el.querySelector('.car-dot span').textContent = initial(m.name);
  const tag = el.querySelector('.car-tag');
  const tagText = m.id === me.id ? '' : m.name + (m.st && m.st !== 'route' ? (prefs.lang === 'en' ? ': ' : ' : ') + statusLabel(m.st) : '');
  tag.textContent = tagText; tag.hidden = !tagText;
  el.style.zIndex = m.id === me.id ? 3 : (m.talking ? 2 : 1);
  updateCone(m);
}
function updateCone(m) {
  const c = m.el && m.el.querySelector('.car-cone');
  if (!c) return;
  const on = m.hdg != null && m.spd > 8;
  c.style.display = on ? '' : 'none';
  if (on) c.style.transform = `rotate(${(m.dHdg != null ? m.dHdg : m.hdg) - (S.map ? S.map.getBearing() : 0)}deg)`;
}
/* Le GPS ne donne qu'un point par seconde environ. Pour un mouvement fluide comme une app de navigation,
   chaque voiture glisse en continu vers sa position prévue (vitesse et cap) et la caméra suit image par image. */
const ANIM = { raf: 0 };
const angDiff = (a, b) => ((a - b + 540) % 360) - 180;
function kick() { if (!ANIM.raf) ANIM.raf = requestAnimationFrame(frame); }
function moveTo(m, lat, lng, spdMs) {
  const now = performance.now();
  if (m.dLat == null || hav([m.dLat, m.dLng], [lat, lng]) > 500) {
    m.dLat = lat; m.dLng = lng; m.anim = null; m.lastFixT = now;
    if (m.mk) m.mk.setLngLat([lng, lat]);
    kick(); return;
  }
  const dt = Math.min(2500, Math.max(300, now - (m.lastFixT || now - 1000)));
  m.lastFixT = now;
  m.fixInt = m.fixInt ? m.fixInt * 0.7 + dt * 0.3 : dt;
  const moving = spdMs > 1 && m.hdg != null;
  const to = moving ? offsetPoint([lat, lng], spdMs * m.fixInt / 1000 * 0.9, m.hdg) : [lat, lng];
  m.anim = { from: [m.dLat, m.dLng], to, t0: now, dur: m.fixInt, kMax: moving ? 1.6 : 1 };
  kick();
}
function frame(now) {
  ANIM.raf = 0;
  if (!S.active) return;
  let busy = false;
  for (const m of S.members.values()) {
    const a = m.anim;
    if (a) {
      const k = Math.min(a.kMax, (now - a.t0) / a.dur);
      m.dLat = a.from[0] + (a.to[0] - a.from[0]) * k;
      m.dLng = a.from[1] + (a.to[1] - a.from[1]) * k;
      if (m.mk) m.mk.setLngLat([m.dLng, m.dLat]);
      if (k >= a.kMax) m.anim = null; else busy = true;
    }
    if (m.hdg != null) {
      if (m.dHdg == null) m.dHdg = m.hdg;
      const d = angDiff(m.hdg, m.dHdg);
      if (Math.abs(d) > 0.3) { m.dHdg = (m.dHdg + d * 0.15 + 360) % 360; busy = true; updateCone(m); }
    }
  }
  if (followFrame()) busy = true;
  if (busy) kick();
}
function followFrame() {
  const map = S.map, self = S.members.get(me.id);
  if (!map || !S.follow || S.gesture || prefs.view !== 'map' || !self || self.dLat == null) return false;
  const p = S.pos, moving = !!(p && p.spd > 2.5 && p.hdg != null);
  const tb = moving ? p.hdg : S.camB, tp = moving ? 45 : 0;
  const db = angDiff(tb, S.camB);
  S.camB = (S.camB + db * 0.08 + 360) % 360;
  S.camP += (tp - S.camP) * 0.08;
  const opts = { center: [self.dLng, self.dLat], bearing: S.camB, pitch: S.camP };
  let zBusy = false;
  if (S.zoomTarget != null) {
    const z = map.getZoom(), nz = z + (S.zoomTarget - z) * 0.12;
    opts.zoom = nz;
    if (Math.abs(S.zoomTarget - nz) < 0.01) S.zoomTarget = null; else zBusy = true;
  }
  map.jumpTo(opts);
  return !!self.anim || Math.abs(db) > 0.2 || Math.abs(tp - S.camP) > 0.2 || zBusy;
}
function followCamera() { kick(); }
function setFollowPadding() {
  if (S.map && S.map.setPadding) S.map.setPadding({ top: Math.round(window.innerHeight * 0.32), bottom: 0, left: 0, right: 0 });
}
function setFollow(on, labelOnly) {
  S.follow = on;
  const b = $('#btnLocate');
  b.innerHTML = ic(on ? ICON.convoy : ICON.locate, 22);
  b.setAttribute('aria-label', t(on ? 'viewConvoy' : 'followMe'));
  if (labelOnly) return;
  if (on && S.map) {
    S.camB = S.map.getBearing(); S.camP = S.map.getPitch();
    S.zoomTarget = Math.max(S.map.getZoom(), 15);
    setFollowPadding();
    kick();
  }
}
function fitConvoy() {
  if (!S.map) return;
  const b = new maplibregl.LngLatBounds();
  let n = 0;
  for (const m of S.members.values()) if (m.lat != null && (m.online || m.id === me.id)) { b.extend([m.lng, m.lat]); n++; }
  const dest = S.plan.wps[S.plan.wps.length - 1];
  if (dest) { b.extend([dest.lng, dest.lat]); n++; }
  if (!n) return;
  const bottom = $('#hudBottom').offsetHeight + 30;
  S.map.fitBounds(b, { padding: { top: 30, bottom, left: 50, right: 50 }, maxZoom: 15, bearing: 0, pitch: 0, duration: 800 });
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
    el.innerHTML = last ? ic(ICON.flag, 13) : String(i + 1);
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
  S.nav.last = clock();
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
    if (clock() - (S.routeFailT || 0) > 60000) { S.routeFailT = clock(); toast(t('routeFail'), 'warn', 5000); }
  } finally {
    S.routing = false;
    updateNavSign();
    if (S.routeAgain) { S.routeAgain = false; computeRoute(); }
  }
}
function instr(step) {
  const N = NAV[prefs.lang] || NAV.fr, mod = step.mod;
  const dir = mod && mod !== 'straight' && mod !== 'uturn' ? (N.mod[mod] || '') : '';
  const f = (k, extra) => {
    let s = N[k];
    const v = Object.assign({ d: dir, D: dir.charAt(0).toUpperCase() + dir.slice(1) }, extra || {});
    for (const key of Object.keys(v)) s = s.split('{' + key + '}').join(v[key]);
    return s;
  };
  switch (step.type) {
    case 'depart': return N.depart;
    case 'arrive': return step.final ? N.arrive : N.stop;
    case 'turn':
    case 'end of road':
      if (mod === 'uturn') return N.uturn;
      return dir ? f(step.type === 'end of road' ? 'endroad' : 'turn') : N.straight;
    case 'merge': return f(dir ? 'mergeDir' : 'merge');
    case 'on ramp': return f(dir ? 'onrampDir' : 'onramp');
    case 'off ramp': return f(dir ? 'offrampDir' : 'offramp');
    case 'fork': return dir ? f('fork') : N.straight;
    case 'roundabout':
    case 'rotary': return step.exit ? f('rb', { n: N.ord(step.exit) }) : N.rbcont;
    case 'roundabout turn': return dir ? f('rbturn') : N.rbcont;
    case 'exit roundabout':
    case 'exit rotary': return N.rbexit;
    default: return mod === 'uturn' ? N.uturn : (dir ? f('contDir') : N.straight);
  }
}
function arrowSVG(step) {
  const W = 'currentColor';
  if (!step || step.type === 'arrive') return `<svg viewBox="0 0 48 48"><path d="M24 44S11 31 11 21a13 13 0 0 1 26 0c0 10-13 23-13 23z" fill="none" stroke="${W}" stroke-width="3.5"/><circle cx="24" cy="21" r="4.5" fill="${W}"/></svg>`;
  if (step.mod === 'uturn') return `<svg viewBox="0 0 48 48"><path d="M31 44V20a8 8 0 0 0-16 0v10" fill="none" stroke="${W}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 28l7 10 7-10z" fill="${W}"/></svg>`;
  const A = { straight: 0, 'slight right': 45, right: 90, 'sharp right': 135, 'slight left': -45, left: -90, 'sharp left': -135 };
  const a = (A[step.mod] ?? 0) * RAD;
  const round = /roundabout|rotary/.test(step.type) && step.type.indexOf('exit') !== 0;
  const sx = Math.sin(a), cyy = Math.cos(a);
  const cx = round ? 24 : 24 - 6 * sx, cy = round ? 22 : 25;
  const r0 = round ? 8 : 0, L = round ? 13 : 14;
  const bx = cx + r0 * sx, by = cy - r0 * cyy, ex = cx + L * sx, ey = cy - L * cyy;
  const f = n => n.toFixed(1);
  const tip = [ex + 7 * sx, ey - 7 * cyy], l = [ex + 6 * cyy, ey + 6 * sx], r = [ex - 6 * cyy, ey - 6 * sx];
  const shaft = round ? `M24 44V${cy + r0}` : `M${f(cx)} 44V${cy}L${f(ex)} ${f(ey)}`;
  return `<svg viewBox="0 0 48 48"><g fill="none" stroke="${W}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">`
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
    if (S.nav.off >= 3 && clock() - S.nav.last > 12000 && !S.routing) computeRoute();
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
    sfx('arrive'); haptic('alert');
  } else {
    toast(t('stopReached', { label: next.label }), 'ok', 5000);
  }
  updateNavSign();
  if (S.sheet === 'route') renderRouteSheet();
}
function updateNavSign() { updateNavSignInner(); layoutSpeedo(); }
function updateNavSignInner() {
  const card = $('#navCard'), eta = $('#navEta'), rt = S.route;
  if (!S.plan.wps.length) { card.hidden = true; eta.hidden = true; return; }
  card.hidden = false;
  const set = (icon, dist, text, road) => {
    $('.nav-ico', card).innerHTML = icon; $('.nav-dist', card).textContent = dist;
    $('.nav-text', card).textContent = text; $('.nav-road', card).textContent = road;
    $('.nav-dist', card).hidden = !dist;
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
  $('#etaTime').textContent = t('eta', { time: fmtClock(clock() + secs * 1000) });
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
        <span class="wp${last ? ' dest' : ''}">${last ? ic(ICON.flag, 13) : i + 1}</span>
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
  renderPinList();
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
        <button class="mini" data-res="${i}" data-as="stop">${esc(t('asStop'))}</button><button class="mini go" data-res="${i}" data-as="dest">${esc(t('asDest'))}</button></div>`;
    }).join('');
    box._features = fs;
  } catch (e) {
    box.innerHTML = `<p class="s">${esc(t('searchFail'))}</p>`;
  }
}
async function onMapClick(e) {
  if (!S.pick) return;
  const mode = S.pick;
  S.pick = false; $('#pickBar').hidden = true;
  const { lat, lng } = e.lngLat;
  if (mode === 'pin') { openPinNew(lat, lng); return; }
  let label = t('mapPoint');
  try {
    const j = await photon('/reverse', `lat=${lat.toFixed(6)}&lon=${lng.toFixed(6)}`);
    const f = j.features && j.features[0];
    if (f) label = placeLabel(f.properties || {}).title;
  } catch (err) { /* garde le libellé par défaut */ }
  addWp({ id: rid(), lat, lng, label }, false);
  openSheet('route');
}

/* ---------- épingles partagées ---------- */
const pinLabel = p => p.label || t('pin_' + p.type);
function agoText(at) {
  const min = Math.floor((clock() - at) / 60000);
  return min < 1 ? t('agoNow') : t('agoMin', { n: min });
}
function renderPins() {
  S.pinMarkers.forEach(mk => mk.remove());
  S.pinMarkers = [];
  if (!S.map) return;
  for (const p of S.pins.values()) {
    const el = document.createElement('div');
    el.className = 'pin' + (p.inRoute ? ' in-route' : '') + (p.type === 'danger' ? ' danger' : '');
    el.style.setProperty('--c', member(p.by).color);
    el.innerHTML = `<div class="pin-b">${ic(PIN_ICON[p.type] || PIN_ICON.other, 16)}</div>`;
    el.addEventListener('click', ev => { ev.stopPropagation(); openPin(p.id); });
    S.pinMarkers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).addTo(S.map));
  }
}
function renderPinList() {
  const box = $('#pinList');
  if (!box) return;
  const pins = [...S.pins.values()].sort((a, b) => b.at - a.at);
  if (!pins.length) { box.innerHTML = `<p class="s">${esc(t('noPins'))}</p>`; return; }
  const lead = isLeader();
  box.innerHTML = pins.map(p => {
    const d = S.pos ? ', ' + t('at', { d: fmtDist(hav([S.pos.lat, S.pos.lng], [p.lat, p.lng])) }) : '';
    return `<div class="item${p.inRoute ? ' done' : ''}">
      <button class="pin-ico" style="--c:${esc(member(p.by).color)}" data-pin="${esc(p.id)}">${ic(PIN_ICON[p.type] || PIN_ICON.other, 16)}</button>
      <button class="grow" style="text-align:left" data-pin="${esc(p.id)}"><div class="t">${esc(pinLabel(p))}</div><div class="s">${esc(t('pinBy', { name: p.by === me.id ? t('youShort') : member(p.by).name, ago: agoText(p.at) }) + d)}</div></button>
      ${lead && !p.inRoute ? `<button class="mini" data-pinstop="${esc(p.id)}">${esc(t('asStop'))}</button>` : ''}
    </div>`;
  }).join('');
}
function openPinNew(lat, lng) {
  if (!S.active) return;
  S.pinOpen = null;
  S.pinDraft = { lat, lng, type: (S.pinDraft && S.pinDraft.type) || 'view' };
  openSheet('pin');
}
function openPin(id) {
  if (!S.pins.has(id)) return;
  S.pinDraft = null; S.pinOpen = id;
  openSheet('pin');
}
function renderPinSheet() {
  const body = $('#pinBody');
  if (S.pinDraft) {
    const dr = S.pinDraft;
    $('#pinTitle').textContent = t('newPin');
    body.innerHTML = `<div class="field"><span class="field-label">${esc(t('pinType'))}</span>
      <div class="ptypes">${PIN_TYPES.map(k => `<button data-ptype="${k}" aria-pressed="${k === dr.type}">${ic(PIN_ICON[k], 22)}<span>${esc(t('pin_' + k))}</span></button>`).join('')}</div></div>
      <input id="pinLabel" class="text" maxlength="40" placeholder="${esc(t('pinLabelPh'))}" autocomplete="off">
      <button class="btn btn-primary" id="pinSave">${esc(t('addPin'))}</button>`;
    return;
  }
  const p = S.pins.get(S.pinOpen);
  if (!p) { closeSheets(); return; }
  const lead = isLeader(), mine = p.by === me.id;
  const d = S.pos ? ', ' + t('at', { d: fmtDist(hav([S.pos.lat, S.pos.lng], [p.lat, p.lng])) }) : '';
  $('#pinTitle').textContent = pinLabel(p);
  body.innerHTML = `<div class="item" style="border:0;padding-top:0"><span class="pin-ico" style="--c:${esc(member(p.by).color)}">${ic(PIN_ICON[p.type] || PIN_ICON.other, 18)}</span>
      <div class="grow"><div class="t">${esc(t('pin_' + p.type))}</div><div class="s">${esc(t('pinBy', { name: mine ? t('youShort') : member(p.by).name, ago: agoText(p.at) }) + d)}</div></div></div>
    ${p.inRoute ? `<p class="s">${esc(t('pinInRoute'))}</p>` : lead
      ? `<button class="btn btn-primary" data-pinact="stop">${esc(t('pinAsStop'))}</button><button class="btn btn-ghost" data-pinact="dest">${esc(t('pinAsDest'))}</button>`
      : `<p class="s">${esc(t('pinLeaderNote'))}</p>`}
    ${mine || lead ? `<button class="btn btn-danger" data-pinact="del">${esc(t('pinDel'))}</button>` : ''}`;
}
function savePin() {
  const dr = S.pinDraft;
  if (!dr) return;
  const label = ($('#pinLabel') && $('#pinLabel').value.trim()) || '';
  const pin = { id: rid(), lat: dr.lat, lng: dr.lng, type: dr.type, label, by: me.id, at: clock() };
  S.pinDraft = null;
  H.pin(pin);
  send('pin', pin);
  closeSheets();
  sfx('sent'); haptic('drop');
  toast(t('pinAdded'), 'ok', 3500);
}
function pinToRoute(id, asDest) {
  const p = S.pins.get(id);
  if (!p || !isLeader()) return;
  p.inRoute = true;
  addWp({ id: rid(), lat: p.lat, lng: p.lng, label: pinLabel(p) }, asDest);
  send('pin', Object.assign({}, p, { upd: true }));
  renderPins();
}
function deletePin(id) {
  H.pinDel({ id });
  send('pinDel', { id });
  closeSheets();
  toast(t('pinRemoved'), 'info', 3000);
}

/* ---------- chat (vidé à chaque nouveau convoi) ---------- */
function linkify(text) {
  const re = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g;
  let out = '', last = 0, m;
  while ((m = re.exec(text))) {
    let url = m[0], tail = '';
    while (/[.,;:!?)\]]$/.test(url)) { tail = url.slice(-1) + tail; url = url.slice(0, -1); }
    const href = /^https?:/.test(url) ? url : 'https://' + url;
    let shown = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
    if (shown.length > 34) shown = shown.slice(0, 32) + '…';
    out += esc(text.slice(last, m.index)) + `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(shown)}</a>` + esc(tail);
    last = m.index + m[0].length;
  }
  return out + esc(text.slice(last));
}
function updateChatBadge() {
  const b = $('#chatBadge');
  b.hidden = !S.chatUnread;
  b.textContent = S.chatUnread > 9 ? '9+' : String(S.chatUnread);
}
function renderChat() {
  const box = $('#chatList');
  if (!S.chat.length) { box.innerHTML = `<p class="empty">${esc(t('chatEmpty'))}</p>`; return; }
  box.innerHTML = S.chat.map(m => {
    const mine = m.by === me.id, mb = member(m.by);
    return `<div class="msg ${mine ? 'mine' : 'other'}">
      ${mine ? '' : `<span class="who"><i style="--c:${esc(mb.color)}"></i>${esc(mb.name)}</span>`}
      <div class="bubble">${linkify(m.text)}</div><time>${fmtClock(m.at)}</time></div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
  S.chatUnread = 0; updateChatBadge();
}
function sendChat(text) {
  text = String(text || '').trim();
  if (!text || !S.active) return;
  const msg = { id: rid(), by: me.id, text, at: clock() };
  H.chat(msg);
  send('chat', msg);
  sfx('sent'); haptic('select');
}
function shareMyPosition() {
  if (!S.pos) return;
  const la = S.pos.lat.toFixed(5), ln = S.pos.lng.toFixed(5), sep = prefs.lang === 'fr' ? ' : ' : ': ';
  sendChat([
    t('myPosition'),
    'Google Maps' + sep + `https://www.google.com/maps/search/?api=1&query=${la},${ln}`,
    'OpenStreetMap' + sep + OSM_LINK(S.pos.lat, S.pos.lng),
    'Waze' + sep + `https://waze.com/ul?ll=${la},${ln}&navigate=yes`,
  ].join('\n'));
}

/* ---------- talkie ---------- */
function talkStart() { return talkStartLive(); }
function talkStop(silent) { return talkStopLive(silent); }
function updatePTT() {
  const b = $('#ptt'), l = $('#pttLabel');
  b.classList.toggle('nomic', S.micOk === false);
  b.classList.toggle('live', S.talking);
  if (S.micOk === false && !S.talking) l.textContent = t('micOn');
  else if (prefs.talkMode === 'hold') l.textContent = t(S.talking ? 'live' : 'holdTalk');
  else l.textContent = t(S.talking ? 'tapStop' : 'tapTalk');
}
function updateTalkBar() {
  const ts = [...S.members.values()].filter(m => m.talking && m.id !== me.id);
  const bar = $('#talkBar');
  let txt = '';
  if (ts.length === 1) txt = t('talks1', { name: ts[0].name });
  else if (ts.length > 1) txt = t('talksN', { names: ts.map(m => m.name).join(t('and')) });
  bar.hidden = !txt;
  if (txt) $('.who', bar).textContent = txt;
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
  const self = member(me.id); self.st = myStatus(); updateMarker(self);
  send('msg', { id: me.id, k: kind, la: S.pos ? +S.pos.lat.toFixed(5) : null, ln: S.pos ? +S.pos.lng.toFixed(5) : null });
  maybeSendPos(true);
  closeSheets();
  sfx('sent'); haptic('select');
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
  const parts = [m.st && m.st !== 'route' ? statusLabel(m.st) : fmtSpd(m.spd)];
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
  if (!S.active) { el.innerHTML = ''; return; }
  const others = sortedOthers();
  if (!others.length) { el.innerHTML = `<div class="mchip glass wait">${esc(t('waiting', { code: S.code }))}</div>`; return; }
  el.innerHTML = others.map(m => `<button class="mchip glass${m.online && !m.stale ? '' : ' off'}" data-id="${esc(m.id)}">
    <span class="av" style="--c:${esc(m.color)}">${esc(initial(m.name))}</span>
    <span style="min-width:0"><span class="nm">${esc(m.name)}${m.id === S.leaderId ? '<i class="lead-tag" aria-label="' + esc(t('leader')) + '"></i>' : ''}</span><span class="meta">${esc(memberMeta(m))}</span></span>
  </button>`).join('');
}
function renderMembers() {
  const list = [member(me.id), ...sortedOthers()];
  const lead = isLeader();
  const audio = m => {
    const p = RTC.peers.get(m.id), st = p && p.pc.connectionState;
    return st === 'connected' ? t('audioOk') : st === 'failed' ? t('audioFail') : m.online ? t('audioWait') : '';
  };
  const invite = S.live ? `<div class="invite"><div><span class="field-label">${esc(t('codeLabel'))}</span><div class="code-big">${esc(S.code)}</div></div>
    <button class="btn btn-primary" id="btnInvite">${esc(t('shareLink'))}</button></div>` : '';
  $('#membersList').innerHTML = invite + list.map(m => `<div class="item">
    <span class="av" style="--c:${esc(m.color)}">${esc(initial(m.name))}</span>
    <div class="grow"><div class="t">${esc(m.name)}${m.id === me.id ? esc(t('you')) : ''}${m.id === S.leaderId ? '<i class="lead-tag"></i>' : ''}</div>
    <div class="s">${esc(m.id === me.id ? statusLabel(myStatus()) + ', ' + fmtSpd(m.spd) : memberMeta(m))}</div>
    ${m.id !== me.id ? `<div class="s">${esc(audio(m))}</div>` : ''}</div>
    ${m.lat != null ? `<button class="mini" data-see="${esc(m.id)}">${esc(t('see'))}</button>` : ''}
    ${lead && m.id !== me.id && m.online ? `<button class="mini" data-lead="${esc(m.id)}">${esc(t('makeLeader'))}</button>` : ''}
  </div>`).join('') + `<p class="s" style="margin-top:12px">${esc(t('currentLeader', { name: leaderName() }))}</p>`;
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
  $('#endBody').innerHTML = bigStats(rows[0], T ? clock() - T.start : 0)
    + (rows.length > 1 ? `<div class="field"><span class="field-label">${esc(t('rankTitle'))}</span>${rankTable(rows)}</div>` : '')
    + `<button class="btn btn-primary" id="endSave">${esc(t('saveQuit'))}</button>`
    + (S.live && isLeader() && S.online.size > 1 ? `<button class="btn btn-ghost" id="endAll">${esc(t('endAll'))}</button>` : '')
    + `<button class="btn btn-ghost" data-close>${esc(t('keepDriving'))}</button>`;
}
async function finish() {
  const T = S.trip, rows = statsRows();
  let saved = false;
  if (T && (rows[0].dist || 0) >= 300) {
    try {
      await DB.putTrip({ id: T.id, start: T.start, end: clock(), dest: T.dest || '', tracks: T.tracks, names: T.names, colors: T.colors, stats: rows });
      saved = true;
    } catch (e) { /* stockage indisponible */ }
  }
  leave();
  if (saved) openHistory(); else homeErr(t('tooShort'));
}

/* ---------- boucle périodique ---------- */
function tick() {
  if (!S.active) return;
  const now = clock();
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
      if (d > lagMeters()) {
        if (!S.alerts.lag[m.id]) {
          S.alerts.lag[m.id] = true;
          bigAlert('lag', t('convoyWho'), m.id === me.id ? t('lagYou', { d: fmtDist(d) }) : t('lagOther', { name: m.name, d: fmtDist(d) }), m.id === me.id ? null : m.id);
        }
      } else if (d < lagMeters() * 0.6) delete S.alerts.lag[m.id];
    }
    if (L.id !== me.id && S.plan.wps.length && !S.arrived) {
      if ((L.spd || 0) < 3) {
        if (!L.stopSince) L.stopSince = now;
        if (now - L.stopSince > 60000 && !S.alerts.leaderStop) { S.alerts.leaderStop = true; bigAlert('leaderStop', t('convoyWho'), t('leaderStopped', { name: L.name }), L.id); }
      } else { L.stopSince = null; S.alerts.leaderStop = false; }
    }
  }
  if (S.live) { checkLeader(); maybeSendPos(false); }
  renderStrip();
  if (S.sheet === 'members') renderMembers();
  if (S.route) updateNavSign();
  updateSpeedo();
}

/* ---------- compteur : cadran ou numérique, graduation et seuil réglables ---------- */
const GAUGE = { cx: 150, cy: 140, r: 116, max: 300, a0: 135, sweep: 270, step: 10, lbl: 50 };
const GAUGE_SCALES = {
  kmh: [{ max: 160, lbl: 20, step: 10 }, { max: 200, lbl: 25, step: 5 }, { max: 260, lbl: 20, step: 10 }, { max: 300, lbl: 50, step: 10 }],
  mph: [{ max: 100, lbl: 10, step: 5 }, { max: 120, lbl: 20, step: 5 }, { max: 160, lbl: 20, step: 10 }, { max: 200, lbl: 25, step: 5 }],
};
const SPEED_WARN = { kmh: [0, 80, 100, 120], mph: [0, 50, 60, 75] };
const polar = (r, deg) => [GAUGE.cx + r * Math.cos(deg * RAD), GAUGE.cy + r * Math.sin(deg * RAD)];
let gaugeRaf = null;
function buildGauge() {
  const G = GAUGE, f = n => n.toFixed(1);
  Object.assign(G, GAUGE_SCALES[speedKey()][prefs.gaugeScale] || GAUGE_SCALES[speedKey()][3]);
  const svg = $('#gaugeSvg');
  svg.classList.toggle('digital', prefs.gaugeStyle === 'digital');
  if (prefs.gaugeStyle === 'digital') {
    svg.innerHTML = `<text class="g-num g-big" id="gNum" x="150" y="152" text-anchor="middle">–</text>
      <text class="g-unit" x="150" y="192" text-anchor="middle">${spdUnit()}</text>
      <text class="g-dir" id="gDir" x="150" y="228" text-anchor="middle"></text>`;
    return;
  }
  const [sx, sy] = polar(G.r, G.a0), [ex, ey] = polar(G.r, G.a0 + G.sweep);
  const arc = `M${f(sx)} ${f(sy)}A${G.r} ${G.r} 0 1 1 ${f(ex)} ${f(ey)}`;
  G.len = G.r * G.sweep * RAD;
  let ticks = '';
  for (let v = 0; v <= G.max; v += G.step) {
    const a = G.a0 + v / G.max * G.sweep, major = v % G.lbl === 0;
    const [x1, y1] = polar(103, a), [x2, y2] = polar(major ? 92 : 97, a);
    ticks += `<line class="g-tick${major ? ' major' : ''}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
    if (major) { const [lx, ly] = polar(78, a); ticks += `<text class="g-lbl" x="${f(lx)}" y="${f(ly + 4)}" text-anchor="middle">${v}</text>`; }
  }
  $('#gaugeSvg').innerHTML = `<path class="g-track" d="${arc}"/>
    <path class="g-val" id="gVal" d="${arc}" stroke-dasharray="${f(G.len)}" stroke-dashoffset="${f(G.len)}"/>
    ${ticks}<line class="g-needle" id="gNeedle" x1="0" y1="0" x2="0" y2="0"/>
    <text class="g-num" id="gNum" x="150" y="160" text-anchor="middle">–</text>
    <text class="g-unit" x="150" y="184" text-anchor="middle">${spdUnit()}</text>
    <text class="g-dir" id="gDir" x="150" y="232" text-anchor="middle"></text>`;
}
function drawGauge(v) {
  const G = GAUGE, frac = Math.max(0, Math.min(1, v / G.max));
  const num = $('#gNum');
  if (num) num.textContent = S.pos ? String(Math.round(v)) : '–';
  const warn = SPEED_WARN[speedKey()][prefs.speedWarn] || 0;
  $('#gaugeSvg').classList.toggle('over', !!(warn && S.pos && v > warn));
  const val = $('#gVal'), nd = $('#gNeedle');
  if (!val) return;
  val.setAttribute('stroke-dashoffset', (G.len * (1 - frac)).toFixed(1));
  val.style.opacity = frac > 0.002 ? 1 : 0;
  const a = G.a0 + frac * G.sweep, [x1, y1] = polar(G.r - 12, a), [x2, y2] = polar(G.r + 12, a);
  nd.setAttribute('x1', x1.toFixed(1)); nd.setAttribute('y1', y1.toFixed(1)); nd.setAttribute('x2', x2.toFixed(1)); nd.setAttribute('y2', y2.toFixed(1));
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
  if (prefs.view !== 'speed' || !S.active) return;
  const p = S.pos;
  S.spTarget = p && clock() - p.t < 8000 ? kmhTo(p.spd * 3.6) : 0;
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
    [lead, t('gapLeader'), 'opt'], [T.max ? fmtKmh(T.max) : '–', t('max'), 'opt'],
    p && p.alt != null ? [Math.round(p.alt) + ' m', t('altitude'), 'opt'] : [[...S.members.values()].filter(m => m.online && !m.stale).length + '/' + S.members.size, t('carsOnline'), 'opt'],
  ];
  $('#spStats').innerHTML = tiles.map(([v, l, c]) => `<div class="sp-tile ${c}"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`).join('');
}
function layoutSpeedo() {
  const sp = $('#speedo');
  if (!sp || sp.hidden) return;
  const main = $('#main').getBoundingClientRect(), ctr = $('.controls').getBoundingClientRect();
  let bottom = $('#viewTabs').getBoundingClientRect().bottom;
  for (const sel of ['#navCard', '#navEta']) { const el = $(sel); if (!el.hidden) bottom = Math.max(bottom, el.getBoundingClientRect().bottom); }
  sp.style.setProperty('--sp-top', Math.round(bottom - main.top + 12) + 'px');
  sp.style.setProperty('--sp-bottom', Math.round(main.bottom - ctr.top + 12) + 'px');
}
function setView(v) {
  prefs.view = v === 'speed' ? 'speed' : 'map';
  savePrefs();
  const sp = prefs.view === 'speed';
  $('#main').classList.toggle('view-speed', sp);
  $('#speedo').hidden = !sp;
  $('#viewTabs').dataset.view = prefs.view;
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
  if (id === 'pin') renderPinSheet();
  if (id === 'chat') renderChat();
  syncSegs();
  $('#scrim').classList.add('open');
  $('#sheet-' + id).classList.add('open');
  S.sheet = id;
}
function closeSheets() {
  $$('.sheet.open').forEach(s => s.classList.remove('open'));
  $('#scrim').classList.remove('open');
  S.sheet = null;
}
function syncSegs() {
  const uk = speedKey();
  $('#gaugeScaleSeg').innerHTML = GAUGE_SCALES[uk].map((g, i) => `<button data-v="${i}">${g.max}</button>`).join('');
  $('#speedWarnSeg').innerHTML = SPEED_WARN[uk].map((w, i) => `<button data-v="${i}">${w ? w : esc(t('warnOff'))}</button>`).join('');
  $('#lagSeg').innerHTML = [1, 2, 3, 5].map(v => `<button data-v="${v}">${v} ${useMiles() ? 'mi' : 'km'}</button>`).join('');
  $$('.seg[data-pref]').forEach(seg => {
    const k = seg.dataset.pref;
    $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(prefs[k]))));
  });
  $('#accentRow').innerHTML = Object.keys(ACCENTS).map(k =>
    `<button style="--c:${ACCENTS[k]}" data-accent="${k}" aria-label="${k}" aria-pressed="${k === prefs.accent}"></button>`).join('');
  $('#accentField').hidden = prefs.theme === 'red';
  $('#themeNote').textContent = t('thn_' + prefs.theme);
  $('#creditsText').innerHTML = t('creditsHtml');
  $$('#creditsText a').forEach(a => { a.target = '_blank'; a.rel = 'noopener'; });
  $('#versionText').textContent = t('version', { v: APP_VERSION });
  $$('#hapCats [data-hcat]').forEach(b => b.setAttribute('aria-pressed', String(prefs.hapticCats.includes(b.dataset.hcat))));
  $('#sndList').innerHTML = SND_PREVIEW.map(([k, l]) => `<button data-snd="${k}">${ic('<path d="M7 4.5v15l12-7.5z"/>', 14)}${esc(t(l))}</button>`).join('');
}
function setPref(k, v) {
  if (prefs[k] === v) return;
  prefs[k] = v; savePrefs();
  if (k === 'talkMode') { talkStop(); updatePTT(); }
  if (k === 'mapTheme') applyMapStyle(S.map);
  if (k === 'lagKm' || k === 'distUnit') S.alerts.lag = {};
  if (k === 'speedUnit' || k === 'gaugeScale' || k === 'gaugeStyle') { buildGauge(); S.spDisp = 0; updateSpeedo(); }
  if (k === 'speedWarn') drawGauge(S.spDisp || 0);
  if (k === 'speedUnit' || k === 'distUnit') applyLang();
  if (k === 'lang') { applyLang(); applyMapStyle(S.map); }
  if (k === 'accent') applyTheme();
  if (k === 'theme') {
    applyTheme();
    const m = THEMES[v].map;
    if (prefs.mapTheme !== m) setPref('mapTheme', m); else applyMapStyle(S.map);
  }
  syncSegs();
}

/* ---------- convoi réel : Supabase Realtime + WebRTC ---------- */
function connect() {
  if (!S.sb) S.sb = supabase.createClient(NET.supabaseUrl, NET.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  const ch = S.sb.channel('pocketconvoy:' + S.code, { config: { broadcast: { self: false, ack: false }, presence: { key: me.id } } });
  for (const ev of NET_EVENTS) ch.on('broadcast', { event: ev }, ({ payload }) => { try { H[ev](payload || {}); } catch (e) { console.warn(ev, e); } });
  ch.on('presence', { event: 'sync' }, onPresence);
  ch.subscribe(async status => {
    if (status === 'SUBSCRIBED') {
      S.conn = true;
      try { await ch.track({ n: me.name, c: me.color, j: S.joinTs }); } catch (e) { /* ignoré */ }
      send('hello', { id: me.id });
      maybeSendPos(true);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      if (S.conn && S.active) toast(t('connLost'), 'warn', 4000);
      S.conn = false;
    }
  });
  S.channel = ch;
}
function disconnect() {
  for (const id of [...RTC.peers.keys()]) closePeer(id);
  try { if (S.channel && S.sb) S.sb.removeChannel(S.channel); } catch (e) { /* ignoré */ }
  S.channel = null; S.conn = false; S.online = new Set();
}
function reconnect() {
  if (!S.live) return;
  try { if (S.channel) S.sb.removeChannel(S.channel); } catch (e) { /* ignoré */ }
  S.channel = null; S.firstSync = true;
  connect();
}
function send(event, payload) {
  if (!S.live || !S.channel) return;
  try { S.channel.send({ type: 'broadcast', event, payload }).catch(() => {}); } catch (e) { /* ignoré */ }
}
function maybeSendPos(force) {
  const p = S.pos;
  if (!S.live || !S.channel || !p) return;
  const now = Date.now();
  const moved = S.lastSent ? hav([S.lastSent.lat, S.lastSent.lng], [p.lat, p.lng]) : 1e9;
  if (!force && !(now - S.lastSentT > 2000 && moved > 5) && now - S.lastSentT < 10000) return;
  const T = S.trip || {};
  send('pos', {
    id: me.id, n: me.name, c: me.color, la: +p.lat.toFixed(6), ln: +p.lng.toFixed(6),
    s: Math.round(p.spd * 3.6), h: p.hdg == null ? null : Math.round(p.hdg), st: myStatus(),
    d: Math.round(T.dist || 0), mv: Math.round(T.moving || 0), mx: +(T.max || 0).toFixed(1),
  });
  S.lastSentT = now; S.lastSent = { lat: p.lat, lng: p.lng };
}
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
    if (!S.firstSync) { toast(t('joined', { name: m.name }), 'ok', 3500); sfx('info'); }
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
function checkLeader() {
  if (!S.conn) return;
  if (S.leaderId && S.online.has(S.leaderId)) { S.leaderMissing = 0; return; }
  if (!S.leaderMissing) { S.leaderMissing = Date.now(); return; }
  if (Date.now() - S.leaderMissing < (S.leaderId ? 15000 : 5000)) return;
  const cand = [...S.online].sort((a, b) => (S.joinedAt[a] || S.joinTs) - (S.joinedAt[b] || S.joinTs) || (a < b ? -1 : 1))[0];
  S.leaderMissing = 0;
  if (cand === me.id) { const seq = S.leaderSeq + 1; setLeader(me.id, false, seq); send('leader', { id: me.id, seq }); }
}
Object.assign(H, {
  rtc(d) { onRtc(d); },
  hello(d) {
    if (!d.id || d.id === me.id) return;
    if (S.leaderId) send('state', { to: d.id, leaderId: S.leaderId, leaderSeq: S.leaderSeq, plan: S.plan, pins: [...S.pins.values()], chat: S.chat.slice(-30) });
    maybeSendPos(true);
  },
  state(d) {
    if (d.to !== me.id) return;
    if (d.leaderId) setLeader(d.leaderId, true, d.leaderSeq || 0);
    if (d.plan && d.plan.v > S.plan.v) { S.plan = d.plan; onPlanChanged(); }
    for (const p of d.pins || []) if (!S.pins.has(p.id)) H.pin(Object.assign({}, p, { upd: true }));
    if (!S.chat.length && Array.isArray(d.chat) && d.chat.length) { S.chat = d.chat.slice(-30); if (S.sheet === 'chat') renderChat(); }
  },
  leader(d) { if (d.id) setLeader(d.id, false, d.seq || 0); },
  end(d) {
    if (!d.by || d.by === me.id) return;
    toast(t('endedAll', { name: member(d.by).name }), 'info', 7000);
    openSheet('end');
  },
});
async function shareInvite() {
  if (!S.code) return;
  const url = location.origin + location.pathname + '?c=' + S.code;
  const text = t('shareText', { code: S.code });
  if (navigator.share) { try { await navigator.share({ title: 'PocketConvoy', text, url }); } catch (e) { /* annulé */ } return; }
  try { await navigator.clipboard.writeText(text + ' ' + url); toast(t('linkCopied'), 'ok', 3000); } catch (e) { toast(S.code, 'info', 6000); }
}

/* talkie en direct : une liaison audio avec chaque voiture ; le micro n'est branché que pendant l'appui */
const RTC = { peers: new Map(), pending: new Map(), stream: null, track: null, token: 0 };
async function askMicOnce() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  try {
    setAudioSession('play-and-record');
    const st = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    st.getTracks().forEach(x => x.stop());
    S.micOk = true;
  } catch (e) { S.micOk = false; toast(t('micDenied'), 'warn', 8000); }
  setAudioSession('playback');
  updatePTT();
}
function rtcSend(to, d) { send('rtc', { from: me.id, to, d }); }
const audioTr = pc => pc.getTransceivers().find(x => x.receiver && x.receiver.track && x.receiver.track.kind === 'audio');
function newPC(id) {
  closePeer(id);
  const pc = new RTCPeerConnection({ iceServers: NET.iceServers });
  const p = { id, pc, audio: null };
  RTC.peers.set(id, p);
  pc.onicecandidate = e => { if (e.candidate) rtcSend(id, { cand: e.candidate.toJSON() }); };
  pc.ontrack = e => playRemote(p, (e.streams && e.streams[0]) || new MediaStream([e.track]));
  pc.onconnectionstatechange = () => {
    const st = pc.connectionState;
    if (st === 'failed') setTimeout(() => { if (RTC.peers.get(id) === p && S.online.has(id)) resetPeer(id); }, 2000);
    if (st === 'disconnected') setTimeout(() => { if (RTC.peers.get(id) === p && pc.connectionState === 'disconnected' && S.online.has(id)) resetPeer(id); }, 8000);
    if (S.sheet === 'members') renderMembers();
  };
  return p;
}
function playRemote(p, stream) {
  if (!p.audio) {
    p.audio = document.createElement('audio');
    p.audio.autoplay = true;
    p.audio.setAttribute('playsinline', '');
    document.body.appendChild(p.audio);
  }
  p.audio.srcObject = stream;
  p.audio.play().catch(() => { if (!S.audioHint) { S.audioHint = true; toast(t('tapForSound'), 'info', 6000); } });
}
async function callPeer(id) {
  const p = newPC(id);
  try {
    const tr = p.pc.addTransceiver('audio', { direction: 'sendrecv' });
    if (RTC.track) await tr.sender.replaceTrack(RTC.track);
    await p.pc.setLocalDescription(await p.pc.createOffer());
    const d = p.pc.localDescription;
    rtcSend(id, { sdp: { type: d.type, sdp: d.sdp } });
  } catch (e) { console.warn('offre', e); }
}
async function onRtc({ from, to, d }) {
  if (to !== me.id || !from || !d || !S.live) return;
  try {
    if (d.reset) { closePeer(from); if (me.id < from) setTimeout(() => callPeer(from), 400); return; }
    if (d.sdp && d.sdp.type === 'offer') {
      const p = newPC(from);
      await p.pc.setRemoteDescription(d.sdp);
      const tr = audioTr(p.pc);
      if (tr) { tr.direction = 'sendrecv'; if (RTC.track) await tr.sender.replaceTrack(RTC.track); }
      await p.pc.setLocalDescription(await p.pc.createAnswer());
      const ld = p.pc.localDescription;
      rtcSend(from, { sdp: { type: ld.type, sdp: ld.sdp } });
      flushCands(from);
    } else if (d.sdp && d.sdp.type === 'answer') {
      const p = RTC.peers.get(from);
      if (p && p.pc.signalingState === 'have-local-offer') { await p.pc.setRemoteDescription(d.sdp); flushCands(from); }
    } else if (d.cand) {
      const p = RTC.peers.get(from);
      if (p && p.pc.remoteDescription) await p.pc.addIceCandidate(d.cand).catch(() => {});
      else { const q = RTC.pending.get(from) || []; q.push(d.cand); RTC.pending.set(from, q); }
    }
  } catch (e) { console.warn('rtc', e); }
}
function flushCands(id) {
  const p = RTC.peers.get(id), q = RTC.pending.get(id);
  RTC.pending.delete(id);
  if (p && q) q.forEach(c => p.pc.addIceCandidate(c).catch(() => {}));
}
function closePeer(id) {
  const p = RTC.peers.get(id);
  if (p) { try { p.pc.close(); } catch (e) { /* ignoré */ } if (p.audio) p.audio.remove(); RTC.peers.delete(id); }
  RTC.pending.delete(id);
}
function resetPeer(id) {
  closePeer(id);
  if (me.id < id) callPeer(id); else rtcSend(id, { reset: true });
}
function checkPeers() {
  for (const id of S.online) {
    if (id === me.id) continue;
    const p = RTC.peers.get(id), st = p && p.pc.connectionState;
    if (!p ? me.id < id : ['failed', 'closed', 'disconnected'].includes(st)) resetPeer(id);
  }
}
async function talkStartLive() {
  if (S.talking || !S.active) return;
  S.talking = true;
  const token = ++RTC.token;
  sfx('talkStart'); haptic('talk');
  clearTimeout(S.talkTimer);
  S.talkTimer = setTimeout(() => talkStop(), 60000);
  updatePTT();
  try {
    setAudioSession('play-and-record');
    const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    S.micOk = true;
    if (!S.talking || token !== RTC.token) { st.getTracks().forEach(x => x.stop()); setAudioSession('playback'); return; }
    RTC.stream = st; RTC.track = st.getAudioTracks()[0];
    for (const p of RTC.peers.values()) { const tr = audioTr(p.pc); if (tr) tr.sender.replaceTrack(RTC.track).catch(() => {}); }
    send('talk', { id: me.id, on: true });
  } catch (e) {
    S.micOk = false; S.talking = false; clearTimeout(S.talkTimer); updatePTT();
    setAudioSession('playback');
    toast(t('micDenied'), 'warn', 8000);
  }
}
function talkStopLive(silent) {
  if (!S.talking) return;
  S.talking = false;
  RTC.token++;
  clearTimeout(S.talkTimer);
  for (const p of RTC.peers.values()) { const tr = audioTr(p.pc); if (tr) tr.sender.replaceTrack(null).catch(() => {}); }
  if (RTC.stream) RTC.stream.getTracks().forEach(x => x.stop());
  RTC.stream = null; RTC.track = null;
  setAudioSession('playback');
  send('talk', { id: me.id, on: false });
  if (!silent) { sfx('talkEnd'); haptic('talk'); }
  updatePTT();
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
      <div class="t">${esc(tr.dest || t('tripDefault'))}</div>
      <div class="s">${esc(fmtDate(tr.start))}</div>
      <div class="s">${esc(t('tripLine', { dist: fmtDist(mine.dist || 0), dur: fmtDur(tr.end - tr.start), cars: n > 1 ? t('carsN', { n }) : t('cars1') }))}</div>
    </div><span class="chev">${ic(ICON.chev, 18)}</span></button>`;
  }).join('');
}
async function openTrip(id) {
  let tr = null;
  try { tr = (await DB.allTrips()).find(x => x.id === id); } catch (e) { /* ignoré */ }
  if (!tr) return;
  show('trip');
  $('#tripTitle').textContent = tr.dest || t('tripDefault');
  const mine = tr.stats.find(r => r.me) || { dist: 0, mv: 0, mx: 0 };
  $('#tripStats').innerHTML = `<p class="s">${esc(t('fromTo', { date: fmtDate(tr.start), a: fmtClock(tr.start), b: fmtClock(tr.end) }))}</p>`
    + bigStats(mine, 0)
    + (tr.stats.length > 1 ? `<div class="field"><span class="field-label">${esc(t('rankTitle'))}</span>${rankTable(tr.stats)}</div>` : '')
    + `<button class="btn btn-danger" data-deltrip="${esc(tr.id)}">${esc(t('delTrip'))}</button>`;

  if (RP && RP.map) RP.map.remove();
  const dur = Math.max(1, Math.round((tr.end - tr.start) / 1000));
  const speeds = [10, 30, 60, 120, 300, 600];
  const target = dur / 60;
  const speed = speeds.reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
  const map = new maplibregl.Map({ container: 'tripMap', style: mapPlaceholder(), center: [MAP_HOME[1], MAP_HOME[0]], zoom: 7, attributionControl: false, dragRotate: false });
  map.touchZoomRotate.disableRotation();
  RP = { map, t: tr, T: 0, dur, playing: false, markers: {}, speed, speeds, raf: null, lastTs: 0 };
  $('#rpSlider').max = dur; $('#rpSlider').value = 0;
  updatePlayBtn();
  let first = true;
  map.on('style.load', () => {
    const b = new maplibregl.LngLatBounds();
    let any = false;
    for (const [mid, track] of Object.entries(tr.tracks)) {
      if (!track || track.length < 2) continue;
      any = true;
      const col = tr.colors[mid] || '#8B8B93';
      if (!map.getSource('tr-' + mid)) map.addSource('tr-' + mid, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: track.map(p => [p[2], p[1]]) } } });
      if (!map.getLayer('tr-' + mid)) map.addLayer({ id: 'tr-' + mid, type: 'line', source: 'tr-' + mid, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': col, 'line-width': 3, 'line-opacity': 0.85 } });
      track.forEach(p => b.extend([p[2], p[1]]));
      if (!RP.markers[mid]) {
        const el = document.createElement('div');
        el.className = 'car rp';
        el.style.setProperty('--c', col);
        el.innerHTML = `<div class="car-dot"><span>${esc(initial(tr.names[mid]))}</span></div>`;
        RP.markers[mid] = new maplibregl.Marker({ element: el }).setLngLat([track[0][2], track[0][1]]).addTo(map);
      }
    }
    if (first) { first = false; if (any) map.fitBounds(b, { padding: 40, duration: 0 }); setReplay(0); }
  });
  applyMapStyle(map);
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
  $('#rpPlay').innerHTML = ic(RP.playing ? ICON.pause : ICON.play, 20);
  $('#rpPlay').setAttribute('aria-label', t(RP.playing ? 'pause' : 'play'));
  $('#rpSpeed').textContent = '×' + RP.speed;
}
function closeTrip() {
  if (RP) { RP.playing = false; cancelAnimationFrame(RP.raf); if (RP.map) RP.map.remove(); RP = null; }
  openHistory();
}

/* ---------- branchements ---------- */
function bind() {
  document.addEventListener('click', e => {
    if (Date.now() < (S.ignoreClickUntil || 0)) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  $('#swatches').addEventListener('click', e => {
    const b = e.target.closest('.swatch');
    if (!b) return;
    me.color = b.dataset.c; store.set('color', me.color);
    $$('.swatch').forEach(s => s.setAttribute('aria-pressed', String(s === b)));
  });
  $('#name').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
  $('#btnCreate').addEventListener('click', () => { if (!configOk()) { homeErr(t('cfgWarn')); return; } start({ creating: true, code: newCode() }); });
  $('#btnJoin').addEventListener('click', () => {
    if (!configOk()) { homeErr(t('cfgWarn')); return; }
    const c = $('#code').value.trim().toUpperCase();
    if (c.length !== 6) { homeErr(t('errCode')); $('#code').focus(); return; }
    start({ code: c });
  });
  $('#code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); });
  $('#code').addEventListener('keydown', e => { if (e.key === 'Enter') { e.target.blur(); $('#btnJoin').click(); } });
  $('#btnHistory').addEventListener('click', () => openHistory());
  $('#btnHomeSettings').addEventListener('click', () => openSheet('settings'));
  $('#btnChat').addEventListener('click', () => openSheet('chat'));
  $('#chatSend').addEventListener('click', () => { const i = $('#chatInput'); sendChat(i.value); i.value = ''; });
  $('#chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(e.target.value); e.target.value = ''; } });
  $('#chatPos').addEventListener('click', shareMyPosition);

  document.addEventListener('click', e => {
    const segBtn = e.target.closest('.seg[data-pref] button');
    if (segBtn) { const k = segBtn.closest('.seg').dataset.pref; setPref(k, ['lagKm', 'gaugeScale', 'speedWarn'].includes(k) ? +segBtn.dataset.v : segBtn.dataset.v); return; }
    const acc = e.target.closest('[data-accent]');
    if (acc) { setPref('accent', acc.dataset.accent); return; }
    if (e.target.closest('[data-close]')) closeSheets();
  });

  $('#main').addEventListener('pointerdown', () => { if ((S.ac && S.ac.state !== 'running') || [...RTC.peers.values()].some(p => p.audio && p.audio.paused)) unlockAudio(); }, { capture: true });
  $('#viewTabs').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
  $('#btnLocate').addEventListener('click', () => { if (S.follow) { setFollow(false); fitConvoy(); } else setFollow(true); });
  $('#navCard').addEventListener('click', () => openSheet(S.arrived ? 'end' : 'route'));
  $$('[data-sheet]').forEach(b => b.addEventListener('click', () => openSheet(b.dataset.sheet)));
  $('#scrim').addEventListener('click', closeSheets);
  window.addEventListener('resize', () => setTimeout(() => { layoutSpeedo(); if (S.follow) setFollowPadding(); }, 120));
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => layoutSpeedo()); ro.observe($('.hud-top')); ro.observe($('.controls')); }

  const ptt = $('#ptt');
  let armed = false;
  ptt.addEventListener('contextmenu', e => e.preventDefault());
  ptt.addEventListener('pointerdown', e => {
    e.preventDefault();
    unlockAudio();
    armed = true;
    if (prefs.talkMode === 'hold') { try { ptt.setPointerCapture(e.pointerId); } catch (err) { /* ignoré */ } talkStart(); }
  });
  ptt.addEventListener('pointerup', () => {
    if (!armed) return;
    armed = false;
    if (prefs.talkMode === 'hold') talkStop();
    else if (S.talking) talkStop(); else talkStart();
  });
  ptt.addEventListener('pointercancel', () => { armed = false; if (prefs.talkMode === 'hold') talkStop(); });

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
  const startPick = mode => {
    closeSheets(); S.pick = mode; setFollow(false);
    $('#pickText').textContent = t(mode === 'pin' ? 'pinHint' : 'pickHint');
    $('#pickBar').hidden = false;
    if (prefs.view === 'speed') setView('map');
  };
  $('#btnPick').addEventListener('click', () => startPick('stop'));
  $('#btnPinMap').addEventListener('click', () => startPick('pin'));
  $('#btnPinHere').addEventListener('click', () => { if (S.pos) openPinNew(S.pos.lat, S.pos.lng); });
  $('#pinList').addEventListener('click', e => {
    const st = e.target.closest('[data-pinstop]');
    if (st) { pinToRoute(st.dataset.pinstop, false); renderRouteSheet(); return; }
    const b = e.target.closest('[data-pin]');
    if (b) openPin(b.dataset.pin);
  });
  $('#pinBody').addEventListener('click', e => {
    const ty = e.target.closest('[data-ptype]');
    if (ty && S.pinDraft) { S.pinDraft.type = ty.dataset.ptype; $$('#pinBody [data-ptype]').forEach(x => x.setAttribute('aria-pressed', String(x === ty))); return; }
    if (e.target.closest('#pinSave')) { savePin(); return; }
    const act = e.target.closest('[data-pinact]');
    if (!act || !S.pinOpen) return;
    if (act.dataset.pinact === 'del') deletePin(S.pinOpen);
    else { pinToRoute(S.pinOpen, act.dataset.pinact === 'dest'); closeSheets(); }
  });
  $('#hapCats').addEventListener('click', e => {
    const b = e.target.closest('[data-hcat]');
    if (b) {
      const c = b.dataset.hcat, set = new Set(prefs.hapticCats);
      if (set.has(c)) set.delete(c); else set.add(c);
      prefs.hapticCats = [...set]; savePrefs(); syncSegs();
      return;
    }
    if (e.target.closest('#hapTest')) haptic('alert', true);
  });
  $('#sndList').addEventListener('click', e => {
    const b = e.target.closest('[data-snd]');
    if (!b) return;
    unlockAudio();
    sfx(b.dataset.snd, true);
    b.classList.add('playing');
    setTimeout(() => b.classList.remove('playing'), 900);
  });
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('button');
    if (b && b.id !== 'ptt' && !b.closest('#hapCats')) haptic('tap');
  }, { capture: true });
  if (window.visualViewport) {
    const vv = window.visualViewport, app = $('#app');
    let predicted = store.get('kbH', 0);
    const isField = el => el && el.matches && el.matches('input.text, textarea');
    const apply = () => {
      const H = document.documentElement.clientHeight;
      const kb = Math.round(H - vv.height);
      const open = kb > 100 && isField(document.activeElement);
      app.style.transform = open && vv.offsetTop > 0 ? `translateY(${Math.round(vv.offsetTop)}px)` : '';
      app.style.setProperty('--kb', (open ? kb : 0) + 'px');
      if (open) {
        if (Math.abs(kb - predicted) > 4) { predicted = kb; store.set('kbH', kb); }
        if (S.sheet === 'chat') { const l = $('#chatList'); l.scrollTop = l.scrollHeight; }
      }
    };
    vv.addEventListener('resize', apply); vv.addEventListener('scroll', apply);
    document.addEventListener('focusin', e => { if (isField(e.target) && predicted) app.style.setProperty('--kb', predicted + 'px'); });
    document.addEventListener('focusout', () => setTimeout(() => {
      if (!isField(document.activeElement)) { app.style.setProperty('--kb', '0px'); app.style.transform = ''; }
    }, 60));
  }
  $('#pickCancel').addEventListener('click', () => { S.pick = false; $('#pickBar').hidden = true; });

  $$('[data-q]').forEach(b => b.addEventListener('click', () => sendQuick(b.dataset.q)));
  $('#sosShow').addEventListener('click', () => { $('#sos').classList.remove('on'); focusMember($('#sos').dataset.id); });
  $('#sosClose').addEventListener('click', () => $('#sos').classList.remove('on'));

  $('#strip').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) focusMember(b.dataset.id); });
  $('#membersList').addEventListener('click', e => {
    if (e.target.closest('#btnInvite')) { shareInvite(); return; }
    const s = e.target.closest('[data-see]'), l = e.target.closest('[data-lead]');
    if (s) focusMember(s.dataset.see);
    if (l && isLeader()) { giveLeader(l.dataset.lead); renderMembers(); }
  });

  $('#btnEndOpen').addEventListener('click', () => openSheet('end'));
  $('#btnQuit').addEventListener('click', () => { if (confirm(t('confirmQuit'))) leave(); });
  $('#endBody').addEventListener('click', e => {
    if (e.target.closest('#endSave')) finish();
    if (e.target.closest('#endAll')) { send('end', { by: me.id }); finish(); }
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
    if (!S.active) return;
    if (document.visibilityState === 'visible') {
      keepAwake(); unlockAudio(); startGeo();
      if (!S.conn) reconnect();
      setTimeout(checkPeers, 1500); maybeSendPos(true);
    }
    else talkStop(true);
  });
}

applyTheme();
buildGauge();
bind();
renderHome();
applyLang();
setFollow(true, true);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
