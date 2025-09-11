import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, View, ActivityIndicator } from "react-native";

type Props = {
  /** URL de miniatura (campo `thumbnailUrl` del doc) */
  uri?: string | null;
  /** Se llama al tocar la imagen (abrir visor) */
  onPress?: () => void;
  /** Ancho/alto opcionales (por defecto 72x96 aprox A4) */
  width?: number;
  height?: number;
  /** Si querés desactivar la pulsación */
  disabled?: boolean;
};

/** Ícono PDF local de respaldo (mostralo si no hay thumbnail todavía) */
const PDF_ICON =
  "https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg"; // o tu asset local

export default function PdfThumbnail({
  uri,
  onPress,
  width = 72,
  height = 96,
  disabled,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Cache-busting suave para que, si actualizás la miniatura, no quede pegada la vieja.
  const finalUri = useMemo(() => {
    if (!uri) return null;
    const sep = uri.includes("?") ? "&" : "?";
    return `${uri}${sep}v=${Date.now()}`;
  }, [uri]);

  const showFallback = !finalUri || failed;

  const content = (
    <View
