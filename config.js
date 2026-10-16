// Configuration de PocketConvoy. À remplir avant de publier sur GitHub Pages.
window.CONVOY_CONFIG = {
  // Supabase : Project Settings > API Keys. Utilise la clé "anon" (onglet Legacy API keys, elle commence par eyJ).
  // Cette clé est publique par conception : elle peut rester dans le dépôt.
  supabaseUrl: 'https://XXXXXXXXXXXX.supabase.co',
  supabaseAnonKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',

  // Serveurs qui relient les téléphones pour le talkie.
  // Le STUN suffit en wifi ; en 4G/5G il faut un relais TURN : colle ici la liste
  // "iceServers" donnée par ton compte gratuit Metered (Open Relay).
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // { urls: 'turn:exemple.relay.metered.ca:80', username: '...', credential: '...' },
    // { urls: 'turn:exemple.relay.metered.ca:443?transport=tcp', username: '...', credential: '...' },
  ],

  // Services gratuits sans clé (à changer seulement si tu héberges les tiens) :
  routingUrl: 'https://router.project-osrm.org',
  geocodeUrl: 'https://photon.komoot.io',
};
