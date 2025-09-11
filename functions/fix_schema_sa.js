// Uso:
// node fix_schema_sa.js "C:\\keys\\mateo-admin.json" <DOC_ID> --gs "gs://bucket/ruta.pdf" --title "..." --category "..." --tags "a,b" --active true --min 0
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const path = require("node:path");

function parseArgs() {
  const [saPath, docId, ...rest] = process.argv.slice(2);
  if (!saPath || !docId) {
    console.error('Uso: node fix_schema_sa.js "C:\\keys\\mateo-admin.json" <DOC_ID> [--gs gs://...] [--url https://...] [--title "..."] [--category "..."] [--tags "a,b"] [--active true|false] [--min 0]');
    process.exit(1);
  }
  const args = { saPath, docId };
  for (let i = 0; i < rest.length; i += 2) {
    const k = rest[i], v = rest[i + 1];
    if (v === undefined) break;
    if (k === "--gs") args.gs = v;
    if (k === "--url") args.url = v;
    if (k === "--title") args.title = v;
    if (k === "--category") args.category = v;
    if (k === "--tags") args.tags = v.split(",").map(s => s.trim()).filter(Boolean);
    if (k === "--active") args.active = v === "true";
    if (k === "--min") args.min = Number(v);
  }
  return args;
}

(async () => {
  const a = parseArgs();
  const sa = require(path.resolve(a.saPath));
  initializeApp({ credential: cert(sa), projectId: "mateo-vendedores" });

  const db = getFirestore();
  const ref = db.doc(`documents/${a.docId}`);

  const data = { updatedAt: Timestamp.now() };
  if (typeof a.active === "boolean") data.active = a.active;
  if (a.category) data.category = a.category;
  if (typeof a.min === "number") data.minLevel = a.min;
  if (a.title) data.title = a.title;
  if (a.tags) data.tags = a.tags; // ARRAY

  if (a.gs) { data.storageUrl = a.gs; data.pdfUrl = null; }
  else if (a.url) { data.pdfUrl = a.url; data.storageUrl = null; }

  await ref.set(data, { merge: true });
  console.log("OK schema ->", a.docId, JSON.stringify(data));
})();
