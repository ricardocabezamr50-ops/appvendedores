import React from 'react';
import DocumentList from '../../components/DocumentList';

export default function Fichas() {
  return <DocumentList filterValue="fichas" iconEmoji="📄" searchPlaceholder="Buscar por título o #tag" />;
}
