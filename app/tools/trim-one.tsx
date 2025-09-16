import React, { useState } from 'react';
import { ScrollView, Text, TextInput, Button } from 'react-native';
import { db } from '../../src/firebase';
import {
  doc, getDoc, updateDoc, deleteField, serverTimestamp,
} from 'firebase/firestore';

export default function TrimOne() {
  const [docId, setDocId] = useState('Lista precio ECOMMERCE');
  const [log, setLog] = useState<string[]>([]);
  const push = (s: string) => setLog(L => [...L, s]);

  const run = async () => {
    setLog([]);
    try {
      const ref = doc(db, 'documents', docId);
      const snap = await getDoc(ref);
      if (!snap.exists()) { push('No existe'); return; }
      const data: any = snap.data();
      push('ANTES: ' + JSON.stringify(data));

      const patch: any = {};
      const dels: any = {};

      // 1) Trimear todas las claves
      for (const [k, v] of Object.entries(data)) {
        const tk = k.trim();         // <-- quita espacios al principio/fin
        if (tk !== k) {
          patch[tk] = v;             // copiar al nombre correcto
          dels[k] = deleteField();   // borrar clave con espacio
        }
      }

      // 2) Normalizar campos críticos
      if (typeof (patch.category ?? data.category) === 'string') {
        const cat = (patch.category ?? data.category).trim();
        patch.category = cat;
        patch.categoryUpper = cat.toUpperCase();
      }

      const minRaw = (patch.minLevel ?? data.minLevel);
      if (typeof minRaw !== 'number') {
        const n = Number(minRaw);
        patch.minLevel = Number.isFinite(n) ? n : 0;
      }

      // updatedAt → Timestamp si falta o es string
      const hasTS = !!(patch.updatedAt ?? data.updatedAt)?.toDate;
      if (!hasTS) patch.updatedAt = serverTimestamp();

      await updateDoc(ref, { ...patch, ...dels });

      const after = await getDoc(ref);
      push('DESPUÉS: ' + JSON.stringify(after.data()));
      push('✔ Hecho. Probá en la pestaña “Precios”.');
    } catch (e: any) {
      push('⚠ ' + (e?.message || String(e)));
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontWeight: '700' }}>Trim & Fix de un documento</Text>
      <Text>ID del doc</Text>
      <TextInput
        value={docId}
        onChangeText={setDocId}
        autoCapitalize="none"
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
      />
      <Button title="TRIMEAR CLAVES + NORMALIZAR" onPress={run} />
      {log.map((l, i) => <Text key={i} selectable style={{ fontSize: 12 }}>{l}</Text>)}
    </ScrollView>
  );
}
