# scripts/scaffold.ps1
# ASCII-safe scaffold: crea carpetas y escribe todos los archivos del proyecto.

$ErrorActionPreference = "Stop"

function Write-File {
  param([string]$Path, [string]$Content)
  $dir = Split-Path $Path
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Set-Content -Path $Path -Value $Content -Encoding UTF8
  Write-Host ("WROTE " + $Path)
}

Write-Host "Creating folders..."
$folders = @(
  "src",
  "src/services",
  "components",
  "theme",
  "app",
  "app/(auth)",
  "app/(tabs)"
)
foreach ($f in $folders) { if (-not (Test-Path $f)) { New-Item -ItemType Directory -Force -Path $f | Out-Null } }

# firebase.config.json (lo completamos en Paso 4)
$firebaseConfig = @'
{
  "apiKey": "",
  "authDomain": "",
  "projectId": "",
  "storageBucket": "",
  "messagingSenderId": "",
  "appId": ""
}
'@
Write-File "firebase.config.json" $firebaseConfig

# src/firebase.ts
$firebaseTs = @'
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Config desde JSON externo para no tocar codigo
// eslint-disable-next-line @typescript-eslint/no-var-requires
// @ts-ignore
const firebaseConfig = require("../firebase.config.json");

if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
  console.warn("[Firebase] Config incompleta en firebase.config.json. Completar antes de login.");
}

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
export const storage = getStorage(app);
'@
Write-File "src/firebase.ts" $firebaseTs

# theme/colors.ts
$colorsTs = @'
export const colors = {
  primary: "#D32F2F",
  primaryDark: "#B71C1C",
  background: "#FFFFFF",
  text: "#212121",
  textSecondary: "#757575",
  border: "#EEEEEE",
  success: "#2E7D32",
  warning: "#ED6C02",
};
'@
Write-File "theme/colors.ts" $colorsTs

# src/types.ts
$typesTs = @'
export type Category = "Fichas" | "Precios" | "Material";

export type DocItem = {
  id: string;
  title: string;
  category: Category;
  url?: string;
  storagePath?: string;
  thumbnailUrl?: string;
  tags?: string[];
  active: boolean;
  minLevel?: number;
  updatedAt?: number | { seconds: number; nanoseconds?: number };
  size?: number;
  mime?: string;
};

export type UserDoc = {
  email: string;
  active: boolean;
  level: number;
  createdAt?: number;
};
'@
Write-File "src/types.ts" $typesTs

# src/services/documents.ts (v1.1)
$documentsTs = @'
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  getDoc,
  doc,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { db, storage } from "../firebase";
import { Category, DocItem } from "../types";

export function toDate(updatedAt?: number | { seconds: number }) {
  if (!updatedAt) return undefined;
  if (typeof updatedAt === "number") return new Date(updatedAt);
  if ((updatedAt as any)?.seconds) return new Date((updatedAt as any).seconds * 1000);
  return undefined;
}

export type Page<T> = { items: T[]; last?: QueryDocumentSnapshot<DocumentData> };

const COL = collection(db, "documents");

export async function fetchPage(
  category: Category,
  opts?: { pageSize?: number; cursor?: QueryDocumentSnapshot<DocumentData> }
): Promise<Page<DocItem>> {
  const pageSize = opts?.pageSize ?? 50;
  const base = [
    where("active", "==", true),
    where("category", "==", category),
    orderBy("updatedAt", "desc"),
    limit(pageSize),
  ];
  const qy = opts?.cursor ? query(COL, ...base, startAfter(opts.cursor)) : query(COL, ...base);
  const snap = await getDocs(qy);
  const items: DocItem[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const last = snap.docs.length ? snap.docs[snap.docs.length - 1] : undefined;
  return { items, last };
}

export async function fetchPreciosPage(
  userLevel: number,
  opts?: { pageSize?: number; cursor?: QueryDocumentSnapshot<DocumentData> }
): Promise<Page<DocItem>> {
  const page = await fetchPage("Precios", opts);
  const items = page.items.filter((i) => (i.minLevel ?? 0) <= userLevel);
  return { items, last: page.last };
}

export async function searchByTag(
  category: Category,
  tag: string,
  opts?: { pageSize?: number }
): Promise<DocItem[]> {
  const pageSize = opts?.pageSize ?? 50;
  const qy = query(
    COL,
    where("active", "==", true),
    where("category", "==", category),
    where("tags", "array-contains", tag.toLowerCase()),
    limit(pageSize)
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function searchByTitleClient(list: DocItem[], term: string): Promise<DocItem[]> {
  const t = term.trim().toLowerCase();
  if (!t) return list;
  return list.filter((i) => i.title?.toLowerCase().includes(t));
}

export async function resolveDownloadUrl(item: DocItem): Promise<string> {
  if (item.storagePath) return await getDownloadURL(ref(storage, item.storagePath));
  if (item.url?.startsWith("gs://")) return await getDownloadURL(ref(storage, item.url));
  if (item.url) return item.url;
  throw new Error("Documento sin URL definida");
}

export async function openInBrowser(item: DocItem) {
  const url = await resolveDownloadUrl(item);
  await WebBrowser.openBrowserAsync(url);
}

const DL_DIR = (FileSystem.documentDirectory ?? "") + "Mateo/";

async function ensureDir() {
  try {
    await FileSystem.makeDirectoryAsync(DL_DIR, { intermediates: true });
  } catch {}
}

function safeFileName(item: DocItem): string {
  const base = (item.storagePath?.split("/").pop() || item.title || "documento").replace(/[^a-z0-9\-_.]+/gi, "_");
  if ((item.mime || "").includes("pdf") && !base.endsWith(".pdf")) return base + ".pdf";
  return base;
}

async function localUriFor(item: DocItem) {
  return DL_DIR + safeFileName(item);
}

export async function getLocalPathIfExists(item: DocItem): Promise<string | null> {
  const uri = await localUriFor(item);
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists ? uri : null;
  } catch {
    return null;
  }
}

export async function downloadToDevice(item: DocItem): Promise<string> {
  await ensureDir();
  const url = await resolveDownloadUrl(item);
  const dest = await localUriFor(item);
  const res = await FileSystem.downloadAsync(url, dest);
  return res.uri;
}

export async function shareDocument(item: DocItem) {
  const local = (await getLocalPathIfExists(item)) ?? (await downloadToDevice(item));
  if (!(await Sharing.isAvailableAsync())) throw new Error("Compartir no esta disponible en este dispositivo");
  await Sharing.shareAsync(local);
}

const FAV_KEY = "mateo:favorites:v1";

export async function listFavorites(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(FAV_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export async function isFavorite(id: string): Promise<boolean> {
  const all = await listFavorites();
  return all.includes(id);
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const all = await listFavorites();
  const idx = all.indexOf(id);
  if (idx === -1) all.push(id); else all.splice(idx, 1);
  await AsyncStorage.setItem(FAV_KEY, JSON.stringify(all));
  return all.includes(id);
}
'@
Write-File "src/services/documents.ts" $documentsTs

# components/DocumentItem.tsx
$docItem = @'
import React, { useEffect, useState } from "react";
import { Pressable, View, Text, StyleSheet, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { DocItem } from "../src/types";
import {
  toDate,
  openInBrowser,
  downloadToDevice,
  shareDocument,
  isFavorite,
  toggleFavorite,
  getLocalPathIfExists,
} from "../src/services/documents";

export default function DocumentItem({ item }: { item: DocItem }) {
  const date = toDate(item.updatedAt);
  const [downCached, setDownCached] = useState<boolean>(false);
  const [fav, setFav] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      setFav(await isFavorite(item.id));
      setDownCached(!!(await getLocalPathIfExists(item)));
    })();
  }, [item.id]);

  const onDownload = async () => {
    try {
      await downloadToDevice(item);
      setDownCached(true);
      Alert.alert("Descargado", "Disponible offline en la app.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo descargar");
    }
  };

  const onShare = async () => {
    try {
      await shareDocument(item);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo compartir");
    }
  };

  const onToggleFav = async () => {
    const nowFav = await toggleFavorite(item.id);
    setFav(nowFav);
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => openInBrowser(item)} style={{ flex: 1 }}>
        <Text style={styles.title}>{item.title}</Text>
        {!!item.tags?.length && (
          <View style={styles.tagsRow}>
            {item.tags!.slice(0, 3).map((t) => (
              <View key={t} style={styles.chip}>
                <Text style={styles.chipText}>#{t}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
          {date && <Text style={styles.meta}>Actualizado: {date.toLocaleDateString()}</Text>}
          {downCached && (
            <View style={styles.badge}>
              <MaterialCommunityIcons name="download-outline" size={14} color={colors.success} />
              <Text style={styles.badgeText}>Offline</Text>
            </View>
          )}
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Pressable onPress={onDownload} style={styles.iconBtn}>
          <MaterialCommunityIcons name="download-outline" size={20} color={colors.primary} />
        </Pressable>
        <Pressable onPress={onShare} style={styles.iconBtn}>
          <MaterialCommunityIcons name="share-variant" size={20} color={colors.primary} />
        </Pressable>
        <Pressable onPress={onToggleFav} style={styles.iconBtn}>
          <MaterialCommunityIcons name={fav ? "star" : "star-outline"} size={20} color={fav ? "#FFC107" : colors.primary} />
        </Pressable>
        <Pressable onPress={() => openInBrowser(item)} style={styles.iconBtn}>
          <MaterialCommunityIcons name="open-in-new" size={20} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.textSecondary, fontSize: 12 },
  tagsRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#FAFAFA",
  },
  chipText: { color: colors.textSecondary, fontSize: 12 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { padding: 6 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#E8F5E9",
  },
  badgeText: { color: colors.success, fontSize: 11, fontWeight: "600" },
});
'@
Write-File "components/DocumentItem.tsx" $docItem

# app/_layout.tsx
$appLayout = @'
import React, { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../src/firebase";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!segments.length) return;
    setReady(true);
  }, [segments]);

  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)/fichas");
    }
  }, [ready, user, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
'@
Write-File "app/_layout.tsx" $appLayout

# app/(auth)/login.tsx
$loginTsx = @'
import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../src/firebase";
import { colors } from "../../theme/colors";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo iniciar sesion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mateo - Vendedores</Text>
      <TextInput
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <TextInput
        placeholder="Contrasena"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      <Pressable disabled={loading} onPress={onLogin} style={styles.btn}>
        <Text style={styles.btnText}>{loading ? "Ingresando..." : "Ingresar"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: "700", color: colors.primary, marginBottom: 24, textAlign: "center" },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 12, color: colors.text },
  btn: { backgroundColor: colors.primary, borderRadius: 10, padding: 14, alignItems: "center", marginTop: 8 },
  btnText: { color: "#fff", fontWeight: "700" },
});
'@
Write-File "app/(auth)/login.tsx" $loginTsx

# app/(tabs)/_layout.tsx
$tabsLayout = @'
import React from "react";
import { Tabs } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#fff" },
        headerTintColor: colors.primary,
        tabBarActiveTintColor: colors.primary,
      }}
    >
      <Tabs.Screen
        name="fichas"
        options={{
          title: "Fichas",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="file-document-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="precios"
        options={{
          title: "Precios",
          tabBarIcon: ({ color, size }) => <Ionicons name="pricetags-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="material"
        options={{
          title: "Material",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bullhorn-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
'@
Write-File "app/(tabs)/_layout.tsx" $tabsLayout

# app/(tabs)/fichas.tsx
$fichasTsx = @'
import React, { useEffect, useMemo, useState } from "react";
import { View, TextInput, FlatList, RefreshControl, ActivityIndicator, Text } from "react-native";
import { colors } from "../../theme/colors";
import DocumentItem from "../../components/DocumentItem";
import { DocItem } from "../../src/types";
import { fetchPage } from "../../src/services/documents";

export default function FichasScreen() {
  const [term, setTerm] = useState("");
  const [data, setData] = useState<DocItem[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);

  const load = async () => {
    setLoading(true);
    const page = await fetchPage("Fichas");
    setData(page.items);
    setCursor(page.last ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onEnd = async () => {
    if (!cursor || fetchingMore) return;
    setFetchingMore(true);
    const page = await fetchPage("Fichas", { cursor });
    setData((prev) => [...prev, ...page.items]);
    setCursor(page.last ?? null);
    setFetchingMore(false);
  };

  const filtered = useMemo(() => {
    const t = term.trim();
    if (!t) return data;
    if (t.startsWith("#")) return data.filter((i) => i.tags?.includes(t.slice(1).toLowerCase()));
    return data.filter((i) => i.title?.toLowerCase().includes(t.toLowerCase()));
  }, [term, data]);

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <TextInput
        placeholder="Buscar por titulo o #tag"
        value={term}
        onChangeText={setTerm}
        style={{
          margin: 12,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 12,
          color: colors.text,
        }}
      />
      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => <DocumentItem item={item} />}
        onEndReachedThreshold={0.4}
        onEndReached={onEnd}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListFooterComponent={fetchingMore ? <ActivityIndicator style={{ margin: 12 }} /> : null}
        ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 24 }}>Sin resultados</Text>}
      />
    </View>
  );
}
'@
Write-File "app/(tabs)/fichas.tsx" $fichasTsx

# app/(tabs)/material.tsx
$materialTsx = @'
import React, { useEffect, useMemo, useState } from "react";
import { View, TextInput, FlatList, RefreshControl, ActivityIndicator, Text } from "react-native";
import { colors } from "../../theme/colors";
import DocumentItem from "../../components/DocumentItem";
import { DocItem } from "../../src/types";
import { fetchPage } from "../../src/services/documents";

export default function MaterialScreen() {
  const [term, setTerm] = useState("");
  const [data, setData] = useState<DocItem[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);

  const load = async () => {
    setLoading(true);
    const page = await fetchPage("Material");
    setData(page.items);
    setCursor(page.last ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onEnd = async () => {
    if (!cursor || fetchingMore) return;
    setFetchingMore(true);
    const page = await fetchPage("Material", { cursor });
    setData((prev) => [...prev, ...page.items]);
    setCursor(page.last ?? null);
    setFetchingMore(false);
  };

  const filtered = useMemo(() => {
    const t = term.trim();
    if (!t) return data;
    if (t.startsWith("#")) return data.filter((i) => i.tags?.includes(t.slice(1).toLowerCase()));
    return data.filter((i) => i.title?.toLowerCase().includes(t.toLowerCase()));
  }, [term, data]);

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <TextInput
        placeholder="Buscar por titulo o #tag"
        value={term}
        onChangeText={setTerm}
        style={{
          margin: 12,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 12,
          color: colors.text,
        }}
      />
      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => <DocumentItem item={item} />}
        onEndReachedThreshold={0.4}
        onEndReached={onEnd}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListFooterComponent={fetchingMore ? <ActivityIndicator style={{ margin: 12 }} /> : null}
        ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 24 }}>Sin resultados</Text>}
      />
    </View>
  );
}
'@
Write-File "app/(tabs)/material.tsx" $materialTsx

# app/(tabs)/precios.tsx
$preciosTsx = @'
import React, { useEffect, useMemo, useState } from "react";
import { View, TextInput, FlatList, RefreshControl, ActivityIndicator, Text, Alert } from "react-native";
import { colors } from "../../theme/colors";
import DocumentItem from "../../components/DocumentItem";
import { DocItem } from "../../src/types";
import { auth, db } from "../../src/firebase";
import { fetchPreciosPage } from "../../src/services/documents";
import { getDoc, doc } from "firebase/firestore";

async function fetchUserLevel(uid: string): Promise<number> {
  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.data() as any;
  return data?.level ?? 0;
}

export default function PreciosScreen() {
  const [term, setTerm] = useState("");
  const [data, setData] = useState<DocItem[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [level, setLevel] = useState<number>(0);

  const load = async () => {
    setLoading(true);
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }
    try {
      const lvl = await fetchUserLevel(uid);
      setLevel(lvl);
      const page = await fetchPreciosPage(lvl);
      setData(page.items);
      setCursor(page.last ?? null);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudieron cargar Precios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onEnd = async () => {
    if (!cursor || fetchingMore) return;
    setFetchingMore(true);
    const page = await fetchPreciosPage(level, { cursor });
    setData((prev) => [...prev, ...page.items]);
    setCursor(page.last ?? null);
    setFetchingMore(false);
  };

  const filtered = useMemo(() => {
    const t = term.trim();
    if (!t) return data;
    if (t.startsWith("#")) return data.filter((i) => i.tags?.includes(t.slice(1).toLowerCase()));
    return data.filter((i) => i.title?.toLowerCase().includes(t.toLowerCase()));
  }, [term, data]);

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <TextInput
        placeholder="Buscar por titulo o #tag"
        value={term}
        onChangeText={setTerm}
        style={{
          margin: 12,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          padding: 12,
          color: colors.text,
        }}
      />
      <FlatList
        data={filtered}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => <DocumentItem item={item} />}
        onEndReachedThreshold={0.4}
        onEndReached={onEnd}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListFooterComponent={fetchingMore ? <ActivityIndicator style={{ margin: 12 }} /> : null}
        ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 24 }}>Sin resultados</Text>}
      />
    </View>
  );
}
'@
Write-File "app/(tabs)/precios.tsx" $preciosTsx

# firestore.rules
$firestoreRules = @'
// Firestore v1 - lectura autenticada; Precios valida nivel; sin escrituras desde app
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function userLevel() {
      return get(/databases/$(db)/documents/users/$(request.auth.uid)).data.level;
    }
    match /documents/{docId} {
      allow read: if request.auth != null
                   && (
                        resource.data.category in ['Fichas','Material'] ||
                        (resource.data.category == 'Precios' && userLevel() >= (resource.data.minLevel ?? 0))
                      )
                   && (resource.data.active == true);
      allow write: if false;
    }
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }
  }
}
'@
Write-File "firestore.rules" $firestoreRules

# storage.rules
$storageRules = @'
// Storage v1 - solo lectura autenticada; sin escrituras desde app
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
'@
Write-File "storage.rules" $storageRules

# README-setup.md
$readme = @'
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
'@
Write-File "README-setup.md" $readme

Write-Host "Scaffold completed. Next: fill firebase.config.json and run: npx expo start"
