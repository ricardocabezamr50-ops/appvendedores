// components/DocumentItem.tsx
import React, { useMemo, useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Share,
  Linking,
  Alert,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "../theme/colors";
import { db } from "../src/firebase"; // fuerza la init de Firebase app
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";

type Doc = {
  id: string;
  title?: string;
  tags?: string[];
  updatedAt?: any;        // Firestore Timestamp | ISO
  category?: string;

  // Posibles campos con enlace:
  storageUrl?: string;    // https o gs://
  url?: string;
  href?: string;
  link?: string;
  downloadUrl?: string;   // ya firmada
  storagePath?: string;   // ej. "documents/fichas/bm500.pdf"

  thumbnailUrl?: string;  // https o gs:// (opcional)
  active?: boolean;
  minLevel?: number;
};

void db; // evita warning por import no usado, y garantiza init de Firebase

// -------------------- helpers --------------------

function isFirebaseHttps(u: string) {
  return /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\//.test(u);
}
function hasToken(u: string) {
  return /[\?&]token=/.test(u);
}
function parsePathFromFirebaseHttps(u: string): string | null {
  try {
    const marker = "/o/";
    const idx = u.indexOf(marker);
    if (idx < 0) return null;
    const after = u.substring(idx + marker.length);
    const q = after.indexOf("?");
    const encPath = q >= 0 ? after.substring(0, q) : after;
    return decodeURIComponent(encPath);
  } catch {
    return null;
  }
}
function gsToPath(gs: string): string | null {
  if (!gs.startsWith("gs://")) return null;
  const no = gs.replace("gs://", "");
  const slash = no.indexOf("/");
  if (slash < 0) return null;
  return no.substring(slash + 1);
}
function isGs(u?: string) {
  return !!u && u.startsWith("gs://");
}

// -------------------- componente --------------------

export default function DocumentItem({ item }: { item: Doc }) {
  const primaryColor = colors?.primary ?? "#B91C1C";

  // URL resuelta y firmada lista para abrir/descargar/compartir
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

        // 1) downloadUrl ya firmada
        if (rawUrl && (!isFirebaseHttps(rawUrl) || hasToken(rawUrl))) {
          mounted && setResolvedUrl(rawUrl);
          return;
        }

        // 2) gs:// -> getDownloadURL
        if (rawUrl && isGs(rawUrl)) {
          const path = gsToPath(rawUrl);
          if (!path) throw new Error("Ruta gs:// inválida");
          const url = await getDownloadURL(storageRef(storage, path));
          mounted && setResolvedUrl(url);
          return;
        }

        // 3) https de Firebase sin token -> pedir getDownloadURL
        if (rawUrl && isFirebaseHttps(rawUrl) && !hasToken(rawUrl)) {
          const path = parsePathFromFirebaseHttps(rawUrl);
          if (!path) throw new Error("URL de Firebase sin path válido");
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

        // 5) cualquier https (Drive, etc.) tal cual
        if (rawUrl) {
          mounted && setResolvedUrl(rawUrl);
          return;
        }

        mounted && setResolvedUrl(null);
      } catch {
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
      if (!item?.updatedAt) return "";
      // @ts-ignore Firestore Timestamp compatible
      const d = item.updatedAt?.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt);
      return new Intl.DateTimeFormat("es-AR").format(d);
    } catch {
      return "";
    }
  }, [item?.updatedAt]);

  const ensureUrl = useCallback(() => {
    if (!resolvedUrl) {
      Alert.alert("Sin enlace", "Este documento no tiene un enlace disponible.");
      return null;
    }
    return resolvedUrl;
  }, [resolvedUrl]);

  const onOpen = useCallback(async () => {
    const url = ensureUrl();
    if (!url) return;
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) throw new Error("URL inválida");
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("No se pudo abrir", String(e?.message ?? e));
    }
  }, [ensureUrl]);

  const onDownload = useCallback(async () => {
    const url = ensureUrl();
    if (!url) return;
    // En Android abrir el enlace directo dispara la descarga en el navegador/sistema.
    try {
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert("No se pudo descargar", String(e?.message ?? e));
    }
  }, [ensureUrl]);

  const onShare = useCallback(async () => {
    const url = ensureUrl();
    if (!url) return;
    try {
      await Share.share({
        title: item.title ?? "Documento",
        message: `${item.title ?? "Documento"}\n${url}`,
      });
    } catch {
      // cancelado
    }
  }, [ensureUrl, item?.title]);

  // Miniatura: si no hay https válido, usamos placeholder local
  const thumbSource = useMemo(() => {
    const t = item?.thumbnailUrl;
    if (t && !isGs(t)) return { uri: t };
    return require("../assets/pdf-thumb.png");
  }, [item?.thumbnailUrl]);

  // ---------- UI ----------
  return (
    <TouchableOpacity onPress={onOpen} activeOpacity={0.85}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          paddingHorizontal: 16,
          backgroundColor: "#F5F6F7",
        }}
      >
        {/* Columna izquierda */}
        <View style={{ flex: 1, paddingRight: 12 }}>
          {!!item?.title && (
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
              {item.title}
            </Text>
          )}

          {!!item?.tags?.length && (
            <Text style={{ color: "#6B7280", marginTop: 2 }}>
              {item.tags.map((t) => `#${t}`).join(" ")}
            </Text>
          )}

          {/* Acciones: Ver · Descargar · Compartir */}
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
            {/* Ver */}
            <TouchableOpacity
              onPress={onOpen}
              style={{ flexDirection: "row", alignItems: "center", marginRight: 18 }}
              hitSlop={8}
            >
              <Ionicons name="eye-outline" size={18} color={primaryColor} />
              <Text style={{ marginLeft: 6, color: primaryColor, fontWeight: "600" }}>Ver</Text>
            </TouchableOpacity>

            {/* Descargar */}
            <TouchableOpacity
              onPress={onDownload}
              style={{ flexDirection: "row", alignItems: "center", marginRight: 18 }}
              hitSlop={8}
            >
              <Ionicons name="download-outline" size={18} color={primaryColor} />
              <Text style={{ marginLeft: 6, color: primaryColor, fontWeight: "600" }}>Descargar</Text>
            </TouchableOpacity>

            {/* Compartir */}
            <TouchableOpacity
              onPress={onShare}
              style={{ flexDirection: "row", alignItems: "center" }}
              hitSlop={8}
            >
              <Ionicons name="share-social-outline" size={18} color={primaryColor} />
              <Text style={{ marginLeft: 6, color: primaryColor, fontWeight: "600" }}>Compartir</Text>
            </TouchableOpacity>
          </View>

          {!!dateText && (
            <Text style={{ color: "#9CA3AF", marginTop: 8, fontSize: 12 }}>{dateText}</Text>
          )}
        </View>

        {/* Miniatura derecha (también abre) */}
        <TouchableOpacity onPress={onOpen} activeOpacity={0.85}>
          <Image
            source={thumbSource as any}
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              backgroundColor: "#FFFFFF",
            }}
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
