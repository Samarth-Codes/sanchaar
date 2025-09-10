import { useEffect, useState } from 'react';
import type { Station, Train, Timetable, TrainPlan } from '../lib';
import { generateLocalTimetable, generateTimetableWithRoutes } from '../lib';

type Props = {
  stations: Station[];
  onTimetable: (tt: Timetable) => void;
  setStatus: (msg: string, type?: 'success'|'error'|'info') => void;
  onSearchSelect?: (stationName: string, coords?: { lat: number; lng: number }) => void;
  catalogStations?: { name: string; lat: number; lng: number }[];
};

export default function Controls({ stations, onTimetable, setStatus, onSearchSelect, catalogStations }: Props) {
  // Simple form fields instead of JSON
  const [expressSpeed, setExpressSpeed] = useState(120);
  const [localSpeed, setLocalSpeed] = useState(80);
  const [freightSpeed, setFreightSpeed] = useState(60);
  const [headway, setHeadway] = useState(5);
  const [dwell, setDwell] = useState(2);
  const [safety, setSafety] = useState(3);
  // Per-train planning
  const [plans, setPlans] = useState<TrainPlan[]>([{
    name: 'Express 1', speed: 120, priority: 1, startTime: '08:00', startStation: '', endStation: '', autoReroute: true
  },{
    name: 'Local 1', speed: 80, priority: 2, startTime: '08:05', startStation: '', endStation: '', autoReroute: false
  },{
    name: 'Freight 1', speed: 60, priority: 3, startTime: '08:10', startStation: '', endStation: '', autoReroute: false
  }]);
  // Search state and RapidAPI suggestions
  const [searchText, setSearchText] = useState('');
  const [apiSuggestions, setApiSuggestions] = useState<{ name: string; lat?: number; lng?: number }[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Debounced geocode+nearby search with Perplexity fallback
  useEffect(() => {
    if (!searchText || searchText.length < 2) { setApiSuggestions([]); return; }
    const t = setTimeout(async () => {
      try {
      setLoadingSearch(true);
        // Try Perplexity first if key exists: ask for nearest Indian railway stations with lat/lng
        const pplxKey = (import.meta as any).env?.VITE_PPLX_KEY as string | undefined;
        if (pplxKey) {
          try {
            const prompt = `Return a concise JSON array of at most 8 nearby Indian railway stations for the place: "${searchText}". Each item must be: {"name": string, "lat": number, "lng": number}. Only include valid stations with accurate coordinates in India.`;
            const resp = await fetch('https://api.perplexity.ai/chat/completions', {
              method: 'POST',
        headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${pplxKey}`
              },
              body: JSON.stringify({
                model: 'llama-3.1-sonar-small-128k-online',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                top_p: 0.9,
                max_tokens: 400
              })
            });
            if (resp.ok) {
              const data = await resp.json();
              const text = data?.choices?.[0]?.message?.content as string | undefined;
              const match = text?.match(/\[[\s\S]*\]/);
              if (match) {
                const arr = JSON.parse(match[0]);
                const mapped = (Array.isArray(arr) ? arr : []).map((it: any) => ({ name: String(it.name || ''), lat: Number(it.lat), lng: Number(it.lng) }))
                  .filter(s => s.name && !Number.isNaN(s.lat) && !Number.isNaN(s.lng));
                if (mapped.length > 0) {
                  setApiSuggestions(mapped);
                  setLoadingSearch(false);
                  return;
                }
              }
            }
          } catch {}
        }
        // Step 1: geocode the place (Nominatim)
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=IN&limit=1&q=${encodeURIComponent(searchText)}`;
        const geoRes = await fetch(geocodeUrl);
        if (!geoRes.ok) throw new Error('geocode');
        const geo = await geoRes.json();
        const first = Array.isArray(geo) ? geo[0] : undefined;
        const lat = Number(first?.lat);
        const lng = Number(first?.lon);
        if (!first || Number.isNaN(lat) || Number.isNaN(lng)) {
          // Fallback: direct station search within India
          const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=IN&limit=8&q=${encodeURIComponent(searchText + ' railway station')}`;
          const fbRes = await fetch(fallbackUrl);
          const fb = await fbRes.json();
          const mapped = (Array.isArray(fb) ? fb : []).map((it: any) => ({ name: it.display_name || it.name, lat: Number(it.lat), lng: Number(it.lon) }))
            .filter(s => !!s.name && !Number.isNaN(s.lat) && !Number.isNaN(s.lng));
          setApiSuggestions(mapped);
          setLoadingSearch(false);
          return;
        }
        // Step 2: nearby stations search with Nominatim viewbox (~25km)
        const dLat = 25000 / 111320;
        const dLng = 25000 / (111320 * Math.cos(lat * Math.PI / 180));
        const minLon = lng - dLng, minLat = lat - dLat, maxLon = lng + dLng, maxLat = lat + dLat;
        const nearbyUrl = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=IN&limit=12&q=railway%20station&bounded=1&viewbox=${minLon},${minLat},${maxLon},${maxLat}`;
        const nearRes = await fetch(nearbyUrl);
        if (!nearRes.ok) throw new Error('nearby');
        const near = await nearRes.json();
        const mapped = (Array.isArray(near) ? near : [])
          .map((it: any) => ({ name: it.display_name || it.name, lat: Number(it.lat), lng: Number(it.lon) }))
          .filter(s => !!s.name && !Number.isNaN(s.lat) && !Number.isNaN(s.lng));
        setApiSuggestions(mapped);
      } catch {
        setApiSuggestions([]);
      } finally {
        setLoadingSearch(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [searchText]);

  const onGenerate = () => {
    if (stations.length < 2) {
      setStatus('Please add at least 2 stations to generate a timetable.', 'error');
      return;
    }
    // Update plan speeds from quick controls
    const mergedPlans = plans.map(p => ({
      ...p,
      speed: p.name.includes('Express') ? expressSpeed : p.name.includes('Local') ? localSpeed : p.name.includes('Freight') ? freightSpeed : p.speed
    }));
    const constraints = { headway, stationDwellTime: dwell, safetyMargin: safety } as any;
    // AI path (optional): use env var VITE_GEMINI_KEY to enable
    const key = (import.meta as any).env?.VITE_GEMINI_KEY as string | undefined;
    if (key) {
      setStatus('Generating timetable with AI...', 'info');
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a railway scheduler AI. Generate a conflict-free timetable with possible rerouting for higher-priority trains.\n\nStations (ordered corridor): ${stations.map(s => `${s.id}. ${s.name} (${s.lat.toFixed(4)}, ${s.lng.toFixed(4)})`).join(' → ')}\n\nTrain plans: ${JSON.stringify(mergedPlans)} (Each plan has startStation, endStation, speed, priority, startTime, autoReroute flag).\n\nConstraints: ${JSON.stringify(constraints)}\n\nReturn ONLY valid JSON: {\n  "timetable": {\n    "trainName": {\n      "stations": {\n        "stationName": {\n          "arrival": "HH:MM",\n          "departure": "HH:MM"\n        }\n      }\n    }\n  }\n}` }]}],
          generationConfig: { temperature: 0.1, topK: 1, topP: 1, maxOutputTokens: 2048 }
        })
      }).then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }).then(data => {
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
        const match = text?.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('No JSON found in AI response');
        const tt = JSON.parse(match[0]);
        onTimetable(tt);
        setStatus('Timetable generated successfully!', 'success');
      }).catch(() => {
        const tt = generateTimetableWithRoutes(stations, mergedPlans, constraints);
        onTimetable(tt);
        setStatus('API failed. Generated local timetable with routes.', 'info');
      });
    } else {
      const tt = generateTimetableWithRoutes(stations, mergedPlans, constraints);
      onTimetable(tt);
      setStatus('Local timetable generated successfully (route-aware)!', 'success');
    }
  };

  return (
    <div className="flex flex-col gap-4 bg-white p-4 rounded-xl border border-gray-200">
      {/* Add Station (manual input + Perplexity/Nominatim assisted lookup) */}
      <div>
        <h3 className="m-0 text-slate-800">Add Station</h3>
        <div className="mt-2 grid grid-cols-12 gap-2 items-center">
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Type station or place name in India"
            className="col-span-8 h-9 rounded-md border border-gray-300 px-3 bg-white text-slate-800"
          />
          <button
            className="col-span-4 h-9 rounded-md bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50"
            onClick={() => {
              const first = apiSuggestions[0];
              if (searchText.trim()) {
                onSearchSelect?.(first?.name || searchText.trim(), (first?.lat && first?.lng) ? { lat: first.lat, lng: first.lng } : undefined);
              }
            }}
            disabled={!searchText.trim()}
          >
            {loadingSearch ? 'Locating…' : 'Add station'}
          </button>
        </div>
        {!!apiSuggestions.length && (
          <div className="mt-2 rounded-md border border-gray-200 bg-white">
            <div className="px-3 py-2 text-xs text-slate-700">Suggestions (click Use to add)</div>
            <ul className="max-h-36 overflow-auto divide-y divide-gray-100 text-slate-800">
              {apiSuggestions.map((s, i) => (
                <li key={`${s.name}-${i}`} className="px-3 py-2 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-slate-800" title={`${s.name} — ${s.lat?.toFixed?.(4) ?? ''}, ${s.lng?.toFixed?.(4) ?? ''}`}>{s.name}</span>
                  <button
                    className="shrink-0 px-2 h-7 rounded bg-slate-200 text-slate-800 hover:bg-slate-100"
                    onClick={() => onSearchSelect?.(s.name, (s.lat && s.lng) ? { lat: s.lat, lng: s.lng } : undefined)}
                  >
                    Use
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        
      </div>

      <h3 className="m-0 text-slate-800">Train Configuration</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-slate-700 flex flex-col gap-1">Express speed (km/h)
          <input type="number" min={40} max={200} value={expressSpeed} onChange={e => setExpressSpeed(parseInt(e.target.value,10)||120)} className="h-9 rounded-md border border-gray-300 px-3 bg-white text-slate-800" />
        </label>
        <label className="text-sm text-slate-700 flex flex-col gap-1">Local speed (km/h)
          <input type="number" min={30} max={150} value={localSpeed} onChange={e => setLocalSpeed(parseInt(e.target.value,10)||80)} className="h-9 rounded-md border border-gray-300 px-3 bg-white text-slate-800" />
        </label>
        <label className="text-sm text-slate-700 flex flex-col gap-1">Freight speed (km/h)
          <input type="number" min={20} max={120} value={freightSpeed} onChange={e => setFreightSpeed(parseInt(e.target.value,10)||60)} className="h-9 rounded-md border border-gray-300 px-3 bg-white text-slate-800" />
        </label>
      </div>

      <h3 className="m-0 text-slate-800">Per-Train Route & Priority</h3>
      <div className="flex flex-col gap-3">
        {plans.map((p, i) => (
          <div key={p.name} className="grid grid-cols-12 gap-2 items-center">
            <input value={p.name} onChange={e => setPlans(prev => prev.map((pp, idx) => idx===i ? { ...pp, name: e.target.value } : pp))} placeholder="Train name" className="col-span-3 h-9 rounded-md border border-gray-300 px-3 bg-white text-slate-800" />
            <select value={p.startStation} onChange={e => setPlans(prev => prev.map((pp, idx) => idx===i ? { ...pp, startStation: e.target.value } : pp))} className="col-span-3 h-9 rounded-md border border-gray-300 px-2 bg-white text-slate-800">
              <option value="">Start station</option>
              {stations.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
            <select value={p.endStation} onChange={e => setPlans(prev => prev.map((pp, idx) => idx===i ? { ...pp, endStation: e.target.value } : pp))} className="col-span-3 h-9 rounded-md border border-gray-300 px-2 bg-white text-slate-800">
              <option value="">End station</option>
              {stations.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </select>
            <input type="time" value={p.startTime} onChange={e => setPlans(prev => prev.map((pp, idx) => idx===i ? { ...pp, startTime: e.target.value } : pp))} className="col-span-2 h-9 rounded-md border border-gray-300 px-2 bg-white text-slate-800" />
            <div className="col-span-1 flex items-center gap-2">
              <input aria-label="Priority" type="number" min={1} max={9} value={p.priority} onChange={e => setPlans(prev => prev.map((pp, idx) => idx===i ? { ...pp, priority: parseInt(e.target.value,10)||pp.priority } : pp))} className="h-9 w-14 rounded-md border border-gray-300 px-2 bg-white text-slate-800" />
            </div>
            <label className="col-span-12 md:col-span-2 flex items-center gap-2 text-slate-700">
              <input type="checkbox" checked={!!p.autoReroute} onChange={e => setPlans(prev => prev.map((pp, idx) => idx===i ? { ...pp, autoReroute: e.target.checked } : pp))} />
              Auto-reroute
            </label>
          </div>
        ))}
        <div className="flex gap-2">
          <button className="px-3 h-9 rounded-md bg-sky-600 text-white hover:bg-sky-500" onClick={() => setPlans(prev => ([...prev, { name: `Train ${prev.length+1}`, speed: 80, priority: prev.length+1, startTime: '08:00', startStation: '', endStation: '', autoReroute: false }]))}>Add Train</button>
          <button className="px-3 h-9 rounded-md bg-slate-200 text-slate-800 hover:bg-slate-100 disabled:opacity-50" onClick={() => setPlans(prev => prev.slice(0, -1))} disabled={plans.length<=1}>Remove Last</button>
      </div>
      </div>

      <h3 className="m-0 text-slate-800">Constraints</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-slate-700 flex flex-col gap-1">Headway (min)
          <input type="number" min={1} max={20} value={headway} onChange={e => setHeadway(parseInt(e.target.value,10)||5)} className="h-9 rounded-md border border-gray-300 px-3 bg-white text-slate-800" />
        </label>
        <label className="text-sm text-slate-700 flex flex-col gap-1">Dwell (min)
          <input type="number" min={0} max={10} value={dwell} onChange={e => setDwell(parseInt(e.target.value,10)||2)} className="h-9 rounded-md border border-gray-300 px-3 bg-white text-slate-800" />
        </label>
        <label className="text-sm text-slate-700 flex flex-col gap-1">Safety (min)
          <input type="number" min={0} max={10} value={safety} onChange={e => setSafety(parseInt(e.target.value,10)||3)} className="h-9 rounded-md border border-gray-300 px-3 bg-white text-slate-800" />
        </label>
      </div>
      <button onClick={onGenerate} className="h-11 rounded-lg bg-[#0ea5a7] hover:opacity-90 text-white font-semibold">Generate Timetable</button>
    </div>
  );
}

