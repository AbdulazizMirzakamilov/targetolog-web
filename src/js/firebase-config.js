// Конфигурация Firebase: данные из консоли Firebase
// Подставьте ваши ключи из Firebase Console -> Project Settings -> General -> Your apps -> Web app
export const firebaseConfig = {
  apiKey: "REPLACE_ME_FIREBASE_API_KEY",
  authDomain: "REPLACE_ME_PROJECT_ID.firebaseapp.com",
  projectId: "REPLACE_ME_PROJECT_ID",
  storageBucket: "REPLACE_ME_PROJECT_ID.appspot.com",
  messagingSenderId: "REPLACE_ME_MESSAGING_SENDER_ID",
  appId: "REPLACE_ME_APP_ID"
};

// Проверка: настроен ли реальный проект Firebase
export const isConfigured = () => {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('REPLACE_ME');
};
