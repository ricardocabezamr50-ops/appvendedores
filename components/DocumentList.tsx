import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, ActivityIndicator, TouchableOpacity,
  Image, Linking, StyleSheet, Share, TextInput, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// 👇 API legacy (sin warnings, estable)
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, orderBy, onSnapshot, where, doc } from 'firebase/firestore';
// @ts-ignore
const firebaseConfig = require('../firebase.config.json');

type Doc = {
  id: string;
  title?: string;
  subtitle?: string;
  thumbnailUrl?: string;
  pdfUrl?: string; url?: string; fileUrl?: string; storageUrl?: string;
  minLevel?: number;
  group?: string; category?: string; type?: string;
  tags?: string[] | string;
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig as any);
const db = getFirestore(app);
const auth = getAuth(app);

const getUrl = (d: Doc) => d.pdfUrl || d.fileUrl || d.url || d.storageUrl || '';

function parseTags(raw: Doc['tags']): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((t) => `${t}`.trim()).filter(Boolean);
  const s = String(raw).replace(/[,;]+/g, ' ');
  return s.split(/\s+/).map((t) => t.trim()).filter(Boolean).map((t) => (t.startsWith('#') ? t : `#${t}`));
}

function filenameFrom(title?: string, url?: string) {
  const safeTitle = (title || 'documento').replace(/[^\p{L}\p{N}\-_\. ]/gu, '').replace(/\s+/g, '_').slice(0, 60);
  let ext = 'pdf';
  if (url) {
    const m = url.split('?')[0].match(/\.(pdf|png|jpg|jpeg|webp|docx?|xlsx?)$/i);
    if (m) ext = m[1].toLowerCase();
  }
  return `${safeTitle || 'archivo'}.${ext}`;
}

function guessMime(url?: string) {
  if (!url) return 'application/octet-stream';
  const u = url.toLowerCase();
  if (u.endsWith('.pdf')) return 'application/pdf';
  if (u.endsWith('.png')) return 'image/png';
  if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
  if (u.endsWith('.webp')) return 'image/webp';
  if (u.endsWith('.doc')) return 'application/msword';
  if (u.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (u.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (u.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return 'application/octet-stream';
}

type Props = {
  filterValue: string | null;
  iconEmoji?: string;
  searchPlaceholder?: string;
};

export default function DocumentList({ filterValue, iconEmoji = '📄', searchPlaceholder = 'Buscar por título o #tag' }: Props) {
  const [level, setLevel] = useState<number | null>(null);
  const [all, setAll] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [qtext, setQtext] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const stopAuth = onAuthStateChanged(auth, (u) => {
      if (!u) { setLevel(0); return; }
      const uref = doc(db, 'users', u.uid);
      const stopUser = onSnapshot(
        uref,
        { includeMetadataChanges: true },
        (snap) => {
          if (snap.metadata.fromCache && !snap.metadata.hasPendingWrites) return;
          const lv = snap.exists() && typeof snap.data().level === 'number' ? snap.data().level : 0;
          setLevel(Math.max(0, Math.min(3, lv)));
        },
        () => setLevel(0)
      );
      return () => stopUser();
    });
    return () => stopAuth();
  }, []);

  useEffect(() => {
    if (level === null) return;
    setLoading(true);
    const qref = query(
      collection(db, 'documents'),
      where('minLevel', '<=', level),
      orderBy('minLevel', 'asc'),
      orderBy('title', 'asc')
    );
    const stop = onSnapshot(
      qref,
      { includeMetadataChanges: true },
      (snap) => {
        if (snap.metadata.fromCache && !snap.metadata.hasPendingWrites) return;
        const rows: Doc[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return { id: d.id, ...data, tags: parseTags(data?.tags) };
        });
        setAll(rows);
        setLoading(false);
      },
      (e) => { setErr(e?.message ?? 'Error desconocido'); setLoading(false); }
    );
    return () => stop();
  }, [level]);

  const data = useMemo(() => {
    let rows = all;
    if (filterValue) {
      const field = (['group', 'category', 'type'] as const).find((f) => rows.some((r: any) => r[f] != null));
      if (field) {
        const fv = String(filterValue).toLowerCase();
        const filt = rows.filter((r: any) => String(r[field]).toLowerCase() === fv);
        if (filt.length) rows = filt;
      }
    }
    const q = qtext.trim().toLowerCase();
    if (!q) return rows;
    const tokens = q.split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      const title = String(r.title || '').toLowerCase();
      const rtags = (Array.isArray(r.tags) ? r.tags : parseTags(r.tags)).map((t) => t.toLowerCase());
      return tokens.every((t) => title.includes(t) || rtags.some((tag) => tag.includes(t.startsWith('#') ? t : `#${t}`)));
    });
  }, [all, filterValue, qtext]);

  const openUrl = async (d: Doc) => {
    const url = getUrl(d);
    if (!url) return;
    try { await Linking.openURL(url); } catch {}
  };

  // ✅ Compartir archivo real (descarga a caché y comparte)
  const shareFile = async (d: Doc) => {
    const url = getUrl(d);
    if (!url) return;
    try {
      setBusyId(d.id);
      const fileName = filenameFrom(d.title, url);
      const dest = FileSystem.cacheDirectory + fileName;

      const result = await FileSystem.downloadAsync(url, dest);
      if (!result || result.status !== 200) {
        throw new Error(`Descarga falló (status ${result?.status ?? 'desconocido'})`);
      }

      const sharingOk = await Sharing.isAvailableAsync();
      if (sharingOk) {
        await Sharing.shareAsync(result.uri, {
          mimeType: guessMime(url),
          dialogTitle: d.title ?? 'Compartir documento',
        });
      } else {
        // Fallback: compartir con Share usando archivo local
        await Share.share({
          title: d.title ?? 'Documento',
          message: d.title ?? 'Documento',
          url: result.uri,
        });
      }
    } catch (e: any) {
      Alert.alert('No se pudo compartir', e?.message ?? 'Intentalo de nuevo.');
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item }: { item: Doc }) => {
    const urlExists = !!getUrl(item);
    const tags = Array.isArray(item.tags) ? item.tags : parseTags(item.tags);

    return (
      <View style={S.card}>
        <View style={S.row}>
          {item.thumbnailUrl ? (
            <Image source={{ uri: item.thumbnailUrl }} style={S.thumb} />
          ) : (
            <View style={[S.thumb, S.thumbFallback]}><Text>{iconEmoji}</Text></View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={S.title}>{item.title ?? '(Sin título)'}</Text>
            {item.subtitle ? <Text style={S.subtitle}>{item.subtitle}</Text> : null}
            <View style={S.metaRow}>
              {typeof item.minLevel === 'number' && <Text style={S.badge}>Nivel {item.minLevel}</Text>}
              <View style={S.tagsRow}>
                {tags.slice(0, 6).map((t, i) => (
                  <View key={i} style={S.tagChip}><Text style={S.tagTxt}>{t}</Text></View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {urlExists ? (
          <View style={S.actions}>
            <TouchableOpacity style={S.actionBtn} onPress={() => openUrl(item)}>
              <Ionicons name="eye-outline" size={18} />
              <Text style={S.actionTxt}>Ver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.actionBtn} onPress={() => openUrl(item)}>
              <Ionicons name="download-outline" size={18} />
              <Text style={S.actionTxt}>Descargar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={S.actionBtn} onPress={() => shareFile(item)} disabled={busyId === item.id}>
              {busyId === item.id ? <ActivityIndicator /> : <Ionicons name="share-social-outline" size={18} />}
              <Text style={S.actionTxt}>Compartir</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  if (level === null || loading) {
    return (<View style={S.center}><ActivityIndicator /><Text style={S.muted}>Cargando…</Text></View>);
  }
  if (err) {
    return (<View style={S.center}><Text style={S.error}>{err.includes('permission-denied') ? 'No tenés acceso a este contenido.' : err}</Text></View>);
  }

  return (
    <View style={S.container}>
      <View style={S.searchBox}>
        <Ionicons name="search-outline" size={18} />
        <TextInput
          placeholder={searchPlaceholder}
          value={qtext}
          onChangeText={setQtext}
          style={S.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        contentContainerStyle={{ padding: 12, paddingTop: 6 }}
      />
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  muted: { marginTop: 8, color: '#666' },
  error: { color: '#b00020', textAlign: 'center', paddingHorizontal: 16 },

  searchBox: {
    marginTop: 10, marginHorizontal: 12, marginBottom: 4,
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f9fafb'
  },
  searchInput: { flex: 1, fontSize: 14 },

  card: { backgroundColor: '#f9fafb', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#eef0f2' },
  row: { flexDirection: 'row', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#eaeaea' },
  thumbFallback: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 13, color: '#555', marginTop: 2 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  badge: { fontSize: 12, color: '#555', marginRight: 6 },

  tagsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tagChip: { backgroundColor: '#1118270F', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  tagTxt: { fontSize: 11, color: '#111827' },

  actions: { marginTop: 10, flexDirection: 'row', gap: 14, alignItems: 'center' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1118270D', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10 },
  actionTxt: { fontSize: 12, fontWeight: '600' },
});
