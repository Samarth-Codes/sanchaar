import { useEffect, useState } from 'react';
import MapView from '../components/MapView';
import Controls from '../components/Controls';
import TimetableView from '../components/Timetable';
import TrackPanel from '../components/TrackPanel';
import type { Station, Timetable } from '../lib';
import { calculateDistance } from '../lib';
import L from 'leaflet';

export default function Scheduler() {
  const [stations, setStations] = useState<Station[]>([]);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [scenario, setScenario] = useState<Timetable | null>(null);
  const [status, setStatusState] = useState<{msg: string; type: 'success'|'error'|'info'} | null>(null);
  const [map, setMap] = useState<L.Map | null>(null as any);
  const [speed, setSpeed] = useState(0.5);
  const [catalogStations, setCatalogStations] = useState<{ name: string; lat: number; lng: number }[]>([]);
  // removed What-If scenario trains; simulation derives from timetable

  // plans are configured in Controls; no basePlans needed here

  const setStatus = (msg: string, type: 'success'|'error'|'info' = 'info') => setStatusState({ msg, type });
  const onAddStation = (s: Station) => setStations(prev => [...prev, s]);
  const active = timetable;
  const [simInfo, setSimInfo] = useState<{ total: number; moving: number; paused: number; clockMin: number; waitingByReason: Record<string, number> }>({ total: 0, moving: 0, paused: 0, clockMin: 0, waitingByReason: {} });

  useEffect(() => {
    (window as any).__app = { map, stations, scenario, timetable, speed, animWrappers: [], animMarkers: [], sim: null, setStatus };
  }, [map, stations, scenario, timetable, speed]);

  // live stats from animation state
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      try {
        const app = (window as any).__app as any;
        const states: TrainState[] = app?.sim?.states || [];
        const total = states.length;
        let moving = 0, paused = 0;
        const waitingByReason: Record<string, number> = {};
        states.forEach(st => {
          if (st.paused) { paused++; waitingByReason[st.waitReason || 'Waiting'] = (waitingByReason[st.waitReason || 'Waiting'] || 0) + 1; }
          else moving++;
        });
        const clockMin = Math.max(0, Math.round((app?.sim?.clock || 0)));
        setSimInfo({ total, moving, paused, clockMin, waitingByReason });
      } catch {}
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    fetch('/rail/stations.json').then(r => r.json()).then((data) => {
      if (Array.isArray(data)) setCatalogStations(data);
    }).catch(() => {});
    setStations([
      { id: 1, name: 'New Delhi', lat: 28.6139, lng: 77.2090 },
      { id: 2, name: 'Kanpur Central', lat: 26.4499, lng: 80.3319 },
      { id: 3, name: 'Howrah Junction', lat: 22.5958, lng: 88.2636 },
      { id: 4, name: 'Mumbai Central', lat: 18.9696, lng: 72.8194 },
      { id: 5, name: 'Chennai Central', lat: 13.0827, lng: 80.2757 },
      { id: 6, name: 'Bengaluru City', lat: 12.9716, lng: 77.5946 }
    ]);
  }, []);

  return (
    <main className="px-6 py-8 lg:px-10 xl:px-16 flex-1 bg-white">
      <div className="max-w-7xl mx-auto">
        <div id="about" className="flex border-b border-gray-200 gap-2">
          <button className="px-4 py-3 text-xs font-bold tracking-wider border-b-2 border-sky-600 text-sky-700 bg-white">Live Schedule</button>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div id="scheduler" className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-2 text-slate-800">Route Planning</h3>
              <div className="max-h-40 overflow-y-auto bg-gray-50 p-2 rounded text-slate-700">
                {stations.length === 0 ? <div className="italic text-slate-500">No stations selected yet</div> : stations.map((s, idx) => (
                  <div key={`${s.id}-${s.lat}-${s.lng}-${idx}`}> <b>{s.id}.</b> {s.name} <br/><small className="text-slate-600">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</small></div>
                ))}
              </div>
              <button className="mt-2 text-sm px-3 py-2 rounded-md bg-slate-200 text-slate-800 hover:bg-slate-100 border border-gray-300" onClick={() => { setStations([]); setTimetable(null); setScenario(null); }}>Clear All Stations</button>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <Controls stations={stations} catalogStations={catalogStations} onTimetable={tt => { setTimetable(tt); }} setStatus={setStatus} onSearchSelect={(name, coords) => {
                const addStation = (lat: number, lng: number) => {
                  const newStation: Station = { id: (stations[stations.length - 1]?.id ?? 0) + 1, name, lat, lng } as any;
                  setStations(prev => [...prev, newStation]);
                  if (map) map.setView([lat, lng], 9);
                };
                const existing = stations.find(s => s.name.toLowerCase() === name.toLowerCase())
                  || catalogStations.find(s => s.name.toLowerCase() === name.toLowerCase());
                if (existing) { addStation(existing.lat as any, (existing as any).lng); return; }
                if (coords) { addStation(coords.lat, coords.lng); return; }
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name + ', India')}`)
                  .then(r => r.json())
                  .then((res: any[]) => {
                    const item = res?.[0];
                    if (item) addStation(parseFloat(item.lat), parseFloat(item.lon));
                    else setStatus('Station not found. Try another name.', 'error');
                  })
                  .catch(() => setStatus('Search failed. Check network.', 'error'));
              }} />
            </div>
            </div>
            {/* Map with bottom-left overlay controls */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="relative" style={{ minHeight: 420 }}>
                <MapView stations={stations} onAddStation={onAddStation} onMapReady={setMap} routes={[[
                  'New Delhi', 'Kanpur Central'], ['Kanpur Central', 'Howrah Junction'], ['New Delhi', 'Mumbai Central'], ['Mumbai Central', 'Chennai Central'], ['Chennai Central', 'Howrah Junction'], ['New Delhi', 'Chennai Central']
                ]} />
                {/* Controls moved beside the map */}
              </div>
            </div>
          
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-2 text-slate-800">Animation Controls</h3>
              <div className="flex flex-wrap items-center md:justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => startDynamicSimulation()} className="h-9 px-3 rounded-md bg-sky-600 text-white hover:bg-sky-500">Start</button>
                  <button onClick={() => stopDynamicSimulation()} className="h-9 px-3 rounded-md bg-slate-200 text-slate-800 hover:bg-slate-100 border border-gray-300">Stop</button>
                  <button onClick={() => resetSimulation()} className="h-9 px-3 rounded-md bg-slate-200 text-slate-800 hover:bg-slate-100 border border-gray-300">Reset</button>
                  <button onClick={() => skipToConflict()} className="h-9 px-3 rounded-md bg-sky-100 text-sky-700 hover:bg-sky-200 border border-sky-200">Skip</button>
                </div>
                <div className="flex items-center gap-2 min-w-[220px] w-full md:w-auto">
                  <span className="text-slate-700 text-sm">Speed</span>
                  <input type="range" min={0.25} max={3} step={0.25} value={speed} onChange={e => setSpeed(parseFloat((e.target as HTMLInputElement).value))} onInput={e => setSpeed(parseFloat((e.target as HTMLInputElement).value))} className="md:w-56 w-full cursor-pointer" />
                  <span className="text-slate-600 text-sm w-14 text-right">x{Number(speed).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="text-lg font-semibold mb-2 text-slate-800">Simulation Status</h3>
              <div className="text-sm text-slate-700 space-y-2 mb-4">
                <div><b>Clock</b>: {simInfo.clockMin} min</div>
                <div><b>Trains</b>: {simInfo.total} total · {simInfo.moving} moving · {simInfo.paused} waiting</div>
              </div>
              <div className="h-64 border border-gray-200 rounded-lg overflow-hidden">
                <TrackPanel getSimSnapshot={() => {
                  const app = (window as any).__app as any;
                  if (!app?.sim?.states) return null;
                  const tt: Timetable | null = app.scenario ?? app.timetable;
                  return {
                    clock: app.sim.clock || 0,
                    speed: Math.max(0.25, app.speed || 1),
                    states: (app.sim.states as any[]).map(st => {
                      const seqLen = tt?.timetable?.[st.name]?.stations ? Object.keys(tt.timetable[st.name].stations).length : 0;
                      return ({
                        name: st.name,
                        paused: !!st.paused,
                        delayMin: st.delayMin || 0,
                        progress: st.progress || 0,
                        fromIndex: st.fromIndex || 0,
                        toIndex: st.toIndex || 0,
                        totalSegments: Math.max(1, (seqLen > 0 ? seqLen - 1 : 1)),
                        waitReason: st.waitReason
                      });
                    })
                  };
                }} />
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow">
              <TimetableView tt={active} />
            </div>
          </div>
        </div>

        {status && (
          <div className={`status ${status.type}`} style={{ marginTop: 12 }}>
            {status.msg}
          </div>
        )}

      </div>
    </main>
  );
}

function resetSimulation() {
  const app = (window as any).__app as any;
  if (!app) return;
  stopDynamicSimulation.call(app);
}
function skipToConflict() {
  const app = (window as any).__app as any;
  if (!app?.sim?.states) return;
  app.sim.clock += 5;
}

type TrainState = { name: string; fromIndex: number; toIndex: number; progress: number; paused: boolean; delayMin: number; appliedDelayMin?: number; resumeTimer?: number | null; waitReason?: string };

function getTrainColorAndSize(name: string): { color: string; size: number } {
  const lower = name.toLowerCase();
  if (lower.includes('express')) return { color: '#60a5fa', size: 30 };
  if (lower.includes('local')) return { color: '#34d399', size: 20 };
  return { color: '#f59e0b', size: 24 };
}
function updateMarkerLabel(marker: L.Marker, text: string) {
  const el = marker.getElement();
  if (!el) return;
  const label = el.querySelector('div div + div') as HTMLDivElement | null;
  if (label) label.textContent = text;
}
function pauseTrain(_app: any, st: TrainState, marker: L.Marker, delayMins: number, reason: string) {
  st.paused = true;
  st.delayMin += Math.max(0, Math.round(delayMins));
  st.waitReason = reason;
  const root = marker.getElement();
  if (root) root.classList.add('pulsing');
  updateMarkerLabel(marker, `${st.name} | Waiting for ${reason} (+${st.delayMin}m)`);
}
function resumeTrain(_app: any, st: TrainState, marker: L.Marker) {
  st.paused = false;
  if (st.resumeTimer) { clearTimeout(st.resumeTimer as number); st.resumeTimer = null; }
  const root = marker.getElement();
  if (root) root.classList.remove('pulsing');
  // No delay propagation or label minutes
  st.waitReason = undefined;
  updateMarkerLabel(marker, `${st.name}`);
}
function startDynamicSimulation(this: any) {
  const app = (window as any).__app as any;
  if (!app) return;
  const { map, stations, scenario, timetable, speed } = app;
  if (!map) return;
  const tt = scenario ?? timetable;
  if (!tt?.timetable) {
    (app.setStatus || console.log)("No timetable to simulate. Generate one first.", 'error');
    return;
  }
  if (!stations || stations.length < 2) {
    (app.setStatus || console.log)("Add at least 2 stations to simulate.", 'error');
    return;
  }
  stopDynamicSimulation.call(app);
  app.animWrappers = [];
  app.animMarkers = [];
  const trainNames = Object.keys(tt.timetable);
  const states: TrainState[] = trainNames.map((name) => ({ name, fromIndex: 0, toIndex: 1, progress: 0, paused: false, delayMin: 0, resumeTimer: null }));
  app.sim = { states, raf: 0, clock: 0 };
  const trains = Object.keys(tt.timetable);
  trains.forEach((name: string) => {
    const { color, size } = getTrainColorAndSize(name);
    const icon = L.divIcon({
      className: 'train-marker',
      html: `<div style="position:relative;transform:translate(-${Math.round(size/2)}px,-${Math.round(size/2)}px);">
        <div style="width:${size}px;height:${size}px;border-radius:50%;border:2px solid white;background:${color};box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>
        <div style="position:absolute;top:-26px;left:${Math.round(size/2)}px;color:#fff;font-size:12px;background:rgba(0,0,0,0.6);padding:2px 6px;border-radius:4px;white-space:nowrap">${name}</div>
      </div>`
    });
    // Start marker at the first station of the train path
    const seq = Object.keys(tt.timetable[name].stations);
    const firstStationName = seq[0];
    const start = stations.find((s: Station) => s.name === firstStationName);
    const startLatLng: [number, number] = start ? [start.lat, start.lng] : [map.getCenter().lat, map.getCenter().lng];
    const m = L.marker(startLatLng, { icon, zIndexOffset: 1000 }).addTo(map);
    (m as any).__labelName = name;
    app.animMarkers.push(m);
  });
  let last = performance.now();
  const safetyMin = 3;
  const tick = (now: number) => {
    const dt = now - last; last = now;
    const currentSpeed = Math.max(0.25, app.speed ?? speed);
    const simMin = dt * (10 * currentSpeed) / 1000;
    app.sim.clock += simMin;
    states.forEach((st: TrainState, idx: number) => {
      const name = st.name;
      const seq = Object.keys(tt.timetable[name].stations);
      if (st.toIndex >= seq.length) return;
      if (st.paused) return;
      const from = stations.find((s: Station) => s.name === seq[st.fromIndex]);
      const to = stations.find((s: Station) => s.name === seq[st.toIndex]);
      if (!from || !to) return;
      const km = calculateDistance(from.lat, from.lng, to.lat, to.lng);
      const speedKmH = name.toLowerCase().includes('express') ? 120 : name.toLowerCase().includes('local') ? 80 : 60;
      const segMin = (km / speedKmH) * 60 + safetyMin;
      st.progress += simMin / Math.max(segMin, 0.1);
      if (st.progress >= 1) {
        st.fromIndex++; st.toIndex++; st.progress = 0;
      }
      // If train reached end, place marker at final station and mark as arrived
      if (st.toIndex >= seq.length) {
        const last = stations.find((s: Station) => s.name === seq[seq.length - 1]);
        if (last) {
          const mEnd = app.animMarkers[idx] as L.Marker;
          mEnd.setLatLng([last.lat, last.lng]);
          updateMarkerLabel(mEnd, `${name} | Arrived`);
        }
        return;
      }
      const lat = from.lat + (to.lat - from.lat) * st.progress;
      const lng = from.lng + (to.lng - from.lng) * st.progress;
      const m = app.animMarkers[idx] as L.Marker;
      m.setLatLng([lat, lng]);
      const el = (m.getElement()?.querySelector('div div + div') as HTMLDivElement) || null;
      if (el && !st.paused) el.textContent = `${name}`;
    });
    const onSameSeg: Record<string, number[]> = {};
    states.forEach((st: TrainState, idx: number) => {
      const name = st.name; const seq = Object.keys(tt.timetable[name].stations);
      if (st.toIndex >= seq.length) return;
      const a = seq[st.fromIndex]; const b = seq[st.toIndex];
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      (onSameSeg[key] ||= []).push(idx);
    });
    Object.values(onSameSeg).forEach(indices => {
      if (indices.length <= 1) return;
      indices.sort((i,j) => {
        const pri = (tt as any).priority?.[states[i].name] ?? (states[i].name.toLowerCase().includes('express') ? 1 : states[i].name.toLowerCase().includes('local') ? 2 : 3);
        const prj = (tt as any).priority?.[states[j].name] ?? (states[j].name.toLowerCase().includes('express') ? 1 : states[j].name.toLowerCase().includes('local') ? 2 : 3);
        return pri - prj;
      });
      const leader = indices[0];
      const leaderState = states[leader];
      leaderState.paused = false;
      const leaderName = leaderState.name;
      const leaderSeq = Object.keys(tt.timetable[leaderName].stations);
      const lf = stations.find((s: Station) => s.name === leaderSeq[leaderState.fromIndex]);
      const lt = stations.find((s: Station) => s.name === leaderSeq[leaderState.toIndex]);
      if (!lf || !lt) return;
      const lkm = calculateDistance(lf.lat, lf.lng, lt.lat, lt.lng);
      const lSpeedKmH = leaderName.toLowerCase().includes('express') ? 120 : leaderName.toLowerCase().includes('local') ? 80 : 60;
      const lSegMin = (lkm / lSpeedKmH) * 60 + safetyMin;
      const leaderRemainingMin = Math.max(0, (1 - leaderState.progress) * Math.max(lSegMin, 0.1));
      const msPerSimMin = 1000 / (10 * currentSpeed);
      indices.slice(1).forEach(i => {
        const st = states[i];
        const m = app.animMarkers[i] as L.Marker;
        const reason = leaderName.toLowerCase().includes('express') ? 'Express' : 'higher priority';
        if (!st.paused) { pauseTrain(app, st, m, Math.ceil(leaderRemainingMin), reason); }
        else { updateMarkerLabel(m, `${st.name} | Waiting for ${reason}`); }
        if (st.resumeTimer) { clearTimeout(st.resumeTimer as number); st.resumeTimer = null; }
        // wait in real time proportional to remaining simulated minutes
        st.resumeTimer = window.setTimeout(() => { resumeTrain(app, st, m); }, Math.max(50, leaderRemainingMin * msPerSimMin));
      });
    });
    app.sim.raf = requestAnimationFrame(tick);
  };
  app.sim.raf = requestAnimationFrame(tick);
}
function stopDynamicSimulation(this: any) {
  const app = (window as any).__app as any;
  if (!app?.animWrappers) return;
  app.animWrappers.forEach((el: HTMLDivElement) => el.parentNode && el.parentNode.removeChild(el));
  app.animWrappers = [];
  if (app?.animMarkers) { (app.animMarkers as L.Marker[]).forEach((mk: L.Marker) => mk.remove()); app.animMarkers = []; }
  if (app?.sim?.states) { (app.sim.states as TrainState[]).forEach(st => { if (st.resumeTimer) { clearTimeout(st.resumeTimer as number); st.resumeTimer = null; } }); }
  if (app?.sim?.raf) cancelAnimationFrame(app.sim.raf);
  app.sim = null;
}


