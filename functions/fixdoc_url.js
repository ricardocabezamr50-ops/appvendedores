// functions/fixdoc_url.js
// Uso: node fixdoc_url.js "C:\ruta\serviceAccount.json" <DOC_ID> "<URL v0 de Firebase Storage>"
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const path = require("node:path");

(async () => {
  const [saPath, docId, url] = process.argv.slice(2);
  if (!saPath || !docId || !url || !/^https?:\/\//i.test(url)) {
    console.error('Uso: node fixdoc_url.js "C:\\ruta\\serviceAccount.json" <DOC_ID> "<URL v0 de Firebase Storage>"');
    process.exit(1);
  }
  const serviceAccount = require(path.resolve(saPath));
  initializeApp({ credential: cert(serviceAccount), projectId: "mateo-vendedores" });

  const db = getFirestore();
  await db.doc(`documents/${docId}`).set(
    { pdfUrl: url, storageUrl: null, pdfUpdatedAt: Timestamp.now() },
    { merge: true }
  );
  console.log("OK ->", docId, url);
})();
