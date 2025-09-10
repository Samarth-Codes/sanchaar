import { Fragment, useEffect, useMemo, useState } from 'react';
import MapView from './MapView';
import TrackPanel from './TrackPanel';
import type { Station, Timetable, Train } from '../lib';
import { compareScenarios, generateTimetableWithRoutes, suggestOptimizedSchedule } from '../lib';
import { searchTrains as rrSearchTrains, getTrainSchedule as rrGetTrainSchedule, getLiveMap as rrGetLiveMap } from '../api/railradar';
import type { TrainScheduleResponse } from '../api/railradar';

type Scenario = { name: string; timetable: Timetable; optimized?: boolean };

export default function PravahSim({ stations, basePlans, onStatus }: { stations: Station[]; basePlans: any[]; onStatus?: (msg: string) => void }) {
  const [map, setMap] = useState<L.Map | null>(null as any);
  const [speed, setSpeed] = useState(1);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [trainQuery, setTrainQuery] = useState('');
  const [trainResults, setTrainResults] = useState<{ trainNumber: string; name: string; type: string }[]>([]);
  const [selectedTrains, setSelectedTrains] = useState<string[]>([]);
  const [livePoll, setLivePoll] = useState<boolean>(false);
  const presets = [
    { name: 'Express – Rajdhani', speed: 120, priority: 1, startTime: '08:00' },
    { name: 'Local – Suburban', speed: 80, priority: 2, startTime: '08:10' },
    { name: 'Freight – Goods', speed: 60, priority: 3, startTime: '08:20' }
  ];

  const baseTimetable = useMemo(() => generateTimetableWithRoutes(stations, basePlans as any, { headway: 5, stationDwellTime: 2, safetyMargin: 3 }), [stations, basePlans]);

  useEffect(() => {
    setScenarios([{ name: 'Base', timetable: baseTimetable }]);
  }, [baseTimetable]);

  useEffect(() => {
    (window as any).__app = { ...(window as any).__app, map, stations, timetable: scenarios[activeIdx]?.timetable, scenario: scenarios[activeIdx]?.timetable, speed };
  }, [map, stations, scenarios, activeIdx, speed]);

  // Search trains (RailRadar)
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!trainQuery || trainQuery.length < 2) { setTrainResults([]); return; }
      try {
        const res = await rrSearchTrains(trainQuery);
        setTrainResults(res as any);
      } catch { setTrainResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [trainQuery]);

  const onAddScenario = () => {
    const name = `Scenario ${scenarios.length}`;
    const tt = generateTimetableWithRoutes(stations, basePlans as any, { headway: 5, stationDwellTime: 2, safetyMargin: 3 });
    setScenarios(prev => [...prev, { name, timetable: tt }]);
  };

  const onOptimize = () => {
    const trains: Train[] = (basePlans as any[]).map(p => ({ name: p.name, speed: p.speed, priority: p.priority, startTime: p.startTime }));
    const optimized = suggestOptimizedSchedule(scenarios[activeIdx].timetable, stations, trains, { headway: 5, maxShiftMin: 10 });
    setScenarios(prev => [...prev, { name: `${scenarios[activeIdx].name} (AI)`, timetable: optimized, optimized: true }]);
  };

  // Live map polling to keep visualization in sync
  useEffect(() => {
    if (!livePoll) return;
    let stop = false;
    const loop = async () => {
      while (!stop) {
        try {
          await rrGetLiveMap('ALL');
          // In a real integration, we would merge live positions into map markers and detect conflicts
        } catch {}
        await new Promise(r => setTimeout(r, 5000));
      }
    };
    loop();
    return () => { stop = true; };
  }, [livePoll]);

  const metrics = useMemo(() => compareScenarios(baseTimetable, scenarios.map(s => ({ name: s.name, timetable: s.timetable }))), [baseTimetable, scenarios]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button className="px-3 py-2 rounded bg-slate-700" onClick={onAddScenario}>Add Scenario</button>
        <button className="px-3 py-2 rounded bg-indigo-600" onClick={onOptimize}>Suggest Optimization (AI)</button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-300">Speed</span>
          <input type="range" min={0.25} max={3} step={0.25} value={speed} onChange={e => setSpeed(parseFloat((e.target as HTMLInputElement).value))} />
        </div>
        <label className="flex items-center gap-2 text-slate-300 text-sm">
          <input type="checkbox" checked={livePoll} onChange={e => setLivePoll(e.target.checked)} /> Live
        </label>
      </div>

      <div className="rounded-xl overflow-hidden border border-[var(--border-color)] p-3 bg-[var(--bg-secondary)]">
        <h3 className="m-0 mb-2 text-slate-200">Search Trains (RailRadar)</h3>
        <div className="flex gap-2 mb-2">
          <input className="flex-1 h-9 rounded-md border border-slate-700 px-3 bg-[#0e141b] text-slate-100" placeholder="Train name or number" value={trainQuery} onChange={e => setTrainQuery(e.target.value)} />
          <button className="px-3 h-9 rounded-md bg-slate-700" onClick={() => setTrainQuery(trainQuery)}>Search</button>
        </div>
        <div className="mb-2 text-slate-300 text-sm">Presets (offline):</div>
        <div className="flex gap-2 flex-wrap mb-3">
          {presets.map(p => (
            <button key={`preset-${p.name}`} className="px-2 h-8 rounded bg-slate-700 hover:bg-slate-600 text-sm" onClick={() => {
              const plans = presets.map(pp => ({
                name: pp.name,
                speed: pp.speed,
                priority: pp.priority,
                startTime: pp.startTime,
                startStation: stations[0]?.name || '',
                endStation: stations[stations.length - 1]?.name || '',
                autoReroute: true
              }));
              const tt = generateTimetableWithRoutes(stations, plans as any, { headway: 5, stationDwellTime: 2, safetyMargin: 3 });
              setScenarios(prev => [...prev, { name: `Preset – ${p.name.split(' ')[0]}`, timetable: tt }]);
            }}>{p.name}</button>
          ))}
        </div>
        <div className="max-h-48 overflow-y-auto text-sm">
          {trainResults.map(t => (
            <div key={`res-${t.trainNumber}`} className="flex items-center justify-between py-1 border-b border-slate-800">
              <div>{t.trainNumber} — {t.name}</div>
              <button className="px-2 h-7 rounded bg-sky-700" onClick={async () => {
                setSelectedTrains(prev => prev.includes(t.trainNumber) ? prev : [...prev, t.trainNumber]);
                const today = new Date(); const dateISO = today.toISOString().slice(0,10);
                const sched: TrainScheduleResponse = await rrGetTrainSchedule(t.trainNumber, dateISO);
                // Convert schedule to our Timetable shape
                const tt = { timetable: { [sched.trainNumber]: { stations: {} as Record<string, { arrival: string|null; departure: string|null }> } } } as any;
                sched.stops.forEach(s => { (tt.timetable[sched.trainNumber].stations as any)[s.stationName] = { arrival: s.arrival, departure: s.departure }; });
                setScenarios(prev => [...prev, { name: `Train ${t.trainNumber}`, timetable: tt }]);
              }}>Add</button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {scenarios.map((s, i) => (
          <button key={s.name} onClick={() => setActiveIdx(i)} className={`px-3 py-2 rounded ${i===activeIdx?'bg-sky-700':'bg-slate-700'}`}>
            {s.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl overflow-hidden border border-[var(--border-color)]" style={{ minHeight: 420 }}>
          <MapView stations={stations} onAddStation={() => {}} onMapReady={setMap} />
        </div>
        <div className="rounded-xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-secondary)]" style={{ minHeight: 420 }}>
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

      <div className="rounded-xl overflow-hidden border border-[var(--border-color)] p-3 bg-[var(--bg-secondary)]">
        <h3 className="m-0 mb-2 text-slate-200">Scenario Comparison</h3>
        <div className="grid grid-cols-3 gap-2 text-sm text-slate-200">
          <div className="font-semibold">Scenario</div>
          <div className="font-semibold">Total Delay (min)</div>
          <div className="font-semibold">Throughput / Avg Punctuality</div>
          {metrics.map(m => (
            <Fragment key={`metric-${m.name}`}>
              <div>{m.name}</div>
              <div>{m.totalDelayMin}</div>
              <div>{m.throughput} / {m.avgPunctualityMin}m</div>
            </Fragment>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button className="px-3 py-2 rounded bg-slate-700" onClick={() => {
            const data = JSON.stringify(metrics, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'scenario-summary.json'; a.click(); URL.revokeObjectURL(url);
          }}>Export JSON</button>
          <button className="px-3 py-2 rounded bg-slate-700" onClick={() => {
            const header = ['Scenario','TotalDelayMin','Throughput','AvgPunctualityMin'];
            const rows = metrics.map(m => [m.name, String(m.totalDelayMin), String(m.throughput), String(m.avgPunctualityMin)]);
            const csv = [header, ...rows].map(r => r.map(v => '"'+v.replace(/"/g,'""')+'"').join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'scenario-summary.csv'; a.click(); URL.revokeObjectURL(url);
          }}>Export CSV</button>
        </div>
      </div>
    </div>
  );
}


