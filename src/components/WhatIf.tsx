import { useState } from 'react';
import type { Timetable, Train, Station } from '../lib';
import { pushTrainFromStation, resolveConflicts } from '../lib';

type Props = {
  baseTimetable: Timetable | null;
  trains: Train[];
  stations: Station[];
  onScenario: (tt: Timetable | null) => void;
  setStatus: (msg: string, type?: 'success'|'error'|'info') => void;
};

export default function WhatIf({ baseTimetable, trains, stations, onScenario, setStatus }: Props) {
  const [trainName, setTrainName] = useState('');
  const [stationName, setStationName] = useState('');
  const [delay, setDelay] = useState<number>(5);

  const apply = () => {
    if (!baseTimetable) { setStatus('Generate a timetable first.', 'error'); return; }
    if (!trainName || !stationName || !delay) { setStatus('Please provide train, station and delay.', 'error'); return; }
    const scenario: Timetable = JSON.parse(JSON.stringify(baseTimetable));
    if (!scenario.timetable[trainName] || !scenario.timetable[trainName].stations[stationName]) {
      setStatus('Train or station not found in timetable.', 'error');
      return;
    }
    pushTrainFromStation(scenario, trainName, stationName, delay);
    resolveConflicts(scenario, trains, 5, stations);
    onScenario(scenario);
    setStatus(`Applied What-If: delayed ${trainName} at ${stationName} by ${delay} min.`, 'info');
  };

  return (
    <div className="flex flex-col gap-3 bg-white p-4 rounded-xl border border-gray-200">
      <h3 className="text-slate-800 m-0">What-If Scenario</h3>
      <input className="h-9 rounded-md border border-gray-300 px-3 bg-white text-slate-800" placeholder="Train Name" value={trainName} onChange={e => setTrainName(e.target.value)} />
      <input className="h-9 rounded-md border border-gray-300 px-3 bg-white text-slate-800" placeholder="Station Name" value={stationName} onChange={e => setStationName(e.target.value)} />
      <input className="h-9 rounded-md border border-gray-300 px-3 bg-white text-slate-800" type="number" min={1} value={delay} onChange={e => setDelay(parseInt(e.target.value, 10))} />
      <div className="flex gap-2">
        <button className="px-3 h-9 rounded-md bg-[#0ea5a7] text-white hover:opacity-90" onClick={apply}>Apply What-If</button>
        <button className="px-3 h-9 rounded-md bg-slate-200 text-slate-800 hover:bg-slate-100" onClick={() => onScenario(null)}>Clear Scenario</button>
      </div>
    </div>
  );
}

