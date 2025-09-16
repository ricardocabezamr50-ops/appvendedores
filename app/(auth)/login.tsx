// app/(auth)/login.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../src/firebase";
import { colors } from "../../theme/colors";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const onLogin = async () => {
    try {
      setBusy(true);
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      router.replace("/fichas");
    } catch (e: any) {
      Alert.alert("Error al ingresar", e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF", padding: 24, justifyContent: "center" }}>
      <Image
        source={require("../../assets/images/logo.png")}
        style={{ width: 220, height: 60, resizeMode: "contain", alignSelf: "center", marginBottom: 32 }}
      />

      {/* Email */}
      <Text style={{ fontSize: 16, color: colors.text, marginBottom: 8 }}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="tu@email.com"
        placeholderTextColor="#9AA0A6"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={{
          borderWidth: 1,
          borderColor: "#E5E7EB",
          padding: 12,
          borderRadius: 10,
          marginBottom: 16,
          backgroundColor: "#FFF",
          color: "#111827", // texto visible
        }}
      />

      {/* Contraseña con 'ojo' */}
      <Text style={{ fontSize: 16, color: colors.text, marginBottom: 8 }}>Contraseña</Text>
      <View
        style={{
          borderWidth: 1,
          borderColor: "#E5E7EB",
          borderRadius: 10,
          backgroundColor: "#FFF",
          flexDirection: "row",
          alignItems: "center",
          paddingRight: 8,
          marginBottom: 24,
        }}
      >
        <TextInput
          value={pass}
          onChangeText={setPass}
          placeholder="••••••••"
          placeholderTextColor="#9AA0A6"
          secureTextEntry={!showPass}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          style={{
            flex: 1,
            padding: 12,
            color: "#111827", // texto visible
          }}
        />
        <TouchableOpacity onPress={() => setShowPass((s) => !s)} style={{ padding: 6 }}>
          <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={22} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={onLogin}
        disabled={busy}
        style={{ backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: "center" }}
      >
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: "#FFF", fontWeight: "700" }}>Ingresar</Text>}
      </TouchableOpacity>
    </View>
  );
}
