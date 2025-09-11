import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, Image, Linking, StyleSheet } from 'react-native';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, collection, query, orderBy, onSnapshot, where, doc
} from 'firebase/firestore';
import firebaseConfig from '../../firebase.config.json';

type Doc = {
  id: string;
  title?: string;
  subtitle?: string;
  thumbnailUrl?: string;
  pdfUrl?: string;
  url?: string;
  fileUrl?: string;
  minLevel?: number;
  group?: string;
  category?: string;
  type?: string;
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig as any);
const db = getFirestore(app);
const auth = getAuth(app);

const FILTER_FIELD_PRIORITY: Array<keyof Doc> = ['group', 'category', 'type'];
const FILTER_VALUE: string | null = 'fichas';

export default function FichasScreen() {
  const [level, setLevel] = useState<number | null>(null);
  const [all, setAll] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // 1) Suscribirse al user doc y tomar SOLO datos que vengan del servidor
  useEffect(() => {
    const stopAuth = onAuthStateChanged(auth, (u) => {
      if (!u) { setLevel(0); return; }
      const uref = doc(db, 'users', u.uid);
      const stopUser = onSnapshot(
        uref,
        { includeMetadataChanges: true },
        (snap) => {
          // Ignorar snapshots que vienen sólo del caché y no tienen writes pendientes
          if (snap.metadata.fromCache && !snap.metadata.hasPendingWrites) return;
          const lvRaw = snap.exists() && typeof snap.data().level === 'number' ? snap.data().level : 0;
          const lv = Math.max(0, Math.min(3, lvRaw));
          setLevel(lv);
        },
        () => setLevel(0)
      );
      return () => stopUser();
    });
    return () => stopAuth();
  }, []);

  // 2) Suscribirse a documents con where(minLevel <= level) y descartar snapshots de caché
  useEffect(() => {
    if (level === null) return;
    setLoading(true);

    const q = query(
      collection(db, 'documents'),
      where('minLevel', '<=', level),
      orderBy('minLevel', 'asc'),
      orderBy('title', 'asc') // si no existe 'title' en todos, podés quitar esta línea y el índice
    );

    const stopDocs = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.fromCache && !snap.metadata.hasPendingWrites) return;
        setAll(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        setLoading(false);
      },
      (e) => { setErr(e?.message ?? 'Error desconocido'); setLoading(false); }
    );

    return () => stopDocs();
  }, [level]);

  // 3) Filtro opcional por categoría en memoria
  const data = useMemo(() => {
    if (!FILTER_VALUE) return all;
    const field = FILTER_FIELD_PRIORITY.find(f => all.some(r => (r as any)[f] != null));
    if (!field) return all;
    const f = all.filter(r => String((r as any)[field]).toLowerCase() === FILTER_VALUE.toLowerCase());
    return f.length ? f : all;
  }, [all]);

  const openUrl = (d: Doc) => {
    const url = d.pdfUrl || d.fileUrl || d.url;
    if (url) Linking.openURL(url).catch(() => {});
  };

  if (level === null || loading) return (<View style={S.center}><ActivityIndicator /><Text style={S.muted}>Cargando fichas…</Text></View>);
  if (err) return (<View style={S.center}><Text style={S.error}>{err.includes('permission-denied') ? 'No tenés acceso a este contenido.' : err}</Text></View>);

  return (
    <View style={S.container}>
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={S.card}>
            <View style={S.row}>
              {item.thumbnailUrl ? <Image source={{ uri: item.thumbnailUrl }} style={S.thumb} /> : <View style={[S.thumb, S.thumbFallback]}><Text>📄</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={S.title}>{item.title ?? '(Sin título)'}</Text>
                {item.subtitle ? <Text style={S.subtitle}>{item.subtitle}</Text> : null}
                {typeof item.minLevel === 'number' && <Text style={S.badge}>Nivel {item.minLevel}</Text>}
              </View>
            </View>
            <View style={S.actions}>
              <TouchableOpacity style={S.btn} onPress={() => openUrl(item)} disabled={!item.pdfUrl && !item.url && !item.fileUrl}>
                <Text style={S.btnText}>{(item.pdfUrl || item.url || item.fileUrl) ? 'Abrir' : 'Sin archivo'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ padding: 12 }}
      />
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  muted: { marginTop: 8, color: '#666' },
  error: { color: '#b00020', textAlign: 'center', paddingHorizontal: 16 },
  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#eef0f2' },
  row: { flexDirection: 'row', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#eaeaea' },
  thumbFallback: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 13, color: '#555', marginTop: 2 },
  badge: { marginTop: 6, fontSize: 12, color: '#555' },
  actions: { marginTop: 10, flexDirection: 'row', gap: 8 },
  btn: { backgroundColor: '#111827', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '600' },
});
