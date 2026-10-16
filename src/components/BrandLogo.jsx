import React from 'react';

// Logo scadahub em texto: "scada" fino em roxo e "hub" em negrito com o degradê roxo→azul da marca.
// O tamanho vem do font-size do elemento pai.
export default function BrandLogo({ className = '' }) {
  return (
    <span className={`scadahub-logo-wrap ${className}`} role="img" aria-label="scadahub">
      <span className="scada-part" aria-hidden="true">scada</span>
      <span className="hub-part" aria-hidden="true">hub</span>
    </span>
  );
}
