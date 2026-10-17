// Configuration de PocketConvoy pour rouler avec tes amis. La démo fonctionne sans.
window.CONVOY_CONFIG = {
  supabaseUrl: 'https://gqneyjrqbcognsvuutac.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxbmV5anJxYmNvZ25zdnV1dGFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNzAyNjUsImV4cCI6MjEwNzg0NjI2NX0.gM7WsqdQQUjBxC-Snx9NWmkbeybbaJT9Hb6paBrdqGM',
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: [
        'turn:free.expressturn.com:3478?transport=udp',
        'turn:free.expressturn.com:3478?transport=tcp',
      ],
      username: '000000002107638886',
      credential: '0qD7tUcM2OBgepiEz/FQgwpCeYk=',
    },
  ],
};
