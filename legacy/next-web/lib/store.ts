'use client';

import { useState, useEffect } from 'react';
import type { Vehicle, Driver, Organization } from '@talaride/shared';
import { INITIAL_ORGANIZATION, INITIAL_VEHICLES, INITIAL_DRIVERS } from './mock-data';

const STORAGE_KEY_VEHICLES = 'talaride_fleet_vehicles_v1';
const STORAGE_KEY_DRIVERS = 'talaride_fleet_drivers_v1';
const STORAGE_KEY_ORG = 'talaride_fleet_org_v1';

export function useFleetStore() {
  const [organization, setOrganization] = useState<Organization>(INITIAL_ORGANIZATION);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize from localStorage or fallback to initial seed
  useEffect(() => {
    try {
      const storedOrg = localStorage.getItem(STORAGE_KEY_ORG);
      const storedVehicles = localStorage.getItem(STORAGE_KEY_VEHICLES);
      const storedDrivers = localStorage.getItem(STORAGE_KEY_DRIVERS);

      if (storedOrg) setOrganization(JSON.parse(storedOrg));
      else setOrganization(INITIAL_ORGANIZATION);

      if (storedVehicles) setVehicles(JSON.parse(storedVehicles));
      else {
        setVehicles(INITIAL_VEHICLES);
        localStorage.setItem(STORAGE_KEY_VEHICLES, JSON.stringify(INITIAL_VEHICLES));
      }

      if (storedDrivers) setDrivers(JSON.parse(storedDrivers));
      else {
        setDrivers(INITIAL_DRIVERS);
        localStorage.setItem(STORAGE_KEY_DRIVERS, JSON.stringify(INITIAL_DRIVERS));
      }
    } catch {
      setVehicles(INITIAL_VEHICLES);
      setDrivers(INITIAL_DRIVERS);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveVehicles = (newVehicles: Vehicle[]) => {
    setVehicles(newVehicles);
    try {
      localStorage.setItem(STORAGE_KEY_VEHICLES, JSON.stringify(newVehicles));
    } catch (e) {
      console.error('Failed to persist vehicles:', e);
    }
  };

  const saveDrivers = (newDrivers: Driver[]) => {
    setDrivers(newDrivers);
    try {
      localStorage.setItem(STORAGE_KEY_DRIVERS, JSON.stringify(newDrivers));
    } catch (e) {
      console.error('Failed to persist drivers:', e);
    }
  };

  const addVehicle = (input: Omit<Vehicle, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>) => {
    const newVehicle: Vehicle = {
      ...input,
      id: 'veh-' + Date.now(),
      organizationId: organization.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveVehicles([newVehicle, ...vehicles]);
    return newVehicle;
  };

  const updateVehicle = (id: string, updates: Partial<Vehicle>) => {
    const updated = vehicles.map((v) =>
      v.id === id ? { ...v, ...updates, updatedAt: new Date().toISOString() } : v
    );
    saveVehicles(updated);
  };

  const deleteVehicle = (id: string) => {
    saveVehicles(vehicles.filter((v) => v.id !== id));
    // Unassign any driver attached to this vehicle
    const updatedDrivers = drivers.map((d) => (d.vehicleId === id ? { ...d, vehicleId: undefined } : d));
    saveDrivers(updatedDrivers);
  };

  const addDriver = (input: Omit<Driver, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>) => {
    const newDriver: Driver = {
      ...input,
      id: 'drv-' + Date.now(),
      organizationId: organization.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveDrivers([newDriver, ...drivers]);
    return newDriver;
  };

  const updateDriver = (id: string, updates: Partial<Driver>) => {
    const updated = drivers.map((d) =>
      d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
    );
    saveDrivers(updated);
  };

  const deleteDriver = (id: string) => {
    saveDrivers(drivers.filter((d) => d.id !== id));
  };

  const resetToDemoData = () => {
    saveVehicles(INITIAL_VEHICLES);
    saveDrivers(INITIAL_DRIVERS);
    setOrganization(INITIAL_ORGANIZATION);
    localStorage.setItem(STORAGE_KEY_ORG, JSON.stringify(INITIAL_ORGANIZATION));
  };

  // Compliance calculations
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(now.getDate() + 30);

  const mtopRenewalAlerts = vehicles.filter((v) => {
    if (!v.mtopExpiresAt) return false;
    const exp = new Date(v.mtopExpiresAt);
    return exp <= thirtyDaysFromNow;
  });

  const inspectionAlerts = vehicles.filter((v) => {
    if (!v.inspectionDueAt) return false;
    const due = new Date(v.inspectionDueAt);
    return due <= thirtyDaysFromNow;
  });

  const licenseRenewalAlerts = drivers.filter((d) => {
    if (!d.licenseExpiresAt) return false;
    const exp = new Date(d.licenseExpiresAt);
    return exp <= thirtyDaysFromNow;
  });

  const exportComplianceCSV = () => {
    const headers = [
      'Body Number',
      'Unit Type',
      'Status',
      'MTOP Number',
      'Plate Number',
      'MTOP Expiry',
      'Inspection Due',
      'Assigned Driver',
      'Driver License',
      'Driver License Expiry',
      'Driver Contact',
    ];

    const rows = vehicles.map((v) => {
      const assignedDriver = drivers.find((d) => d.vehicleId === v.id);
      return [
        `"${v.bodyNumber}"`,
        `"${v.unitType}"`,
        `"${v.status}"`,
        `"${v.mtopNumber || 'N/A'}"`,
        `"${v.plateNumber || 'N/A'}"`,
        `"${v.mtopExpiresAt || 'N/A'}"`,
        `"${v.inspectionDueAt || 'N/A'}"`,
        `"${assignedDriver ? assignedDriver.fullName : 'Unassigned'}"`,
        `"${assignedDriver?.licenseNumber || 'N/A'}"`,
        `"${assignedDriver?.licenseExpiresAt || 'N/A'}"`,
        `"${assignedDriver?.contactNumber || 'N/A'}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `TalaRide_Fleet_Compliance_${organization.municipality}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
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
  };
}
