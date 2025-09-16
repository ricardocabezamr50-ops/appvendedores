// C:\appvend\src\services\documents.ts
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocsFromServer,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase';

export type DocItem = {
  id: string;
  title?: string;
  category?: string;
  minLevel?: number;
  active?: boolean;
  updatedAt?: any;      // Firestore Timestamp
  storageUrl?: string;
  thumbnailUrl?: string;
  [k: string]: any;
};

/**
 * Diagnóstico: trae activos desde SERVIDOR.
 * Intenta ordenar por updatedAt; si falla, cae a fallback sin orderBy.
 */
export async function cargarDocumentsUI(max = 100): Promise<DocItem[]> {
  try {
    const q = query(
      collection(db, 'documents'),
      where('active', '==', true),
      orderBy('updatedAt', 'desc'),
      limit(max)
    );
    const snap = await getDocsFromServer(q);
    return mapSnap(snap);
  } catch {
    const q2 = query(
      collection(db, 'documents'),
      where('active', '==', true),
      limit(max)
    );
    const snap2 = await getDocsFromServer(q2);
    return mapSnap(snap2);
  }
}

/**
 * Producción: vista “Precios” en SERVIDOR usando `category` (case-sensitive).
 * Requiere índice compuesto:
 *   active(asc), category(asc), minLevel(asc), updatedAt(desc)
 * Importante:
 *   - `category` debe ser EXACTAMENTE "Precios" (sin espacios ni variantes).
 *   - `minLevel` debe ser number.
 *   - `updatedAt` debe ser Timestamp.
 */
export async function cargarPreciosServer(userLevel: number, max = 100): Promise<DocItem[]> {
  const q = query(
    collection(db, 'documents'),
    where('active', '==', true),
    where('category', '==', 'Precios'),  // ← mantenemos `category`
    where('minLevel', '<=', userLevel),
    // 🔑 primer orderBy = campo con desigualdad
    orderBy('minLevel', 'asc'),
    // luego tu orden "visual"
    orderBy('updatedAt', 'desc'),
    limit(max)
  );
  const snap = await getDocsFromServer(q);
  return mapSnap(snap);
}

/**
 * Fallback seguro en CLIENTE (por si el índice aún no está listo o hay datos desparejos).
 * Trae activos del servidor y filtra por category/minLevel en la app.
 */
export async function cargarPreciosSafe(userLevel: number, max = 200): Promise<DocItem[]> {
  const all = await cargarDocumentsUI(max);
  const out = all.filter((x: any) => {
    const catOk = String(x?.category ?? '').toLowerCase() === 'precios';
    const min = typeof x?.minLevel === 'number' ? x.minLevel : Number(x?.minLevel) || 0;
    return catOk && min <= userLevel;
  });
  out.sort((a: any, b: any) => {
    const ta = a?.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : 0;
    const tb = b?.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : 0;
    return tb - ta;
  });
  return out;
}

function mapSnap(snap: QuerySnapshot<DocumentData>): DocItem[] {
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
}
