import React, { useState } from 'react';
import { View, TextInput, Button, Text, ScrollView } from 'react-native';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../src/firebase';
import { colors } from '../../theme/colors';

export default function FixOne() {
  const [docId, setDocId] = useState('Lista precio ECOMMERCE'); // id por defecto
  const [log, setLog] = useState<string[]>([]);
  const push = (s: string) => setLog((L) => [...L, s]);

  const run = async () => {
    setLog([]);
    try {
      const ref = doc(db, 'documents', docId);
      const before = await getDoc(ref);
      push(`Antes: ${before.exists() ? JSON.stringify(before.data()) : 'NO EXISTE'}`);

      await updateDoc(ref, {
        active: true,
        category: 'Precios',
        categoryUpper: 'PRECIOS',      // nos sirve luego para filtrar case-insensitive
        minLevel: 0,                   // número
        updatedAt: serverTimestamp(),  // Timestamp de servidor
      });

      const after = await getDoc(ref);
      push(`Después: ${after.exists() ? JSON.stringify(after.data()) : 'NO EXISTE'}`);
      push('✔ Listo. Probá ahora la pestaña "Precios".');
    } catch (e: any) {
      push(`⚠ Error: ${e?.message || String(e)}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16, backgroundColor: colors.background }}>
      <Text style={{ fontWeight: '700' }}>Arreglar un documento de /documents</Text>
      <Text>Doc ID:</Text>
      <TextInput
        value={docId}
        onChangeText={setDocId}
        placeholder="Id exacto del documento"
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 10 }}
        autoCapitalize="none"
      />
      <Button title="Arreglar campos (category/minLevel/updatedAt)" onPress={run} />
      {log.map((l, i) => (
        <Text key={i} selectable style={{ fontSize: 12 }}>{l}</Text>
      ))}
    </ScrollView>
  );
}
