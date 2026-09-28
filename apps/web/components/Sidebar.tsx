'use client';

import React from 'react';
import { DashboardIcon, VehicleIcon, DriverIcon, ShieldCheckIcon } from './Icons';

export type TabType = 'overview' | 'vehicles' | 'drivers' | 'compliance';

interface SidebarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  vehicleCount: number;
  driverCount: number;
  alertCount: number;
}

export function Sidebar({
  currentTab,
  onSelectTab,
  vehicleCount,
  driverCount,
  alertCount,
}: SidebarProps) {
  const getNavStyle = (tab: TabType) => {
    const isActive = currentTab === tab;
    return {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderRadius: 'var(--radius-sm)',
      background: isActive ? 'var(--accent-primary-light)' : 'transparent',
      borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
      color: isActive ? 'var(--accent-primary)' : '#475569',
      fontWeight: isActive ? 600 : 500,
      fontSize: '0.85rem',
      textAlign: 'left' as const,
      transition: 'all 0.12s ease',
      cursor: 'pointer',
    };
  };

  return (
    <aside className="sidebar">
      {/* Brand & Logo (AdminLTE White Clean) */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '15px',
              color: '#ffffff',
            }}
          >
            TR
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1e293b', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              TalaRide
            </div>
            <div
              style={{
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Fleet & Compliance
            </div>
          </div>
        </div>
      </div>

      {/* Nav Menu */}
      <nav style={{ padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        <button
          id="nav-tab-overview"
          onClick={() => onSelectTab('overview')}
          style={getNavStyle('overview')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <DashboardIcon size={17} color={currentTab === 'overview' ? 'var(--accent-primary)' : '#64748b'} />
            <span>Dashboard</span>
          </span>
        </button>

        <button
          id="nav-tab-vehicles"
          onClick={() => onSelectTab('vehicles')}
          style={getNavStyle('vehicles')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <VehicleIcon size={17} color={currentTab === 'vehicles' ? 'var(--accent-primary)' : '#64748b'} />
            <span>Vehicles</span>
          </span>
          <span
            style={{
              fontSize: '0.725rem',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 'var(--radius-sm)',
              background: '#f1f5f9',
              color: '#334155',
            }}
          >
            {vehicleCount}
          </span>
        </button>

        <button
          id="nav-tab-drivers"
          onClick={() => onSelectTab('drivers')}
          style={getNavStyle('drivers')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <DriverIcon size={17} color={currentTab === 'drivers' ? 'var(--accent-primary)' : '#64748b'} />
            <span>Drivers</span>
          </span>
          <span
            style={{
              fontSize: '0.725rem',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 'var(--radius-sm)',
              background: '#f1f5f9',
              color: '#334155',
            }}
          >
            {driverCount}
          </span>
        </button>

        <button
          id="nav-tab-compliance"
          onClick={() => onSelectTab('compliance')}
          style={getNavStyle('compliance')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheckIcon size={17} color={currentTab === 'compliance' ? 'var(--accent-primary)' : '#64748b'} />
            <span>Compliance & Alerts</span>
          </span>
          {alertCount > 0 && (
            <span
              style={{
                fontSize: '0.725rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                background: '#fee2e2',
                color: '#dc2626',
              }}
            >
              {alertCount}
            </span>
          )}
        </button>
      </nav>

      {/* Operator Status Footer */}
      <div
        style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--border-subtle)',
          background: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--accent-success)',
            }}
          />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155' }}>
            Franchise System Online
          </span>
        </div>
        <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>
          Philippine LGU TFRB Standard
        </div>
      </div>
    </aside>
  );
}
