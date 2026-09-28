'use client';

import React, { useState } from 'react';
import type { Vehicle, Driver, VehicleStatus } from '@talaride/shared';
import { PlusIcon, CloseIcon } from './Icons';

interface VehiclesTableProps {
  vehicles: Vehicle[];
  drivers: Driver[];
  onUpdateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  onDeleteVehicle: (id: string) => void;
  onOpenAddModal: () => void;
}

export function VehiclesTable({
  vehicles,
  drivers,
  onUpdateVehicle,
  onDeleteVehicle,
  onOpenAddModal,
}: VehiclesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'tricycle' | 'pedicab'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | VehicleStatus>('all');

  const filtered = vehicles.filter((v) => {
    const matchesSearch =
      v.bodyNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.mtopNumber && v.mtopNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (v.plateNumber && v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterType === 'all' || v.unitType === filterType;
    const matchesStatus = filterStatus === 'all' || v.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getDriverForVehicle = (vehicleId: string) => {
    return drivers.find((d) => d.vehicleId === vehicleId);
  };

  const getStatusBadge = (status: VehicleStatus) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-active">Active</span>;
      case 'for_renewal':
        return <span className="badge badge-renewal">For Renewal</span>;
      case 'suspended':
        return <span className="badge badge-suspended">Suspended</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const cycleStatus = (vehicle: Vehicle) => {
    const nextStatusMap: Record<VehicleStatus, VehicleStatus> = {
      active: 'for_renewal',
      for_renewal: 'suspended',
      suspended: 'active',
    };
    onUpdateVehicle(vehicle.id, { status: nextStatusMap[vehicle.status] });
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      {/* Header & Filter Controls */}
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
            Vehicle Registry
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Digital inventory of franchised tricycles and pedicabs
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            id="vehicle-search-input"
            type="text"
            className="input-field"
            placeholder="Search Body #, MTOP, Plate..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '220px' }}
          />

          <select
            id="vehicle-type-filter"
            className="select-field"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            style={{ width: '130px' }}
          >
            <option value="all">All Units</option>
            <option value="tricycle">Tricycles</option>
            <option value="pedicab">Pedicabs</option>
          </select>

          <select
            id="vehicle-status-filter"
            className="select-field"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            style={{ width: '140px' }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="for_renewal">For Renewal</option>
            <option value="suspended">Suspended</option>
          </select>

          <button
            id="btn-table-add-vehicle"
            className="btn btn-primary btn-sm"
            onClick={onOpenAddModal}
          >
            <PlusIcon size={14} />
            <span>Register</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table" id="vehicles-registry-table">
          <thead>
            <tr>
              <th>Body #</th>
              <th>Type</th>
              <th>MTOP #</th>
              <th>Plate #</th>
              <th>Status</th>
              <th>MTOP Expiry</th>
              <th>Inspection Due</th>
              <th>Assigned Driver</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  No vehicles found matching current criteria.
                </td>
              </tr>
            ) : (
              filtered.map((vehicle) => {
                const driver = getDriverForVehicle(vehicle.id);
                return (
                  <tr key={vehicle.id} id={`vehicle-row-${vehicle.id}`}>
                    <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {vehicle.bodyNumber}
                    </td>
                    <td>
                      <span className={`badge ${vehicle.unitType === 'tricycle' ? 'badge-tricycle' : 'badge-pedicab'}`}>
                        {vehicle.unitType}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {vehicle.mtopNumber || '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                      {vehicle.plateNumber || '—'}
                    </td>
                    <td>
                      <button
                        onClick={() => cycleStatus(vehicle)}
                        title="Click to cycle status: Active -> For Renewal -> Suspended"
                        style={{ background: 'none', border: 'none', padding: 0 }}
                      >
                        {getStatusBadge(vehicle.status)}
                      </button>
                    </td>
                    <td>
                      {vehicle.mtopExpiresAt ? (
                        <span style={{ fontSize: '0.8125rem' }}>
                          {vehicle.mtopExpiresAt}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {vehicle.inspectionDueAt ? (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {vehicle.inspectionDueAt}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {driver ? (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{driver.fullName}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                            {driver.contactNumber}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontStyle: 'italic', fontSize: '0.8125rem' }}>
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => cycleStatus(vehicle)}
                          title="Change status"
                        >
                          Toggle Status
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            if (confirm(`Remove vehicle ${vehicle.bodyNumber}?`)) {
                              onDeleteVehicle(vehicle.id);
                            }
                          }}
                          title="Delete vehicle record"
                        >
                          <CloseIcon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
