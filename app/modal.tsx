import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Modal</Text>
      <Text style={styles.subtitle}>
        Pantalla de ejemplo. Podés personalizarla o eliminarla si no la usás.
      </Text>
      <Text style={styles.note}>
        Plataforma: {Platform.OS.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555' },
  note: { marginTop: 20, fontSize: 12, color: '#777' },
});
