import React from 'react';
import { MAIN_TABS } from '../data/navigation';

// Barra inferior do celular: os mesmos quatro destinos da sidebar. Configurações fica no menu do avatar.
export default function MobileTabBar({ activeTab, setActiveTab }) {
  return (
    <nav className="mobile-tabbar" aria-label="Menu">
      {MAIN_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={isActive ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
