'use client';

import React, { useState } from 'react';
import { useFleetStore } from '../lib/store';
import { Sidebar, type TabType } from '../components/Sidebar';
import { Header } from '../components/Header';
import { StatsCards } from '../components/StatsCards';
import { VehiclesTable } from '../components/VehiclesTable';
import { DriversList } from '../components/DriversList';
import { ComplianceView } from '../components/ComplianceView';
import { AddVehicleModal } from '../components/AddVehicleModal';
import { AddDriverModal } from '../components/AddDriverModal';
import { CheckCircleIcon } from '../components/Icons';

export default function FleetDashboardPage() {
  const {
    organization,
    vehicles,
    drivers,
    isLoaded,
    addVehicle,
    updateVehicle,
    deleteVehicle,
    addDriver,
    updateDriver,
    deleteDriver,
    resetToDemoData,
    mtopRenewalAlerts,
    inspectionAlerts,
    licenseRenewalAlerts,
    exportComplianceCSV,
  } = useFleetStore();

  const [currentTab, setCurrentTab] = useState<TabType>('overview');
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isAddDriverOpen, setIsAddDriverOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddVehicle = (data: any) => {
    const v = addVehicle(data);
    showToast(`Vehicle ${v.bodyNumber} registered successfully!`);
  };

  const handleAddDriver = (data: any) => {
    const d = addDriver(data);
    showToast(`Driver ${d.fullName} profile created!`);
  };

  const totalAlerts =
    mtopRenewalAlerts.length +
    inspectionAlerts.length +
    licenseRenewalAlerts.length;

  if (!isLoaded) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: 'var(--accent-primary)',
          fontWeight: 600,
          background: 'var(--bg-primary)',
        }}
      >
        Loading TalaRide Fleet Portal...
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'var(--accent-success)',
            color: '#ffffff',
            padding: '12px 18px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: '0.875rem',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircleIcon size={18} color="#ffffff" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        vehicleCount={vehicles.length}
        driverCount={drivers.length}
        alertCount={totalAlerts}
      />

      {/* Main Content Area */}
      <main className="main-content">
        <Header
          organization={organization}
          onOpenAddVehicle={() => setIsAddVehicleOpen(true)}
          onOpenAddDriver={() => setIsAddDriverOpen(true)}
          onExportCSV={() => {
            exportComplianceCSV();
            showToast('LGU Compliance CSV report downloaded!');
          }}
          onResetDemo={() => {
            resetToDemoData();
            showToast('Sample fleet records reloaded!');
          }}
        />

        {/* Tab 1: Overview Dashboard */}
        {currentTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <StatsCards
              vehicles={vehicles}
              drivers={drivers}
              mtopRenewalCount={mtopRenewalAlerts.length}
              inspectionAlertCount={inspectionAlerts.length}
            />

            {/* Quick-Action Vehicles Overview */}
            <VehiclesTable
              vehicles={vehicles}
              drivers={drivers}
              onUpdateVehicle={updateVehicle}
              onDeleteVehicle={(id) => {
                deleteVehicle(id);
                showToast('Vehicle deleted');
              }}
              onOpenAddModal={() => setIsAddVehicleOpen(true)}
            />
          </div>
        )}

        {/* Tab 2: Full Vehicle Registry */}
        {currentTab === 'vehicles' && (
          <VehiclesTable
            vehicles={vehicles}
            drivers={drivers}
            onUpdateVehicle={updateVehicle}
            onDeleteVehicle={(id) => {
              deleteVehicle(id);
              showToast('Vehicle deleted');
            }}
            onOpenAddModal={() => setIsAddVehicleOpen(true)}
          />
        )}

        {/* Tab 3: Driver Directory */}
        {currentTab === 'drivers' && (
          <DriversList
            drivers={drivers}
            vehicles={vehicles}
            onUpdateDriver={updateDriver}
            onDeleteDriver={(id) => {
              deleteDriver(id);
              showToast('Driver record removed');
            }}
            onOpenAddModal={() => setIsAddDriverOpen(true)}
          />
        )}

        {/* Tab 4: Compliance & Alerts */}
        {currentTab === 'compliance' && (
          <ComplianceView
            vehicles={vehicles}
            drivers={drivers}
            onExportCSV={() => {
              exportComplianceCSV();
              showToast('LGU Compliance CSV report downloaded!');
            }}
          />
        )}
      </main>

      {/* Modals */}
      <AddVehicleModal
        isOpen={isAddVehicleOpen}
        onClose={() => setIsAddVehicleOpen(false)}
        onAddVehicle={handleAddVehicle}
      />

      <AddDriverModal
        isOpen={isAddDriverOpen}
        vehicles={vehicles}
        onClose={() => setIsAddDriverOpen(false)}
        onAddDriver={handleAddDriver}
      />
    </div>
  );
}
