# Actualización: visibilidad por nivel en Firestore + remover auto-thumbnail

Este paquete reemplaza **Functions** para eliminar `generatePdfThumbnail` y agrega **reglas de Firestore**
para que la visibilidad de `documents/*` se controle **en Firebase** por `minLevel` del documento contra
el `level` del usuario (en `users/{uid}.level`). Mantiene sólo la función `ping`.

## Archivos incluidos
- `firebase.json`
- `firestore.rules`
- `functions/src/index.ts` (sólo `ping`)
- `functions/package.json` (sin puppeteer/chromium)
- `functions/tsconfig.json`

---

## 1) Preparación de datos
1. En **Firestore**, por cada usuario crea/actualiza `users/{uid}` con al menos:
   ```json
   { "level": 0, "role": "user" }
   ```
   - Para administradores usa `role: "admin"` o asigna **custom claim** `admin=true`.
2. En **documents/{docId}**, agrega el campo numérico `minLevel` (ej. 0, 1, 2...).  
   - Si `minLevel` no existe, el doc es **visible** para cualquier usuario autenticado.
   - `thumbnailUrl` pasa a ser **manual** (cargalo como string con la URL que quieras mostrar).

## 2) Eliminar la función vieja (opcional pero recomendado)
- Con Firebase CLI:
  ```bash
  firebase functions:delete generatePdfThumbnail --project mateo-vendedores --force
  # si tu CLI pide región, podés agregar: --region us-central1
  ```

## 3) Reemplazar Functions
1. Copiá la carpeta `functions` incluida aquí **sobre tu proyecto** (reemplazar).
2. En Windows CMD:
   ```cmd
   cd C:\...\appvendedores\functions
   npm install
   npm run build
   firebase deploy --only functions --project mateo-vendedores
   ```
   - Resultado esperado: sólo queda desplegada `ping` (Gen2).

## 4) Aplicar reglas de Firestore
Desde la raíz del proyecto (donde está `firestore.rules`):
```bash
firebase deploy --only firestore:rules --project mateo-vendedores
```

## 5) App (cliente)
- **Quitá** cualquier filtro/where por `minLevel` del lado cliente. Consultá `documents` normal y
  dejá que **las reglas** decidan qué se puede leer. Ejemplo (React Native / web SDK v9):
  ```ts
  import { collection, getDocs, orderBy, query } from 'firebase/firestore';
  const q = query(collection(db, 'documents'), orderBy('title'));
  const snap = await getDocs(q); // Devolverá sólo lo permitido por reglas
  ```
- Manejá `permission-denied` si el usuario no tiene nivel suficiente.

## 6) Notas
- El bucket correcto es `gs://mateo-vendedores.appspot.com` (si lo necesitás para PDFs), pero **ya no**
  hay función que derive `thumbnailUrl`: ese campo se carga **a mano**.
- Si alguna parte de la app esperaba `thumbnailPath/_thumbUpdatedAt`, simplemente ignoralos o limpiá esos campos.

## 7) Verificación rápida
- Logueate con un usuario con `level: 0`. Asegurate de que un documento con `minLevel: 1` **no** se liste.
- Logueate con un admin (`role: "admin"`). Verificá lectura y edición de `documents`.

---
Cualquier ajuste adicional (nombres de campos distintos, más colecciones con gating, etc.) se puede extender en `firestore.rules`.
