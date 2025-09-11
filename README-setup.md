# Mateo Vendedores App - Setup rapido

## Dependencias (instaladas)
firebase, @react-native-async-storage/async-storage, expo-web-browser, expo-file-system, expo-sharing

## Configuracion Firebase
Editar firebase.config.json con tus valores:
{
  "apiKey": "XXX",
  "authDomain": "XXX.firebaseapp.com",
  "projectId": "XXX",
  "storageBucket": "XXX.appspot.com",
  "messagingSenderId": "XXXX",
  "appId": "1:XXXX:web:XXXX"
}

## Estructura
- src/firebase.ts (lee firebase.config.json)
- src/services/documents.ts (queries + descarga/compartir + favoritos)
- components/DocumentItem.tsx
- app/(auth)/login.tsx
- app/(tabs)/_layout.tsx, fichas.tsx, precios.tsx, material.tsx
- theme/colors.ts
- firestore.rules, storage.rules

## Iniciar
npx expo start
