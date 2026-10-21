// Конфигурация Firebase: данные из консоли Firebase
// Подставьте ваши ключи из Firebase Console -> Project Settings -> General -> Your apps -> Web app
export const firebaseConfig = {
  apiKey: "AIzaSyAiGVHb1x8e4KBRO1uH93VNX5FVH6HNlHs",
  authDomain: "kamila-targetolog-6523a.firebaseapp.com",
  projectId: "kamila-targetolog-6523a",
  storageBucket: "kamila-targetolog-6523a.firebasestorage.app",
  messagingSenderId: "827549919584",
  appId: "1:827549919584:web:fb5c75d73bfb5eb63dd605"
};

// Проверка: настроен ли реальный проект Firebase
export const isConfigured = () => {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('REPLACE_ME');
};
