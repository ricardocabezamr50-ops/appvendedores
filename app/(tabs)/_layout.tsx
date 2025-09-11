// app/(tabs)/_layout.tsx
import React from "react";
import { Tabs, router } from "expo-router";
import { Image, TouchableOpacity } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { signOut } from "firebase/auth";
import { auth } from "../../src/firebase";          // misma ruta que usa el resto
import { colors } from "../../theme/colors";        // tu paleta

const LogoTitle = () => (
  <Image
    source={require("../../assets/images/logo.png")}
    style={{ height: 24, width: 120, resizeMode: "contain" }}
  />
);

export default function TabsLayout() {
  const HeaderRight = () => (
    <TouchableOpacity
      onPress={async () => {
        try { await signOut(auth); } catch {}
        router.replace("/(auth)/login");
      }}
      style={{ paddingHorizontal: 12 }}
    >
      <Ionicons name="log-out-outline" size={22} color={colors.primary} />
    </TouchableOpacity>
  );

  return (
    <Tabs
      initialRouteName="fichas"
      screenOptions={{
        headerTitle: () => <LogoTitle />,     // <-- vuelve el logo al header
        headerTitleAlign: "left",
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerShadowVisible: true,
        headerRight: () => <HeaderRight />,
        tabBarActiveTintColor: colors.primary,
      }}
    >
      <Tabs.Screen
        name="fichas"
        options={{
          title: "Fichas",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="file-document-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="precios"
        options={{
          title: "Precios",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pricetags-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="material"
        options={{
          title: "Material",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bullhorn-outline" size={size} color={color} />
          ),
        }}
      />

      {/** No declares index/two si ya los eliminaste */}
      {/* <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="two"   options={{ href: null }} /> */}
    </Tabs>
  );
}
