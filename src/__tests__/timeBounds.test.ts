import { generateTimetableWithRoutes } from '../lib';

function isValidTime(hhmm: string | null): boolean {
  if (!hhmm) return true; // allow null arrivals
  const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

describe('Timetable time bounds', () => {
  it('never exceeds 23:59 for arrivals/departures', () => {
    const stations = [
      { id: 1, name: 'A', lat: 28.6, lng: 77.2 },
      { id: 2, name: 'B', lat: 26.4, lng: 80.3 },
      { id: 3, name: 'C', lat: 22.6, lng: 88.3 }
    ];
    const plans = [
      { name: 'Express 1', startStation: 'A', endStation: 'C', speed: 120, priority: 1, startTime: '08:00', autoReroute: true },
      { name: 'Local 1', startStation: 'C', endStation: 'A', speed: 80, priority: 2, startTime: '08:05', autoReroute: false },
      { name: 'Freight 1', startStation: 'A', endStation: 'B', speed: 60, priority: 3, startTime: '08:10', autoReroute: false }
    ];
    const tt = generateTimetableWithRoutes(stations as any, plans as any, { headway: 5, stationDwellTime: 2, safetyMargin: 3 });
    for (const train of Object.values(tt.timetable)) {
      for (const times of Object.values(train.stations)) {
        expect(isValidTime((times as any).arrival)).toBe(true);
        expect(isValidTime((times as any).departure)).toBe(true);
      }
    }
  });
});


