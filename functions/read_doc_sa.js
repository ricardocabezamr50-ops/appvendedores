const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const path = require("node:path");

(async () => {
  const [saPath, docId] = process.argv.slice(2);
  if (!saPath || !docId) {
    console.error('Uso: node read_doc_sa.js "C:\\keys\\mateo-admin.json" <DOC_ID>');
    process.exit(1);
  }
  const sa = require(path.resolve(saPath));
  initializeApp({ credential: cert(sa), projectId: "mateo-vendedores" });

  const db = getFirestore();
  const snap = await db.doc(`documents/${docId}`).get();
  if (!snap.exists) return console.log("No existe el doc:", docId);
  console.log(JSON.stringify(snap.data(), null, 2));
})();
