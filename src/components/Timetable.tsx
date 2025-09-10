import type { Timetable } from '../lib';

export default function TimetableView({ tt }: { tt: Timetable | null }) {
  if (!tt || !tt.timetable) return null;
  const trains = Object.keys(tt.timetable);
  const allStations = new Set<string>();
  trains.forEach(name => {
    const trainData = tt.timetable[name];
    if (trainData?.stations) Object.keys(trainData.stations).forEach(s => allStations.add(s));
  });
  const stationArray = Array.from(allStations);
  return (
    <table className="timetable-table" style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', color: '#111', borderRadius: 8, overflow: 'hidden' }}>
      <thead><tr><th>Train</th>{stationArray.map(s => <th key={s}>{s}</th>)}</tr></thead>
      <tbody>
      {trains.map(name => (
        <tr key={name}>
          <td><strong>{name}</strong></td>
          {stationArray.map(s => {
            const times = tt.timetable[name].stations[s];
            if (!times) return <td key={s}>-</td>;
            const arrival = times.arrival || '-';
            const departure = times.departure || '-';
            return <td key={s}>{arrival}<br/><small>{departure}</small></td>
          })}
        </tr>
      ))}
      </tbody>
    </table>
  );
}

