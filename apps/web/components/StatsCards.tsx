'use client';

import React from 'react';
import type { Vehicle, Driver } from '@talaride/shared';
import { VehicleIcon, CheckCircleIcon, AlertTriangleIcon, AlertOctagonIcon } from './Icons';

interface StatsCardsProps {
  vehicles: Vehicle[];
  drivers: Driver[];
  mtopRenewalCount: number;
  inspectionAlertCount: number;
}

export function StatsCards({
  vehicles,
  drivers,
  mtopRenewalCount,
  inspectionAlertCount,
}: StatsCardsProps) {
  const activeVehicles = vehicles.filter((v) => v.status === 'active').length;
  const suspendedVehicles = vehicles.filter((v) => v.status === 'suspended').length;
  const assignedDrivers = drivers.filter((d) => Boolean(d.vehicleId)).length;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}
    >
      {/* 1. Registered Fleet (AdminLTE Primary Info-Box) */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          padding: '0',
          minHeight: '84px',
        }}
      >
        <div
          style={{
            width: '80px',
            minHeight: '84px',
            background: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <VehicleIcon size={30} color="#ffffff" />
        </div>
        <div style={{ padding: '12px 16px', flex: 1 }}>
          <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Registered Fleet
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>
            {vehicles.length}
          </div>
          <div style={{ fontSize: '0.675rem', color: 'var(--text-dim)' }}>
            {vehicles.filter((v) => v.unitType === 'tricycle').length} Tricycles • {vehicles.filter((v) => v.unitType === 'pedicab').length} Pedicabs
          </div>
        </div>
      </div>

      {/* 2. Active on Road (AdminLTE Success Info-Box) */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          padding: '0',
          minHeight: '84px',
        }}
      >
        <div
          style={{
            width: '80px',
            minHeight: '84px',
            background: 'var(--accent-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <CheckCircleIcon size={30} color="#ffffff" />
        </div>
        <div style={{ padding: '12px 16px', flex: 1 }}>
          <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active & Compliant
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>
            {activeVehicles}
          </div>
          <div style={{ fontSize: '0.675rem', color: 'var(--text-dim)' }}>
            {assignedDrivers} assigned drivers on rotation
          </div>
        </div>
      </div>

      {/* 3. MTOP Renewals Due (AdminLTE Warning Info-Box) */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          padding: '0',
          minHeight: '84px',
        }}
      >
        <div
          style={{
            width: '80px',
            minHeight: '84px',
            background: 'var(--accent-warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <AlertTriangleIcon size={30} color="#ffffff" />
        </div>
        <div style={{ padding: '12px 16px', flex: 1 }}>
          <div style={{ fontSize: '0.725rem', color: '#b45309', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            MTOP Renewals (&lt; 30d)
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>
            {mtopRenewalCount}
          </div>
          <div style={{ fontSize: '0.675rem', color: 'var(--text-dim)' }}>
            Franchise renewal window open
          </div>
        </div>
      </div>

      {/* 4. Action Required (AdminLTE Danger Info-Box) */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          padding: '0',
          minHeight: '84px',
        }}
      >
        <div
          style={{
            width: '80px',
            minHeight: '84px',
            background: 'var(--accent-danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <AlertOctagonIcon size={30} color="#ffffff" />
        </div>
        <div style={{ padding: '12px 16px', flex: 1 }}>
          <div style={{ fontSize: '0.725rem', color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Suspended / Overdue
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>
            {suspendedVehicles + inspectionAlertCount}
          </div>
          <div style={{ fontSize: '0.675rem', color: 'var(--text-dim)' }}>
            Requires inspection or audit
          </div>
        </div>
      </div>
    </div>
  );
}
