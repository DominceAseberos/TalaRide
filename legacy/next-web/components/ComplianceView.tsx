'use client';

import React from 'react';
import type { Vehicle, Driver } from '@talaride/shared';
import { ShieldCheckIcon, DownloadIcon, CheckCircleIcon } from './Icons';

interface ComplianceViewProps {
  vehicles: Vehicle[];
  drivers: Driver[];
  onExportCSV: () => void;
}

export function ComplianceView({ vehicles, drivers, onExportCSV }: ComplianceViewProps) {
  const now = new Date();
  const thirtyDays = new Date();
  thirtyDays.setDate(now.getDate() + 30);

  // Group vehicles by MTOP status
  const expiredMtop = vehicles.filter((v) => {
    if (!v.mtopExpiresAt) return false;
    return new Date(v.mtopExpiresAt) < now;
  });

  const soonExpiringMtop = vehicles.filter((v) => {
    if (!v.mtopExpiresAt) return false;
    const exp = new Date(v.mtopExpiresAt);
    return exp >= now && exp <= thirtyDays;
  });

  const compliantMtop = vehicles.filter((v) => {
    if (!v.mtopExpiresAt) return false;
    return new Date(v.mtopExpiresAt) > thirtyDays && v.status === 'active';
  });

  const expiringLicenses = drivers.filter((d) => {
    if (!d.licenseExpiresAt) return false;
    return new Date(d.licenseExpiresAt) <= thirtyDays;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Compliance Overview Card */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheckIcon size={20} color="var(--accent-primary)" />
              <span>LGU & LTFRB Compliance Dashboard</span>
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Official MTOP (Motorized Tricycle Operator&apos;s Permit) & inspection tracking
            </p>
          </div>
          <button id="btn-compliance-export-csv" className="btn btn-primary" onClick={onExportCSV}>
            <DownloadIcon size={15} />
            <span>Download TFRB Compliance CSV</span>
          </button>
        </div>

        {/* Status Breakdown Bar (AdminLTE Clean Cards) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
              Compliant Units
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#15803d', margin: '3px 0' }}>
              {compliantMtop.length}
            </div>
            <div style={{ fontSize: '0.675rem', color: '#166534' }}>
              Valid MTOP &gt; 30 days
            </div>
          </div>

          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>
              Renewals Due Soon
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#b45309', margin: '3px 0' }}>
              {soonExpiringMtop.length}
            </div>
            <div style={{ fontSize: '0.675rem', color: '#92400e' }}>
              Expires within 30 days
            </div>
          </div>

          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
              Expired / Suspended
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#b91c1c', margin: '3px 0' }}>
              {expiredMtop.length}
            </div>
            <div style={{ fontSize: '0.675rem', color: '#991b1b' }}>
              Action required to avoid fines
            </div>
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
              License Expiries
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1d4ed8', margin: '3px 0' }}>
              {expiringLicenses.length}
            </div>
            <div style={{ fontSize: '0.675rem', color: '#1e40af' }}>
              Drivers due for LTO renewal
            </div>
          </div>
        </div>

        {/* Action Items List */}
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '12px' }}>
          Urgent Action Items
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {expiredMtop.map((v) => (
            <div
              key={v.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                borderLeft: '4px solid #dc3545',
              }}
            >
              <div style={{ fontSize: '0.8125rem', color: '#1e293b' }}>
                <strong style={{ color: '#b91c1c' }}>Body #{v.bodyNumber}</strong> — MTOP {v.mtopNumber || 'Unassigned'} expired on {v.mtopExpiresAt}
              </div>
              <span className="badge badge-suspended">Expired</span>
            </div>
          ))}

          {soonExpiringMtop.map((v) => (
            <div
              key={v.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderLeft: '4px solid #ffc107',
              }}
            >
              <div style={{ fontSize: '0.8125rem', color: '#1e293b' }}>
                <strong style={{ color: '#b45309' }}>Body #{v.bodyNumber}</strong> — MTOP renewal due on {v.mtopExpiresAt}
              </div>
              <span className="badge badge-renewal">Due Soon</span>
            </div>
          ))}

          {expiringLicenses.map((d) => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                background: '#eff6ff',
                border: '1px solid #dbeafe',
                borderLeft: '4px solid #007bff',
              }}
            >
              <div style={{ fontSize: '0.8125rem', color: '#1e293b' }}>
                <strong style={{ color: '#1d4ed8' }}>Driver {d.fullName}</strong> — LTO License #{d.licenseNumber} expires {d.licenseExpiresAt}
              </div>
              <span className="badge badge-tricycle">License Alert</span>
            </div>
          ))}

          {expiredMtop.length === 0 && soonExpiringMtop.length === 0 && expiringLicenses.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '20px', background: '#ecfdf5', borderRadius: 'var(--radius-sm)', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 600, fontSize: '0.85rem' }}>
              <CheckCircleIcon size={18} color="#16a34a" />
              <span>All fleet units and driver licenses are fully compliant with LGU TFRB requirements!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
