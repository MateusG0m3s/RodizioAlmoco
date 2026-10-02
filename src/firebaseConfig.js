// Configurações do Firebase Realtime Database
// Você pode preencher as informações abaixo ou colar diretamente na aba "Configurações" do site.

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});

export const defaultFirebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyC3ezYD_5Ya614IYbGUe37uxUNN4A1OqP4",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "rodizio-almoco-equipe.firebaseapp.com",
  databaseURL: env.VITE_FIREBASE_DATABASE_URL || "https://rodizio-almoco-equipe-default-rtdb.firebaseio.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "rodizio-almoco-equipe",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "rodizio-almoco-equipe.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "340326184861",
  appId: env.VITE_FIREBASE_APP_ID || "1:340326184861:web:5e9251293fce02d6aa6174"
};
