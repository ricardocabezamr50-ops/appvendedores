// components/DocumentItem.tsx
import React, { useMemo, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Share,
  Linking,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme/colors';
import { db } from '../src/firebase'; // fuerza la init de Firebase app
import { getStorage, ref as storageRef, getDownloadURL } from 'firebase/storage';

type Doc = {
  id: string;
  title?: string;
  tags?: string[];
  updatedAt?: any;        // Firestore Timestamp | ISO
  category?: string;

  // Posibles campos con enlace:
  storageUrl?: string;    // puede ser https, o gs://
  url?: string;
  href?: string;
  link?: string;
  downloadUrl?: string;   // si ya viene firmado, lo usamos tal cual
  storagePath?: string;   // ej. "documents/fichas/bm500.pdf"

  thumbnailUrl?: string;  // https o gs:// (opcional)
  active?: boolean;
  minLevel?: number;
};

void db; // evita warning por import no usado, y garantiza init de Firebase

// --- Helpers ---------------------------------------------------------------

function isFirebaseHttps(u: string) {
  return /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\//.test(u);
}

function hasToken(u: string) {
  return /[\?&]token=/.test(u);
}

function parsePathFromFirebaseHttps(u: string): string | null {
  // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<path>?alt=media...
  try {
    const marker = '/o/';
    const idx = u.indexOf(marker);
    if (idx < 0) return null;
    const after = u.substring(idx + marker.length);
    const q = after.indexOf('?');
    const encPath = q >= 0 ? after.substring(0, q) : after;
    return decodeURIComponent(encPath);
  } catch {
    return null;
  }
}

function gsToPath(gs: string): string | null {
  // gs://<bucket>/<path> -> devuelve <path>
  if (!gs.startsWith('gs://')) return null;
  const no = gs.replace('gs://', '');
  const slash = no.indexOf('/');
  if (slash < 0) return null;
  return no.substring(slash + 1);
}

function isGs(u?: string) {
  return !!u && u.startsWith('gs://');
}

// --- Componente ------------------------------------------------------------

export default function DocumentItem({ item }: { item: Doc }) {
  const primaryColor = colors?.primary ?? '#B91C1C';

  // URL resuelta y firmada lista para abrir/compartir
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  // Determina el “hint” inicial de URL
  const rawUrl = useMemo<string | null>(() => {
    return (
      item?.downloadUrl || // ya firmada: prioridad 1
      item?.storageUrl ||
      item?.url ||
      item?.href ||
      item?.link ||
      null
    );
  }, [item]);

  // Resuelve la URL final (usa getDownloadURL cuando hace falta)
  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        const storage = getStorage();

        // 1) downloadUrl ya firmado
        if (rawUrl && (!isFirebaseHttps(rawUrl) || hasToken(rawUrl))) {
          mounted && setResolvedUrl(rawUrl);
          return;
        }

        // 2) gs:// desde storageUrl/url/...  -> getDownloadURL
        if (rawUrl && isGs(rawUrl)) {
          const path = gsToPath(rawUrl);
          if (!path) throw new Error('Ruta gs:// inválida');
          const url = await getDownloadURL(storageRef(storage, path));
          mounted && setResolvedUrl(url);
          return;
        }

        // 3) https de Firebase sin token -> extraer path y pedir getDownloadURL
        if (rawUrl && isFirebaseHttps(rawUrl) && !hasToken(rawUrl)) {
          const path = parsePathFromFirebaseHttps(rawUrl);
          if (!path) throw new Error('URL de Firebase sin path válido');
          const url = await getDownloadURL(storageRef(storage, path));
          mounted && setResolvedUrl(url);
          return;
        }

        // 4) storagePath en el documento -> getDownloadURL
        if (item?.storagePath) {
          const url = await getDownloadURL(storageRef(storage, item.storagePath));
          mounted && setResolvedUrl(url);
          return;
        }

        // 5) Cualquier otra https (Drive, etc.) se usa tal cual
        if (rawUrl) {
          mounted && setResolvedUrl(rawUrl);
          return;
        }

        mounted && setResolvedUrl(null);
      } catch (e) {
        // Si algo falla, dejamos null para que onOpen avise
        mounted && setResolvedUrl(null);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [rawUrl, item?.storagePath]);

  const dateText = useMemo(() => {
    try {
      if (!item?.updatedAt) return '';
      // @ts-ignore Firestore Timestamp compatible
      const d = item.updatedAt?.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt);
      return new Intl.DateTimeFormat('es-AR').format(d);
    } catch {
      return '';
    }
  }, [item?.updatedAt]);

  const onOpen = useCallback(async () => {
    if (!resolvedUrl) {
      Alert.alert('Sin enlace', 'Este documento no tiene un enlace disponible.');
      return;
    }
    try {
      const can = await Linking.canOpenURL(resolvedUrl);
      if (!can) throw new Error('URL inválida');
      await Linking.openURL(resolvedUrl);
    } catch (e: any) {
      Alert.alert('No se pudo abrir', String(e?.message ?? e));
    }
  }, [resolvedUrl]);

  const onShare = useCallback(async () => {
    if (!resolvedUrl) {
      Alert.alert('Sin enlace', 'No hay enlace para compartir.');
      return;
    }
    try {
      await Share.share({
        title: item.title ?? 'Documento',
        message: `${item.title ?? 'Documento'}\n${resolvedUrl}`,
      });
    } catch {
      // cancelado / silencioso
    }
  }, [resolvedUrl, item?.title]);

  // Miniatura: usa thumbnailUrl si es https/gs://; si es gs:// la mostramos como placeholder (RN no la renderiza)
  const thumbSource = useMemo(() => {
    const t = item?.thumbnailUrl;
    if (t && !isGs(t)) return { uri: t };
    // placeholder local (PDF)
    return require('../assets/pdf-thumb.png');
  }, [item?.thumbnailUrl]);

  return (
    // Toda la fila abre el documento
    <TouchableOpacity onPress={onOpen} activeOpacity={0.8}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: 16,
          backgroundColor: '#F5F6F7',
        }}
      >
        {/* Columna izquierda: título, tags, acciones, fecha */}
        <View style={{ flex: 1, paddingRight: 12 }}>
          {!!item?.title && (
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>
              {item.title}
            </Text>
          )}

          {!!item?.tags?.length && (
            <Text style={{ color: '#6B7280', marginTop: 2 }}>
              {item.tags.map((t) => `#${t}`).join(' ')}
            </Text>
          )}

          {/* Acciones: compartir (clásico Android, rojo) + ver (ojo rojo) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <TouchableOpacity onPress={onShare} style={{ marginRight: 18 }} hitSlop={8}>
              <Ionicons name="share-social-outline" size={20} color={primaryColor} />
            </TouchableOpacity>

            <TouchableOpacity onPress={onOpen} hitSlop={8}>
              <Ionicons name="eye-outline" size={20} color={primaryColor} />
            </TouchableOpacity>
          </View>

          {!!dateText && (
            <Text style={{ color: '#9CA3AF', marginTop: 6, fontSize: 12 }}>
              {dateText}
            </Text>
          )}
        </View>

        {/* Miniatura derecha (también abre) */}
        <TouchableOpacity onPress={onOpen} activeOpacity={0.8}>
          <Image
            source={thumbSource as any}
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              backgroundColor: '#fff',
            }}
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
