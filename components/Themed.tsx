// C:\appvend\components\Themed.tsx
import React from 'react';
import {
  Text as RNText,
  View as RNView,
  type TextProps as RNTextProps,
  type ViewProps as RNViewProps,
} from 'react-native';

// Wrappers mínimos. Si querés estilos globales, agrégalos acá.
export function Text(props: RNTextProps) {
  return <RNText {...props} />;
}

export function View(props: RNViewProps) {
  return <RNView {...props} />;
}
