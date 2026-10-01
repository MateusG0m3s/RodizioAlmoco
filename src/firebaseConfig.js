// Configurações do Firebase Realtime Database
// Você pode preencher as informações abaixo ou colar diretamente na aba "Configurações" do site.

export const defaultFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyRodizioEquipeDefault",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "rodizio-almoco-equipe.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://rodizio-almoco-equipe-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "rodizio-almoco-equipe",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "rodizio-almoco-equipe.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};
