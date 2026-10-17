// Configuration de PocketConvoy pour rouler avec tes amis. La démo fonctionne sans.
window.CONVOY_CONFIG = {
  // Supabase : Project Settings > API Keys. Colle l'URL du projet et la clé « anon »
  // (onglet Legacy API keys, elle commence par eyJ). Cette clé est publique par conception.
  supabaseUrl: 'https://XXXXXXXXXXXX.supabase.co',
  supabaseAnonKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',

  // Serveurs qui relient les téléphones pour le talkie. En wifi le STUN suffit ;
  // en 4G/5G il faut un relais TURN : colle ici la liste « iceServers » de ton compte Metered (Open Relay).
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // { urls: 'turn:....', username: '...', credential: '...' },
  ],
};
