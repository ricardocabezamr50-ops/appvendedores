// C:\appvend\app\(tabs)\precios.tsx
import React from 'react';
import DocumentList from '../../components/DocumentList';

export default function Precios() {
  // mismo patrón que Fichas y Material, cambiando el filtro
  return (
    <DocumentList
      filterValue="precios"
      iconEmoji="🏷️"
      searchPlaceholder="Buscar por título o #tag"
    />
  );
}
