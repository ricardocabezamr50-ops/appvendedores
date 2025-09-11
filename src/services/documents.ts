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
