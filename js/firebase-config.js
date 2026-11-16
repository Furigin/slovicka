// Конфиг Firebase (web) из Firebase Console → Project settings → Your apps.
// Этот ключ по задумке Firebase публичный (он всё равно виден в браузере):
// данные защищают правила firestore.rules — каждый видит только свои users/{uid}/…
// null — синхронизация выключена, приложение работает только локально.
export const firebaseConfig = {
  apiKey: 'AIzaSyCuCuJr5wzTKFwdEbelURKDZA8GLyZ5TOg',
  authDomain: 'slova-4821b.firebaseapp.com',
  projectId: 'slova-4821b',
  storageBucket: 'slova-4821b.firebasestorage.app',
  messagingSenderId: '268095550032',
  appId: '1:268095550032:web:038c055b359f59f2709755',
};
