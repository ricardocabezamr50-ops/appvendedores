// Uso: node touch_doc_sa.js "C:\\keys\\mateo-admin.json" <DOC_ID>
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const path = require("node:path");

(async () => {
  try {
    const [saPath, docId] = process.argv.slice(2);
    if (!saPath || !docId) {
      console.error('Uso: node touch_doc_sa.js "C:\\keys\\mateo-admin.json" <DOC_ID>');
      process.exit(1);
    }
    const sa = require(path.resolve(saPath));
    initializeApp({ credential: cert(sa), projectId: "mateo-vendedores" });

    const db = getFirestore();
    await db.doc(`documents/${docId}`).set(
      { pdfUpdatedAt: Timestamp.now() },
      { merge: true }
    );
    console.log("OK touch ->", docId);
  } catch (e) {
    console.error("ERROR:", e);
    process.exit(1);
  }
})();
