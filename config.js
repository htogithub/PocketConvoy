// Configuration de PocketConvoy pour rouler avec tes amis. La démo fonctionne sans.
window.CONVOY_CONFIG = {
  // Supabase : Project Settings > API Keys. Colle l'URL du projet et la clé « anon »
  // (onglet Legacy API keys, elle commence par eyJ). Cette clé est publique par conception.
  supabaseUrl: 'https://gqneyjrqbcognsvuutac.supabase.co/rest/v1/',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxbmV5anJxYmNvZ25zdnV1dGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNzAyNjUsImV4cCI6MjEwNzg0NjI2NX0.gM7WsqdQQUjBxC-Snx9NWmkbeybbaJT9Hb6paBrdqGM',

  // Serveurs qui relient les téléphones pour le talkie. En wifi le STUN suffit ;
  // en 4G/5G il faut un relais TURN : colle ici la liste « iceServers » de ton compte Metered (Open Relay).
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // { urls: 'turn:....', username: '...', credential: '...' },
  ],
};
