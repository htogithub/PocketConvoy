'use strict';
const APP_VERSION = '1.9.0';
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
const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const FALLBACK_STYLES = {
  night: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  day: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};
const MAP_PAL = {
  dark: { bg: '#141416', land: '#18181B', park: '#162019', water: '#0D1821', waterway: '#1B3040', building: '#1E1E22', minor: '#2B2B31', major: '#3A3A42',
    motorway: '#4C4C55', casing: '#141416', rail: '#2A2A30', boundary: '#45454E', label: '#8E8E97', labelStrong: '#E4E4E8', labelRoad: '#7C7C85', labelWater: '#4F7A96', halo: '#141416' },
  oled: { bg: '#000000', land: '#060607', park: '#08100A', water: '#04090E', waterway: '#10202B', building: '#111113', minor: '#202024', major: '#2E2E34',
    motorway: '#3E3E46', casing: '#000000', rail: '#1E1E22', boundary: '#3A3A42', label: '#85858E', labelStrong: '#E4E4E8', labelRoad: '#6E6E77', labelWater: '#456B84', halo: '#000000' },
  offroad: { bg: '#191A14', land: '#1D1F17', park: '#1F2919', water: '#11202A', waterway: '#1E3A4A', building: '#26271F', minor: '#3B3929', major: '#4C4833',
    motorway: '#5B553A', casing: '#15160F', rail: '#302F25', boundary: '#57533F', label: '#ABA78E', labelStrong: '#F0ECDC', labelRoad: '#918D75', labelWater: '#5E8BA4', halo: '#15160F' },
  offroadDay: { bg: '#EEEADC', land: '#EBE6D4', park: '#DAE2C5', water: '#C4D7DF', waterway: '#A7C4D2', building: '#DFD9C8', minor: '#FFFFFF', major: '#FFF7E3',
    motorway: '#FBEDC8', casing: '#CDC4AB', rail: '#C9C2AD', boundary: '#B1A78B', label: '#5C5643', labelStrong: '#25221A', labelRoad: '#6C6650', labelWater: '#4E7990', halo: '#EEEADC' },
  light: { bg: '#F3F3F1', land: '#EEEEEB', park: '#E2EADD', water: '#CBD9E4', waterway: '#B4C8D8', building: '#E3E3DF', minor: '#FFFFFF', major: '#FFFFFF',
    motorway: '#FFFFFF', casing: '#D2D2CC', rail: '#CFCFCA', boundary: '#B5B5AF', label: '#5F5F66', labelStrong: '#18181B', labelRoad: '#6B6B72', labelWater: '#5A7F99', halo: '#F3F3F1' },
};
const COLORS = ['#4C9EFF', '#FF4D6D', '#2BD9A0', '#FFC53D', '#B07CFF', '#00C2FF', '#FF8A3D', '#E8E8E8'];
const ACCENT_HUES = { orange: 15, yellow: 51, lime: 85, cyan: 191, magenta: 333 };
function hslHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
  return '#' + f(0) + f(8) + f(4);
}
function hexHue(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 215;
  const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
}
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * c(n >> 16) + 0.7152 * c((n >> 8) & 255) + 0.0722 * c(n & 255);
}
const memberColor = h => hslHex(h, 85, 62);
const accentColor = h => hslHex(h, 100, 56);
const THEMES = { offroad: { map: 'night', meta: '#12130E' }, graphite: { map: 'night', meta: '#0F0F10' }, light: { map: 'day', meta: '#F4F4F2' }, oled: { map: 'night', meta: '#000000' }, red: { map: 'night', meta: '#050000' } };
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
    nickname: 'Ton pseudo', nicknamePh: 'Pseudo', colour: 'Ta couleur sur la carte', colourAria: 'Couleur',
    history: 'Historique', settings: 'Réglages',
    homeNote: 'Pendant le trajet, garde l’app ouverte au premier plan, écran allumé : sur iPhone, une web app s’arrête quand l’écran se verrouille.',
    tabMap: 'Carte', tabSpeed: 'Compteur', viewAria: 'Vue', pickHint: 'Touche la carte pour placer l’étape', cancel: 'Annuler',
    toolRoute: 'Parcours', toolAlerts: 'Alertes', toolConvoy: 'Convoi', toolSettings: 'Réglages', ptt: 'Talkie-walkie', close: 'Fermer', back: 'Retour',
    route: 'Parcours', searchPh: 'Adresse ou lieu', pickBtn: 'Placer une étape sur la carte',
    quickTitle: 'Alertes rapides', qPause: 'Pause', qFuel: 'Essence', qSlow: 'Ralentissez', qLost: 'Je suis perdu', qOk: 'Tout va bien, je repars',
    qSos: 'Panne ou urgence', qSosConfirm: 'Toucher encore pour confirmer',
    quickNote: 'Chaque alerte part à tout le convoi avec un son. Une panne s’affiche en plein écran chez les autres.',
    convoy: 'Convoi', lang: 'Langue', theme: 'Thème', accent: 'Couleur d’accent', talkBtn: 'Bouton du talkie', hold: 'Maintenir', toggle: 'Appui simple',
    map: 'Carte', night: 'Sombre', day: 'Claire', lagAlert: 'Alerte quand un véhicule est loin du leader',
    endTrip: 'Terminer le trajet', yourTrip: 'Ton trajet',
    th_graphite: 'Graphite', th_light: 'Clair', th_oled: 'OLED', th_red: 'Nuit rouge',
    thn_graphite: 'Gris neutres, une seule couleur vive pour l’essentiel.', thn_light: 'Pour rouler en plein jour.',
    thn_oled: 'Noir pur : moins d’éblouissement et de batterie sur les écrans OLED.', thn_red: 'Tout en rouge sombre pour garder les yeux habitués à la nuit. L’accent est fixé au rouge.',
    sosHas: '{name} a un problème', sosSub: 'Panne ou urgence signalée', sosShow: 'Voir sur la carte', sosOk: 'J’ai vu', sosDist: 'À {d} de toi',
    play: 'Lecture', pause: 'Pause', replayAria: 'Position dans le trajet', gaugeAria: 'Compteur de vitesse',
    st_route: 'En route', st_arret: 'À l’arrêt', st_pause: 'En pause', st_essence: 'À la pompe', st_perdu: 'Perdu', st_panne: 'En panne',
    q_pause: 'Je fais une pause', q_essence: 'Je m’arrête faire le plein', q_perdu: 'Je suis perdu', q_ralentir: 'Attention, ralentissez',
    q_ok: 'Tout va bien, je repars', q_sos: 'Panne ou urgence', msgFrom: '{name} : {text}',
    errName: 'Choisis un pseudo pour que les autres te reconnaissent.', errLibs: 'La carte n’a pas pu se charger. Vérifie ta connexion.',
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
    youShort: 'toi', nobody: 'personne', car: 'Véhicule', distance: 'Distance', driving: 'Conduite', avgShort: 'Moy.', max: 'Max',
    rankTitle: 'Le convoi, classé par distance', drivingOf: 'Temps de conduite sur {t}', drivingTime: 'Temps de conduite',
    avgMoving: 'Vitesse moyenne en roulant', maxSpeed: 'Vitesse max', keepDriving: 'Continuer à rouler',
    lagYou: 'Tu es à {d} du leader', lagOther: '{name} est à {d} du leader', leaderStopped: 'Le leader {name} est à l’arrêt',
    heading: 'Cap {d}', itsYou: 'C’est toi', carsOnline: 'Véhicules connectés', average: 'Moyenne', gapLeader: 'Écart au leader', altitude: 'Altitude',
    noTrips: 'Aucun trajet enregistré pour l’instant. Ils apparaissent ici quand tu termines un trajet.', tripDefault: 'Trajet',
    cars1: '1 véhicule', carsN: '{n} véhicules', tripLine: '{dist} en {dur}, {cars}', fromTo: '{date}, de {a} à {b}', delTrip: 'Supprimer ce trajet',
    confirmDel: 'Supprimer ce trajet de l’historique ?',
    viewConvoy: 'Vue du convoi', followMe: 'Me suivre',
    on: 'Activés', off: 'Désactivés',
    haptics: 'Retour haptique', hapOff: 'Désactivé', hapLight: 'Léger', hapNormal: 'Normal', hapStrong: 'Fort', hapFor: 'Utiliser pour',
    hapUi: 'Boutons', hapTalk: 'Talkie', hapAlerts: 'Alertes', hapTest: 'Tester',
    hapNote: 'Sur iPhone, Safari ne permet qu’un léger tic (iOS 18 et plus) : l’intensité règle le nombre de tics. Sur Android, la vibration suit l’intensité.',
    sounds: 'Sons', sndPreview: 'Écouter le son de chaque alerte', sndLag: 'Véhicule distancé', sndLeaderStop: 'Leader arrêté', sndPin: 'Nouveau pin', convoyWho: 'Convoi',
    pins: 'Pins du convoi', noPins: 'Aucun pin pour l’instant. Garde le doigt appuyé sur la carte pour en placer un.', newPin: 'Nouveau pin', pinType: 'Type',
    pinLabelPh: 'Nom (facultatif)', addPin: 'Ajouter le pin', pinHere: 'Pin à ma position', pinOnMap: 'Placer un pin sur la carte', pinHint: 'Touche la carte pour placer le pin',
    pinBy: 'Ajouté par {name}, {ago}', agoNow: 'à l’instant', agoMin: 'il y a {n} min', pinAdded: 'Pin ajouté, visible par tout le convoi',
    pinFrom: '{name} a ajouté un pin : {label}', pinAsStop: 'Ajouter comme étape', pinAsDest: 'Choisir comme destination', pinDel: 'Supprimer le pin',
    pinInRoute: 'Ce pin fait partie du parcours.', pinLeaderNote: 'Le leader peut l’ajouter au parcours.', pinAccepted: '{name} a ajouté ton pin au parcours', pinRemoved: 'Pin supprimé',
    pin_view: 'Point de vue', pin_food: 'Restaurant', pin_fuel: 'Station-service', pin_parking: 'Parking', pin_danger: 'Danger', pin_other: 'Autre',
    credits: 'Crédits', version: 'Version {v}',
    scanQr: 'Scanner un QR code', scanHint: 'Vise le QR code du convoi', scanBad: 'Ce QR code n’est pas un convoi PocketConvoy.',
    camDenied: 'Caméra refusée. Autorise la caméra pour Safari dans les réglages de l’iPhone.', camFail: 'Impossible d’ouvrir la caméra.',
    qrHint: 'Tes amis le scannent depuis l’accueil de PocketConvoy. Touche-le pour l’agrandir.', qrFail: 'QR code indisponible sans connexion.',
    gNeedle: 'Aiguille', gRing: 'Anneau', gBar: 'Barre', gHud: 'Pare-brise',
    gHudNote: 'Pare-brise : chiffres inversés qui se reflètent dans le pare-brise la nuit. Pose le téléphone à plat sous la vitre.',
    tutoSkip: 'Passer', tutoNext: 'Suivant', tutoGo: 'C’est parti', tutoAgain: 'Revoir le tutoriel',
    tuto1t: 'Bienvenue sur PocketConvoy', tuto1d: 'Roulez à plusieurs véhicules, voitures ou motos, sans vous perdre : chacun voit les autres en direct sur la carte.',
    tuto2t: 'Créer ou rejoindre', tuto2d: 'Une personne crée le convoi. Les autres le rejoignent avec le code, le lien d’invitation ou en scannant le QR code.',
    tuto3t: 'Le leader guide', tuto3d: 'Le leader choisit la destination et les étapes, et tout le monde reçoit le guidage. Garde le doigt appuyé sur la carte pour poser un pin.',
    tuto4t: 'Parler et prévenir', tuto4d: 'Maintiens le gros bouton pour parler au talkie. Alertes prévient tout le convoi en un geste, et le chat sert pour les messages et les liens.',
    tuto5t: 'Avant de partir', tuto5d: 'Autorise la localisation et le micro. Garde l’app ouverte, écran allumé, sur un support : sur iPhone, une web app s’arrête quand l’écran se verrouille.',
    importConfirm1: 'Importer ce fichier ? Ton pseudo et tes réglages seront remplacés, et son trajet ajouté à ton historique.', importDone1: 'Import terminé : 1 trajet ajouté ou mis à jour.',
    importData: 'Importer', exportShort: 'Exporter', importBad: 'Ce fichier n’est pas un export PocketConvoy.',
    importConfirm: 'Importer ce fichier ? Ton pseudo et tes réglages seront remplacés, et ses {n} trajets ajoutés à ton historique.',
    importDone: 'Import terminé : {n} trajets ajoutés ou mis à jour.', importNote: 'L’import reprend le pseudo et les réglages du fichier et ajoute ses trajets à ton historique, sans effacer les autres.',
    exportData: 'Exporter mes données', exportNote: 'Pseudo, réglages et historique des trajets, dans un fichier JSON.',
    exploreBtn: 'Explorer les pistes', exploreTitle: 'Explorer les pistes', exLocate: 'Ma position', orSearchTitle: 'Rechercher des pistes', orSearchRoute: 'Rechercher une piste',
    orTabSearch: 'Recherche', orTabSaved: 'Mes pistes', orWhere: 'Où', orWhereMe: 'Autour de moi', orWhereView: 'Zone affichée', orWherePlace: 'Un lieu',
    orPlacePh: 'Village, col, région…', orRadius: 'Rayon', orVeh: 'Mon véhicule', vShort0: 'Voiture', vShort1: 'SUV', vShort2: '4×4', vShort3: 'Expert',
    orAccF: 'Accès', orAccOk: 'Autorisées', orAccRestr: 'Avec restrictions', orAccAll: 'Toutes', orMinLen: 'Longueur minimale', orAnyLen: 'Toutes',
    orUnknown: 'Inclure les pistes sans information', orNo: 'Non', orSort: 'Trier', orSortNear: 'Les plus proches', orSortLong: 'Les plus longues', orGo: 'Rechercher',
    orProgress: 'Chargement des pistes : {a}/{b} zones', orResults: '{n} pistes trouvées', orResults1: '1 piste trouvée', orNoResult: 'Aucune piste ne correspond. Élargis le rayon ou les filtres.',
    orMore: 'Et {n} autres : affine les filtres pour les voir.', orAway: 'à {d}', orTotalLen: 'Longueur totale', orSegments: 'Tronçons', orSurfaces: 'Revêtements',
    orPartNo: 'Interdit sur une partie du tracé', orUnknownPart: 'Certaines portions n’ont pas d’information sur la difficulté.',
    orRide: 'Rouler cette piste avec le convoi', orRideNote: 'Le guidage emmène le convoi jusqu’à l’entrée de la piste, puis la piste s’affiche pour tout le monde avec la distance restante.',
    orRideLeader: 'Seul le leader peut lancer une piste pour tout le convoi.', orRideExplore: 'Enregistre-la dans Mes pistes pour la lancer pendant un convoi.',
    orSave: 'Enregistrer dans Mes pistes', orUnsave: 'Retirer de Mes pistes', orSavedEmpty: 'Aucune piste enregistrée. Ouvre une piste puis « Enregistrer dans Mes pistes ».',
    orWhole: 'Voir la piste entière', orChainNote: 'Calculé sur les pistes chargées : elle peut continuer au-delà de la zone.', orPickPlace: 'Choisis d’abord un lieu dans la liste.',
    orViewTooBig: 'Zone trop grande : zoome un peu ou choisis un rayon.', orLastErr: 'Dernière erreur du serveur des pistes : {e}', exNoGps: 'Position GPS pas encore disponible : la recherche part du centre de la carte.',
    trkEntry: 'Entrée : {name}', trkOn: 'Sur la piste', trkOff: 'Hors de la piste', trkBack: 'Reviens vers le tracé', trkTo: 'Rejoindre la piste', trkDone: 'Fin de la piste',
    trkStart: 'Entrée de la piste atteinte : bonne route !', trkPlanned: 'Piste prévue', trkSet: 'Piste lancée pour le convoi : {name}',
    orPeriod: 'Période', yes: 'Oui', orOn: 'Activé', orOff: 'Désactivé', offroad: 'Mode off road', offroadNote: 'Thème baroudeur, relief sur la carte et pistes détaillées (type, difficulté, accès), touche une piste pour sa fiche. Données OpenStreetMap.',
    thn_offroad: 'Le mode off road impose son thème terre et kaki. Désactive-le pour revenir à ton thème.', orLegend: 'Légende des pistes',
    orZoom: 'Pistes : zoome pour les afficher', orLoading: 'Chargement des pistes…', orCount: '{n} pistes', orCount1: '1 piste', orNone: 'Aucune piste dans cette zone',
    orErr: 'Serveur des pistes saturé, nouvel essai bientôt', orTrack: 'Piste sans nom', orVehicle: 'Véhicule conseillé',
    d_unk: 'Inconnu (pas d’information)', d0: 'Voiture', d1: 'SUV ou bonne garde au sol', d2: '4×4', d3: '4×4 et pilote expérimenté', d4: 'Impraticable',
    acc_ok: 'Aucune restriction indiquée', acc_no: 'Interdit aux véhicules à moteur', acc_dest: 'Réservé (riverains, ayants droit ou autorisation)', acc_season: 'Restriction selon la période',
    orAccess: 'Accès', orSurface: 'Revêtement', orGrade: 'État de la piste', orSmooth: 'Régularité', orWidth: 'Largeur', or4wd: '4×4 uniquement', orIncline: 'Pente',
    orLength: 'Longueur de ce tronçon', orSeasonal: 'Praticable', orNoteTag: 'Remarque', orOsm: 'Voir ou corriger sur OpenStreetMap', orPin: 'Poser un pin ici pour le convoi',
    orDisclaimer: 'Données OpenStreetMap, sans garantie : la signalisation sur place et la réglementation locale font foi. Vérifie aussi les interdictions temporaires (risque d’incendie, travaux, chasse).',
    orLines: 'Trait plein : aucune restriction indiquée. Tirets de couleur : accès réservé ou selon la période. Tirets gris : interdit aux véhicules à moteur.',
    orRecommended: 'Recommandé', orPinLabel: 'Piste : {name}',
    shareTitle: 'Partager ce trajet', shareTripLink: 'Créer un lien de partage', sharePreparing: 'Préparation du lien…',
    shareSend: 'Envoyer', copyBtn: 'Copier', copied: 'Copié', shareFail: 'Impossible de créer le lien. Réessaie avec une connexion.',
    shareWho: 'Le lien montre ce trajet pour tout le convoi : noms, tracés et statistiques.',
    shareLongNote: 'Lien long : les liens courts ne sont pas encore activés dans Supabase (voir le README).',
    shareText: 'Mon trajet {dest} sur PocketConvoy', sharedBy: 'Partagé par {name}', loading: 'Chargement…',
    sharedGone: 'Trajet introuvable', sharedGoneText: 'Ce lien de trajet n’est plus valable ou il est incomplet.', openApp: 'Découvrir PocketConvoy',
    storyTitle: 'Récap en story', storyImage: 'Image', storyVideo: 'Vidéo',
    storyNote: 'Format vertical 1080 × 1920 pour les stories, avec la carte et les statistiques de la vue choisie ci-dessus. La vidéo est un timelapse de 10 secondes du trajet.',
    storyMaking: 'Création de l’image…', storyRecording: 'Enregistrement de la vidéo : {p} %', storyMap: 'Préparation de la carte…',
    storyShare: 'Partager ou enregistrer', storyNoVideo: 'Ce navigateur ne peut pas enregistrer de vidéo. L’image fonctionne toujours.',
    storyFail: 'Impossible de créer le récapitulatif.', storyKicker: 'TRAJET', storyOf: 'Trajet de {name}',
    tripAll: 'Tous', tripWho: 'Afficher le trajet de', speedLegend: 'Vitesse sur le trajet (part du temps)', gapLegend: 'Signal perdu',
    units: 'Unités', miles: 'miles', gauge: 'Compteur', gDial: 'Cadran', gDigital: 'Numérique', gMax: 'Graduation maximale',
    gWarn: 'Seuil de vitesse', warnOff: 'Aucun', gWarnNote: 'Au-delà du seuil choisi, la vitesse et l’aiguille passent au rouge.',
    create: 'Créer un convoi', orJoin: 'ou rejoindre avec un code', join: 'Rejoindre', errCode: 'Le code du convoi fait 6 caractères.',
    cfgWarn: 'Pour rouler avec tes amis, ajoute l’URL et la clé de ton projet Supabase dans config.js.',
    errLive: 'La connexion au serveur n’a pas pu se charger. Vérifie ta connexion.', invite: 'Inviter des amis', codeLabel: 'Code du convoi', shareLink: 'Partager le lien d’invitation',
    shareText: 'Rejoins mon convoi sur PocketConvoy avec le code {code}', linkCopied: 'Lien d’invitation copié',
    created: 'Convoi créé. Invite tes amis depuis Convoi, code {code}.', connLost: 'Connexion au convoi perdue, reconnexion…',
    waiting: 'En attente des autres véhicules. Code {code}', endAll: 'Terminer pour tout le convoi', endedAll: '{name} a terminé le trajet pour tout le convoi',
    audioOk: 'Talkie connecté', audioFail: 'Talkie en échec', audioWait: 'Talkie en connexion', tapForSound: 'Touche l’écran pour entendre le talkie de tes amis.',
    chat: 'Chat', chatPh: 'Message ou lien', chatEmpty: 'Aucun message pour l’instant. Le chat repart à zéro à chaque nouveau convoi.',
    chatPos: 'Partager ma position', myPosition: 'Ma position :', sendAria: 'Envoyer', creditsHtml: 'Carte : © <a href="https://www.openstreetmap.org/copyright">les contributeurs d’OpenStreetMap</a>, tuiles <a href="https://openfreemap.org">OpenFreeMap</a> et <a href="https://openmaptiles.org">OpenMapTiles</a>. Itinéraires : <a href="https://project-osrm.org">OSRM</a>. Recherche d’adresses : <a href="https://photon.komoot.io">Photon</a> par komoot. Pistes : OpenStreetMap via <a href="https://overpass-api.de">Overpass API</a>. Relief : <a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a> (AWS Open Data).',
  },
  en: {
    tagline: 'Drive together, never lose each other',
    nickname: 'Your nickname', nicknamePh: 'Nickname', colour: 'Your colour on the map', colourAria: 'Colour',
    history: 'History', settings: 'Settings',
    homeNote: 'While driving, keep the app open in the foreground with the screen on: on iPhone, a web app stops when the screen locks.',
    tabMap: 'Map', tabSpeed: 'Speed', viewAria: 'View', pickHint: 'Tap the map to place the stop', cancel: 'Cancel',
    toolRoute: 'Route', toolAlerts: 'Alerts', toolConvoy: 'Convoy', toolSettings: 'Settings', ptt: 'Walkie-talkie', close: 'Close', back: 'Back',
    route: 'Route', searchPh: 'Address or place', pickBtn: 'Place a stop on the map',
    quickTitle: 'Quick alerts', qPause: 'Break', qFuel: 'Fuel', qSlow: 'Slow down', qLost: 'I’m lost', qOk: 'All good, moving on',
    qSos: 'Breakdown or emergency', qSosConfirm: 'Tap again to confirm',
    quickNote: 'Every alert goes to the whole convoy with a sound. A breakdown shows full screen on the other phones.',
    convoy: 'Convoy', lang: 'Language', theme: 'Theme', accent: 'Accent colour', talkBtn: 'Walkie-talkie button', hold: 'Hold', toggle: 'Tap',
    map: 'Map', night: 'Dark', day: 'Light', lagAlert: 'Alert when a vehicle is far from the leader',
    endTrip: 'End the trip', yourTrip: 'Your trip',
    th_graphite: 'Graphite', th_light: 'Light', th_oled: 'OLED', th_red: 'Red night',
    thn_graphite: 'Neutral greys, a single bright colour for what matters.', thn_light: 'For driving in daylight.',
    thn_oled: 'Pure black: less glare and less battery on OLED screens.', thn_red: 'Everything in dim red to keep your eyes adapted to the dark. The accent is locked to red.',
    sosHas: '{name} has a problem', sosSub: 'Breakdown or emergency reported', sosShow: 'Show on the map', sosOk: 'Got it', sosDist: '{d} away from you',
    play: 'Play', pause: 'Pause', replayAria: 'Position in the trip', gaugeAria: 'Speedometer',
    st_route: 'Driving', st_arret: 'Stopped', st_pause: 'On a break', st_essence: 'Refuelling', st_perdu: 'Lost', st_panne: 'Broken down',
    q_pause: 'I’m taking a break', q_essence: 'I’m stopping for fuel', q_perdu: 'I’m lost', q_ralentir: 'Careful, slow down',
    q_ok: 'All good, moving on', q_sos: 'Breakdown or emergency', msgFrom: '{name}: {text}',
    errName: 'Pick a nickname so the others recognise you.', errLibs: 'The map could not load. Check your connection.',
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
    youShort: 'you', nobody: 'nobody', car: 'Vehicle', distance: 'Distance', driving: 'Driving', avgShort: 'Avg.', max: 'Max',
    rankTitle: 'The convoy, ranked by distance', drivingOf: 'Driving time out of {t}', drivingTime: 'Driving time',
    avgMoving: 'Average speed while moving', maxSpeed: 'Top speed', keepDriving: 'Keep driving',
    lagYou: 'You are {d} from the leader', lagOther: '{name} is {d} from the leader', leaderStopped: 'The leader {name} has stopped',
    heading: 'Heading {d}', itsYou: 'It’s you', carsOnline: 'Vehicles connected', average: 'Average', gapLeader: 'Gap to leader', altitude: 'Altitude',
    noTrips: 'No trips saved yet. They appear here when you end a trip.', tripDefault: 'Trip',
    cars1: '1 vehicle', carsN: '{n} vehicles', tripLine: '{dist} in {dur}, {cars}', fromTo: '{date}, from {a} to {b}', delTrip: 'Delete this trip',
    confirmDel: 'Delete this trip from the history?',
    viewConvoy: 'Convoy view', followMe: 'Follow me',
    on: 'On', off: 'Off',
    haptics: 'Haptic feedback', hapOff: 'Off', hapLight: 'Light', hapNormal: 'Normal', hapStrong: 'Strong', hapFor: 'Use for',
    hapUi: 'Buttons', hapTalk: 'Walkie-talkie', hapAlerts: 'Alerts', hapTest: 'Test',
    hapNote: 'On iPhone, Safari only allows a light tick (iOS 18 and later): the strength sets how many ticks you feel. On Android, the vibration follows the strength.',
    sounds: 'Sounds', sndPreview: 'Listen to each alert sound', sndLag: 'Vehicle falling behind', sndLeaderStop: 'Leader stopped', sndPin: 'New pin', convoyWho: 'Convoy',
    pins: 'Convoy pins', noPins: 'No pins yet. Press and hold on the map to drop one.', newPin: 'New pin', pinType: 'Type',
    pinLabelPh: 'Name (optional)', addPin: 'Drop the pin', pinHere: 'Pin at my position', pinOnMap: 'Place a pin on the map', pinHint: 'Tap the map to place the pin',
    pinBy: 'Added by {name}, {ago}', agoNow: 'just now', agoMin: '{n} min ago', pinAdded: 'Pin dropped, visible to the whole convoy',
    pinFrom: '{name} dropped a pin: {label}', pinAsStop: 'Add as a stop', pinAsDest: 'Set as destination', pinDel: 'Delete the pin',
    pinInRoute: 'This pin is part of the route.', pinLeaderNote: 'The leader can add it to the route.', pinAccepted: '{name} added your pin to the route', pinRemoved: 'Pin deleted',
    pin_view: 'Viewpoint', pin_food: 'Restaurant', pin_fuel: 'Fuel station', pin_parking: 'Parking', pin_danger: 'Hazard', pin_other: 'Other',
    credits: 'Credits', version: 'Version {v}',
    scanQr: 'Scan a QR code', scanHint: 'Point at the convoy QR code', scanBad: 'This QR code is not a PocketConvoy convoy.',
    camDenied: 'Camera blocked. Allow the camera for Safari in the iPhone settings.', camFail: 'Could not open the camera.',
    qrHint: 'Your friends scan it from the PocketConvoy home screen. Tap it to enlarge.', qrFail: 'QR code unavailable offline.',
    gNeedle: 'Needle', gRing: 'Ring', gBar: 'Bar', gHud: 'Windshield',
    gHudNote: 'Windshield: mirrored digits that reflect in the windshield at night. Lay the phone flat under the glass.',
    tutoSkip: 'Skip', tutoNext: 'Next', tutoGo: 'Let’s go', tutoAgain: 'Show the tutorial again',
    tuto1t: 'Welcome to PocketConvoy', tuto1d: 'Travel as a group of vehicles, cars or motorbikes, without losing each other: everyone sees the others live on the map.',
    tuto2t: 'Create or join', tuto2d: 'One person creates the convoy. The others join with the code, the invite link or by scanning the QR code.',
    tuto3t: 'The leader guides', tuto3d: 'The leader picks the destination and the stops, and everyone gets the guidance. Press and hold on the map to drop a pin.',
    tuto4t: 'Talk and warn', tuto4d: 'Hold the big button to talk on the walkie-talkie. Alerts warns the whole convoy in one tap, and the chat is for messages and links.',
    tuto5t: 'Before you leave', tuto5d: 'Allow location and microphone. Keep the app open with the screen on, on a mount: on iPhone, a web app stops when the screen locks.',
    importConfirm1: 'Import this file? Your nickname and settings will be replaced, and its trip added to your history.', importDone1: 'Import complete: 1 trip added or updated.',
    importData: 'Import', exportShort: 'Export', importBad: 'This file is not a PocketConvoy export.',
    importConfirm: 'Import this file? Your nickname and settings will be replaced, and its {n} trips added to your history.',
    importDone: 'Import complete: {n} trips added or updated.', importNote: 'Importing takes the nickname and settings from the file and adds its trips to your history, without deleting the others.',
    exportData: 'Export my data', exportNote: 'Nickname, settings and trip history, in a JSON file.',
    exploreBtn: 'Explore tracks', exploreTitle: 'Explore tracks', exLocate: 'My position', orSearchTitle: 'Search tracks', orSearchRoute: 'Search a track',
    orTabSearch: 'Search', orTabSaved: 'My tracks', orWhere: 'Where', orWhereMe: 'Around me', orWhereView: 'Visible area', orWherePlace: 'A place',
    orPlacePh: 'Village, pass, region…', orRadius: 'Radius', orVeh: 'My vehicle', vShort0: 'Car', vShort1: 'SUV', vShort2: '4×4', vShort3: 'Expert',
    orAccF: 'Access', orAccOk: 'Allowed', orAccRestr: 'With restrictions', orAccAll: 'All', orMinLen: 'Minimum length', orAnyLen: 'Any',
    orUnknown: 'Include tracks without information', orNo: 'No', orSort: 'Sort', orSortNear: 'Nearest', orSortLong: 'Longest', orGo: 'Search',
    orProgress: 'Loading tracks: {a}/{b} areas', orResults: '{n} tracks found', orResults1: '1 track found', orNoResult: 'No matching track. Widen the radius or the filters.',
    orMore: 'And {n} more: refine the filters to see them.', orAway: '{d} away', orTotalLen: 'Total length', orSegments: 'Sections', orSurfaces: 'Surfaces',
    orPartNo: 'No motor vehicles on part of it', orUnknownPart: 'Some sections have no difficulty information.',
    orRide: 'Drive this track with the convoy', orRideNote: 'Guidance takes the convoy to the start of the track, then the track appears for everyone with the distance left.',
    orRideLeader: 'Only the leader can start a track for the whole convoy.', orRideExplore: 'Save it to My tracks to start it during a convoy.',
    orSave: 'Save to My tracks', orUnsave: 'Remove from My tracks', orSavedEmpty: 'No saved track yet. Open a track, then “Save to My tracks”.',
    orWhole: 'Show the whole track', orChainNote: 'Built from the loaded tracks: it may continue beyond this area.', orPickPlace: 'Pick a place from the list first.',
    orViewTooBig: 'Area too large: zoom in a little or choose a radius.', orLastErr: 'Last track server error: {e}', exNoGps: 'GPS position not available yet: the search starts from the map centre.',
    trkEntry: 'Start: {name}', trkOn: 'On the track', trkOff: 'Off the track', trkBack: 'Head back to the line', trkTo: 'Join the track', trkDone: 'End of the track',
    trkStart: 'Start of the track reached: enjoy the ride!', trkPlanned: 'Planned track', trkSet: 'Track started for the convoy: {name}',
    orPeriod: 'Period', yes: 'Yes', orOn: 'On', orOff: 'Off', offroad: 'Off-road mode', offroadNote: 'Adventure theme, terrain relief on the map and detailed tracks (type, difficulty, access); tap a track for its details. OpenStreetMap data.',
    thn_offroad: 'Off-road mode uses its own earth and khaki theme. Turn it off to go back to your theme.', orLegend: 'Track legend',
    orZoom: 'Tracks: zoom in to show them', orLoading: 'Loading tracks…', orCount: '{n} tracks', orCount1: '1 track', orNone: 'No track in this area',
    orErr: 'Track server busy, retrying soon', orTrack: 'Unnamed track', orVehicle: 'Suitable vehicle',
    d_unk: 'Unknown (no information)', d0: 'Car', d1: 'SUV or good ground clearance', d2: '4×4', d3: '4×4 and experienced driver', d4: 'Impassable',
    acc_ok: 'No restriction indicated', acc_no: 'No motor vehicles', acc_dest: 'Restricted (residents, authorised users or permit)', acc_season: 'Restriction depending on the period',
    orAccess: 'Access', orSurface: 'Surface', orGrade: 'Track condition', orSmooth: 'Smoothness', orWidth: 'Width', or4wd: '4×4 only', orIncline: 'Incline',
    orLength: 'Length of this section', orSeasonal: 'Usable', orNoteTag: 'Note', orOsm: 'View or fix on OpenStreetMap', orPin: 'Drop a pin here for the convoy',
    orDisclaimer: 'OpenStreetMap data, without guarantee: signs on site and local rules prevail. Also check temporary bans (fire risk, works, hunting).',
    orLines: 'Solid line: no restriction indicated. Coloured dashes: restricted access or depending on the period. Grey dashes: no motor vehicles.',
    orRecommended: 'Recommended', orPinLabel: 'Track: {name}',
    shareTitle: 'Share this trip', shareTripLink: 'Create a share link', sharePreparing: 'Preparing the link…',
    shareSend: 'Send', copyBtn: 'Copy', copied: 'Copied', shareFail: 'Could not create the link. Try again with a connection.',
    shareWho: 'The link shows this trip for the whole convoy: names, tracks and statistics.',
    shareLongNote: 'Long link: short links are not enabled in Supabase yet (see the README).',
    shareText: 'My trip {dest} on PocketConvoy', sharedBy: 'Shared by {name}', loading: 'Loading…',
    sharedGone: 'Trip not found', sharedGoneText: 'This trip link is no longer valid or is incomplete.', openApp: 'Discover PocketConvoy',
    storyTitle: 'Story recap', storyImage: 'Image', storyVideo: 'Video',
    storyNote: 'Vertical 1080 × 1920 format for stories, with the map and the statistics of the view chosen above. The video is a 10-second timelapse of the trip.',
    storyMaking: 'Creating the image…', storyRecording: 'Recording the video: {p} %', storyMap: 'Preparing the map…',
    storyShare: 'Share or save', storyNoVideo: 'This browser cannot record video. The image always works.',
    storyFail: 'Could not create the recap.', storyKicker: 'TRIP', storyOf: 'Trip of {name}',
    tripAll: 'All', tripWho: 'Show the trip of', speedLegend: 'Speed along the trip (share of time)', gapLegend: 'Signal lost',
    units: 'Units', miles: 'miles', gauge: 'Speedometer', gDial: 'Dial', gDigital: 'Digital', gMax: 'Maximum on the dial',
    gWarn: 'Speed threshold', warnOff: 'None', gWarnNote: 'Above the chosen threshold, the speed and the needle turn red.',
    create: 'Create a convoy', orJoin: 'or join with a code', join: 'Join', errCode: 'The convoy code has 6 characters.',
    cfgWarn: 'To drive with your friends, add your Supabase project URL and key to config.js.',
    errLive: 'The server connection could not load. Check your connection.', invite: 'Invite friends', codeLabel: 'Convoy code', shareLink: 'Share the invite link',
    shareText: 'Join my convoy on PocketConvoy with the code {code}', linkCopied: 'Invite link copied',
    created: 'Convoy created. Invite your friends from Convoy, code {code}.', connLost: 'Lost connection to the convoy, reconnecting…',
    waiting: 'Waiting for the other vehicles. Code {code}', endAll: 'End for the whole convoy', endedAll: '{name} ended the trip for the whole convoy',
    audioOk: 'Walkie-talkie connected', audioFail: 'Walkie-talkie failed', audioWait: 'Walkie-talkie connecting', tapForSound: 'Tap the screen to hear your friends on the walkie-talkie.',
    chat: 'Chat', chatPh: 'Message or link', chatEmpty: 'No messages yet. The chat starts fresh with every new convoy.',
    chatPos: 'Share my position', myPosition: 'My position:', sendAria: 'Send', creditsHtml: 'Map: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>, <a href="https://openfreemap.org">OpenFreeMap</a> and <a href="https://openmaptiles.org">OpenMapTiles</a> tiles. Routing: <a href="https://project-osrm.org">OSRM</a>. Address search: <a href="https://photon.komoot.io">Photon</a> by komoot. Tracks: OpenStreetMap via <a href="https://overpass-api.de">Overpass API</a>. Relief: <a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a> (AWS Open Data).',
  },
  de: {
    tagline: 'Gemeinsam fahren, ohne sich zu verlieren',
    nickname: 'Dein Name', nicknamePh: 'Name', colour: 'Deine Farbe auf der Karte', colourAria: 'Farbe',
    history: 'Verlauf', settings: 'Einstellungen',
    homeNote: 'Lass die App während der Fahrt im Vordergrund und den Bildschirm an: Auf dem iPhone stoppt eine Web-App, wenn der Bildschirm sperrt.',
    tabMap: 'Karte', tabSpeed: 'Tacho', viewAria: 'Ansicht', pickHint: 'Tippe auf die Karte, um den Zwischenstopp zu setzen', cancel: 'Abbrechen',
    toolRoute: 'Route', toolAlerts: 'Warnungen', toolConvoy: 'Konvoi', toolSettings: 'Optionen', ptt: 'Funkgerät', close: 'Schliessen', back: 'Zurück',
    route: 'Route', searchPh: 'Adresse oder Ort', pickBtn: 'Zwischenstopp auf der Karte setzen',
    quickTitle: 'Schnellwarnungen', qPause: 'Pause', qFuel: 'Tanken', qSlow: 'Langsamer', qLost: 'Verfahren', qOk: 'Alles gut, ich fahre weiter',
    qSos: 'Panne oder Notfall', qSosConfirm: 'Zum Bestätigen nochmals tippen',
    quickNote: 'Jede Warnung geht mit einem Ton an den ganzen Konvoi. Eine Panne erscheint bei den anderen im Vollbild.',
    convoy: 'Konvoi', lang: 'Sprache', theme: 'Design', accent: 'Akzentfarbe', talkBtn: 'Funkgerät-Taste', hold: 'Halten', toggle: 'Antippen',
    map: 'Karte', night: 'Dunkel', day: 'Hell', lagAlert: 'Warnung, wenn ein Fahrzeug weit vom Konvoiführer entfernt ist',
    endTrip: 'Fahrt beenden', yourTrip: 'Deine Fahrt',
    th_graphite: 'Graphit', th_light: 'Hell', th_oled: 'OLED', th_red: 'Rote Nacht',
    thn_graphite: 'Neutrale Grautöne, eine einzige kräftige Farbe für das Wichtigste.', thn_light: 'Zum Fahren bei Tageslicht.',
    thn_oled: 'Reines Schwarz: weniger Blendung und weniger Akkuverbrauch auf OLED-Bildschirmen.', thn_red: 'Alles in gedämpftem Rot, damit die Augen an die Dunkelheit gewöhnt bleiben. Die Akzentfarbe ist auf Rot festgelegt.',
    sosHas: '{name} hat ein Problem', sosSub: 'Panne oder Notfall gemeldet', sosShow: 'Auf der Karte zeigen', sosOk: 'Gesehen', sosDist: '{d} von dir entfernt',
    play: 'Abspielen', pause: 'Pause', replayAria: 'Position in der Fahrt', gaugeAria: 'Tachometer',
    st_route: 'Unterwegs', st_arret: 'Steht', st_pause: 'Macht Pause', st_essence: 'Tankt', st_perdu: 'Verfahren', st_panne: 'Panne',
    q_pause: 'Ich mache eine Pause', q_essence: 'Ich halte zum Tanken an', q_perdu: 'Ich habe mich verfahren', q_ralentir: 'Achtung, langsamer fahren',
    q_ok: 'Alles gut, ich fahre weiter', q_sos: 'Panne oder Notfall', msgFrom: '{name}: {text}',
    errName: 'Wähle einen Namen, damit dich die anderen erkennen.', errLibs: 'Die Karte konnte nicht geladen werden. Prüfe deine Verbindung.',
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
    youShort: 'du', nobody: 'niemand', car: 'Fahrzeug', distance: 'Distanz', driving: 'Fahrzeit', avgShort: 'Ø', max: 'Max',
    rankTitle: 'Der Konvoi, nach Distanz geordnet', drivingOf: 'Fahrzeit von {t}', drivingTime: 'Fahrzeit',
    avgMoving: 'Durchschnitt während der Fahrt', maxSpeed: 'Höchstgeschwindigkeit', keepDriving: 'Weiterfahren',
    lagYou: 'Du bist {d} vom Konvoiführer entfernt', lagOther: '{name} ist {d} vom Konvoiführer entfernt', leaderStopped: 'Konvoiführer {name} steht',
    heading: 'Richtung {d}', itsYou: 'Du', average: 'Durchschnitt', gapLeader: 'Abstand zum Führer', altitude: 'Höhe', carsOnline: 'Verbundene Fahrzeuge',
    noTrips: 'Noch keine gespeicherten Fahrten. Sie erscheinen hier, wenn du eine Fahrt beendest.', tripDefault: 'Fahrt',
    cars1: '1 Fahrzeug', carsN: '{n} Fahrzeuge', tripLine: '{dist} in {dur}, {cars}', fromTo: '{date}, von {a} bis {b}', delTrip: 'Diese Fahrt löschen',
    confirmDel: 'Diese Fahrt aus dem Verlauf löschen?',
    viewConvoy: 'Konvoi-Ansicht', followMe: 'Mir folgen',
    on: 'An', off: 'Aus',
    haptics: 'Haptisches Feedback', hapOff: 'Aus', hapLight: 'Leicht', hapNormal: 'Normal', hapStrong: 'Stark', hapFor: 'Verwenden für',
    hapUi: 'Tasten', hapTalk: 'Funkgerät', hapAlerts: 'Warnungen', hapTest: 'Testen',
    hapNote: 'Auf dem iPhone erlaubt Safari nur ein leichtes Ticken (ab iOS 18): Die Stärke bestimmt die Anzahl der Ticks. Auf Android folgt die Vibration der Stärke.',
    sounds: 'Töne', sndPreview: 'Den Ton jeder Warnung anhören', sndLag: 'Fahrzeug zurückgefallen', sndLeaderStop: 'Konvoiführer steht', sndPin: 'Neuer Pin', convoyWho: 'Konvoi',
    pins: 'Pins des Konvois', noPins: 'Noch keine Pins. Halte den Finger auf der Karte gedrückt, um einen zu setzen.', newPin: 'Neuer Pin', pinType: 'Art',
    pinLabelPh: 'Name (optional)', addPin: 'Pin setzen', pinHere: 'Pin an meiner Position', pinOnMap: 'Pin auf der Karte setzen', pinHint: 'Tippe auf die Karte, um den Pin zu setzen',
    pinBy: 'Gesetzt von {name}, {ago}', agoNow: 'gerade eben', agoMin: 'vor {n} Min.', pinAdded: 'Pin gesetzt, für den ganzen Konvoi sichtbar',
    pinFrom: '{name} hat einen Pin gesetzt: {label}', pinAsStop: 'Als Zwischenstopp hinzufügen', pinAsDest: 'Als Ziel festlegen', pinDel: 'Pin löschen',
    pinInRoute: 'Dieser Pin ist Teil der Route.', pinLeaderNote: 'Der Konvoiführer kann ihn zur Route hinzufügen.', pinAccepted: '{name} hat deinen Pin zur Route hinzugefügt', pinRemoved: 'Pin gelöscht',
    pin_view: 'Aussichtspunkt', pin_food: 'Restaurant', pin_fuel: 'Tankstelle', pin_parking: 'Parkplatz', pin_danger: 'Gefahr', pin_other: 'Anderes',
    credits: 'Quellen', version: 'Version {v}',
    scanQr: 'QR-Code scannen', scanHint: 'Richte die Kamera auf den QR-Code des Konvois', scanBad: 'Dieser QR-Code ist kein PocketConvoy-Konvoi.',
    camDenied: 'Kamera blockiert. Erlaube die Kamera für Safari in den iPhone-Einstellungen.', camFail: 'Die Kamera konnte nicht geöffnet werden.',
    qrHint: 'Deine Freunde scannen ihn auf dem Startbildschirm von PocketConvoy. Tippe darauf, um ihn zu vergrössern.', qrFail: 'QR-Code ohne Verbindung nicht verfügbar.',
    gNeedle: 'Zeiger', gRing: 'Ring', gBar: 'Balken', gHud: 'Frontscheibe',
    gHudNote: 'Frontscheibe: gespiegelte Ziffern, die sich nachts in der Frontscheibe spiegeln. Leg das Handy flach unter die Scheibe.',
    tutoSkip: 'Überspringen', tutoNext: 'Weiter', tutoGo: 'Los geht’s', tutoAgain: 'Anleitung erneut ansehen',
    tuto1t: 'Willkommen bei PocketConvoy', tuto1d: 'Fahrt mit mehreren Fahrzeugen, Autos oder Motorrädern, ohne euch zu verlieren: Alle sehen die anderen live auf der Karte.',
    tuto2t: 'Erstellen oder beitreten', tuto2d: 'Eine Person erstellt den Konvoi. Die anderen treten mit dem Code, dem Einladungslink oder per QR-Code bei.',
    tuto3t: 'Der Konvoiführer leitet', tuto3d: 'Der Konvoiführer wählt Ziel und Zwischenstopps, alle erhalten die Navigation. Halte den Finger auf der Karte gedrückt, um einen Pin zu setzen.',
    tuto4t: 'Sprechen und warnen', tuto4d: 'Halte die grosse Taste gedrückt, um über das Funkgerät zu sprechen. Warnungen informiert den ganzen Konvoi mit einem Tipp, der Chat ist für Nachrichten und Links.',
    tuto5t: 'Vor der Abfahrt', tuto5d: 'Erlaube Standort und Mikrofon. Lass die App mit eingeschaltetem Bildschirm in einer Halterung offen: Auf dem iPhone stoppt eine Web-App, wenn der Bildschirm sperrt.',
    importConfirm1: 'Diese Datei importieren? Dein Name und deine Einstellungen werden ersetzt, und ihre Fahrt zu deinem Verlauf hinzugefügt.', importDone1: 'Import abgeschlossen: 1 Fahrt hinzugefügt oder aktualisiert.',
    importData: 'Importieren', exportShort: 'Exportieren', importBad: 'Diese Datei ist kein PocketConvoy-Export.',
    importConfirm: 'Diese Datei importieren? Dein Name und deine Einstellungen werden ersetzt, und ihre {n} Fahrten zu deinem Verlauf hinzugefügt.',
    importDone: 'Import abgeschlossen: {n} Fahrten hinzugefügt oder aktualisiert.', importNote: 'Der Import übernimmt Name und Einstellungen aus der Datei und fügt ihre Fahrten zu deinem Verlauf hinzu, ohne die anderen zu löschen.',
    exportData: 'Meine Daten exportieren', exportNote: 'Name, Einstellungen und Fahrtenverlauf in einer JSON-Datei.',
    exploreBtn: 'Pisten erkunden', exploreTitle: 'Pisten erkunden', exLocate: 'Meine Position', orSearchTitle: 'Pisten suchen', orSearchRoute: 'Piste suchen',
    orTabSearch: 'Suche', orTabSaved: 'Meine Pisten', orWhere: 'Wo', orWhereMe: 'In meiner Nähe', orWhereView: 'Sichtbarer Bereich', orWherePlace: 'Ein Ort',
    orPlacePh: 'Dorf, Pass, Region…', orRadius: 'Umkreis', orVeh: 'Mein Fahrzeug', vShort0: 'Auto', vShort1: 'SUV', vShort2: '4×4', vShort3: 'Experte',
    orAccF: 'Zufahrt', orAccOk: 'Erlaubt', orAccRestr: 'Mit Einschränkungen', orAccAll: 'Alle', orMinLen: 'Mindestlänge', orAnyLen: 'Alle',
    orUnknown: 'Pisten ohne Angaben einbeziehen', orNo: 'Nein', orSort: 'Sortieren', orSortNear: 'Am nächsten', orSortLong: 'Am längsten', orGo: 'Suchen',
    orProgress: 'Pisten werden geladen: {a}/{b} Gebiete', orResults: '{n} Pisten gefunden', orResults1: '1 Piste gefunden', orNoResult: 'Keine passende Piste. Vergrössere den Umkreis oder lockere die Filter.',
    orMore: 'Und {n} weitere: verfeinere die Filter, um sie zu sehen.', orAway: 'in {d}', orTotalLen: 'Gesamtlänge', orSegments: 'Abschnitte', orSurfaces: 'Beläge',
    orPartNo: 'Auf einem Teil für Motorfahrzeuge verboten', orUnknownPart: 'Zu manchen Abschnitten fehlen Angaben zur Schwierigkeit.',
    orRide: 'Diese Piste mit dem Konvoi fahren', orRideNote: 'Die Navigation führt den Konvoi zum Anfang der Piste, danach sehen alle die Piste mit der Reststrecke.',
    orRideLeader: 'Nur der Konvoiführer kann eine Piste für den ganzen Konvoi starten.', orRideExplore: 'Speichere sie unter Meine Pisten, um sie während eines Konvois zu starten.',
    orSave: 'Unter Meine Pisten speichern', orUnsave: 'Aus Meine Pisten entfernen', orSavedEmpty: 'Noch keine gespeicherte Piste. Öffne eine Piste und tippe auf „Unter Meine Pisten speichern“.',
    orWhole: 'Ganze Piste anzeigen', orChainNote: 'Aus den geladenen Pisten berechnet: sie kann über dieses Gebiet hinaus weitergehen.', orPickPlace: 'Wähle zuerst einen Ort aus der Liste.',
    orViewTooBig: 'Gebiet zu gross: zoome etwas hinein oder wähle einen Umkreis.', orLastErr: 'Letzter Fehler des Pisten-Servers: {e}', exNoGps: 'GPS-Position noch nicht verfügbar: Die Suche startet in der Kartenmitte.',
    trkEntry: 'Anfang: {name}', trkOn: 'Auf der Piste', trkOff: 'Neben der Piste', trkBack: 'Zurück zur Linie', trkTo: 'Zur Piste', trkDone: 'Ende der Piste',
    trkStart: 'Anfang der Piste erreicht: gute Fahrt!', trkPlanned: 'Geplante Piste', trkSet: 'Piste für den Konvoi gestartet: {name}',
    orPeriod: 'Zeitraum', yes: 'Ja', orOn: 'Ein', orOff: 'Aus', offroad: 'Offroad-Modus', offroadNote: 'Abenteuer-Design, Relief auf der Karte und detaillierte Pisten (Art, Schwierigkeit, Zufahrt); tippe auf eine Piste für Details. Daten von OpenStreetMap.',
    thn_offroad: 'Der Offroad-Modus nutzt sein eigenes Erd- und Khaki-Design. Schalte ihn aus, um zu deinem Design zurückzukehren.', orLegend: 'Pisten-Legende',
    orZoom: 'Pisten: hineinzoomen, um sie anzuzeigen', orLoading: 'Pisten werden geladen…', orCount: '{n} Pisten', orCount1: '1 Piste', orNone: 'Keine Piste in diesem Gebiet',
    orErr: 'Pisten-Server ausgelastet, neuer Versuch bald', orTrack: 'Piste ohne Namen', orVehicle: 'Geeignetes Fahrzeug',
    d_unk: 'Unbekannt (keine Angaben)', d0: 'Auto', d1: 'SUV oder gute Bodenfreiheit', d2: '4×4', d3: '4×4 und erfahrener Fahrer', d4: 'Unpassierbar',
    acc_ok: 'Keine Einschränkung angegeben', acc_no: 'Für Motorfahrzeuge verboten', acc_dest: 'Eingeschränkt (Anlieger, Berechtigte oder Bewilligung)', acc_season: 'Einschränkung je nach Zeitraum',
    orAccess: 'Zufahrt', orSurface: 'Belag', orGrade: 'Zustand der Piste', orSmooth: 'Ebenheit', orWidth: 'Breite', or4wd: 'Nur 4×4', orIncline: 'Steigung',
    orLength: 'Länge dieses Abschnitts', orSeasonal: 'Befahrbar', orNoteTag: 'Hinweis', orOsm: 'Auf OpenStreetMap ansehen oder korrigieren', orPin: 'Hier einen Pin für den Konvoi setzen',
    orDisclaimer: 'Daten von OpenStreetMap, ohne Gewähr: Signalisation vor Ort und lokale Vorschriften gehen vor. Prüfe auch vorübergehende Verbote (Brandgefahr, Bauarbeiten, Jagd).',
    orLines: 'Durchgezogene Linie: keine Einschränkung angegeben. Farbige Striche: eingeschränkte Zufahrt oder je nach Zeitraum. Graue Striche: für Motorfahrzeuge verboten.',
    orRecommended: 'Empfohlen', orPinLabel: 'Piste: {name}',
    shareTitle: 'Diese Fahrt teilen', shareTripLink: 'Link zum Teilen erstellen', sharePreparing: 'Link wird vorbereitet…',
    shareSend: 'Senden', copyBtn: 'Kopieren', copied: 'Kopiert', shareFail: 'Der Link konnte nicht erstellt werden. Versuche es mit Verbindung erneut.',
    shareWho: 'Der Link zeigt diese Fahrt für den ganzen Konvoi: Namen, Strecken und Statistiken.',
    shareLongNote: 'Langer Link: Kurze Links sind in Supabase noch nicht aktiviert (siehe README).',
    shareText: 'Meine Fahrt {dest} mit PocketConvoy', sharedBy: 'Geteilt von {name}', loading: 'Wird geladen…',
    sharedGone: 'Fahrt nicht gefunden', sharedGoneText: 'Dieser Fahrtlink ist nicht mehr gültig oder unvollständig.', openApp: 'PocketConvoy entdecken',
    storyTitle: 'Rückblick als Story', storyImage: 'Bild', storyVideo: 'Video',
    storyNote: 'Hochformat 1080 × 1920 für Stories, mit der Karte und den Statistiken der oben gewählten Ansicht. Das Video ist ein 10-sekündiger Zeitraffer der Fahrt.',
    storyMaking: 'Bild wird erstellt…', storyRecording: 'Video wird aufgenommen: {p} %', storyMap: 'Karte wird vorbereitet…',
    storyShare: 'Teilen oder sichern', storyNoVideo: 'Dieser Browser kann kein Video aufnehmen. Das Bild funktioniert immer.',
    storyFail: 'Der Rückblick konnte nicht erstellt werden.', storyKicker: 'FAHRT', storyOf: 'Fahrt von {name}',
    tripAll: 'Alle', tripWho: 'Fahrt anzeigen von', speedLegend: 'Tempo entlang der Fahrt (Zeitanteil)', gapLegend: 'Signal verloren',
    units: 'Einheiten', miles: 'Meilen', gauge: 'Tacho', gDial: 'Zifferblatt', gDigital: 'Digital', gMax: 'Höchstwert der Skala',
    gWarn: 'Tempogrenze', warnOff: 'Keine', gWarnNote: 'Über der gewählten Grenze werden Tempo und Zeiger rot.',
    create: 'Konvoi erstellen', orJoin: 'oder mit einem Code beitreten', join: 'Beitreten', errCode: 'Der Konvoi-Code hat 6 Zeichen.',
    cfgWarn: 'Um mit Freunden zu fahren, trage die URL und den Schlüssel deines Supabase-Projekts in config.js ein.',
    errLive: 'Die Serververbindung konnte nicht geladen werden. Prüfe deine Verbindung.', invite: 'Freunde einladen', codeLabel: 'Konvoi-Code', shareLink: 'Einladungslink teilen',
    shareText: 'Tritt meinem Konvoi auf PocketConvoy bei, Code {code}', linkCopied: 'Einladungslink kopiert',
    created: 'Konvoi erstellt. Lade deine Freunde unter Konvoi ein, Code {code}.', connLost: 'Verbindung zum Konvoi verloren, neuer Versuch…',
    waiting: 'Warte auf die anderen Fahrzeuge. Code {code}', endAll: 'Für den ganzen Konvoi beenden', endedAll: '{name} hat die Fahrt für den ganzen Konvoi beendet',
    audioOk: 'Funkgerät verbunden', audioFail: 'Funkgerät-Fehler', audioWait: 'Funkgerät verbindet', tapForSound: 'Tippe auf den Bildschirm, um deine Freunde im Funkgerät zu hören.',
    chat: 'Chat', chatPh: 'Nachricht oder Link', chatEmpty: 'Noch keine Nachrichten. Der Chat beginnt bei jedem neuen Konvoi von vorn.',
    chatPos: 'Meine Position teilen', myPosition: 'Meine Position:', sendAria: 'Senden', creditsHtml: 'Karte: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>, Kacheln von <a href="https://openfreemap.org">OpenFreeMap</a> und <a href="https://openmaptiles.org">OpenMapTiles</a>. Routen: <a href="https://project-osrm.org">OSRM</a>. Adresssuche: <a href="https://photon.komoot.io">Photon</a> von komoot. Pisten: OpenStreetMap über <a href="https://overpass-api.de">Overpass API</a>. Relief: <a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a> (AWS Open Data).',
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
function on(sel, ev, fn, opt) { const el = document.querySelector(sel); if (el) el.addEventListener(ev, fn, opt); }
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
const prefs = Object.assign({ talkMode: 'hold', mapTheme: 'night', lagKm: 3, view: 'map', lang: 'fr', theme: 'graphite', accent: 'orange', haptics: 'normal', hapticCats: ['ui', 'talk', 'alerts'], sound: 'on', distUnit: 'km', speedUnit: 'kmh', gaugeStyle: 'dial', gaugeIdx: 5, speedWarn: 0, offroad: 'off' }, store.get('prefs', {}));
if (!I18N[prefs.lang]) prefs.lang = 'fr';
if (!THEMES[prefs.theme]) prefs.theme = 'graphite';
if (prefs.accentHue == null) prefs.accentHue = ACCENT_HUES[prefs.accent] != null ? ACCENT_HUES[prefs.accent] : 15;
if (!Array.isArray(prefs.hapticCats)) prefs.hapticCats = ['ui', 'talk', 'alerts'];
const savePrefs = () => store.set('prefs', prefs);

function t(k, v) {
  let s = I18N[prefs.lang][k];
  if (s == null) s = I18N.fr[k] != null ? I18N.fr[k] : k;
  if (v) for (const key of Object.keys(v)) s = s.split('{' + key + '}').join(v[key]);
  return s;
}
const locale = () => ({ en: 'en-GB', de: 'de-CH' }[prefs.lang] || 'fr-CH');

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
const DB = {
  _p: null,
  open() {
    if (!this._p) this._p = new Promise((res, rej) => {
      const r = indexedDB.open('pocketconvoy', 2);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('trips')) d.createObjectStore('trips', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        if (!d.objectStoreNames.contains('osm')) d.createObjectStore('osm');
      };
      r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); res(r.result); };
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
  getOsm: k => withTimeout(DB.run('osm', 'readonly', s => s.get(k)), 2500),
  putOsm: (k, v) => withTimeout(DB.run('osm', 'readwrite', s => s.put(v, k)), 5000),
  getKv: k => withTimeout(DB.run('kv', 'readonly', s => s.get(k)), 2500),
  putKv: (k, v) => withTimeout(DB.run('kv', 'readwrite', s => s.put(v, k)), 5000),
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
const me = { id: store.get('id', null), name: store.get('name', ''), hue: store.get('hue', null) };
if (me.hue == null) me.hue = hexHue(store.get('color', COLORS[0]));
me.color = memberColor(me.hue);
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
  if (!$('#tuto').hidden) renderTuto();
  if (S.sheet === 'track') renderTrackSheet();
  if (S.sheet === 'orlegend') renderOrLegend();
  orRender();
  if (S.sheet === 'orsearch') renderOrSearch();
  syncSegs();
}
const offroadOn = () => prefs.offroad === 'on';
const themeNow = () => (offroadOn() ? 'offroad' : prefs.theme);
function applyTheme() {
  const root = document.documentElement;
  root.dataset.theme = themeNow();
  const acc = accentColor(prefs.accentHue);
  root.style.setProperty('--accent', acc);
  if (themeNow() === 'red' || themeNow() === 'offroad') root.style.removeProperty('--accent-ink');
  else root.style.setProperty('--accent-ink', luminance(acc) > 0.3 ? '#0F0F10' : '#FFFFFF');
  const be = document.getElementById('btnExplore');
  if (be) be.hidden = !offroadOn();
  const ah = document.getElementById('accentHue');
  if (ah) { ah.value = prefs.accentHue; ah.style.setProperty('--thumb', acc); }
  $('#metaTheme').setAttribute('content', THEMES[themeNow()].meta);
  styleRouteLayers();
}
/* ---------- fond de carte ---------- */
let mapBasePromise = null;
function mapPalette() {
  if (offroadOn()) return prefs.mapTheme === 'day' ? MAP_PAL.offroadDay : MAP_PAL.offroad;
  return prefs.mapTheme === 'day' ? MAP_PAL.light : (prefs.theme === 'oled' ? MAP_PAL.oled : MAP_PAL.dark);
}
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
  if (offroadOn()) {
    st.sources.dem = { type: 'raster-dem', tiles: [DEM_TILES], tileSize: 256, maxzoom: 14, encoding: 'terrarium' };
    const day = prefs.mapTheme === 'day';
    const hill = { id: 'or-hillshade', type: 'hillshade', source: 'dem', paint: {
      'hillshade-exaggeration': day ? 0.45 : 0.55,
      'hillshade-shadow-color': day ? 'rgba(70,58,35,0.45)' : 'rgba(0,0,0,0.6)',
      'hillshade-highlight-color': day ? 'rgba(255,255,255,0.45)' : 'rgba(255,245,215,0.12)',
      'hillshade-accent-color': day ? 'rgba(70,58,35,0.2)' : 'rgba(0,0,0,0.25)' } };
    let at = st.layers.findIndex(l => l.type === 'fill' && /water/i.test(l.id));
    if (at < 0) at = st.layers.findIndex(l => l.type === 'line' || l.type === 'symbol');
    st.layers.splice(at < 0 ? st.layers.length : at, 0, hill);
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
/* Safari n'a pas d'API de vibration : on bascule un interrupteur iOS (input switch), ce qui produit le tic.
   Les iOS récents ignorent un interrupteur non affiché ou hors de l'écran : il est donc rendu dans la page,
   en haut à gauche, presque transparent et sans interaction, et le focus est rendu au champ actif. */
let lastTick = 0, hapticEl = null;
function iosTick() {
  const now = performance.now();
  if (now - lastTick < 40) return;
  lastTick = now;
  if (!hapticEl || !hapticEl.isConnected) {
    hapticEl = document.createElement('label');
    hapticEl.setAttribute('aria-hidden', 'true');
    hapticEl.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;overflow:hidden;opacity:.01;pointer-events:none;z-index:-1;contain:strict';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    input.style.cssText = 'margin:0;width:2px;height:2px';
    hapticEl.appendChild(input);
    document.body.appendChild(hapticEl);
  }
  const active = document.activeElement;
  hapticEl.click();
  if (active && active !== document.activeElement && active.focus) { try { active.focus({ preventScroll: true }); } catch (e) { /* ignoré */ } }
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
  $('#colorHue').value = me.hue;
  updateColorPreview();
  const c = (new URLSearchParams(location.search).get('c') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c) $('#code').value = c.slice(0, 6);
  $('#cfgWarn').hidden = configOk();
  homeErr('');
  syncSegs();
}
function updateColorPreview() {
  me.color = memberColor(me.hue);
  const pv = $('#colorPreview');
  pv.style.setProperty('--c', me.color);
  pv.textContent = initial($('#name').value || me.name || '?');
  $('#colorHue').style.setProperty('--thumb', me.color);
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
  exitExplore();
  me.name = name.slice(0, 16);
  store.set('name', me.name); store.set('hue', me.hue); store.set('color', me.color);
  homeErr('');
  unlockAudio(); unlockSpeech();

  S.active = true;
  S.live = true; S.code = opts.code;
  S.chat = []; S.chatUnread = 0; updateChatBadge();
  S.trip = { id: 't' + Date.now(), start: clock(), dist: 0, moving: 0, max: 0, last: null, tracks: {}, names: {}, colors: {}, dest: '' };
  S.plan = { v: 0, wps: [], track: null }; S.passed = new Set(); S.arrived = false; S.route = null; S.trkGeo = null; S.trk = null; S.trackDone = false;
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
  S.trkGeo = null; S.trk = null; S.trackDone = false;
  Object.assign(S, { active: false, trip: null, route: null, plan: { v: 0, wps: [], track: null }, passed: new Set(), leaderId: null,
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
  if (S.trkGeo) { trackProgress(); if (!pendingWps().length) updateNavSign(); }
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
  m.on('style.load', () => { orAddLayers(); addRouteLayers(); renderRoute(); });
  m.on('moveend', () => orRefresh());
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
  if (!m.getSource('ptrack')) m.addSource('ptrack', { type: 'geojson', data: trackGeoJSON() });
  if (!m.getLayer('ptrack-casing')) m.addLayer({ id: 'ptrack-casing', type: 'line', source: 'ptrack', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': cssVar('--route-casing'), 'line-width': 11, 'line-opacity': 0.7 } });
  if (!m.getLayer('ptrack-line')) m.addLayer({ id: 'ptrack-line', type: 'line', source: 'ptrack', layout: { 'line-join': 'round' }, paint: { 'line-color': cssVar('--accent'), 'line-width': 6, 'line-dasharray': [1.4, 0.9] } });
  if (!m.getSource('route')) m.addSource('route', { type: 'geojson', data: routeGeo() });
  if (!m.getLayer('route-casing')) m.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': cssVar('--route-casing'), 'line-width': 10, 'line-opacity': 0.8 } });
  if (!m.getLayer('route-line')) m.addLayer({ id: 'route-line', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': cssVar('--accent'), 'line-width': 5 } });
}
function styleRouteLayers() {
  const m = S.map;
  if (!m || !m.isStyleLoaded || !m.isStyleLoaded()) return;
  if (m.getLayer('route-casing')) m.setPaintProperty('route-casing', 'line-color', cssVar('--route-casing'));
  if (m.getLayer('route-line')) m.setPaintProperty('route-line', 'line-color', cssVar('--accent'));
  if (m.getLayer('ptrack-line')) m.setPaintProperty('ptrack-line', 'line-color', cssVar('--accent'));
  if (m.getLayer('or-pick-glow')) m.setPaintProperty('or-pick-glow', 'line-color', cssVar('--accent'));
}
function routeGeo() {
  const c = S.route ? S.route.coords.map(p => [p[1], p[0]]) : [];
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c.length > 1 ? c : [] } };
}
function renderRoute() {
  const src = S.map && S.map.getSource && S.map.getSource('route');
  if (src) src.setData(routeGeo());
  const ts = S.map && S.map.getSource && S.map.getSource('ptrack');
  if (ts) ts.setData(trackGeoJSON());
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
   chaque véhicule glisse en continu vers sa position prévue (vitesse et cap) et la caméra suit image par image. */
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

function setPlan(wps, track) {
  S.plan = { v: S.plan.v + 1, wps, track: track === undefined ? (S.plan.track || null) : track };
  send('plan', { plan: S.plan, by: me.id });
  onPlanChanged();
}
function onPlanChanged() {
  S.arrived = false;
  const tk = S.plan.track || null;
  if (!tk || !S.trkGeo || S.trkGeo.coords !== tk.coords) { S.trkGeo = trackGeoOf(tk); S.trk = null; S.trackDone = false; trackProgress(); }
  const dest = S.plan.wps[S.plan.wps.length - 1];
  if (S.trip && dest) S.trip.dest = dest.label;
  renderWaypoints();
  if (S.sheet === 'route') renderRouteSheet();
  if (!pendingWps().length) { S.route = null; renderRoute(); updateNavSign(); return; }
  renderRoute();
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
  if (!pendingWps().length && S.plan.track) {
    S.route = null; renderRoute();
    toast(t('trkStart'), 'ok', 7000); sfx('arrive'); haptic('alert');
  } else if (!pendingWps().length) {
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
  if (!S.plan.wps.length && !S.plan.track) { card.hidden = true; eta.hidden = true; return; }
  card.hidden = false;
  const set = (icon, dist, text, road) => {
    $('.nav-ico', card).innerHTML = icon; $('.nav-dist', card).textContent = dist;
    $('.nav-text', card).textContent = text; $('.nav-road', card).textContent = road;
    $('.nav-dist', card).hidden = !dist;
  };
  if (S.plan.track && !pendingWps().length) {
    const tk = S.plan.track, g = S.trkGeo, tr = S.trk, icon = ic(TRAIL_ICON, 34);
    eta.hidden = true;
    if (S.trackDone) { set(arrowSVG(null), '', t('trkDone'), tk.name); return; }
    if (!tr || !g) { set(icon, '', S.pos ? tk.name : t('gpsWait'), tk.name); return; }
    if (tr.on) set(icon, fmtDist(Math.max(0, g.total - tr.prog)), t('trkOn'), tk.name);
    else set(ic('<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.01"/>', 34), fmtDist(tr.d), t(tr.started ? 'trkOff' : 'trkTo'), tr.started ? t('trkBack') : tk.name);
    $('#etaTime').textContent = '';
    $('#etaLeft').textContent = t('remaining', { dist: fmtDist(Math.max(0, g.total - (tr.on ? tr.prog : 0))) });
    eta.hidden = false;
    return;
  }
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
  const tk = S.plan.track;
  if (tk) h += `<div class="list"><div class="item"><span class="wp dest">${ic(TRAIL_ICON, 14)}</span>
    <div class="grow"><div class="t">${esc(tk.name)}</div><div class="s">${esc(t('trkPlanned') + ' · ' + fmtDist(tk.len))}</div></div>
    ${lead ? `<button class="mini" data-act="untrack" aria-label="${esc(t('del'))}">✕</button>` : ''}</div></div>`;
  $('#wpList').innerHTML = h;
  $('#wpEdit').hidden = !lead;
  $('#btnOrRoute').hidden = !offroadOn();
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
  if (!S.pick) { if (offroadOn()) orClick(e); return; }
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

/* ---------- mode off road : pistes OpenStreetMap ----------
   Les pistes de la zone affichée sont demandées à l'API Overpass par carrés (tuiles de niveau 12, environ 10 km),
   gardées 14 jours dans le téléphone, puis classées selon le véhicule capable de les emprunter et leur accès. */
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const OR_Z = 12, OR_MINZOOM = 12, OR_MAXTILES = 24, OR_TTL = 14 * 864e5, OR_CACHE_V = 'v2:';
const OR_COLORS = ['#6FCF7F', '#F2C94C', '#F2994A', '#EB5757', '#B07CFF'];
const OR_UNKNOWN = '#C9C2A3';
const OR = { tiles: new Map(), busy: 0, queue: [], sel: null, chain: null, state: '', timer: null, sig: '', lastErr: '', saved: [], results: null, searching: false, place: null };
const OR_VAL = {
  fr: {
    surface: { asphalt: 'asphalte', paved: 'revêtu', concrete: 'béton', paving_stones: 'pavés', sett: 'pavés', compacted: 'gravier compacté', fine_gravel: 'gravier fin',
      gravel: 'gravier', pebblestone: 'galets', unpaved: 'non revêtu', ground: 'terre', dirt: 'terre', earth: 'terre', grass: 'herbe', sand: 'sable', mud: 'boue', rock: 'roche', wood: 'bois' },
    smoothness: { excellent: 'excellente', good: 'bonne', intermediate: 'moyenne', bad: 'mauvaise (garde au sol conseillée)', very_bad: 'très mauvaise (véhicule surélevé)',
      horrible: 'horrible (4×4)', very_horrible: 'extrême (4×4 spécialisé)', impassable: 'impraticable' },
    tracktype: { grade1: 'grade 1 : revêtu ou très compact', grade2: 'grade 2 : gravier compact', grade3: 'grade 3 : mélange terre et gravier', grade4: 'grade 4 : surtout terre ou herbe', grade5: 'grade 5 : terre meuble ou herbe' },
    seasonal: { yes: 'selon la saison', summer: 'en été', winter: 'en hiver', spring: 'au printemps', autumn: 'en automne', wet_season: 'à la saison des pluies', dry_season: 'à la saison sèche' },
  },
  en: {
    surface: { asphalt: 'asphalt', paved: 'paved', concrete: 'concrete', paving_stones: 'paving stones', sett: 'cobbles', compacted: 'compacted gravel', fine_gravel: 'fine gravel',
      gravel: 'gravel', pebblestone: 'pebbles', unpaved: 'unpaved', ground: 'dirt', dirt: 'dirt', earth: 'dirt', grass: 'grass', sand: 'sand', mud: 'mud', rock: 'rock', wood: 'wood' },
    smoothness: { excellent: 'excellent', good: 'good', intermediate: 'average', bad: 'bad (ground clearance advised)', very_bad: 'very bad (raised vehicle)',
      horrible: 'horrible (4×4)', very_horrible: 'extreme (specialised 4×4)', impassable: 'impassable' },
    tracktype: { grade1: 'grade 1: paved or very compact', grade2: 'grade 2: compacted gravel', grade3: 'grade 3: mix of dirt and gravel', grade4: 'grade 4: mostly dirt or grass', grade5: 'grade 5: soft dirt or grass' },
    seasonal: { yes: 'depending on the season', summer: 'in summer', winter: 'in winter', spring: 'in spring', autumn: 'in autumn', wet_season: 'in the wet season', dry_season: 'in the dry season' },
  },
  de: {
    surface: { asphalt: 'Asphalt', paved: 'befestigt', concrete: 'Beton', paving_stones: 'Pflaster', sett: 'Kopfsteinpflaster', compacted: 'verdichteter Kies', fine_gravel: 'Feinkies',
      gravel: 'Kies', pebblestone: 'Kieselsteine', unpaved: 'unbefestigt', ground: 'Erde', dirt: 'Erde', earth: 'Erde', grass: 'Gras', sand: 'Sand', mud: 'Schlamm', rock: 'Fels', wood: 'Holz' },
    smoothness: { excellent: 'ausgezeichnet', good: 'gut', intermediate: 'mittel', bad: 'schlecht (Bodenfreiheit empfohlen)', very_bad: 'sehr schlecht (höhergelegtes Fahrzeug)',
      horrible: 'katastrophal (4×4)', very_horrible: 'extrem (spezieller 4×4)', impassable: 'unpassierbar' },
    tracktype: { grade1: 'Grad 1: befestigt oder sehr kompakt', grade2: 'Grad 2: verdichteter Kies', grade3: 'Grad 3: Erde und Kies gemischt', grade4: 'Grad 4: meist Erde oder Gras', grade5: 'Grad 5: weiche Erde oder Gras' },
    seasonal: { yes: 'je nach Jahreszeit', summer: 'im Sommer', winter: 'im Winter', spring: 'im Frühling', autumn: 'im Herbst', wet_season: 'in der Regenzeit', dry_season: 'in der Trockenzeit' },
  },
};
const orVal = (group, v) => ((OR_VAL[prefs.lang] || OR_VAL.fr)[group] || {})[v] || String(v).replace(/_/g, ' ');
const ACC_NO = /^(no|private|forestry|agricultural|agricultural;forestry|forestry;agricultural|military|emergency|delivery|discouraged)$/;
const ACC_DEST = /^(destination|customers|permit|residents|delivery;destination)$/;
const ACC_KEYS = ['motorcar', 'motor_vehicle', 'vehicle', 'access'];
function orAccess(tg) {
  const k = ACC_KEYS.find(x => tg[x] != null);
  const v = k ? String(tg[k]).toLowerCase() : '';
  const base = !v ? 'ok' : ACC_NO.test(v) ? 'no' : ACC_DEST.test(v) ? 'dest' : 'ok';
  const cond = ACC_KEYS.map(x => tg[x + ':conditional']).filter(Boolean);
  return { acc: base === 'ok' && (cond.length || tg.seasonal) ? 'season' : base, key: k, val: v, cond };
}
function orDifficulty(tg) {
  const prim = [];
  const sm = { excellent: 0, good: 0, intermediate: 0, bad: 1, very_bad: 2, horrible: 3, very_horrible: 3, impassable: 4 }[tg.smoothness];
  const tt = { grade1: 0, grade2: 0, grade3: 1, grade4: 2, grade5: 2 }[tg.tracktype];
  const fw = { yes: 2, recommended: 1 }[tg['4wd_only']];
  [sm, tt, fw].forEach(v => { if (v != null) prim.push(v); });
  if (prim.length) return Math.max(...prim);
  const su = tg.surface;
  if (/^(asphalt|paved|concrete|paving_stones|sett|compacted|fine_gravel|gravel)$/.test(su || '')) return 0;
  if (/^(unpaved|pebblestone|ground|dirt|earth|grass|wood)$/.test(su || '')) return 1;
  if (/^(sand|mud|rock)$/.test(su || '')) return 2;
  return -1;
}
function orTileXY(lng, lat, z) {
  const n = 2 ** z, x = Math.floor((lng + 180) / 360 * n);
  const r = lat * RAD, y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
  return [Math.max(0, Math.min(n - 1, x)), Math.max(0, Math.min(n - 1, y))];
}
function orTileBBox(x, y, z) {
  const n = 2 ** z, lng = v => v / n * 360 - 180, lat = v => Math.atan(Math.sinh(Math.PI * (1 - 2 * v / n))) / RAD;
  return { w: lng(x), e: lng(x + 1), n: lat(y), s: lat(y + 1) };
}
function orQuery(b) {
  const bb = `${b.s.toFixed(5)},${b.w.toFixed(5)},${b.n.toFixed(5)},${b.e.toFixed(5)}`;
  return `[out:json][timeout:25];(way["highway"="track"](${bb});way["highway"~"^(unclassified|service|road)$"]["surface"~"^(unpaved|gravel|fine_gravel|compacted|dirt|ground|earth|grass|sand|mud|rock|pebblestone)$"](${bb});way["4wd_only"~"^(yes|recommended)$"](${bb}););out body geom qt;`;
}
const OR_KEEP = ['name', 'ref', 'highway', 'tracktype', 'surface', 'smoothness', 'width', 'incline', '4wd_only', 'seasonal', 'description', 'note', 'access', 'vehicle',
  'motor_vehicle', 'motorcar', 'access:conditional', 'vehicle:conditional', 'motor_vehicle:conditional', 'motorcar:conditional', 'maxweight', 'maxwidth'];
function orFeatures(json) {
  const out = [];
  for (const el of json.elements || []) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const tg = {};
    for (const k of OR_KEEP) if (el.tags && el.tags[k] != null) tg[k] = String(el.tags[k]).slice(0, 200);
    const a = orAccess(tg);
    const nd = el.nodes || [];
    out.push({ type: 'Feature', properties: { id: el.id, d: orDifficulty(tg), acc: a.acc, t: JSON.stringify(tg), a: nd.length ? nd[0] : null, b: nd.length ? nd[nd.length - 1] : null },
      geometry: { type: 'LineString', coordinates: el.geometry.map(p => [+p.lon.toFixed(6), +p.lat.toFixed(6)]) } });
  }
  return out;
}
async function orFetch(key, x, y) {
  const b = orTileBBox(x, y, OR_Z), q = orQuery(b);
  let lastErr = null;
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url + '?data=' + encodeURIComponent(q));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return orFeatures(await r.json());
    } catch (e) { lastErr = e; }
  }
  OR.lastErr = (lastErr && lastErr.message) || 'Overpass';
  throw lastErr || new Error('overpass');
}
function orLoadTile(key, x, y) {
  let tile = OR.tiles.get(key);
  if (!tile) { tile = { state: 'queued', feats: [] }; OR.tiles.set(key, tile); }
  tile.state = 'loading';
  tile.p = (async () => {
    const ck = OR_CACHE_V + key;
    let cached = null;
    try {
      cached = await DB.getOsm(ck).catch(() => null);
      if (cached && Date.now() - cached.t < OR_TTL) tile.feats = cached.feats;
      else {
        tile.feats = await orFetch(key, x, y);
        DB.putOsm(ck, { t: Date.now(), feats: tile.feats }).catch(() => {});
      }
      tile.state = 'ok';
    } catch (e) {
      if (cached) { tile.feats = cached.feats; tile.state = 'ok'; }
      else { tile.state = 'err'; tile.retry = Date.now() + 30000; }
    }
    orRender();
  })();
  return tile.p;
}
function orEnsureTile(key, x, y) {
  const tile = OR.tiles.get(key);
  if (tile && tile.state === 'ok') return Promise.resolve();
  if (tile && tile.state === 'loading' && tile.p) return tile.p;
  return orLoadTile(key, x, y);
}
function orPump() {
  while (OR.busy < 2 && OR.queue.length) {
    const [key, x, y] = OR.queue.shift();
    const tile = OR.tiles.get(key);
    if (!tile || tile.state !== 'queued') continue;
    OR.busy++;
    orLoadTile(key, x, y).finally(() => { OR.busy--; orPump(); });
  }
}
/* Pendant le suivi GPS la carte bouge à chaque image : on rafraîchit au plus toutes les 0,6 s, sans attendre l'arrêt. */
function orRefresh() {
  if (OR.timer) return;
  OR.timer = setTimeout(() => { OR.timer = null; orUpdate(); }, 600);
}
function orUpdate() {
  const m = S.map;
  if (!m || !m.getBounds) return;
  if (!offroadOn()) { orStatus(''); return; }
  if (m.getZoom() < OR_MINZOOM) { orStatus('zoom'); orRender(); return; }
  const b = m.getBounds();
  const [x0, y0] = orTileXY(b.getWest(), b.getNorth(), OR_Z), [x1, y1] = orTileXY(b.getEast(), b.getSouth(), OR_Z);
  const keys = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.push([OR_Z + '/' + x + '/' + y, x, y]);
  if (keys.length > OR_MAXTILES) { orStatus('zoom'); return; }
  OR.view = keys.map(k => k[0]);
  for (const [key, x, y] of keys) {
    const tile = OR.tiles.get(key);
    if (tile && (tile.state === 'ok' || tile.state === 'loading' || tile.state === 'queued')) continue;
    if (tile && tile.state === 'err' && Date.now() < tile.retry) continue;
    OR.tiles.set(key, { state: 'queued', feats: [] });
    OR.queue.push([key, x, y]);
  }
  if (OR.tiles.size > 80) for (const k of [...OR.tiles.keys()].slice(0, OR.tiles.size - 80)) if (!OR.view.includes(k)) OR.tiles.delete(k);
  orPump();
  orRender();
}
function orRender() {
  const m = S.map;
  if (!m || !m.getSource) return;
  const src = m.getSource('or');
  const view = OR.view || [];
  const seen = new Map();
  let loading = false, err = false;
  for (const k of view) {
    const tile = OR.tiles.get(k);
    if (!tile) continue;
    if (tile.state === 'loading' || tile.state === 'queued') loading = true;
    if (tile.state === 'err') err = true;
    for (const f of tile.feats || []) seen.set(f.properties.id, f);
  }
  const show = offroadOn() && m.getZoom() >= OR_MINZOOM;
  const sig = (show ? 1 : 0) + '|' + view.join(',') + '|' + view.map(k => (OR.tiles.get(k) || {}).state).join('') + '|' + seen.size;
  if (src && (sig !== OR.sig || OR.forceRender)) { OR.sig = sig; OR.forceRender = false; src.setData({ type: 'FeatureCollection', features: show ? [...seen.values()] : [] }); }
  if (!offroadOn()) return orStatus('');
  if (m.getZoom() < OR_MINZOOM) return orStatus('zoom');
  orStatus(loading ? 'loading' : err && !seen.size ? 'err' : 'count', seen.size);
}
function orStatus(kind, n) {
  const el = $('#orStatus');
  if (!el) return;
  el.hidden = !kind;
  if (!kind) return;
  el.dataset.kind = kind;
  el.querySelector('span').textContent = kind === 'zoom' ? t('orZoom') : kind === 'loading' ? t('orLoading') : kind === 'err' ? t('orErr')
    : n ? (n === 1 ? t('orCount1') : t('orCount', { n })) : t('orNone');
}
function orAddLayers() {
  const m = S.map;
  if (!m || !offroadOn()) return;
  if (!m.getSource('or')) m.addSource('or', { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, promoteId: 'id' });
  const color = ['match', ['get', 'd'], 0, OR_COLORS[0], 1, OR_COLORS[1], 2, OR_COLORS[2], 3, OR_COLORS[3], 4, OR_COLORS[4], OR_UNKNOWN];
  const width = ['interpolate', ['linear'], ['zoom'], 11, 2, 14, 4, 17, 7];
  const lay = { 'line-cap': 'round', 'line-join': 'round' };
  const add = l => { if (!m.getLayer(l.id)) m.addLayer(l); };
  if (!m.getSource('or-pick')) m.addSource('or-pick', { type: 'geojson', data: orPickGeo() });
  add({ id: 'or-pick-glow', type: 'line', source: 'or-pick', layout: lay, paint: { 'line-color': cssVar('--accent'), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 8, 17, 20], 'line-opacity': 0.4, 'line-blur': 2 } });
  add({ id: 'or-sel', type: 'line', source: 'or', layout: lay, filter: ['==', ['get', 'id'], -1], paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 9, 17, 16], 'line-opacity': 0.45 } });
  add({ id: 'or-casing', type: 'line', source: 'or', layout: lay, filter: ['!=', ['get', 'acc'], 'no'], paint: { 'line-color': '#000000', 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 4, 14, 7, 17, 11], 'line-opacity': 0.35 } });
  add({ id: 'or-no', type: 'line', source: 'or', layout: { 'line-join': 'round' }, filter: ['==', ['get', 'acc'], 'no'], paint: { 'line-color': '#9A7B72', 'line-width': width, 'line-opacity': 0.75, 'line-dasharray': [1.2, 1.6] } });
  add({ id: 'or-restr', type: 'line', source: 'or', layout: { 'line-join': 'round' }, filter: ['in', ['get', 'acc'], ['literal', ['dest', 'season']]], paint: { 'line-color': color, 'line-width': width, 'line-dasharray': [2.2, 1.2] } });
  add({ id: 'or-line', type: 'line', source: 'or', layout: lay, filter: ['==', ['get', 'acc'], 'ok'], paint: { 'line-color': color, 'line-width': width } });
  OR.forceRender = true;
  orRender();
}
function orPickGeo() {
  const c = OR.pickCoords;
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c && c.length > 1 ? c : [] } };
}
function orSetPick(coords) {
  OR.pickCoords = coords || null;
  const src = S.map && S.map.getSource && S.map.getSource('or-pick');
  if (src) src.setData(orPickGeo());
}
function orSelect(f) {
  OR.sel = f;
  const m = S.map;
  if (m && m.getLayer && m.getLayer('or-sel')) m.setFilter('or-sel', ['==', ['get', 'id'], f ? f.properties.id : -1]);
}
function orClick(e) {
  const m = S.map;
  if (!m || !m.queryRenderedFeatures || m.getZoom() < OR_MINZOOM) return;
  const p = e.point, r = 14;
  const layers = ['or-line', 'or-restr', 'or-no'].filter(id => m.getLayer(id));
  const hits = m.queryRenderedFeatures([[p.x - r, p.y - r], [p.x + r, p.y + r]], { layers });
  if (!hits.length) return;
  const id = hits[0].properties.id;
  let f = null;
  for (const k of OR.view || []) { const tile = OR.tiles.get(k); f = tile && (tile.feats || []).find(x => x.properties.id === id); if (f) break; }
  if (!f) return;
  OR.at = e.lngLat;
  OR.chain = null; orSetPick(null);
  S.keepTrack = true;
  orSelect(f);
  haptic('select');
  openSheet('track');
  S.keepTrack = false;
}
function lineLength(coords) { let d = 0; for (let i = 1; i < coords.length; i++) d += hav([coords[i - 1][1], coords[i - 1][0]], [coords[i][1], coords[i][0]]); return d; }
function orName(tg) { return tg.name || tg.ref || t('orTrack'); }
function renderTrackSheet() {
  if (OR.chain) { renderChainSheet(); return; }
  const f = OR.sel;
  if (!f) return;
  const tg = JSON.parse(f.properties.t || '{}'), d = f.properties.d, a = orAccess(tg);
  $('#trackTitle').textContent = orName(tg);
  const row = (k, v) => v ? `<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>` : '';
  const condTxt = a.cond.map(c => c.split(';').map(part => {
    const m2 = /^\s*([^@]+?)\s*@\s*\(?(.+?)\)?\s*$/.exec(part);
    if (!m2) return part.trim();
    const v = m2[1].toLowerCase();
    return `${ACC_NO.test(v) ? t('acc_no') : ACC_DEST.test(v) ? t('acc_dest') : t('acc_ok')} : ${m2[2]}`;
  }).join(' ; ')).join(' ; ');
  const accTxt = t('acc_' + a.acc) + (a.val ? ` (${a.key}=${a.val})` : '');
  const dc = d >= 0 ? OR_COLORS[d] : OR_UNKNOWN;
  $('#trackBody').innerHTML = `<div class="or-badges"><span class="or-badge" style="--c:${dc}">${esc(t(d >= 0 ? 'd' + d : 'd_unk'))}</span>
      <span class="or-badge acc-${esc(a.acc)}">${esc(t('acc_' + a.acc))}</span></div>
    <div class="kvs">
      ${row(t('orVehicle'), t(d >= 0 ? 'd' + d : 'd_unk'))}
      ${row(t('orAccess'), accTxt)}
      ${condTxt ? row(t('orPeriod'), condTxt) : ''}
      ${row(t('orSeasonal'), tg.seasonal ? orVal('seasonal', tg.seasonal) : '')}
      ${row(t('orSurface'), tg.surface ? orVal('surface', tg.surface) : '')}
      ${row(t('orGrade'), tg.tracktype ? orVal('tracktype', tg.tracktype) : '')}
      ${row(t('orSmooth'), tg.smoothness ? orVal('smoothness', tg.smoothness) : '')}
      ${row(t('or4wd'), tg['4wd_only'] ? (tg['4wd_only'] === 'yes' ? t('yes') : t('orRecommended')) : '')}
      ${row(t('orWidth'), tg.width ? tg.width.replace(/\s*m$/, '') + ' m' : (tg.maxwidth ? tg.maxwidth + ' m' : ''))}
      ${row(t('orIncline'), tg.incline && /\d/.test(tg.incline) ? tg.incline : '')}
      ${row(t('orLength'), fmtDist(lineLength(f.geometry.coordinates)))}
      ${row(t('orNoteTag'), tg.description || tg.note || '')}
    </div>
    <button class="btn btn-primary" data-oract="whole">${esc(t('orWhole'))}</button>
    ${S.active ? `<button class="btn btn-ghost" id="orPinBtn">${esc(t('orPin'))}</button>` : ''}
    <a class="btn btn-ghost" href="https://www.openstreetmap.org/way/${encodeURIComponent(f.properties.id)}" target="_blank" rel="noopener">${esc(t('orOsm'))}</a>
    <p class="s">${esc(t('orDisclaimer'))}</p>`;
}
/* ---------- exploration des pistes sans convoi ---------- */
const EX = { watch: null, mk: null, first: true };
function openExplore() {
  if (typeof maplibregl === 'undefined') { homeErr(t('errLibs')); return; }
  S.explore = true; EX.first = true;
  $('#main').classList.add('explore');
  closeSheets();
  show('main');
  initMap();
  setView('map');
  if (navigator.geolocation) EX.watch = navigator.geolocation.watchPosition(exFix, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
  orLoadSaved();
  setTimeout(() => orUpdate(), 400);
}
function exFix(pos) {
  const c = pos.coords;
  S.exPos = { lat: c.latitude, lng: c.longitude, acc: c.accuracy };
  if (!S.map) return;
  if (!EX.mk) {
    const el = document.createElement('div');
    el.className = 'ex-me';
    EX.mk = new maplibregl.Marker({ element: el }).setLngLat([c.longitude, c.latitude]).addTo(S.map);
  } else EX.mk.setLngLat([c.longitude, c.latitude]);
  if (EX.first) { EX.first = false; S.map.jumpTo({ center: [c.longitude, c.latitude], zoom: Math.max(S.map.getZoom(), 12.6) }); orRefresh(); }
}
function exitExplore() {
  if (!S.explore) return;
  S.explore = false;
  if (EX.watch != null && navigator.geolocation) navigator.geolocation.clearWatch(EX.watch);
  EX.watch = null;
  if (EX.mk) { EX.mk.remove(); EX.mk = null; }
  S.exPos = null;
  $('#main').classList.remove('explore');
}
function closeExplore() {
  closeSheets(); orSetPick(null); exitExplore();
  show('home'); renderHome();
}

/* ---------- étape 2 : pistes entières, recherche, Mes pistes ---------- */
const ACC_RANK = { ok: 0, season: 1, dest: 2, no: 3 };
const orColor = d => (d >= 0 ? OR_COLORS[d] : OR_UNKNOWN);
function decimate(arr, max) {
  if (arr.length <= max) return arr.slice();
  const k = Math.ceil(arr.length / max), out = [];
  for (let i = 0; i < arr.length; i += k) out.push(arr[i]);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
}
function bboxOf(coords) {
  let w = 180, so = 90, e = -180, n = -90;
  for (const p of coords) { w = Math.min(w, p[0]); e = Math.max(e, p[0]); so = Math.min(so, p[1]); n = Math.max(n, p[1]); }
  return [[w, so], [e, n]];
}
/* Dans OpenStreetMap une piste est découpée en tronçons : on raccorde ceux qui se suivent bout à bout
   (point de jonction partagé par exactement deux tronçons), et on coupe aux carrefours. */
function orChains(feats) {
  const ends = new Map();
  const add = (n, i) => { if (n == null) return; let l = ends.get(n); if (!l) ends.set(n, l = []); l.push(i); };
  feats.forEach((f, i) => { add(f.properties.a, i); add(f.properties.b, i); });
  const used = new Uint8Array(feats.length), chains = [];
  const nextAt = (node, cur) => {
    const l = ends.get(node);
    if (!l || l.length !== 2) return -1;
    const j = l[0] === cur ? l[1] : l[0];
    return j === cur || used[j] ? -1 : j;
  };
  for (let i = 0; i < feats.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const f0 = feats[i];
    let coords = f0.geometry.coordinates.slice();
    const segs = [f0];
    let cur = i, node = f0.properties.b;
    for (let g = 0; g < 2000; g++) {
      const j = nextAt(node, cur);
      if (j < 0) break;
      used[j] = 1;
      const fj = feats[j], fwd = fj.properties.a === node;
      const cj = fwd ? fj.geometry.coordinates : fj.geometry.coordinates.slice().reverse();
      coords = coords.concat(cj.slice(1)); segs.push(fj);
      node = fwd ? fj.properties.b : fj.properties.a; cur = j;
    }
    cur = i; node = f0.properties.a;
    for (let g = 0; g < 2000; g++) {
      const j = nextAt(node, cur);
      if (j < 0) break;
      used[j] = 1;
      const fj = feats[j], fwd = fj.properties.b === node;
      const cj = fwd ? fj.geometry.coordinates : fj.geometry.coordinates.slice().reverse();
      coords = cj.slice(0, -1).concat(coords); segs.unshift(fj);
      node = fwd ? fj.properties.a : fj.properties.b; cur = j;
    }
    chains.push({ segs, coords });
  }
  return chains;
}
function orChainInfo(ch, c) {
  let d = -1, unk = 0, len = 0;
  const accLen = { ok: 0, season: 0, dest: 0, no: 0 }, surf = new Set(), names = {}, ids = [];
  for (const f of ch.segs) {
    const p = f.properties, tg = JSON.parse(p.t || '{}'), l = lineLength(f.geometry.coordinates);
    len += l; ids.push(p.id);
    if (p.d >= 0) d = Math.max(d, p.d); else unk += l;
    accLen[p.acc] = (accLen[p.acc] || 0) + l;
    if (tg.surface) surf.add(tg.surface);
    const nm = tg.name || tg.ref;
    if (nm) names[nm] = (names[nm] || 0) + l;
  }
  const acc = Object.keys(accLen).filter(k => accLen[k] > 0).sort((x, y) => ACC_RANK[y] - ACC_RANK[x])[0] || 'ok';
  let near = null, entryFirst = true;
  if (c) {
    near = Infinity;
    for (const p of ch.coords) near = Math.min(near, hav([c.lat, c.lng], [p[1], p[0]]));
    const a = ch.coords[0], z = ch.coords[ch.coords.length - 1];
    entryFirst = hav([c.lat, c.lng], [a[1], a[0]]) <= hav([c.lat, c.lng], [z[1], z[0]]);
  }
  return { ids, coords: ch.coords, len, d, unkShare: len ? unk / len : 1, acc, accPart: accLen.no > 0 && accLen.no < len * 0.98,
    name: Object.keys(names).sort((x, y) => names[y] - names[x])[0] || '', near, entryFirst, surf: [...surf], segs: ch.segs.length, bbox: bboxOf(ch.coords) };
}
const myPos = () => (S.pos ? { lat: S.pos.lat, lng: S.pos.lng } : S.exPos ? { lat: S.exPos.lat, lng: S.exPos.lng } : null);
const orAccLabel = r => (r.accPart ? t('orPartNo') : t('acc_' + r.acc));
const orKey = r => 'c' + Math.min(...r.ids);
const orIsSaved = r => (OR.saved || []).some(x => x.key === orKey(r));
function orShowChain(r) {
  OR.chain = r; OR.sel = null;
  orSelect(null);
  orSetPick(r.coords);
  if (S.active) setFollow(false);
  if (S.map && S.map.fitBounds) S.map.fitBounds(r.bbox, { padding: { top: 90, bottom: Math.round(window.innerHeight * 0.5), left: 40, right: 40 }, duration: 600, maxZoom: 15 });
  S.keepTrack = true;
  openSheet('track');
  S.keepTrack = false;
}
function orWholeTrack() {
  const f = OR.sel;
  if (!f) return;
  const feats = new Map();
  for (const k of OR.view || []) for (const x of (OR.tiles.get(k) || {}).feats || []) feats.set(x.properties.id, x);
  const ch = orChains([...feats.values()]).find(c => c.segs.some(x => x.properties.id === f.properties.id));
  if (!ch) return;
  const r = orChainInfo(ch, OR.at ? { lat: OR.at.lat, lng: OR.at.lng } : myPos());
  r.partial = true;
  orShowChain(r);
}
function renderChainSheet() {
  const r = OR.chain;
  $('#trackTitle').textContent = r.name || t('orTrack');
  const row = (k, v) => v ? `<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>` : '';
  const lead = S.active && isLeader();
  const saved = orIsSaved(r);
  $('#trackBody').innerHTML = `<div class="or-badges"><span class="or-badge" style="--c:${orColor(r.d)}">${esc(t(r.d >= 0 ? 'd' + r.d : 'd_unk'))}</span>
      <span class="or-badge acc-${esc(r.accPart ? 'no' : r.acc)}">${esc(orAccLabel(r))}</span></div>
    <div class="kvs">
      ${row(t('orTotalLen'), fmtDist(r.len))}
      ${row(t('orVehicle'), t(r.d >= 0 ? 'd' + r.d : 'd_unk'))}
      ${row(t('orAccess'), orAccLabel(r))}
      ${row(t('orSurfaces'), r.surf && r.surf.length ? r.surf.map(x => orVal('surface', x)).join(', ') : '')}
      ${row(t('orSegments'), String(r.segs || 1))}
    </div>
    ${r.unkShare > 0.05 && r.d >= 0 ? `<p class="s">${esc(t('orUnknownPart'))}</p>` : ''}
    ${r.partial ? `<p class="s">${esc(t('orChainNote'))}</p>` : ''}
    ${lead ? `<button class="btn btn-primary" data-oract="ride">${esc(t('orRide'))}</button><p class="s">${esc(t('orRideNote'))}</p>`
      : `<p class="s">${esc(t(S.active ? 'orRideLeader' : 'orRideExplore'))}</p>`}
    <button class="btn btn-ghost" data-oract="${saved ? 'unsave' : 'save'}">${esc(t(saved ? 'orUnsave' : 'orSave'))}</button>
    ${r.ids && r.ids.length ? `<a class="btn btn-ghost" href="https://www.openstreetmap.org/way/${encodeURIComponent(r.ids[0])}" target="_blank" rel="noopener">${esc(t('orOsm'))}</a>` : ''}
    <p class="s">${esc(t('orDisclaimer'))}</p>`;
}
async function orLoadSaved() {
  try { OR.saved = (await DB.getKv('orSaved')) || []; } catch (e) { OR.saved = OR.saved || []; }
}
function orToggleSave(r) {
  const key = orKey(r);
  if (orIsSaved(r)) OR.saved = OR.saved.filter(x => x.key !== key);
  else OR.saved.unshift({ key, name: r.name, len: Math.round(r.len), d: r.d, acc: r.acc, accPart: r.accPart, unkShare: r.unkShare, surf: r.surf, segs: r.segs,
    ids: r.ids.slice(0, 500), coords: decimate(r.coords, 800).map(p => [+p[0].toFixed(5), +p[1].toFixed(5)]), at: Date.now() });
  DB.putKv('orSaved', OR.saved).catch(() => {});
  haptic('select');
}
function savedToChain(x) {
  const c = myPos();
  const r = Object.assign({}, x, { bbox: bboxOf(x.coords), near: null, entryFirst: true });
  if (c) {
    r.near = Math.min(...x.coords.map(p => hav([c.lat, c.lng], [p[1], p[0]])));
    const a = x.coords[0], z = x.coords[x.coords.length - 1];
    r.entryFirst = hav([c.lat, c.lng], [a[1], a[0]]) <= hav([c.lat, c.lng], [z[1], z[0]]);
  }
  return r;
}
OR.q = Object.assign({ tab: 'search', where: 'me', radius: 10, veh: 1, acc: 'restr', minLen: 1000, unknown: 'yes', sort: 'near' }, store.get('orQuery', {}));
function renderOrSearch() {
  const q = OR.q;
  const seg = (k, opts, cls) => `<div class="seg${cls ? ' ' + cls : ''}" data-oq="${k}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${String(q[k]) === String(v)}">${esc(l)}</button>`).join('')}</div>`;
  const field = (label, inner) => `<div class="field"><span class="field-label">${esc(label)}</span>${inner}</div>`;
  let h = seg('tab', [['search', t('orTabSearch')], ['saved', t('orTabSaved')]]);
  if (q.tab === 'saved') {
    const list = OR.saved || [];
    h += list.length ? `<div class="list">${list.map((x, i) => `<div class="item or-res"><button class="or-open" data-osaved="${i}"><span class="or-dot" style="--c:${orColor(x.d)}"></span>
        <span class="grow"><span class="t">${esc(x.name || t('orTrack'))}</span><span class="s">${esc([fmtDist(x.len), t(x.d >= 0 ? 'd' + x.d : 'd_unk'), orAccLabel(x)].join(' · '))}</span></span></button>
        <button class="mini" data-osdel="${i}" aria-label="${esc(t('del'))}">✕</button></div>`).join('')}</div>`
      : `<p class="empty">${esc(t('orSavedEmpty'))}</p>`;
  } else {
    h += field(t('orWhere'), seg('where', [['me', t('orWhereMe')], ['view', t('orWhereView')], ['place', t('orWherePlace')]])
      + (q.where === 'place' ? `<input id="orPlace" class="text" type="search" placeholder="${esc(t('orPlacePh'))}" value="${esc(OR.place ? OR.place.label : '')}" autocomplete="off" enterkeyhint="search"><div id="orPlaceRes" class="list"></div>` : ''));
    if (q.where !== 'view') h += field(t('orRadius'), seg('radius', [5, 10, 20].map(v => [v, fmtDist(v * 1000)])));
    h += field(t('orVeh'), seg('veh', [0, 1, 2, 3].map(v => [v, t('vShort' + v)])));
    h += field(t('orAccF'), seg('acc', [['ok', t('orAccOk')], ['restr', t('orAccRestr')], ['all', t('orAccAll')]]));
    h += field(t('orMinLen'), seg('minLen', [[0, t('orAnyLen')], ...[1000, 3000, 5000, 10000].map(v => [v, fmtDist(v)])], 'grid5'));
    h += field(t('orUnknown'), seg('unknown', [['yes', t('yes')], ['no', t('orNo')]]));
    h += field(t('orSort'), seg('sort', [['near', t('orSortNear')], ['long', t('orSortLong')]]));
    h += `<button class="btn btn-primary" id="orGo" ${OR.searching ? 'disabled' : ''}>${esc(OR.searching ? t('orProgress', { a: OR.prog[0], b: OR.prog[1] }) : t('orGo'))}</button>`;
    if (OR.searchMsg) h += `<p class="s or-msg">${esc(OR.searchMsg)}</p>`;
    if (OR.results) {
      const R = OR.results;
      h += `<div class="field"><span class="field-label">${esc(R.total === 1 ? t('orResults1') : t('orResults', { n: R.total }))}</span>`
        + (R.list.length ? `<div class="list">${R.list.map((r, i) => `<button class="item or-res or-open" data-ores="${i}"><span class="or-dot" style="--c:${orColor(r.d)}"></span>
          <span class="grow"><span class="t">${esc(r.name || t('orTrack'))}</span><span class="s">${esc([fmtDist(r.len), t(r.d >= 0 ? 'd' + r.d : 'd_unk'), orAccLabel(r), r.near != null ? t('orAway', { d: fmtDist(r.near) }) : ''].filter(Boolean).join(' · '))}</span></span></button>`).join('')}</div>`
          : `<p class="empty">${esc(t('orNoResult'))}</p>`)
        + (R.total > R.list.length ? `<p class="s">${esc(t('orMore', { n: R.total - R.list.length }))}</p>` : '') + '</div>';
    }
  }
  h += `<button class="btn btn-ghost" id="orLegendOpen">${esc(t('orLegend'))}</button>`;
  if (OR.lastErr) h += `<p class="s">${esc(t('orLastErr', { e: OR.lastErr }))}</p>`;
  $('#orSearchBody').innerHTML = h;
}
function orSearchCenter() {
  const q = OR.q;
  if (q.where === 'place') return OR.place ? { lat: OR.place.lat, lng: OR.place.lng } : null;
  const mp = myPos();
  if (q.where === 'me' && mp) return mp;
  if (q.where === 'me') OR.searchMsg = t('exNoGps');
  const c = S.map.getCenter();
  return { lat: c.lat, lng: c.lng };
}
async function orSearch() {
  if (OR.searching || !S.map) return;
  const q = OR.q;
  OR.searchMsg = '';
  const c = orSearchCenter();
  if (!c) { OR.searchMsg = t('orPickPlace'); renderOrSearch(); return; }
  let bb;
  if (q.where === 'view') { const b = S.map.getBounds(); bb = { w: b.getWest(), e: b.getEast(), s: b.getSouth(), n: b.getNorth() }; }
  else { const R = q.radius * 1000, dl = R / 111320, dg = R / (111320 * Math.cos(c.lat * RAD)); bb = { w: c.lng - dg, e: c.lng + dg, s: c.lat - dl, n: c.lat + dl }; }
  const [x0, y0] = orTileXY(bb.w, bb.n, OR_Z), [x1, y1] = orTileXY(bb.e, bb.s, OR_Z);
  const keys = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.push([OR_Z + '/' + x + '/' + y, x, y]);
  if (keys.length > 64) { OR.searchMsg = t('orViewTooBig'); renderOrSearch(); return; }
  OR.searching = true; OR.prog = [0, keys.length]; OR.results = null;
  renderOrSearch();
  let i = 0;
  const worker = async () => {
    while (i < keys.length) {
      const [key, x, y] = keys[i++];
      await orEnsureTile(key, x, y).catch(() => {});
      OR.prog[0]++;
      const go = $('#orGo');
      if (go) go.textContent = t('orProgress', { a: OR.prog[0], b: OR.prog[1] });
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  const feats = new Map();
  for (const [key] of keys) for (const f of (OR.tiles.get(key) || {}).feats || []) feats.set(f.properties.id, f);
  const R = q.where === 'view' ? Infinity : q.radius * 1000;
  const accOk = r => q.acc === 'all' || (q.acc === 'ok' ? r.acc === 'ok' : r.acc !== 'no');
  let list = orChains([...feats.values()]).map(ch => orChainInfo(ch, c))
    .filter(r => r.len >= Math.max(200, q.minLen) && r.near <= R && accOk(r) && (r.d >= 0 ? r.d <= q.veh : q.unknown === 'yes'));
  list.sort((a, b) => (q.sort === 'long' ? b.len - a.len : a.near - b.near));
  OR.results = { total: list.length, list: list.slice(0, 50) };
  OR.searching = false;
  renderOrSearch();
  if (S.active) setFollow(false);
  S.map.fitBounds([[bb.w, bb.s], [bb.e, bb.n]], { padding: 20, duration: 600 });
}
let orPlaceT = null;
function orPlaceInput(v) {
  clearTimeout(orPlaceT);
  const box = $('#orPlaceRes');
  if (!box) return;
  if (v.trim().length < 3) { box.innerHTML = ''; return; }
  orPlaceT = setTimeout(async () => {
    try {
      const j = await photon('/api', 'q=' + encodeURIComponent(v.trim()) + '&limit=6');
      OR.placeFeats = j.features || [];
      const el = $('#orPlaceRes');
      if (el) el.innerHTML = OR.placeFeats.map((f, i) => { const l = placeLabel(f.properties || {}); return `<button class="item" data-oplace="${i}"><span class="grow"><span class="t">${esc(l.title)}</span><span class="s">${esc(l.sub)}</span></span></button>`; }).join('');
    } catch (e) { /* hors ligne */ }
  }, 450);
}
function orSearchClick(e) {
  const segB = e.target.closest('[data-oq] button');
  if (segB) {
    const k = segB.closest('[data-oq]').dataset.oq, v = segB.dataset.v;
    OR.q[k] = ['radius', 'veh', 'minLen'].includes(k) ? +v : v;
    const keep = Object.assign({}, OR.q); delete keep.tab;
    store.set('orQuery', keep);
    renderOrSearch(); return;
  }
  if (e.target.closest('#orGo')) { orSearch(); return; }
  if (e.target.closest('#orLegendOpen')) { openSheet('orlegend'); return; }
  const pl = e.target.closest('[data-oplace]');
  if (pl) {
    const f = OR.placeFeats[+pl.dataset.oplace], [lng, lat] = f.geometry.coordinates;
    OR.place = { lat, lng, label: placeLabel(f.properties || {}).title };
    renderOrSearch(); return;
  }
  const rb = e.target.closest('[data-ores]');
  if (rb && OR.results) { orShowChain(OR.results.list[+rb.dataset.ores]); return; }
  const sv = e.target.closest('[data-osaved]');
  if (sv) { orShowChain(savedToChain(OR.saved[+sv.dataset.osaved])); return; }
  const del = e.target.closest('[data-osdel]');
  if (del) { OR.saved.splice(+del.dataset.osdel, 1); DB.putKv('orSaved', OR.saved).catch(() => {}); renderOrSearch(); }
}

/* ---------- piste roulée par le convoi ---------- */
const TRAIL_ICON = '<path d="M5 21c1.5-3 4-4 6-6s1-5 3.5-7S19 5 19 3"/><circle cx="5" cy="21" r="1.2"/><circle cx="19" cy="3" r="1.2"/>';
function orRide(r) {
  if (!S.active || !isLeader()) return;
  let coords = r.coords.map(p => [p[1], p[0]]);
  if (S.pos) {
    const here = [S.pos.lat, S.pos.lng];
    if (hav(here, coords[coords.length - 1]) < hav(here, coords[0])) coords.reverse();
  } else if (!r.entryFirst) coords.reverse();
  coords = decimate(coords, 600).map(p => [+p[0].toFixed(5), +p[1].toFixed(5)]);
  const name = r.name || t('orTrack');
  setPlan([{ id: rid(), lat: coords[0][0], lng: coords[0][1], label: t('trkEntry', { name }), entry: true }], { name, coords, len: Math.round(r.len), d: r.d });
  closeSheets();
  setFollow(true);
  toast(t('trkSet', { name }), 'ok', 6000);
}
function trackGeoOf(tk) {
  if (!tk || !tk.coords || tk.coords.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < tk.coords.length; i++) cum.push(cum[i - 1] + hav(tk.coords[i - 1], tk.coords[i]));
  return { coords: tk.coords, cum, total: cum[cum.length - 1] };
}
function trackProgress() {
  const g = S.trkGeo;
  if (!g || !S.pos) return;
  const p = [S.pos.lat, S.pos.lng];
  let best = { d: Infinity, i: 0, t: 0 };
  for (let i = 0; i < g.coords.length - 1; i++) { const pr = projectOnSeg(p, g.coords[i], g.coords[i + 1]); if (pr.d < best.d) best = { d: pr.d, i, t: pr.t }; }
  const prog = g.cum[best.i] + best.t * (g.cum[best.i + 1] - g.cum[best.i]);
  const on = best.d <= Math.max(80, Math.min(150, (S.pos.acc || 20) * 2));
  S.trk = { d: best.d, prog, on, started: !!(S.trk && S.trk.started) || on };
  if (S.trk.started && !S.trackDone && g.total - prog < 80) {
    S.trackDone = true;
    toast(t('trkDone'), 'ok', 8000); sfx('arrive'); haptic('alert');
  }
}
function trackGeoJSON() {
  const tk = S.plan && S.plan.track;
  const c = tk && tk.coords ? tk.coords.map(p => [p[1], p[0]]) : [];
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c.length > 1 ? c : [] } };
}

function renderOrLegend() {
  $('#orLegendBody').innerHTML = `<div class="legend">${[0, 1, 2, 3, 4].map(i => `<div class="lg"><i style="--c:${OR_COLORS[i]}"></i><span>${esc(t('d' + i))}</span><b></b></div>`).join('')}
      <div class="lg"><i style="--c:${OR_UNKNOWN}"></i><span>${esc(t('d_unk'))}</span><b></b></div></div>
    <p class="s">${esc(t('orLines'))}</p><p class="s">${esc(t('orDisclaimer'))}</p>`;
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

/* ---------- bandeau et liste des véhicules ---------- */
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
  const endAll = $('#btnEndAll');
  if (endAll) endAll.hidden = !(isLeader() && S.online.size > 1);
  const list = [member(me.id), ...sortedOthers()];
  const lead = isLeader();
  const audio = m => {
    const p = RTC.peers.get(m.id), st = p && p.pc.connectionState;
    return st === 'connected' ? t('audioOk') : st === 'failed' ? t('audioFail') : m.online ? t('audioWait') : '';
  };
  const invite = S.live ? `<div class="invite"><div class="invite-row"><button class="qr" id="qrBox" aria-label="QR"></button>
    <div class="invite-code"><span class="field-label">${esc(t('codeLabel'))}</span><div class="code-big">${esc(S.code)}</div><p class="s">${esc(t('qrHint'))}</p></div></div>
    <button class="btn btn-primary" id="btnInvite">${esc(t('shareLink'))}</button></div>` : '';
  const qrOld = S.live && $('#qrBox') ? $('#qrBox').innerHTML : '';
  $('#membersList').innerHTML = invite + list.map(m => `<div class="item">
    <span class="av" style="--c:${esc(m.color)}">${esc(initial(m.name))}</span>
    <div class="grow"><div class="t">${esc(m.name)}${m.id === me.id ? esc(t('you')) : ''}${m.id === S.leaderId ? '<i class="lead-tag"></i>' : ''}</div>
    <div class="s">${esc(m.id === me.id ? statusLabel(myStatus()) + ', ' + fmtSpd(m.spd) : memberMeta(m))}</div>
    ${m.id !== me.id ? `<div class="s">${esc(audio(m))}</div>` : ''}</div>
    ${m.lat != null ? `<button class="mini" data-see="${esc(m.id)}">${esc(t('see'))}</button>` : ''}
    ${lead && m.id !== me.id && m.online ? `<button class="mini" data-lead="${esc(m.id)}">${esc(t('makeLeader'))}</button>` : ''}
  </div>`).join('') + `<p class="s" style="margin-top:12px">${esc(t('currentLeader', { name: leaderName() }))}</p>`;
  if (S.live) { if (qrOld) $('#qrBox').innerHTML = qrOld; else drawInviteQr($('#qrBox')); }
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
    + `<button class="btn btn-primary" id="endSave">${esc(t('endTrip'))}</button>`
    + (S.live && isLeader() && S.online.size > 1 ? `<button class="btn btn-ghost" id="endAll">${esc(t('endAll'))}</button>` : '')
    + `<button class="btn btn-ghost" data-close>${esc(t('keepDriving'))}</button>`;
}
/* Le trajet s'enregistre quand on termine le convoi, sans question.
   Seuls les essais de moins d'une minute et de moins de 100 m sont ignorés. */
async function persistTrip() {
  const T = S.trip;
  if (!T) return false;
  const rows = statsRows();
  if (clock() - T.start < 60000 && (rows[0].dist || 0) < 100) return false;
  try {
    await DB.putTrip({ id: T.id, start: T.start, end: clock(), dest: T.dest || '', tracks: T.tracks, names: T.names, colors: T.colors, stats: rows });
    return true;
  } catch (e) { return false; }
}
async function finish(forAll) {
  if (forAll) send('end', { by: me.id });
  const id = S.trip && S.trip.id;
  const saved = await persistTrip();
  leave();
  if (saved) openTrip(id);
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
const GAUGE = { cx: 150, cy: 140, r: 116, max: 300, a0: 135, sweep: 270, step: 10, lbl: 50, len: 0 };
const GAUGE_STYLES = ['dial', 'digital', 'needle', 'ring', 'bar', 'hud'];
const GAUGE_SCALES = {
  kmh: [{ max: 120, lbl: 20, step: 10 }, { max: 160, lbl: 20, step: 10 }, { max: 200, lbl: 25, step: 5 }, { max: 240, lbl: 40, step: 10 },
    { max: 260, lbl: 20, step: 10 }, { max: 300, lbl: 50, step: 10 }, { max: 350, lbl: 50, step: 10 }, { max: 400, lbl: 50, step: 10 }],
  mph: [{ max: 80, lbl: 10, step: 5 }, { max: 100, lbl: 10, step: 5 }, { max: 120, lbl: 20, step: 5 }, { max: 140, lbl: 20, step: 10 },
    { max: 160, lbl: 20, step: 10 }, { max: 200, lbl: 25, step: 5 }, { max: 220, lbl: 20, step: 10 }, { max: 250, lbl: 50, step: 10 }],
};
const SPEED_WARN = { kmh: [0, 80, 100, 120], mph: [0, 50, 60, 75] };
const polar = (r, deg) => [GAUGE.cx + r * Math.cos(deg * RAD), GAUGE.cy + r * Math.sin(deg * RAD)];
let gaugeRaf = null;
function gaugeTicks(rIn, rMaj, rMin, rLbl) {
  const G = GAUGE, f = n => n.toFixed(1);
  let out = '';
  for (let v = 0; v <= G.max; v += G.step) {
    const a = G.a0 + v / G.max * G.sweep, major = v % G.lbl === 0;
    const [x1, y1] = polar(rIn, a), [x2, y2] = polar(major ? rMaj : rMin, a);
    out += `<line class="g-tick${major ? ' major' : ''}" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"/>`;
    if (major) { const [lx, ly] = polar(rLbl, a); out += `<text class="g-lbl" x="${f(lx)}" y="${f(ly + 4)}" text-anchor="middle">${v}</text>`; }
  }
  return out;
}
function buildGauge() {
  const G = GAUGE, f = n => n.toFixed(1), unit = spdUnit();
  const st = GAUGE_STYLES.includes(prefs.gaugeStyle) ? prefs.gaugeStyle : 'dial';
  Object.assign(G, GAUGE_SCALES[speedKey()][prefs.gaugeIdx] || GAUGE_SCALES[speedKey()][5]);
  const svg = $('#gaugeSvg');
  svg.setAttribute('class', 'gs-' + st);
  $('#speedo').classList.toggle('hud', st === 'hud');
  const dir = y => `<text class="g-dir" id="gDir" x="150" y="${y}" text-anchor="middle"></text>`;
  const [sx, sy] = polar(G.r, G.a0), [ex, ey] = polar(G.r, G.a0 + G.sweep);
  const arc = `M${f(sx)} ${f(sy)}A${G.r} ${G.r} 0 1 1 ${f(ex)} ${f(ey)}`;
  let html;
  if (st === 'digital' || st === 'hud') {
    html = `<text class="g-num ${st === 'hud' ? 'g-huge' : 'g-big'}" id="gNum" x="150" y="${st === 'hud' ? 160 : 152}" text-anchor="middle">–</text>
      <text class="g-unit" x="150" y="${st === 'hud' ? 200 : 192}" text-anchor="middle">${unit}</text>${st === 'hud' ? '' : dir(228)}`;
  } else if (st === 'needle') {
    html = `<path class="g-rim" d="${arc}"/>${gaugeTicks(112, 98, 104, 82)}
      <line class="g-hand" id="gHand" x1="150" y1="140" x2="150" y2="140"/><circle class="g-hub" cx="150" cy="140" r="8"/>
      <text class="g-num g-small" id="gNum" x="150" y="206" text-anchor="middle">–</text>
      <text class="g-unit" x="150" y="226" text-anchor="middle">${unit}</text>`;
  } else if (st === 'ring') {
    const R = 100;
    G.len = 2 * Math.PI * R;
    html = `<circle class="g-track" cx="150" cy="120" r="${R}"/>
      <circle class="g-val" id="gVal" cx="150" cy="120" r="${R}" stroke-dasharray="${f(G.len)}" stroke-dashoffset="${f(G.len)}" transform="rotate(-90 150 120)"/>
      <text class="g-num" id="gNum" x="150" y="138" text-anchor="middle">–</text>
      <text class="g-unit" x="150" y="164" text-anchor="middle">${unit}</text>${dir(236)}`;
  } else if (st === 'bar') {
    const N = 24, x0 = 22, w = 256, gap = 3, sw = (w - gap * (N - 1)) / N;
    const warn = SPEED_WARN[speedKey()][prefs.speedWarn] || 0;
    let segs = '';
    for (let i = 0; i < N; i++) {
      const hot = warn && (i + 1) / N * G.max > warn;
      segs += `<rect class="g-seg${hot ? ' hot' : ''}" x="${f(x0 + i * (sw + gap))}" y="166" width="${f(sw)}" height="28" rx="2"/>`;
    }
    html = `<text class="g-num g-mid" id="gNum" x="150" y="118" text-anchor="middle">–</text>
      <text class="g-unit" x="150" y="146" text-anchor="middle">${unit}</text>${segs}
      <text class="g-lbl" x="${x0}" y="214">0</text><text class="g-lbl" x="${x0 + w}" y="214" text-anchor="end">${G.max}</text>${dir(236)}`;
  } else {
    G.len = G.r * G.sweep * RAD;
    html = `<path class="g-track" d="${arc}"/>
      <path class="g-val" id="gVal" d="${arc}" stroke-dasharray="${f(G.len)}" stroke-dashoffset="${f(G.len)}"/>
      ${gaugeTicks(103, 92, 97, 78)}<line class="g-needle" id="gNeedle" x1="0" y1="0" x2="0" y2="0"/>
      <text class="g-num" id="gNum" x="150" y="160" text-anchor="middle">–</text>
      <text class="g-unit" x="150" y="184" text-anchor="middle">${unit}</text>${dir(232)}`;
  }
  svg.innerHTML = html;
}
function drawGauge(v) {
  const G = GAUGE, frac = Math.max(0, Math.min(1, v / G.max)), svg = $('#gaugeSvg'), f = n => n.toFixed(1);
  const num = $('#gNum');
  if (num) num.textContent = S.pos ? String(Math.round(v)) : '–';
  const warn = SPEED_WARN[speedKey()][prefs.speedWarn] || 0;
  svg.classList.toggle('over', !!(warn && S.pos && v > warn));
  const val = $('#gVal');
  if (val) { val.setAttribute('stroke-dashoffset', f(G.len * (1 - frac))); val.style.opacity = frac > 0.002 ? 1 : 0; }
  const a = G.a0 + frac * G.sweep;
  const nd = $('#gNeedle');
  if (nd) {
    const [x1, y1] = polar(G.r - 12, a), [x2, y2] = polar(G.r + 12, a);
    nd.setAttribute('x1', f(x1)); nd.setAttribute('y1', f(y1)); nd.setAttribute('x2', f(x2)); nd.setAttribute('y2', f(y2));
  }
  const hand = $('#gHand');
  if (hand) {
    const [x1, y1] = polar(-16, a), [x2, y2] = polar(G.r - 26, a);
    hand.setAttribute('x1', f(x1)); hand.setAttribute('y1', f(y1)); hand.setAttribute('x2', f(x2)); hand.setAttribute('y2', f(y2));
  }
  const segs = svg.querySelectorAll('.g-seg');
  if (segs.length) { const lit = Math.round(frac * segs.length); segs.forEach((el, i) => el.classList.toggle('on', i < lit)); }
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
  const gd = $('#gDir');
  if (gd) gd.textContent = p && p.hdg != null && p.spd > 1 ? t('heading', { d: dirs[Math.round(p.hdg / 45) % 8] }) : '';
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
  if (id === 'track') renderTrackSheet();
  if (id === 'orlegend') renderOrLegend();
  if (id === 'orsearch') { renderOrSearch(); orLoadSaved().then(() => { if (S.sheet === 'orsearch') renderOrSearch(); }); }
  if (id === 'settings') DB.allTrips().then(tr => { S.tripsCache = tr; }).catch(() => { S.tripsCache = []; });
  syncSegs();
  $('#scrim').classList.add('open');
  $('#sheet-' + id).classList.add('open');
  S.sheet = id;
}
function closeSheets() {
  if (S.sheet === 'track' && !S.keepTrack) { orSelect(null); OR.chain = null; orSetPick(null); }
  $$('.sheet.open').forEach(s => s.classList.remove('open'));
  $('#scrim').classList.remove('open');
  S.sheet = null;
}
function syncSegs() {
  const uk = speedKey();
  $('#gaugeScaleSeg').innerHTML = GAUGE_SCALES[uk].map((g, i) => `<button data-v="${i}">${g.max}</button>`).join('');
  $('#gaugeNote').textContent = prefs.gaugeStyle === 'hud' ? t('gHudNote') : '';
  $('#speedWarnSeg').innerHTML = SPEED_WARN[uk].map((w, i) => `<button data-v="${i}">${w ? w : esc(t('warnOff'))}</button>`).join('');
  $('#lagSeg').innerHTML = [1, 2, 3, 5].map(v => `<button data-v="${v}">${v} ${useMiles() ? 'mi' : 'km'}</button>`).join('');
  $$('.seg[data-pref]').forEach(seg => {
    const k = seg.dataset.pref;
    $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === String(prefs[k]))));
  });
  $('#accentField').hidden = themeNow() === 'red' || themeNow() === 'offroad';
  $('#themeNote').textContent = t(offroadOn() ? 'thn_offroad' : 'thn_' + prefs.theme);
  $('#btnOrLegend').hidden = !offroadOn();
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
  if (['speedUnit', 'gaugeIdx', 'gaugeStyle', 'speedWarn'].includes(k)) { buildGauge(); S.spDisp = 0; updateSpeedo(); drawGauge(0); }
  if (k === 'speedUnit' || k === 'distUnit') applyLang();
  if (k === 'lang') { applyLang(); applyMapStyle(S.map); }
  if (k === 'accent') applyTheme();
  if (k === 'offroad') { applyTheme(); applyMapStyle(S.map); orUpdate(); }
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
    if (!d.by || d.by === me.id || !S.active) return;
    toast(t('endedAll', { name: member(d.by).name }), 'info', 7000);
    finish(false);
  },
});
async function shareInvite() {
  if (!S.code) return;
  const url = location.origin + location.pathname + '?c=' + S.code;
  const text = t('shareText', { code: S.code });
  if (navigator.share) { try { await navigator.share({ title: 'PocketConvoy', text, url }); } catch (e) { /* annulé */ } return; }
  try { await navigator.clipboard.writeText(text + ' ' + url); toast(t('linkCopied'), 'ok', 3000); } catch (e) { toast(S.code, 'info', 6000); }
}

/* talkie en direct : une liaison audio avec chaque véhicule ; le micro n'est branché que pendant l'appui */
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

/* ---------- QR code : affichage de l'invitation et scanner intégré ---------- */
const LIBS = {
  qr: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
  jsqr: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
};
const libLoads = {};
function loadLib(k) {
  if (!libLoads[k]) libLoads[k] = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = LIBS[k]; sc.onload = res;
    sc.onerror = () => { delete libLoads[k]; rej(new Error('lib')); };
    document.head.appendChild(sc);
  });
  return libLoads[k];
}
const inviteUrl = () => location.origin + location.pathname + '?c=' + S.code;
async function qrSvg(text) {
  await loadLib('qr');
  const q = qrcode(0, 'M');
  q.addData(text); q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="-3 -3 ${n + 6} ${n + 6}" shape-rendering="crispEdges" aria-hidden="true"><rect x="-3" y="-3" width="${n + 6}" height="${n + 6}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
async function drawInviteQr(el) {
  if (!el) return;
  try { el.innerHTML = await qrSvg(inviteUrl()); } catch (e) { el.innerHTML = `<span class="s">${esc(t('qrFail'))}</span>`; }
}
async function showBigQr() {
  const o = $('#qrBig');
  $('#qrBigCode').textContent = S.code;
  try { $('#qrBigImg').innerHTML = await qrSvg(inviteUrl()); } catch (e) { return; }
  o.hidden = false;
}
const SCAN = { stream: null, raf: 0, last: 0, badT: 0, detector: null, canvas: null };
async function openScanner() {
  const o = $('#scanner');
  $('#scanMsg').textContent = t('scanHint');
  o.hidden = false;
  try {
    if ('BarcodeDetector' in window) {
      try { SCAN.detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { SCAN.detector = null; }
    }
    if (!SCAN.detector) await loadLib('jsqr');
    SCAN.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    const v = $('#scanVideo');
    v.srcObject = SCAN.stream;
    await v.play().catch(() => {});
    SCAN.raf = requestAnimationFrame(scanFrame);
  } catch (e) {
    $('#scanMsg').textContent = e && e.name === 'NotAllowedError' ? t('camDenied') : t('camFail');
  }
}
function closeScanner() {
  cancelAnimationFrame(SCAN.raf); SCAN.raf = 0;
  if (SCAN.stream) SCAN.stream.getTracks().forEach(x => x.stop());
  SCAN.stream = null;
  $('#scanVideo').srcObject = null;
  $('#scanner').hidden = true;
}
async function scanFrame(now) {
  if (!SCAN.stream) return;
  SCAN.raf = requestAnimationFrame(scanFrame);
  if (now - SCAN.last < 160) return;
  SCAN.last = now;
  const v = $('#scanVideo');
  if (!v.videoWidth) return;
  let text = null;
  try {
    if (SCAN.detector) {
      const r = await SCAN.detector.detect(v);
      if (r && r[0]) text = r[0].rawValue;
    } else if (window.jsQR) {
      const scale = Math.min(1, 480 / Math.max(v.videoWidth, v.videoHeight));
      const w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale);
      const c = SCAN.canvas || (SCAN.canvas = document.createElement('canvas'));
      c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(v, 0, 0, w, h);
      const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
      if (r) text = r.data;
    }
  } catch (e) { /* image suivante */ }
  if (text) onScanned(text);
}
function onScanned(text) {
  let code = null;
  try { code = new URL(text).searchParams.get('c'); } catch (e) { /* pas une adresse */ }
  if (!code && /^[A-Z0-9]{6}$/i.test(text.trim())) code = text.trim();
  code = code ? code.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  if (code.length !== 6) {
    if (Date.now() - SCAN.badT > 2500) { SCAN.badT = Date.now(); $('#scanMsg').textContent = t('scanBad'); }
    return;
  }
  closeScanner();
  haptic('select', true);
  $('#code').value = code;
  if (!$('#name').value.trim()) { homeErr(t('errName')); $('#name').focus(); return; }
  $('#btnJoin').click();
}

/* ---------- export : pseudo, réglages et historique ---------- */
function exportData() {
  const data = {
    app: 'PocketConvoy', version: APP_VERSION, exportedAt: new Date().toISOString(),
    profile: { name: me.name || $('#name').value.trim(), color: me.color, hue: me.hue },
    settings: Object.assign({}, prefs),
    trips: S.tripsCache || [],
  };
  const name = 'pocketconvoy-' + new Date().toISOString().slice(0, 10) + '.json';
  const file = new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'PocketConvoy' }).catch(err => { if (!err || err.name !== 'AbortError') downloadFile(file); });
    return;
  }
  downloadFile(file);
}
function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ---------- import d'un fichier exporté ---------- */
async function importData(file) {
  const msg = $('#importMsg');
  msg.hidden = true;
  let data = null;
  try { data = JSON.parse(await file.text()); } catch (e) { data = null; }
  const trips = data && Array.isArray(data.trips) ? data.trips.filter(tr => tr && tr.id && tr.start && tr.end && tr.tracks && Array.isArray(tr.stats)) : null;
  if (!data || data.app !== 'PocketConvoy' || !trips) { msg.textContent = t('importBad'); msg.hidden = false; return; }
  if (!confirm(t(trips.length === 1 ? 'importConfirm1' : 'importConfirm', { n: trips.length }))) return;
  const pr = data.profile || {};
  if (typeof pr.name === 'string' && pr.name.trim()) { me.name = pr.name.trim().slice(0, 16); store.set('name', me.name); }
  if (typeof pr.hue === 'number') { me.hue = Math.round(pr.hue) % 360; me.color = memberColor(me.hue); store.set('hue', me.hue); store.set('color', me.color); }
  const st = data.settings || {};
  for (const k of Object.keys(prefs)) {
    if (!(k in st) || k === 'view') continue;
    const v = st[k];
    if (Array.isArray(prefs[k]) ? Array.isArray(v) : typeof v === typeof prefs[k]) prefs[k] = v;
  }
  if (!I18N[prefs.lang]) prefs.lang = 'fr';
  if (!THEMES[prefs.theme]) prefs.theme = 'graphite';
  savePrefs();
  let n = 0;
  for (const tr of trips) { try { await DB.putTrip(tr); n++; } catch (e) { /* trajet ignoré */ } }
  S.tripsCache = null;
  applyTheme(); applyLang(); buildGauge(); applyMapStyle(S.map);
  $('#name').value = me.name; $('#colorHue').value = me.hue; updateColorPreview();
  msg.textContent = t(n === 1 ? 'importDone1' : 'importDone', { n }); msg.hidden = false;
}

/* ---------- partage d'un trajet par lien ----------
   Lien court : le trajet (allégé) est déposé dans le stockage Supabase, dossier public « trips », sous un nom aléatoire.
   Si ce stockage n'est pas activé, le trajet compressé est mis directement dans le lien (lien plus long). */
const SHARE_BUCKET = 'trips';
const HEX_RE = /^#[0-9a-f]{6}$/i;
function shareableTrip(tr, maxPts) {
  const tracks = {};
  for (const mid of Object.keys(tr.tracks || {})) {
    const tk = tr.tracks[mid] || [];
    if (tk.length < 2) continue;
    const k = Math.max(1, Math.ceil(tk.length / maxPts)), out = [];
    for (let i = 0; i < tk.length; i += k) out.push(tk[i]);
    if (out[out.length - 1] !== tk[tk.length - 1]) out.push(tk[tk.length - 1]);
    tracks[mid] = out.map(p => [Math.round(p[0]), +(+p[1]).toFixed(5), +(+p[2]).toFixed(5)]);
  }
  return { v: 1, id: tr.id, start: tr.start, end: tr.end, dest: tr.dest || '', tracks, names: tr.names, colors: tr.colors,
    stats: tr.stats.map(r => ({ id: r.id, me: !!r.me, name: r.name, color: r.color, dist: Math.round(r.dist || 0), mv: Math.round(r.mv || 0), mx: +(r.mx || 0).toFixed(2) })) };
}
function cleanSharedTrip(d) {
  if (!d || typeof d !== 'object' || !d.tracks || !Array.isArray(d.stats)) throw new Error('data');
  const str = (x, n) => String(x == null ? '' : x).slice(0, n);
  const num = x => (Number.isFinite(+x) ? +x : 0);
  const col = c => (HEX_RE.test(c) ? c : '#8B8B93');
  const tr = { id: 'shared-' + str(d.id, 40), shared: true, start: num(d.start), end: num(d.end), dest: str(d.dest, 80), tracks: {}, names: {}, colors: {} };
  for (const mid of Object.keys(d.tracks).slice(0, 12)) {
    const tk = Array.isArray(d.tracks[mid]) ? d.tracks[mid].filter(p => Array.isArray(p) && p.length >= 3).map(p => [num(p[0]), num(p[1]), num(p[2])]) : [];
    if (tk.length < 2) continue;
    const key = str(mid, 64);
    tr.tracks[key] = tk;
    tr.names[key] = str((d.names || {})[mid] || '?', 24);
    tr.colors[key] = col((d.colors || {})[mid]);
  }
  tr.stats = d.stats.slice(0, 12).map(r => ({ id: str(r.id, 64), me: !!r.me, name: str(r.name || '?', 24), color: col(r.color), dist: num(r.dist), mv: num(r.mv), mx: num(r.mx) }));
  if (!(tr.end > tr.start)) tr.end = tr.start + 1000;
  return tr;
}
function b64urlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function packTrip(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'undefined') return 'j' + b64urlEncode(bytes);
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer();
  return 'z' + b64urlEncode(new Uint8Array(buf));
}
async function unpackTrip(str) {
  let bytes = b64urlDecode(str.slice(1));
  if (str[0] === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(bytes));
}
const supabaseBase = () => NET.supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
let shareClient = null;
async function uploadTrip(obj) {
  if (!configOk() || typeof supabase === 'undefined') throw new Error('config');
  if (!shareClient) shareClient = supabase.createClient(supabaseBase(), NET.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const id = Array.from(crypto.getRandomValues(new Uint8Array(14)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  const body = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const { error } = await shareClient.storage.from(SHARE_BUCKET).upload(id + '.json', body, { contentType: 'application/json', upsert: false });
  if (error) throw error;
  return location.origin + location.pathname + '?trip=' + id;
}
async function prepareShareLink() {
  if (!RP || RP.sharing) return;
  const tr = RP.t, btn = $('#btnShareTrip');
  if (!RP.shareUrl) {
    RP.sharing = true;
    if (btn) { btn.disabled = true; btn.textContent = t('sharePreparing'); }
    try { RP.shareUrl = await uploadTrip(shareableTrip(tr, 800)); RP.shareLong = false; }
    catch (e) {
      try { RP.shareUrl = location.origin + location.pathname + '#t=' + await packTrip(shareableTrip(tr, 150)); RP.shareLong = true; }
      catch (e2) { RP.shareUrl = null; }
    }
    RP.sharing = false;
    if (RP.shareUrl && !RP.shareLong) { tr.shareUrl = RP.shareUrl; DB.putTrip(tr).catch(() => {}); }
  }
  renderShareBox();
}
function renderShareBox() {
  const box = $('#shareBox'), btn = $('#btnShareTrip');
  if (!box || !btn) return;
  box.hidden = false;
  if (!RP.shareUrl) {
    btn.disabled = false; btn.textContent = t('shareTripLink');
    box.innerHTML = `<p class="s">${esc(t('shareFail'))}</p>`;
    return;
  }
  btn.hidden = true;
  const shown = RP.shareUrl.length > 64 ? RP.shareUrl.slice(0, 60) + '…' : RP.shareUrl;
  box.innerHTML = `<div class="share-url">${esc(shown)}</div>
    <div class="home-row"><button class="btn btn-primary" id="shareSend">${esc(t('shareSend'))}</button><button class="btn btn-ghost" id="shareCopy">${esc(t('copyBtn'))}</button></div>
    <p class="s">${esc(t('shareWho'))}</p>${RP.shareLong ? `<p class="s">${esc(t('shareLongNote'))}</p>` : ''}`;
}
function sendShareLink() {
  if (!RP || !RP.shareUrl) return;
  const text = t('shareText', { dest: RP.t.dest ? '→ ' + RP.t.dest : '' }).replace(/\s+/g, ' ');
  if (navigator.share) navigator.share({ title: 'PocketConvoy', text, url: RP.shareUrl }).catch(() => {});
  else copyShareLink($('#shareCopy'));
}
function copyShareLink(btn) {
  if (!RP || !RP.shareUrl) return;
  const done = () => { if (btn) { btn.textContent = t('copied'); setTimeout(() => { if (btn.isConnected) btn.textContent = t('copyBtn'); }, 2000); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(RP.shareUrl).then(done).catch(() => prompt('', RP.shareUrl));
  else prompt('', RP.shareUrl);
}
function appFooter() {
  return `<div class="app-foot"><img src="icons/icon-192.png" alt=""><b>PocketConvoy</b>
    <button class="btn btn-ghost" id="openApp">${esc(t('openApp'))}</button></div>`;
}
function sharedLinkInUrl() {
  return new URLSearchParams(location.search).has('trip') || location.hash.startsWith('#t=');
}
async function loadSharedTrip() {
  S.sharedView = true;
  const id = new URLSearchParams(location.search).get('trip');
  const packed = location.hash.startsWith('#t=') ? location.hash.slice(3) : null;
  show('trip');
  $('#trip').classList.add('shared');
  $('#tripTitle').textContent = t('loading');
  $('#tripStats').innerHTML = '';
  try {
    let data;
    if (packed) data = await unpackTrip(packed);
    else {
      if (!/^[a-z0-9]{8,40}$/.test(id || '') || !NET.supabaseUrl) throw new Error('id');
      const r = await fetch(`${supabaseBase()}/storage/v1/object/public/${SHARE_BUCKET}/${id}.json`, { cache: 'no-cache' });
      if (!r.ok) throw new Error('http ' + r.status);
      data = await r.json();
    }
    openTripData(cleanSharedTrip(data));
  } catch (e) {
    $('#tripTitle').textContent = t('sharedGone');
    $('#tripStats').innerHTML = `<p class="s">${esc(t('sharedGoneText'))}</p>` + appFooter();
  }
}

/* ---------- récap en story : image ou vidéo verticale 1080 × 1920 ---------- */
const STORY = { W: 1080, H: 1920, M: { x: 60, y: 450, w: 960, h: 780 } };
let storyFile = null, storyUrl = null, storyBusy = false;
function loadImage(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
function tripBounds(tr, ids) {
  let w = 180, so = 90, e = -180, n = -90;
  for (const mid of ids) for (const p of tr.tracks[mid] || []) { w = Math.min(w, p[2]); e = Math.max(e, p[2]); so = Math.min(so, p[1]); n = Math.max(n, p[1]); }
  if (e - w < 0.002) { w -= 0.001; e += 0.001; }
  if (n - so < 0.002) { so -= 0.001; n += 0.001; }
  return [[w, so], [e, n]];
}
function mercatorProjector(bb, w, h, pad) {
  const mx = lng => (lng + 180) / 360;
  const my = lat => { const sn = Math.sin(lat * RAD); return 0.5 - Math.log((1 + sn) / (1 - sn)) / (4 * Math.PI); };
  const x0 = mx(bb[0][0]), x1 = mx(bb[1][0]), y0 = my(bb[1][1]), y1 = my(bb[0][1]);
  const sc = Math.min((w - 2 * pad) / Math.max(x1 - x0, 1e-12), (h - 2 * pad) / Math.max(y1 - y0, 1e-12));
  const ox = (w - (x1 - x0) * sc) / 2, oy = (h - (y1 - y0) * sc) / 2;
  return (lng, lat) => [ox + (mx(lng) - x0) * sc, oy + (my(lat) - y0) * sc];
}
/* Carte réelle rendue hors écran (deux fois la taille pour des noms lisibles), copiée en image, puis supprimée. */
async function captureStoryMap(tr, ids, w, h) {
  if (typeof maplibregl === 'undefined') return null;
  const box = document.createElement('div');
  box.style.cssText = `position:fixed;left:-5000px;top:0;width:${w / 2}px;height:${h / 2}px;pointer-events:none`;
  document.body.appendChild(box);
  let map = null;
  try {
    const bb = tripBounds(tr, ids);
    map = new maplibregl.Map({ container: box, style: mapPlaceholder(), bounds: bb, fitBoundsOptions: { padding: 40, maxZoom: 15 },
      interactive: false, attributionControl: false, preserveDrawingBuffer: true, pixelRatio: 2, fadeDuration: 0 });
    const ready = await new Promise(res => {
      let styled = false;
      const timer = setTimeout(() => res(false), 12000);
      map.on('style.load', () => { styled = map.getStyle().layers.length > 2; });
      map.on('idle', () => { if (styled) { clearTimeout(timer); res(true); } });
      applyMapStyle(map);
    });
    if (!ready) throw new Error('map');
    const img = document.createElement('canvas');
    img.width = w; img.height = h;
    const cx = img.getContext('2d');
    cx.drawImage(map.getCanvas(), 0, 0, w, h);
    cx.getImageData(0, 0, 1, 1);
    const k = w / (w / 2);
    return { img, project: (lng, lat) => { const p = map.project([lng, lat]); return [p.x * k, p.y * k]; }, map, box };
  } catch (e) {
    if (map) map.remove();
    box.remove();
    return null;
  }
}
async function buildStoryData() {
  const tr = RP.t, sel = RP.sel, ids = sel === 'all' ? RP.ids : [sel];
  const { M } = STORY;
  await Promise.all(['600 76px Sora', '600 58px Sora', '600 46px Sora', '500 34px Manrope', '600 28px Manrope'].map(f => document.fonts.load(f).catch(() => {})));
  const logo = await loadImage('icons/icon-192.png').catch(() => null);
  const cap = await captureStoryMap(tr, ids, M.w, M.h);
  const project = cap ? cap.project : mercatorProjector(tripBounds(tr, ids), M.w, M.h, 60);
  const lines = ids.map(mid => {
    const tk = tr.tracks[mid];
    const pts = tk.map(p => { const [x, y] = project(p[2], p[1]); return [x + M.x, y + M.y, p[0]]; });
    const bands = tk.map((p, i) => {
      if (!i) return -1;
      const a = tk[i - 1], dt = p[0] - a[0];
      return dt <= 0 || dt > 120 ? -1 : bandOf(hav([a[1], a[2]], [p[1], p[2]]) / dt * 3.6);
    });
    const cum = [0];
    for (let i = 1; i < tk.length; i++) cum.push(cum[i - 1] + hav([tk[i - 1][1], tk[i - 1][2]], [tk[i][1], tk[i][2]]));
    return { mid, pts, bands, cum, color: tr.colors[mid] || '#8B8B93', name: tr.names[mid] || '?' };
  });
  if (cap) { cap.map.remove(); cap.box.remove(); }
  const row = sel === 'all' ? (tr.stats.find(r => r.me) || tr.stats[0] || { dist: 0, mv: 0, mx: 0 }) : tripRow(sel);
  const focus = lines.find(l => l.mid === (row.id || '')) || lines[0];
  const maxT = Math.max(1, ...lines.map(l => l.pts[l.pts.length - 1][2]));
  return {
    tr, sel, lines, row, focus, maxT, logo, mapImg: cap ? cap.img : null,
    accent: accentColor(prefs.accentHue),
    title: tr.dest || t('tripDefault'),
    date: `${fmtDate(tr.start)} · ${fmtClock(tr.start)} – ${fmtClock(tr.end)}`,
    who: sel === 'all' ? '' : t('storyOf', { name: tr.names[sel] || '?' }),
    whoColor: sel === 'all' ? '' : tr.colors[sel],
  };
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fitText(ctx, text, x, y, maxW, size, weight, family) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > size * 0.6) { s -= 2; ctx.font = `${weight} ${s}px ${family}`; }
  let out = text;
  while (ctx.measureText(out).width > maxW && out.length > 1) out = out.slice(0, -2) + '…';
  ctx.fillText(out, x, y);
}
function trackUntil(line, T) {
  const p = line.pts;
  let i = 0;
  while (i < p.length - 1 && p[i + 1][2] <= T) i++;
  if (i >= p.length - 1) return { n: p.length, head: p[p.length - 1], dist: line.cum[line.cum.length - 1] };
  const a = p[i], b = p[i + 1], k = b[2] > a[2] ? Math.max(0, Math.min(1, (T - a[2]) / (b[2] - a[2]))) : 0;
  const head = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  return { n: i + 1, head, dist: line.cum[i] + (line.cum[i + 1] - line.cum[i]) * k };
}
const FONT_UI = 'Manrope, system-ui, sans-serif', FONT_NUM = 'Sora, Manrope, system-ui, sans-serif';
function drawStory(ctx, D, f) {
  const { W, H, M } = STORY;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1A1A1E'); g.addColorStop(1, '#0B0B0C');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  // en-tête
  ctx.fillStyle = D.accent; ctx.font = `600 28px ${FONT_UI}`;
  ctx.fillText(t('storyKicker').split('').join(String.fromCharCode(8202)), 72, 250);
  ctx.fillStyle = '#F4F4F5'; fitText(ctx, D.title, 72, 330, 936, 76, 600, FONT_NUM);
  ctx.fillStyle = '#A1A1AA'; fitText(ctx, D.date, 72, 384, 936, 34, 500, FONT_UI);
  if (D.who) {
    ctx.fillStyle = D.whoColor; ctx.beginPath(); ctx.arc(84, 420, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F4F4F5'; fitText(ctx, D.who, 106, 431, 900, 32, 600, FONT_UI);
  }
  // carte
  ctx.save();
  rrect(ctx, M.x, M.y, M.w, M.h, 40); ctx.clip();
  if (D.mapImg) ctx.drawImage(D.mapImg, M.x, M.y, M.w, M.h);
  else {
    ctx.fillStyle = '#1C1C20'; ctx.fillRect(M.x, M.y, M.w, M.h);
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 2;
    for (let x = M.x; x < M.x + M.w; x += 80) { ctx.beginPath(); ctx.moveTo(x, M.y); ctx.lineTo(x, M.y + M.h); ctx.stroke(); }
    for (let y = M.y; y < M.y + M.h; y += 80) { ctx.beginPath(); ctx.moveTo(M.x, y); ctx.lineTo(M.x + M.w, y); ctx.stroke(); }
  }
  const T = f * D.maxT, heads = [];
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const L of D.lines) {
    const u = trackUntil(L, T), p = L.pts;
    if (u.n < 1) continue;
    const path = () => { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < u.n; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.lineTo(u.head[0], u.head[1]); };
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 18; path(); ctx.stroke();
    if (D.sel === 'all') { ctx.strokeStyle = L.color; ctx.lineWidth = 10; path(); ctx.stroke(); }
    else {
      ctx.lineWidth = 11;
      for (let i = 1; i <= u.n; i++) {
        const a = p[i - 1], b = i < u.n ? p[i] : u.head;
        if (!a || !b || i >= p.length + 1) break;
        const band = L.bands[Math.min(i, p.length - 1)];
        ctx.strokeStyle = band < 0 ? GAP_COLOR : BAND_COLORS[band];
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = '#0F0F10'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(p[0][0], p[0][1], 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    heads.push([u.head, L]);
  }
  for (const [h, L] of heads) {
    ctx.fillStyle = L.color; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(h[0], h[1], 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#0F0F10'; ctx.font = `700 22px ${FONT_UI}`; ctx.textAlign = 'center';
    ctx.fillText(initial(L.name), h[0], h[1] + 8); ctx.textAlign = 'left';
  }
  if (f < 1) {
    const clockTxt = fmtClock(D.tr.start + T * 1000);
    ctx.font = `600 34px ${FONT_NUM}`;
    const w = ctx.measureText(clockTxt).width + 44;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; rrect(ctx, M.x + 24, M.y + 24, w, 60, 30); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.fillText(clockTxt, M.x + 46, M.y + 66);
  }
  if (D.mapImg) {
    ctx.font = `500 20px ${FONT_UI}`; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 4;
    ctx.fillText('© OpenStreetMap · OpenFreeMap', M.x + M.w - 22, M.y + M.h - 18);
    ctx.shadowBlur = 0; ctx.textAlign = 'left';
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 2; rrect(ctx, M.x, M.y, M.w, M.h, 40); ctx.stroke();
  // légende
  const ly = M.y + M.h + 50;
  ctx.font = `600 26px ${FONT_UI}`;
  if (D.sel === 'all') {
    let x = 72;
    for (const L of D.lines) {
      const label = L.name.length > 12 ? L.name.slice(0, 11) + '…' : L.name;
      const w = ctx.measureText(label).width + 44;
      if (x + w > 1008) break;
      ctx.fillStyle = L.color; ctx.beginPath(); ctx.arc(x + 10, ly - 9, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#D4D4D8'; ctx.fillText(label, x + 28, ly); x += w + 18;
    }
  } else {
    const cw = 936 / BAND_COLORS.length;
    BAND_COLORS.forEach((c, i) => {
      const x = 72 + i * cw;
      ctx.fillStyle = c; rrect(ctx, x, ly - 18, 34, 12, 6); ctx.fill();
      ctx.fillStyle = '#D4D4D8'; ctx.font = `600 22px ${FONT_UI}`;
      ctx.fillText(bandLabel(i) + (i === BAND_COLORS.length - 1 ? ' ' + spdUnit() : ''), x + 42, ly - 6);
    });
  }
  // statistiques (la distance et le temps de conduite avancent pendant la vidéo)
  const r = D.row, frac = D.focus ? Math.min(1, trackUntil(D.focus, T).dist / Math.max(1, D.focus.cum[D.focus.cum.length - 1])) : 1;
  const k = f >= 1 ? 1 : frac;
  const tiles = [
    [fmtDist((r.dist || 0) * k), t('distance')],
    [fmtDur((r.mv || 0) * k), t('drivingTime')],
    [avgOf(r) ? fmtKmh(avgOf(r)) : '–', t('avgMoving')],
    [r.mx ? fmtKmh(r.mx) : '–', t('maxSpeed')],
  ];
  tiles.forEach(([v, l], i) => {
    const x = 60 + (i % 2) * 490, y = ly + 34 + Math.floor(i / 2) * 166;
    ctx.fillStyle = 'rgba(255,255,255,.06)'; rrect(ctx, x, y, 470, 150, 30); ctx.fill();
    ctx.fillStyle = '#F4F4F5'; fitText(ctx, v, x + 32, y + 78, 410, 58, 600, FONT_NUM);
    ctx.fillStyle = '#A1A1AA'; fitText(ctx, l, x + 32, y + 122, 410, 28, 500, FONT_UI);
  });
  // pied : logo et nom de l'application
  const fy = ly + 34 + 2 * 166 + 40;
  ctx.font = `600 46px ${FONT_NUM}`;
  const name = 'PocketConvoy', nw = ctx.measureText(name).width, lw = 72, gap = 22, tot = lw + gap + nw, x0 = (W - tot) / 2;
  if (D.logo) { ctx.save(); rrect(ctx, x0, fy, lw, lw, 18); ctx.clip(); ctx.drawImage(D.logo, x0, fy, lw, lw); ctx.restore(); }
  ctx.fillStyle = '#F4F4F5'; ctx.fillText(name, x0 + lw + gap, fy + 52);
}
function storyMsg(txt) { $('#storyMsg').textContent = txt || ''; }
function closeStory() {
  if (storyBusy) return;
  $('#story').hidden = true;
  $('#storyStage').innerHTML = '';
  if (storyUrl) { URL.revokeObjectURL(storyUrl); storyUrl = null; }
  storyFile = null;
}
async function makeStory(kind) {
  if (!RP || storyBusy) return;
  storyBusy = true; storyFile = null;
  $('#story').hidden = false;
  $('#storyShare').hidden = true; $('#storyClose').disabled = true;
  $('#storyStage').innerHTML = '';
  storyMsg(t('storyMap'));
  try {
    const D = await buildStoryData();
    const c = document.createElement('canvas');
    c.width = STORY.W; c.height = STORY.H;
    $('#storyStage').appendChild(c);
    const ctx = c.getContext('2d');
    if (kind === 'video') {
      if (!c.captureStream || typeof MediaRecorder === 'undefined') throw new Error('novideo');
      storyFile = await recordStory(c, ctx, D);
      storyUrl = URL.createObjectURL(storyFile);
      $('#storyStage').innerHTML = `<video src="${storyUrl}" autoplay loop muted playsinline></video>`;
    } else {
      storyMsg(t('storyMaking'));
      drawStory(ctx, D, 1);
      const blob = await new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('blob'))), 'image/png'));
      storyFile = new File([blob], 'pocketconvoy-' + new Date(D.tr.start).toISOString().slice(0, 10) + '.png', { type: 'image/png' });
      storyUrl = URL.createObjectURL(storyFile);
      $('#storyStage').innerHTML = `<img src="${storyUrl}" alt="">`;
    }
    storyMsg('');
    $('#storyShare').hidden = false;
  } catch (e) {
    storyMsg(e && e.message === 'novideo' ? t('storyNoVideo') : t('storyFail'));
  }
  storyBusy = false;
  $('#storyClose').disabled = false;
}
async function recordStory(c, ctx, D) {
  const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  const mime = types.find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
  drawStory(ctx, D, 0);
  const stream = c.captureStream(30);
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8000000 } : undefined);
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(res => { rec.onstop = res; });
  const ANIM = 8000, HOLD = 2000;
  rec.start(500);
  const t0 = performance.now();
  await new Promise(res => {
    const step = now => {
      const el = now - t0;
      drawStory(ctx, D, Math.min(1, el / ANIM));
      storyMsg(t('storyRecording', { p: Math.min(100, Math.round(el / (ANIM + HOLD) * 100)) }));
      if (el < ANIM + HOLD) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  rec.stop();
  await stopped;
  stream.getTracks().forEach(x => x.stop());
  const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
  return new File([new Blob(chunks, { type })], 'pocketconvoy-' + new Date(D.tr.start).toISOString().slice(0, 10) + (type.includes('mp4') ? '.mp4' : '.webm'), { type });
}
function shareStory() {
  if (!storyFile) return;
  if (navigator.canShare && navigator.canShare({ files: [storyFile] })) navigator.share({ files: [storyFile] }).catch(err => { if (!err || err.name !== 'AbortError') downloadFile(storyFile); });
  else downloadFile(storyFile);
}

/* ---------- tutoriel de la première utilisation ---------- */
const TUTO_ICONS = [
  '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v6M19.6 9.2l-5.6 2.1M16.8 18.9l-3.4-5M7.2 18.9l3.4-5M4.4 9.2l5.6 2.1"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
  '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5"/>',
  '<path d="M6 21V4M6 4h11l-2.5 4L17 12H6"/>',
  '<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/>',
  '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 5.5h3M12 18.5v.01"/>',
];
let tutoIdx = 0;
function openTuto() {
  tutoIdx = 0;
  renderTuto();
  $('#tuto').hidden = false;
}
function renderTuto() {
  const n = TUTO_ICONS.length, i = tutoIdx;
  $('#tutoIcon').innerHTML = ic(TUTO_ICONS[i], 44);
  $('#tutoTitle').textContent = t('tuto' + (i + 1) + 't');
  $('#tutoText').textContent = t('tuto' + (i + 1) + 'd');
  $('#tutoDots').innerHTML = TUTO_ICONS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
  $('#tutoNext').textContent = t(i === n - 1 ? 'tutoGo' : 'tutoNext');
  $('#tutoSkip').textContent = t('tutoSkip');
  $('#tutoSkip').style.visibility = i === n - 1 ? 'hidden' : '';
  const card = $('#tutoCard');
  card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
}
function tutoStep(d) {
  const n = TUTO_ICONS.length;
  if (tutoIdx + d >= n) { closeTuto(); return; }
  tutoIdx = Math.max(0, tutoIdx + d);
  renderTuto();
}
function closeTuto() { $('#tuto').hidden = true; store.set('tutoDone', true); }

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
/* tranches de vitesse de l'historique (km/h) et leurs couleurs */
const SPEED_BANDS = [50, 120, 180, 220];
const BAND_COLORS = ['#4C9EFF', '#2BD9A0', '#FFC53D', '#FF8A3D', '#FF2E88'];
const GAP_COLOR = '#8B8B93';
const bandOf = kmh => { let i = 0; while (i < SPEED_BANDS.length && kmh >= SPEED_BANDS[i]) i++; return i; };
function speedSegments(track) {
  const feats = [], time = [0, 0, 0, 0, 0];
  let cur = null;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1], b = track[i], dt = b[0] - a[0];
    const band = dt <= 0 || dt > 120 ? -1 : bandOf(hav([a[1], a[2]], [b[1], b[2]]) / dt * 3.6);
    if (band >= 0) time[band] += dt;
    const pa = [a[2], a[1]], pb = [b[2], b[1]];
    if (cur && cur.properties.band === band) cur.geometry.coordinates.push(pb);
    else { cur = { type: 'Feature', properties: { band }, geometry: { type: 'LineString', coordinates: [pa, pb] } }; feats.push(cur); }
  }
  return { geo: { type: 'FeatureCollection', features: feats }, time };
}
function bandLabel(i) {
  const v = x => Math.round(kmhTo(x));
  if (i === 0) return `0–${v(SPEED_BANDS[0])}`;
  if (i === SPEED_BANDS.length) return `> ${v(SPEED_BANDS[i - 1])}`;
  return `${v(SPEED_BANDS[i - 1])}–${v(SPEED_BANDS[i])}`;
}
async function openTrip(id) {
  let tr = null;
  try { tr = (await DB.allTrips()).find(x => x.id === id); } catch (e) { /* ignoré */ }
  if (!tr) return;
  openTripData(tr);
}
function openTripData(tr) {
  show('trip');
  $('#trip').classList.toggle('shared', !!tr.shared);
  $('#tripTitle').textContent = tr.dest || t('tripDefault');
  if (RP && RP.map) RP.map.remove();
  const dur = Math.max(1, Math.round((tr.end - tr.start) / 1000));
  const speeds = [10, 30, 60, 120, 300, 600];
  const target = dur / 60;
  const speed = speeds.reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
  const map = new maplibregl.Map({ container: 'tripMap', style: mapPlaceholder(), center: [MAP_HOME[1], MAP_HOME[0]], zoom: 7, attributionControl: false, dragRotate: false });
  map.touchZoomRotate.disableRotation();
  const ids = Object.keys(tr.tracks).filter(mid => tr.tracks[mid] && tr.tracks[mid].length >= 2);
  RP = { map, t: tr, T: 0, dur, playing: false, markers: {}, speed, speeds, raf: null, lastTs: 0, ids, sel: 'all', segs: {}, shareUrl: tr.shareUrl || null };
  for (const mid of ids) RP.segs[mid] = speedSegments(tr.tracks[mid]);
  $('#rpSlider').max = dur; $('#rpSlider').value = 0;
  updatePlayBtn();
  renderTripPanel();
  let first = true;
  map.on('style.load', () => {
    for (const mid of ids) {
      const track = tr.tracks[mid], col = tr.colors[mid] || '#8B8B93';
      if (!map.getSource('tr-' + mid)) map.addSource('tr-' + mid, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: track.map(p => [p[2], p[1]]) } } });
      if (!map.getLayer('tr-' + mid)) map.addLayer({ id: 'tr-' + mid, type: 'line', source: 'tr-' + mid, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': col, 'line-width': 3, 'line-opacity': 0.85 } });
      if (!RP.markers[mid]) {
        const el = document.createElement('div');
        el.className = 'car rp';
        el.style.setProperty('--c', col);
        el.innerHTML = `<div class="car-dot"><span>${esc(initial(tr.names[mid]))}</span></div>`;
        RP.markers[mid] = new maplibregl.Marker({ element: el }).setLngLat([track[0][2], track[0][1]]).addTo(map);
      }
    }
    const empty = { type: 'FeatureCollection', features: [] };
    if (!map.getSource('spd')) map.addSource('spd', { type: 'geojson', data: empty });
    if (!map.getLayer('spd-casing')) map.addLayer({ id: 'spd-casing', type: 'line', source: 'spd', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#000000', 'line-width': 9, 'line-opacity': 0.45 } });
    if (!map.getLayer('spd-line')) map.addLayer({ id: 'spd-line', type: 'line', source: 'spd', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['match', ['get', 'band'], 0, BAND_COLORS[0], 1, BAND_COLORS[1], 2, BAND_COLORS[2], 3, BAND_COLORS[3], 4, BAND_COLORS[4], GAP_COLOR], 'line-width': 5 } });
    applyTripSelection(first);
    if (first) { first = false; setReplay(0); }
  });
  applyMapStyle(map);
}
function tripRow(mid) {
  const tr = RP.t;
  return tr.stats.find(r => r.id === mid) || (mid === me.id ? tr.stats.find(r => r.me) : null) || { dist: 0, mv: 0, mx: 0 };
}
function renderTripPanel() {
  const tr = RP.t, sel = RP.sel;
  const chips = [`<button data-tsel="all" aria-pressed="${sel === 'all'}">${esc(t('tripAll'))}</button>`]
    .concat(RP.ids.map(mid => `<button data-tsel="${esc(mid)}" aria-pressed="${sel === mid}"><i style="--c:${esc(tr.colors[mid] || '#8B8B93')}"></i>${esc(tr.names[mid] || '?')}</button>`));
  let legend = '';
  if (sel !== 'all' && RP.segs[sel]) {
    const time = RP.segs[sel].time, tot = time.reduce((a, b) => a + b, 0) || 1;
    legend = `<div class="field"><span class="field-label">${esc(t('speedLegend'))}</span><div class="legend">`
      + BAND_COLORS.map((c, i) => `<div class="lg"><i style="--c:${c}"></i><span>${bandLabel(i)} ${spdUnit()}</span><b>${Math.round(time[i] / tot * 100)} %</b></div>`).join('')
      + `<div class="lg"><i class="gap" style="--c:${GAP_COLOR}"></i><span>${esc(t('gapLegend'))}</span><b></b></div></div></div>`;
  }
  const mine = sel === 'all' ? (tr.stats.find(r => r.me) || { dist: 0, mv: 0, mx: 0 }) : tripRow(sel);
  const sharer = tr.shared ? (tr.stats.find(r => r.me) || {}).name : '';
  $('#tripStats').innerHTML = (sharer ? `<p class="s shared-by">${esc(t('sharedBy', { name: sharer }))}</p>` : '')
    + `<p class="s">${esc(t('fromTo', { date: fmtDate(tr.start), a: fmtClock(tr.start), b: fmtClock(tr.end) }))}</p>`
    + (RP.ids.length ? `<div class="field"><span class="field-label">${esc(t('tripWho'))}</span><div class="toggles trip-chips">${chips.join('')}</div></div>` : '')
    + legend
    + bigStats(mine, 0)
    + (tr.stats.length > 1 ? `<div class="field"><span class="field-label">${esc(t('rankTitle'))}</span>${rankTable(tr.stats)}</div>` : '')
    + (tr.shared ? '' : `<div class="field"><span class="field-label">${esc(t('shareTitle'))}</span>
        <button class="btn btn-primary" id="btnShareTrip">${esc(t('shareTripLink'))}</button><div id="shareBox" class="share-box" hidden></div></div>`)
    + `<div class="field"><span class="field-label">${esc(t('storyTitle'))}</span>
        <div class="home-row"><button class="btn btn-ghost" data-story="image">${esc(t('storyImage'))}</button><button class="btn btn-ghost" data-story="video">${esc(t('storyVideo'))}</button></div>
        <p class="s">${esc(t('storyNote'))}</p></div>`
    + (tr.shared ? appFooter() : `<button class="btn btn-danger" data-deltrip="${esc(tr.id)}">${esc(t('delTrip'))}</button>`);
  if (RP.shareUrl && !tr.shared) renderShareBox();
}
function applyTripSelection(fit) {
  if (!RP) return;
  const map = RP.map, sel = RP.sel, tr = RP.t;
  for (const mid of RP.ids) {
    if (map.getLayer && map.getLayer('tr-' + mid)) map.setLayoutProperty('tr-' + mid, 'visibility', sel === 'all' ? 'visible' : 'none');
    if (RP.markers[mid]) RP.markers[mid].getElement().style.display = sel === 'all' || sel === mid ? '' : 'none';
  }
  const src = map.getSource && map.getSource('spd');
  if (src) src.setData(sel !== 'all' && RP.segs[sel] ? RP.segs[sel].geo : { type: 'FeatureCollection', features: [] });
  if (fit) {
    const b = new maplibregl.LngLatBounds();
    let any = false;
    for (const mid of (sel === 'all' ? RP.ids : [sel])) for (const p of tr.tracks[mid] || []) { b.extend([p[2], p[1]]); any = true; }
    if (any) map.fitBounds(b, { padding: 40, duration: sel === 'all' && fit === true ? 0 : 600 });
  }
}
function selectTripMember(mid) {
  if (!RP) return;
  RP.sel = mid;
  renderTripPanel();
  applyTripSelection('anim');
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
  const shared = RP && RP.t && RP.t.shared;
  if (RP) { RP.playing = false; cancelAnimationFrame(RP.raf); if (RP.map) RP.map.remove(); RP = null; }
  if (shared || S.sharedView) { S.sharedView = false; history.replaceState(null, '', location.pathname); show('home'); return; }
  openHistory();
}

/* ---------- branchements ---------- */
function bind() {
  document.addEventListener('click', e => {
    if (Date.now() < (S.ignoreClickUntil || 0)) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  on('#colorHue', 'input', e => { me.hue = +e.target.value; updateColorPreview(); });
  on('#colorHue', 'change', () => { store.set('hue', me.hue); store.set('color', me.color); haptic('select'); });
  on('#name', 'input', updateColorPreview);
  on('#accentHue', 'input', e => { prefs.accentHue = +e.target.value; applyTheme(); });
  on('#accentHue', 'change', () => { savePrefs(); haptic('select'); });
  on('#btnScan', 'click', openScanner);
  on('#scanClose', 'click', closeScanner);
  on('#qrBig', 'click', () => { $('#qrBig').hidden = true; });
  on('#tutoNext', 'click', () => tutoStep(1));
  on('#tutoSkip', 'click', closeTuto);
  on('#btnTuto', 'click', () => { closeSheets(); openTuto(); });
  on('#btnExport', 'click', exportData);
  on('#orStatus', 'click', () => openSheet('orsearch'));
  on('#orSearchBody', 'click', orSearchClick);
  on('#orSearchBody', 'input', e => { if (e.target.id === 'orPlace') orPlaceInput(e.target.value); });
  on('#btnExplore', 'click', openExplore);
  on('#exClose', 'click', closeExplore);
  on('#exSearch', 'click', () => openSheet('orsearch'));
  on('#exLocate', 'click', () => { const p = myPos(); if (p && S.map) S.map.flyTo({ center: [p.lng, p.lat], zoom: Math.max(S.map.getZoom(), 13.5) }); });
  on('#btnOrRoute', 'click', () => openSheet('orsearch'));
  on('#btnOrLegend', 'click', () => openSheet('orlegend'));
  on('#trackBody', 'click', e => {
    const act = e.target.closest('[data-oract]');
    if (act) {
      const a = act.dataset.oract;
      if (a === 'whole') orWholeTrack();
      if (a === 'ride' && OR.chain) orRide(OR.chain);
      if ((a === 'save' || a === 'unsave') && OR.chain) { orToggleSave(OR.chain); renderChainSheet(); }
      return;
    }
    if (!e.target.closest('#orPinBtn') || !OR.sel || !OR.at) return;
    const tg = JSON.parse(OR.sel.properties.t || '{}'), label = t('orPinLabel', { name: orName(tg) }).slice(0, 40);
    const at = OR.at;
    openPinNew(at.lat, at.lng);
    if (S.pinDraft) { S.pinDraft.type = 'other'; renderPinSheet(); const inp = $('#pinLabel'); if (inp) inp.value = label; }
  });
  on('#storyShare', 'click', shareStory);
  on('#storyClose', 'click', closeStory);
  on('#btnImport', 'click', () => { $('#importFile').value = ''; $('#importFile').click(); });
  on('#importFile', 'change', e => { const f = e.target.files && e.target.files[0]; if (f) importData(f); });
  let tx = null;
  on('#tuto', 'touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  on('#tuto', 'touchend', e => {
    if (tx == null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) tutoStep(dx < 0 ? 1 : -1);
  });
  on('#name', 'keydown', e => { if (e.key === 'Enter') e.target.blur(); });
  on('#btnCreate', 'click', () => { if (!configOk()) { homeErr(t('cfgWarn')); return; } start({ creating: true, code: newCode() }); });
  on('#btnJoin', 'click', () => {
    if (!configOk()) { homeErr(t('cfgWarn')); return; }
    const c = $('#code').value.trim().toUpperCase();
    if (c.length !== 6) { homeErr(t('errCode')); $('#code').focus(); return; }
    start({ code: c });
  });
  on('#code', 'input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); });
  on('#code', 'keydown', e => { if (e.key === 'Enter') { e.target.blur(); $('#btnJoin').click(); } });
  on('#btnHistory', 'click', () => openHistory());
  on('#btnHomeSettings', 'click', () => openSheet('settings'));
  on('#btnChat', 'click', () => openSheet('chat'));
  on('#chatSend', 'click', () => { const i = $('#chatInput'); sendChat(i.value); i.value = ''; });
  on('#chatInput', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(e.target.value); e.target.value = ''; } });
  on('#chatPos', 'click', shareMyPosition);

  document.addEventListener('click', e => {
    const segBtn = e.target.closest('.seg[data-pref] button');
    if (segBtn) { const k = segBtn.closest('.seg').dataset.pref; setPref(k, ['lagKm', 'gaugeIdx', 'speedWarn'].includes(k) ? +segBtn.dataset.v : segBtn.dataset.v); return; }
    if (e.target.closest('[data-close]')) closeSheets();
  });

  on('#main', 'pointerdown', () => { if ((S.ac && S.ac.state !== 'running') || [...RTC.peers.values()].some(p => p.audio && p.audio.paused)) unlockAudio(); }, { capture: true });
  on('#viewTabs', 'click', e => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
  on('#btnLocate', 'click', () => { if (S.follow) { setFollow(false); fitConvoy(); } else setFollow(true); });
  on('#navCard', 'click', () => openSheet(S.arrived ? 'end' : 'route'));
  $$('[data-sheet]').forEach(b => b.addEventListener('click', () => openSheet(b.dataset.sheet)));
  on('#scrim', 'click', closeSheets);
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

  on('#wpList', 'click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || !isLeader()) return;
    if (b.dataset.act === 'untrack') { setPlan(S.plan.wps.filter(w => !w.entry), null); return; }
    const i = +b.dataset.i, wps = [...S.plan.wps];
    if (b.dataset.act === 'del') wps.splice(i, 1);
    if (b.dataset.act === 'up' && i > 0) [wps[i - 1], wps[i]] = [wps[i], wps[i - 1]];
    if (b.dataset.act === 'down' && i < wps.length - 1) [wps[i + 1], wps[i]] = [wps[i], wps[i + 1]];
    setPlan(wps);
  });
  on('#search', 'input', e => {
    clearTimeout(searchT);
    const q = e.target.value.trim();
    if (q.length < 3) { $('#results').innerHTML = ''; return; }
    searchT = setTimeout(() => runSearch(q), 450);
  });
  on('#results', 'click', e => {
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
  on('#btnPick', 'click', () => startPick('stop'));
  on('#btnPinMap', 'click', () => startPick('pin'));
  on('#btnPinHere', 'click', () => { if (S.pos) openPinNew(S.pos.lat, S.pos.lng); });
  on('#pinList', 'click', e => {
    const st = e.target.closest('[data-pinstop]');
    if (st) { pinToRoute(st.dataset.pinstop, false); renderRouteSheet(); return; }
    const b = e.target.closest('[data-pin]');
    if (b) openPin(b.dataset.pin);
  });
  on('#pinBody', 'click', e => {
    const ty = e.target.closest('[data-ptype]');
    if (ty && S.pinDraft) { S.pinDraft.type = ty.dataset.ptype; $$('#pinBody [data-ptype]').forEach(x => x.setAttribute('aria-pressed', String(x === ty))); return; }
    if (e.target.closest('#pinSave')) { savePin(); return; }
    const act = e.target.closest('[data-pinact]');
    if (!act || !S.pinOpen) return;
    if (act.dataset.pinact === 'del') deletePin(S.pinOpen);
    else { pinToRoute(S.pinOpen, act.dataset.pinact === 'dest'); closeSheets(); }
  });
  on('#hapCats', 'click', e => {
    const b = e.target.closest('[data-hcat]');
    if (b) {
      const c = b.dataset.hcat, set = new Set(prefs.hapticCats);
      if (set.has(c)) set.delete(c); else set.add(c);
      prefs.hapticCats = [...set]; savePrefs(); syncSegs();
      return;
    }
    if (e.target.closest('#hapTest')) haptic('alert', true);
  });
  on('#sndList', 'click', e => {
    const b = e.target.closest('[data-snd]');
    if (!b) return;
    unlockAudio();
    sfx(b.dataset.snd, true);
    b.classList.add('playing');
    setTimeout(() => b.classList.remove('playing'), 900);
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b && b.id !== 'ptt' && b.id !== 'hapTest') haptic('tap');
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
  on('#pickCancel', 'click', () => { S.pick = false; $('#pickBar').hidden = true; });

  $$('[data-q]').forEach(b => b.addEventListener('click', () => sendQuick(b.dataset.q)));
  on('#sosShow', 'click', () => { $('#sos').classList.remove('on'); focusMember($('#sos').dataset.id); });
  on('#sosClose', 'click', () => $('#sos').classList.remove('on'));

  on('#strip', 'click', e => { const b = e.target.closest('[data-id]'); if (b) focusMember(b.dataset.id); });
  on('#membersList', 'click', e => {
    if (e.target.closest('#btnInvite')) { shareInvite(); return; }
    if (e.target.closest('#qrBox')) { showBigQr(); return; }
    const s = e.target.closest('[data-see]'), l = e.target.closest('[data-lead]');
    if (s) focusMember(s.dataset.see);
    if (l && isLeader()) { giveLeader(l.dataset.lead); renderMembers(); }
  });

  on('#btnEndOpen', 'click', () => finish(false));
  on('#btnEndAll', 'click', () => finish(true));
  on('#endBody', 'click', e => {
    if (e.target.closest('#endSave')) finish(false);
    if (e.target.closest('#endAll')) finish(true);
  });

  on('#histBack', 'click', () => { show('home'); renderHome(); });
  on('#histList', 'click', e => { const b = e.target.closest('[data-trip]'); if (b) openTrip(b.dataset.trip); });
  on('#tripBack', 'click', closeTrip);
  on('#tripStats', 'click', async e => {
    const sel = e.target.closest('[data-tsel]');
    if (sel) { selectTripMember(sel.dataset.tsel); return; }
    if (e.target.closest('#btnShareTrip')) { prepareShareLink(); return; }
    if (e.target.closest('#shareSend')) { sendShareLink(); return; }
    if (e.target.closest('#shareCopy')) { copyShareLink(e.target.closest('#shareCopy')); return; }
    const st = e.target.closest('[data-story]');
    if (st) { makeStory(st.dataset.story); return; }
    if (e.target.closest('#openApp')) { closeTrip(); return; }
    const b = e.target.closest('[data-deltrip]');
    if (!b || !confirm(t('confirmDel'))) return;
    await DB.delTrip(b.dataset.deltrip);
    closeTrip();
  });
  on('#rpPlay', 'click', () => {
    if (!RP) return;
    if (!RP.playing && RP.T >= RP.dur) setReplay(0);
    RP.playing = !RP.playing; RP.lastTs = 0;
    updatePlayBtn();
    if (RP.playing) RP.raf = requestAnimationFrame(rpLoop);
  });
  on('#rpSlider', 'input', e => { if (RP) setReplay(+e.target.value); });
  on('#rpSpeed', 'click', () => {
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
orLoadSaved();
renderHome();
applyLang();
if (sharedLinkInUrl()) loadSharedTrip();
else if (!store.get('tutoDone', false)) openTuto();
setFollow(true, true);
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
