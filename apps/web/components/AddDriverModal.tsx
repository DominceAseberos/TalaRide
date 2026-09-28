'use client';

import React, { useState } from 'react';
import type { Driver, Vehicle } from '@talaride/shared';
import { DriverSchema } from '@talaride/shared';
import { CloseIcon } from './Icons';

interface AddDriverModalProps {
  isOpen: boolean;
  vehicles: Vehicle[];
  onClose: () => void;
  onAddDriver: (driver: Omit<Driver, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>) => void;
}

export function AddDriverModal({ isOpen, vehicles, onClose, onAddDriver }: AddDriverModalProps) {
  const [fullName, setFullName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiresAt, setLicenseExpiresAt] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const payload = {
      fullName: fullName.trim(),
      licenseNumber: licenseNumber.trim().toUpperCase() || undefined,
      licenseExpiresAt: licenseExpiresAt || undefined,
      contactNumber: contactNumber.trim() || undefined,
      emergencyContact: emergencyContact.trim() || undefined,
      vehicleId: vehicleId || undefined,
    };

    const validation = DriverSchema.safeParse(payload);
    if (!validation.success) {
      setErrorMsg(validation.error.errors[0]?.message || 'Validation failed. Please check inputs.');
      return;
    }

    onAddDriver(payload as any);
    // Reset form
    setFullName('');
    setLicenseNumber('');
    setLicenseExpiresAt('');
    setContactNumber('');
    setEmergencyContact('');
    setVehicleId('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>Add Driver Record</h3>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
            <CloseIcon size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="callout callout-danger" style={{ marginBottom: '16px', fontSize: '0.8125rem', color: '#dc3545', fontWeight: 500 }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="input-label" htmlFor="input-driver-name">
              Full Legal Name *
            </label>
            <input
              id="input-driver-name"
              type="text"
              className="input-field"
              placeholder="e.g. Danilo C. Santos"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="input-label" htmlFor="input-driver-license">
                LTO License Number
              </label>
              <input
                id="input-driver-license"
                type="text"
                className="input-field"
                placeholder="N02-14-082914"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="input-label" htmlFor="input-license-expiry">
                License Expiry Date
              </label>
              <input
                id="input-license-expiry"
                type="date"
                className="input-field"
                value={licenseExpiresAt}
                onChange={(e) => setLicenseExpiresAt(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="input-label" htmlFor="input-driver-contact">
                Contact Mobile #
              </label>
              <input
                id="input-driver-contact"
                type="text"
                className="input-field"
                placeholder="+63 917 555 0192"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="input-label" htmlFor="input-driver-vehicle">
                Assign Unit (Optional)
              </label>
              <select
                id="input-driver-vehicle"
                className="select-field"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
              >
                <option value="">None (Driver Pool)</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.bodyNumber} ({v.unitType})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="input-label" htmlFor="input-driver-emergency">
              Emergency Contact (Name & Phone)
            </label>
            <input
              id="input-driver-emergency"
              type="text"
              className="input-field"
              placeholder="e.g. Elena Santos (Wife) - 0917-555-0193"
              value={emergencyContact}
              onChange={(e) => setEmergencyContact(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button id="btn-submit-driver" type="submit" className="btn btn-primary">
              Save Driver Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
