import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../src/firebase";
import { colors } from "../../theme/colors";
import { router } from "expo-router";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);

  const onLogin = async () => {
    try {
      setBusy(true);
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      router.replace("/(tabs)/fichas");
    } catch (e: any) {
      Alert.alert("Error al ingresar", e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF", padding: 24, justifyContent: "center" }}>
      {/* LOGO */}
      <Image
        source={require("../../assets/images/logo.png")}
        style={{ width: 220, height: 60, resizeMode: "contain", alignSelf: "center", marginBottom: 32 }}
      />

      {/* FORM */}
      <Text style={{ fontSize: 16, color: colors.text, marginBottom: 8 }}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="tu@email.com"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          borderWidth: 1,
          borderColor: "#EEE",
          padding: 12,
          borderRadius: 10,
          marginBottom: 16,
          backgroundColor: "#FFF"
        }}
      />

      <Text style={{ fontSize: 16, color: colors.text, marginBottom: 8 }}>Contraseña</Text>
      <TextInput
        value={pass}
        onChangeText={setPass}
        placeholder="••••••••"
        secureTextEntry
        style={{
          borderWidth: 1,
          borderColor: "#EEE",
          padding: 12,
          borderRadius: 10,
          marginBottom: 24,
          backgroundColor: "#FFF"
        }}
      />

      <TouchableOpacity
        onPress={onLogin}
        disabled={busy}
        style={{
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center"
        }}
      >
        {busy ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={{ color: "#FFF", fontWeight: "700" }}>Ingresar</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
