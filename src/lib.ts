export type Station = { id: number; name: string; lat: number; lng: number };
export type Train = { name: string; speed: number; priority: number; startTime: string };
export type Timetable = { timetable: Record<string, { stations: Record<string, { arrival: string | null; departure: string | null }> }> };
export type TrainPlan = {
  name: string;
  speed: number;
  priority: number;
  startTime: string;
  startStation: string;
  endStation: string;
  autoReroute?: boolean;
};

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function timeToMinutes(timeStr: string): number {
  const [h,m] = timeStr.split(':').map(Number);
  return h*60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

export function pushTrainFromStation(tt: Timetable, trainName: string, fromStation: string, delta: number) {
  const entries = tt.timetable[trainName].stations;
  let pushing = false;
  Object.keys(entries).forEach(sn => {
    if (sn === fromStation) pushing = true;
    if (pushing) {
      const e = entries[sn];
      if (e.arrival) e.arrival = minutesToTime(timeToMinutes(e.arrival) + delta);
      if (e.departure) e.departure = minutesToTime(timeToMinutes(e.departure) + delta);
    }
  });
}

export function resolveConflicts(tt: Timetable, trains: Train[], headway: number, stations: Station[]) {
  const priority: Record<string, number> = {};
  trains.forEach(t => { priority[t.name] = typeof t.priority === 'number' ? t.priority : 999; });
  const trainNames = Object.keys(tt.timetable);
  const stationOrder = stations.map(s => s.name);
  stationOrder.forEach(st => {
    const deps: { train: string; dep: number }[] = [];
    trainNames.forEach(tn => {
      const e = tt.timetable[tn].stations[st];
      if (e?.departure) deps.push({ train: tn, dep: timeToMinutes(e.departure) });
    });
    deps.sort((a,b) => a.dep - b.dep);
    for (let i=1;i<deps.length;i++) {
      const prev = deps[i-1];
      const curr = deps[i];
      if (curr.dep - prev.dep < headway) {
        const pPrev = priority[prev.train] ?? 999;
        const pCurr = priority[curr.train] ?? 999;
        const toDelay = pPrev <= pCurr ? curr : prev;
        const need = headway - (curr.dep - prev.dep);
        pushTrainFromStation(tt, toDelay.train, st, need);
        toDelay.dep += need;
      }
    }
  });
}

export function generateLocalTimetable(stations: Station[], trains: Train[], constraints: { headway: number; stationDwellTime: number; safetyMargin: number }): Timetable {
  const headway = constraints.headway || 5;
  const dwellTime = constraints.stationDwellTime || 2;
  const safetyMargin = constraints.safetyMargin || 3;
  const tt: Timetable = { timetable: {} };
  trains.forEach((train, idx) => {
    const speed = train.speed || 80;
    const startMinutes = timeToMinutes(train.startTime || '08:00') + (idx * headway);
    tt.timetable[train.name] = { stations: {} };
    stations.forEach((st, sIdx) => {
      if (sIdx === 0) {
        tt.timetable[train.name].stations[st.name] = { arrival: null, departure: minutesToTime(startMinutes) };
      } else {
        const prev = stations[sIdx - 1];
        const dist = calculateDistance(prev.lat, prev.lng, st.lat, st.lng);
        const travel = Math.round((dist / speed) * 60) + safetyMargin;
        const arr = minutesToTime(startMinutes + (sIdx * travel) + (sIdx * dwellTime));
        const dep = minutesToTime(startMinutes + (sIdx * travel) + (sIdx * dwellTime) + dwellTime);
        tt.timetable[train.name].stations[st.name] = { arrival: arr, departure: dep };
      }
    });
  });
  resolveConflicts(tt, trains, headway, stations);
  return tt;
}

// Simple route-aware generator: respects per-train start/end along the given stations order.
// Chooses forward or reverse path to minimize shared segment usage for higher-priority trains when autoReroute is true.
export function generateTimetableWithRoutes(
  stations: Station[],
  plans: TrainPlan[],
  constraints: { headway: number; stationDwellTime: number; safetyMargin: number }
): Timetable {
  const headway = constraints.headway || 5;
  const dwellTime = constraints.stationDwellTime || 2;
  const safetyMargin = constraints.safetyMargin || 3;
  const stationNames = stations.map(s => s.name);
  const indexOf = (name: string) => stationNames.indexOf(name);
  const tt: Timetable = { timetable: {} };

  // Track segment occupancy by key "A|B" with time windows for conflict estimation
  const segmentUsages: Record<string, Array<{ start: number; end: number }>> = {};
  const segmentKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const addUsage = (a: string, b: string, start: number, end: number) => {
    const key = segmentKey(a, b);
    if (!segmentUsages[key]) segmentUsages[key] = [];
    segmentUsages[key].push({ start, end });
  };
  const countOverlap = (a: string, b: string, start: number, end: number) => {
    const key = segmentKey(a, b);
    const list = segmentUsages[key] || [];
    return list.filter(w => !(end <= w.start || start >= w.end)).length;
  };

  // Higher priority first to grant better paths
  const sortedPlans = [...plans].sort((p1, p2) => p1.priority - p2.priority);

  sortedPlans.forEach((plan, idx) => {
    const speed = plan.speed || 80;
    const startIdx = indexOf(plan.startStation);
    const endIdx = indexOf(plan.endStation);
    if (startIdx === -1 || endIdx === -1) return;
    const forward = startIdx <= endIdx;
    const pathForward = forward ? stations.slice(startIdx, endIdx + 1) : stations.slice(endIdx, startIdx + 1);
    const pathReverse = [...pathForward].slice().reverse();

    // Estimate conflicts for both directions if autoReroute
    const evaluatePath = (path: Station[]) => {
      let t = timeToMinutes(plan.startTime || '08:00') + (idx * headway);
      let conflicts = 0;
      for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const curr = path[i];
        const dist = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
        const travel = Math.round((dist / speed) * 60) + safetyMargin;
        const arr = t + travel;
        conflicts += countOverlap(prev.name, curr.name, t, arr);
        t = arr + dwellTime;
      }
      return conflicts;
    };

    const chosenPath = plan.autoReroute ? (evaluatePath(pathForward) <= evaluatePath(pathReverse) ? pathForward : pathReverse) : pathForward;

    // Build timetable entries and record segment usages
    tt.timetable[plan.name] = { stations: {} };
    let t = timeToMinutes(plan.startTime || '08:00') + (idx * headway);
    chosenPath.forEach((st, i) => {
      if (i === 0) {
        tt.timetable[plan.name].stations[st.name] = { arrival: null, departure: minutesToTime(t) };
      } else {
        const prev = chosenPath[i - 1];
        const dist = calculateDistance(prev.lat, prev.lng, st.lat, st.lng);
        const travel = Math.round((dist / speed) * 60) + safetyMargin;
        const arr = t + travel;
        tt.timetable[plan.name].stations[st.name] = { arrival: minutesToTime(arr), departure: minutesToTime(arr + dwellTime) };
        addUsage(prev.name, st.name, t, arr);
        t = arr + dwellTime;
      }
    });
  });

  // Resolve overlaps using existing conflict logic (delays lower-priority trains)
  const trainsAsBasic: Train[] = plans.map(p => ({ name: p.name, speed: p.speed, priority: p.priority, startTime: p.startTime }));
  resolveConflicts(tt, trainsAsBasic, headway, stations);
  return tt;
}

// Build a small square polygon WKT around a point (approximate buffer) in meters
export function createSquareWKT(lat: number, lng: number, radiusMeters: number): string {
  const dLat = radiusMeters / 111320; // meters per degree latitude
  const dLng = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180));
  const p = [
    [lng - dLng, lat - dLat],
    [lng - dLng, lat + dLat],
    [lng + dLng, lat + dLat],
    [lng + dLng, lat - dLat],
    [lng - dLng, lat - dLat]
  ];
  const coords = p.map(([x,y]) => `${x} ${y}`).join(',');
  return `POLYGON ((${coords}))`;
}

// Woosmap integration removed (paid/limited). Kept helpers above if needed.

// ===== Pravah – Optimization helpers =====

export type ScenarioMetrics = {
  name: string;
  totalDelayMin: number;
  throughput: number; // trains that reached last station in their path
  avgPunctualityMin: number; // average absolute arrival delay at final station
};

function getFinalArrival(tt: Timetable, trainName: string): string | null {
  const stations = tt.timetable?.[trainName]?.stations;
  if (!stations) return null;
  const keys = Object.keys(stations);
  if (keys.length === 0) return null;
  const last = stations[keys[keys.length - 1]];
  return last.arrival || last.departure || null;
}

export function compareScenarios(base: Timetable, scenarios: Array<{ name: string; timetable: Timetable }>): ScenarioMetrics[] {
  const trainNames = Object.keys(base.timetable);
  return scenarios.map(scn => {
    let totalDelay = 0;
    let count = 0;
    let reached = 0;
    trainNames.forEach(tn => {
      const baseArr = getFinalArrival(base, tn);
      const scnArr = getFinalArrival(scn.timetable, tn);
      if (baseArr && scnArr) {
        const d = timeToMinutes(scnArr) - timeToMinutes(baseArr);
        totalDelay += Math.max(0, d);
        reached += 1;
        count += 1;
      }
    });
    const avgPunctuality = count > 0 ? totalDelay / count : 0;
    return { name: scn.name, totalDelayMin: Math.round(totalDelay), throughput: reached, avgPunctualityMin: Math.round(avgPunctuality) };
  });
}

export function suggestOptimizedSchedule(
  current: Timetable,
  stations: Station[],
  trains: Train[],
  options: { headway?: number; maxShiftMin?: number } = {}
): Timetable {
  // Simple heuristic: resolve conflicts again and then shift lower-priority train departures at their first station by small increments
  const headway = options.headway ?? 5;
  const maxShift = options.maxShiftMin ?? 10;
  const out: Timetable = JSON.parse(JSON.stringify(current));
  // Count conflicts per train on station departures
  const stationOrder = stations.map(s => s.name);
  const priority: Record<string, number> = {};
  trains.forEach(t => { priority[t.name] = typeof t.priority === 'number' ? t.priority : 999; });
  const conflictsCount: Record<string, number> = {};
  stationOrder.forEach(st => {
    const deps: { train: string; dep: number }[] = [];
    Object.keys(out.timetable).forEach(tn => {
      const e = out.timetable[tn].stations[st];
      if (e?.departure) deps.push({ train: tn, dep: timeToMinutes(e.departure) });
    });
    deps.sort((a,b) => a.dep - b.dep);
    for (let i=1;i<deps.length;i++) {
      const prev = deps[i-1];
      const curr = deps[i];
      if (curr.dep - prev.dep < headway) {
        const pPrev = priority[prev.train] ?? 999;
        const pCurr = priority[curr.train] ?? 999;
        const loser = pPrev <= pCurr ? curr.train : prev.train;
        conflictsCount[loser] = (conflictsCount[loser] || 0) + 1;
      }
    }
  });
  // Apply shifts to frequent losers
  Object.keys(conflictsCount).forEach(tn => {
    const shift = Math.min(maxShift, 2 * conflictsCount[tn]);
    const firstStation = Object.keys(out.timetable[tn].stations)[0];
    if (firstStation) pushTrainFromStation(out, tn, firstStation, shift);
  });
  // Final pass resolve conflicts
  resolveConflicts(out, trains, headway, stations);
  return out;
}

// ===== RailRadar API Types & Helpers (client-side) =====

export type RailRadarStation = { code: string; name: string; lat?: number; lng?: number };
export type RailRadarTrainLite = { trainNumber: string; name: string; type: 'EXPRESS'|'LOCAL'|'FREIGHT'|string };
export type RailRadarStop = { stationCode: string; stationName: string; arrival: string|null; departure: string|null };
export type RailRadarSchedule = { trainNumber: string; journeyDate: string; stops: RailRadarStop[] };
export type RailRadarLiveTrain = { trainNumber: string; name: string; type: string; lat: number; lng: number; lastStation?: string; nextStation?: string; delayMin?: number };
export type RailRadarAverageDelay = { trainNumber: string; avgArrivalDelayMin: number; avgDepartureDelayMin: number };
export type RailRadarStationLive = { stationCode: string; arrivals: Array<{ trainNumber: string; due: string; delayMin: number }>; departures: Array<{ trainNumber: string; due: string; delayMin: number }>; };

function getApiBase(): string {
  // Prefer env var; fallback to relative (same origin proxy)
  // Configure Vite env: VITE_RAILRADAR_BASE
  const v = (import.meta as any).env?.VITE_RAILRADAR_BASE as string | undefined;
  // When running locally with Vite proxy, force relative paths to avoid CORS
  if (typeof window !== 'undefined' && window.location.origin.includes('localhost')) return '';
  return v || '';
}

function getApiKey(): string | undefined {
  const v = (import.meta as any).env?.VITE_RAILRADAR_KEY as string | undefined;
  const w = (window as any).__RR_KEY as string | undefined;
  return v || w;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path}`;
  const key = getApiKey();
  const defaultHeaders: Record<string, string> = { 'Accept': 'application/json' };
  if (key) {
    // Try both common patterns; server can ignore extras
    defaultHeaders['Authorization'] = `Bearer ${key}`;
    defaultHeaders['x-api-key'] = key;
  }
  const res = await fetch(url, { ...init, headers: { ...defaultHeaders, ...(init?.headers||{}) } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

export const railRadar = {
  searchStations: (query: string) => apiFetch<RailRadarStation[]>(`/search/stations?query=${encodeURIComponent(query)}`),
  searchTrains: (query: string) => apiFetch<RailRadarTrainLite[]>(`/search/trains?query=${encodeURIComponent(query)}`),
  getTrainSchedule: (trainNumber: string, dateISO: string) => apiFetch<RailRadarSchedule>(`/trains/${encodeURIComponent(trainNumber)}/schedule?journeyDate=${encodeURIComponent(dateISO)}`),
  getLiveMap: (trainType: string = 'ALL') => apiFetch<RailRadarLiveTrain[]>(`/trains/live-map?trainType=${encodeURIComponent(trainType)}`),
  getAverageDelay: (trainNumber: string) => apiFetch<RailRadarAverageDelay>(`/trains/${encodeURIComponent(trainNumber)}/average-delay`),
  getStationLive: (stationCode: string) => apiFetch<RailRadarStationLive>(`/stations/${encodeURIComponent(stationCode)}/live`)
};

export async function generateTimetableFromAPI(trainNumber: string, dateISO: string): Promise<Timetable> {
  const sched = await railRadar.getTrainSchedule(trainNumber, dateISO);
  const tt: Timetable = { timetable: {} };
  tt.timetable[trainNumber] = { stations: {} };
  sched.stops.forEach(s => {
    tt.timetable[trainNumber].stations[s.stationName] = { arrival: s.arrival, departure: s.departure };
  });
  return tt;
}

export function resolveConflictsWithLiveData(current: Timetable, live: RailRadarLiveTrain[], stations: Station[]): { updated: Timetable; conflicts: Array<{ seg: string; trains: string[] }> } {
  // Map live trains to segments by nearest two stations on the corridor; then apply priority
  const stationNames = stations.map(s => s.name);
  const segKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const onSeg: Record<string, string[]> = {};
  live.forEach(t => {
    const last = t.lastStation; const next = t.nextStation;
    if (!last || !next) return;
    if (!stationNames.includes(last) || !stationNames.includes(next)) return;
    const key = segKey(last, next);
    (onSeg[key] ||= []).push(t.trainNumber);
  });
  const conflicts: Array<{ seg: string; trains: string[] }> = [];
  Object.entries(onSeg).forEach(([key, list]) => {
    if (list.length > 1) conflicts.push({ seg: key, trains: list });
  });
  // For simplicity, reuse priority by name heuristic and push small delay for non-express
  const out: Timetable = JSON.parse(JSON.stringify(current));
  conflicts.forEach(c => {
    const losers = [...c.trains].sort((a,b) => {
      const la = (a.toLowerCase().includes('express') ? 1 : a.toLowerCase().includes('local') ? 2 : 3);
      const lb = (b.toLowerCase().includes('express') ? 1 : b.toLowerCase().includes('local') ? 2 : 3);
      return la - lb;
    }).slice(1);
    losers.forEach(tn => {
      const firstStation = Object.keys(out.timetable?.[tn]?.stations || {})[0];
      if (firstStation) pushTrainFromStation(out, tn, firstStation, 2);
    });
  });
  return { updated: out, conflicts };
}

