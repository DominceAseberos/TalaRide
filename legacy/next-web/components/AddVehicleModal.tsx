'use client';

import React, { useState } from 'react';
import type { Vehicle, UnitType, VehicleStatus } from '@talaride/shared';
import { VehicleSchema } from '@talaride/shared';
import { CloseIcon } from './Icons';

interface AddVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVehicle: (vehicle: Omit<Vehicle, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>) => void;
}

export function AddVehicleModal({ isOpen, onClose, onAddVehicle }: AddVehicleModalProps) {
  const [bodyNumber, setBodyNumber] = useState('');
  const [unitType, setUnitType] = useState<UnitType>('tricycle');
  const [mtopNumber, setMtopNumber] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [mtopExpiresAt, setMtopExpiresAt] = useState('');
  const [inspectionDueAt, setInspectionDueAt] = useState('');
  const [status, setStatus] = useState<VehicleStatus>('active');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const payload = {
      bodyNumber: bodyNumber.trim().toUpperCase(),
      unitType,
      mtopNumber: mtopNumber.trim() || undefined,
      plateNumber: plateNumber.trim().toUpperCase() || undefined,
      mtopExpiresAt: mtopExpiresAt || undefined,
      inspectionDueAt: inspectionDueAt || undefined,
      status,
    };

    const validation = VehicleSchema.safeParse(payload);
    if (!validation.success) {
      setErrorMsg(validation.error.errors[0]?.message || 'Validation failed. Please check inputs.');
      return;
    }

    onAddVehicle(payload as any);
    // Reset form
    setBodyNumber('');
    setMtopNumber('');
    setPlateNumber('');
    setMtopExpiresAt('');
    setInspectionDueAt('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>Register New Fleet Unit</h3>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="input-label" htmlFor="input-body-num">
                Body Number *
              </label>
              <input
                id="input-body-num"
                type="text"
                className="input-field"
                placeholder="e.g. T-048"
                value={bodyNumber}
                onChange={(e) => setBodyNumber(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="input-label" htmlFor="input-unit-type">
                Unit Type *
              </label>
              <select
                id="input-unit-type"
                className="select-field"
                value={unitType}
                onChange={(e) => setUnitType(e.target.value as UnitType)}
              >
                <option value="tricycle">Tricycle</option>
                <option value="pedicab">Pedicab</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="input-label" htmlFor="input-mtop-num">
                MTOP Permit #
              </label>
              <input
                id="input-mtop-num"
                type="text"
                className="input-field"
                placeholder="MTOP-2026-0048"
                value={mtopNumber}
                onChange={(e) => setMtopNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="input-label" htmlFor="input-plate-num">
                Plate Number
              </label>
              <input
                id="input-plate-num"
                type="text"
                className="input-field"
                placeholder="7102-TC"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label className="input-label" htmlFor="input-mtop-expiry">
                MTOP Expiry Date
              </label>
              <input
                id="input-mtop-expiry"
                type="date"
                className="input-field"
                value={mtopExpiresAt}
                onChange={(e) => setMtopExpiresAt(e.target.value)}
              />
            </div>
            <div>
              <label className="input-label" htmlFor="input-inspection-due">
                Inspection Due Date
              </label>
              <input
                id="input-inspection-due"
                type="date"
                className="input-field"
                value={inspectionDueAt}
                onChange={(e) => setInspectionDueAt(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="input-label" htmlFor="input-status">
              Initial Compliance Status
            </label>
            <select
              id="input-status"
              className="select-field"
              value={status}
              onChange={(e) => setStatus(e.target.value as VehicleStatus)}
            >
              <option value="active">Active (Permitted)</option>
              <option value="for_renewal">For Renewal</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button id="btn-submit-vehicle" type="submit" className="btn btn-primary">
              Save Vehicle Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
