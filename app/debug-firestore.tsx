// C:\appvend\app\debug-firestore.tsx
import React, { useState } from 'react';
import { View, Button, Text, ScrollView } from 'react-native';
import { cargarDocsDebug } from '../src/services/documents';

export default function DebugFirestore() {
  const [count, setCount] = useState<number | null>(null);
  const [lines, setLines] = useState<string[]>([]);

  const probar = async () => {
    setLines([]);
    try {
      const snap = await cargarDocsDebug();
      setCount(snap.size);
      const out: string[] = [];
      snap.forEach(d => out.push(`${d.id} -> ${JSON.stringify(d.data())}`));
      setLines(out);
    } catch (e: any) {
      setLines([String(e?.message || e)]);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Button title="Probar Firestore (server)" onPress={probar} />
      <Text>Docs recibidos: {count ?? '-'}</Text>
      {lines.map((t, i) => (
        <Text key={i} selectable>{t}</Text>
      ))}
    </ScrollView>
  );
}
