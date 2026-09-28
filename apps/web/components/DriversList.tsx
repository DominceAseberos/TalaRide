'use client';

import React, { useState } from 'react';
import type { Driver, Vehicle } from '@talaride/shared';
import { PlusIcon, PhoneIcon, HeartHandshakeIcon, CalendarIcon } from './Icons';

interface DriversListProps {
  drivers: Driver[];
  vehicles: Vehicle[];
  onUpdateDriver: (id: string, updates: Partial<Driver>) => void;
  onDeleteDriver: (id: string) => void;
  onOpenAddModal: () => void;
}

export function DriversList({
  drivers,
  vehicles,
  onUpdateDriver,
  onDeleteDriver,
  onOpenAddModal,
}: DriversListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = drivers.filter(
    (d) =>
      d.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.licenseNumber && d.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (d.contactNumber && d.contactNumber.includes(searchTerm))
  );

  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  const isLicenseExpiring = (dateStr?: string) => {
    if (!dateStr) return false;
    const exp = new Date(dateStr);
    return exp <= thirtyDaysFromNow;
  };

  const getVehicleForDriver = (vehicleId?: string) => {
    if (!vehicleId) return null;
    return vehicles.find((v) => v.id === vehicleId);
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      {/* Header & Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', letterSpacing: '-0.01em' }}>
            Driver Directory & Licensing
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Authorized drivers, LTO professional licenses, and vehicle assignments
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            id="driver-search-input"
            type="text"
            className="input-field"
            placeholder="Search driver name, license, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '260px' }}
          />
          <button id="btn-add-driver-card" className="btn btn-primary btn-sm" onClick={onOpenAddModal}>
            <PlusIcon size={14} />
            <span>Add Driver</span>
          </button>
        </div>
      </div>

      {/* Driver Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
            No driver profiles found.
          </div>
        ) : (
          filtered.map((driver) => {
            const assignedVehicle = getVehicleForDriver(driver.vehicleId);
            const licenseAlert = isLicenseExpiring(driver.licenseExpiresAt);

            return (
              <div
                key={driver.id}
                id={`driver-card-${driver.id}`}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-sm)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  position: 'relative',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                      {driver.fullName}
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      License: {driver.licenseNumber || 'None / Pending'}
                    </div>
                  </div>

                  {licenseAlert ? (
                    <span className="badge badge-renewal">License Expiring</span>
                  ) : (
                    <span className="badge badge-active">LTO Valid</span>
                  )}
                </div>

                {/* Details */}
                <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PhoneIcon size={14} color="var(--accent-primary)" />
                    <span style={{ color: '#334155', fontWeight: 500 }}>{driver.contactNumber || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <HeartHandshakeIcon size={14} color="#dc2626" />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{driver.emergencyContact || 'None listed'}</span>
                  </div>
                  {driver.licenseExpiresAt && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CalendarIcon size={14} color="var(--text-muted)" />
                      <span>
                        Expiry:{' '}
                        <strong style={{ color: licenseAlert ? '#b45309' : '#334155' }}>
                          {driver.licenseExpiresAt}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Vehicle Assignment Dropdown */}
                <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
                    Assigned Unit
                  </label>
                  <select
                    className="select-field"
                    style={{ fontSize: '0.8125rem', padding: '6px 10px' }}
                    value={driver.vehicleId || ''}
                    onChange={(e) => onUpdateDriver(driver.id, { vehicleId: e.target.value || undefined })}
                  >
                    <option value="">Unassigned (Driver Pool)</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.bodyNumber} ({v.unitType} • {v.mtopNumber || 'No MTOP'})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      if (confirm(`Remove driver ${driver.fullName}?`)) {
                        onDeleteDriver(driver.id);
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
