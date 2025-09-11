// functions/fixdoc_storage.js
// Uso: node fixdoc_storage.js "C:\ruta\serviceAccount.json" <DOC_ID> "gs://bucket/ruta/archivo.pdf"
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const path = require("node:path");

(async () => {
  const [saPath, docId, gsUrl] = process.argv.slice(2);
  if (!saPath || !docId || !gsUrl || !gsUrl.startsWith("gs://")) {
    console.error('Uso: node fixdoc_storage.js "C:\\ruta\\serviceAccount.json" <DOC_ID> "gs://bucket/ruta/archivo.pdf"');
    process.exit(1);
  }
  const serviceAccount = require(path.resolve(saPath));
  initializeApp({ credential: cert(serviceAccount), projectId: "mateo-vendedores" });

  const db = getFirestore();
  await db.doc(`documents/${docId}`).set(
    { storageUrl: gsUrl, pdfUpdatedAt: Timestamp.now(), pdfUrl: null },
    { merge: true }
  );
  console.log("OK ->", docId, gsUrl);
})();
