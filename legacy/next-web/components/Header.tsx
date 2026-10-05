'use client';

import React from 'react';
import type { Organization } from '@talaride/shared';
import { LocationIcon, RefreshIcon, DocumentIcon, PlusIcon, VehicleIcon } from './Icons';

interface HeaderProps {
  organization: Organization;
  onOpenAddVehicle: () => void;
  onOpenAddDriver: () => void;
  onExportCSV: () => void;
  onResetDemo: () => void;
}

export function Header({
  organization,
  onOpenAddVehicle,
  onOpenAddDriver,
  onExportCSV,
  onResetDemo,
}: HeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
        paddingBottom: '18px',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' }}>
            {organization.name}
          </h1>
          <span className="badge badge-active">Operator Coop</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <LocationIcon size={14} color="var(--accent-primary)" /> {organization.municipality}, {organization.region}
          </span>
          <span>•</span>
          <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>SaaS Tier: {organization.subscriptionTier.toUpperCase()}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button
          id="btn-reset-demo"
          className="btn btn-secondary btn-sm"
          onClick={onResetDemo}
          title="Reset to sample Filipino tricycle fleet records"
        >
          <RefreshIcon size={13} color="#64748b" />
          <span>Reset Sample Data</span>
        </button>

        <button
          id="btn-export-csv"
          className="btn btn-secondary btn-sm"
          onClick={onExportCSV}
          title="Download compliance spreadsheet for LGU submission"
        >
          <DocumentIcon size={13} color="#64748b" />
          <span>Export LGU CSV</span>
        </button>

        <button
          id="btn-add-driver"
          className="btn btn-secondary btn-sm"
          onClick={onOpenAddDriver}
        >
          <PlusIcon size={13} color="#64748b" />
          <span>Add Driver</span>
        </button>

        <button
          id="btn-add-vehicle"
          className="btn btn-primary btn-sm"
          onClick={onOpenAddVehicle}
        >
          <VehicleIcon size={14} color="#ffffff" />
          <span>Register Vehicle</span>
        </button>
      </div>
    </header>
  );
}
