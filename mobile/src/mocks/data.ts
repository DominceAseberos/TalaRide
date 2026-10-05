import type { LostRequest, Ride } from '@/types/models';
export const initialRides: Ride[] = [
  ['1234', '2024-05-20T14:15:00+08:00'],
  ['5678', '2024-05-19T09:43:00+08:00'],
  ['9012', '2024-05-18T18:20:00+08:00'],
  ['3456', '2024-05-16T13:05:00+08:00'],
  ['7788', '2024-05-14T11:12:00+08:00'],
  ['2468', '2024-05-12T08:30:00+08:00'],
  ['1357', '2024-05-11T16:20:00+08:00'],
  ['4321', '2024-05-10T10:00:00+08:00'],
  ['8765', '2024-05-09T07:45:00+08:00'],
  ['1122', '2024-05-08T12:10:00+08:00'],
  ['3344', '2024-05-07T15:30:00+08:00'],
  ['5566', '2024-05-06T09:15:00+08:00'],
].map(([number, date]) => ({
  id: number,
  number,
  date,
  identifier: 'MTOP',
  note: '',
  location: '',
}));
export const initialRequests: LostRequest[] = [];
export function formatDate(date: string) {
  const value = new Date(date);
  return `${value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}
