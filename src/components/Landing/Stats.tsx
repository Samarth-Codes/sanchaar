export default function Stats() {
  const items = [
    { label: 'Interactive Planner', value: 'Drag, drop, and tweak timelines easily.', color: '#0ea5a7' },
    { label: 'Smooth Playback', value: 'Preview movements without clutter.', color: '#0b2545' },
    { label: 'Realistic Constraints', value: 'Headways and routes respected.', color: '#ea580c' }
  ];
  return (
    <section className="grid md:grid-cols-3 gap-4">
      {items.map(i => (
        <div key={i.label} className="rounded-xl border border-[#e5e7eb] bg-white p-5 flex items-start gap-4 transition hover:shadow-sm">
          <div className="w-3 h-12 rounded" style={{ background: i.color, opacity: 0.8 }} />
          <div>
            <div className="text-base font-semibold text-[#0b2545]">{i.label}</div>
            <div className="text-sm text-[#475569]">{i.value}</div>
          </div>
        </div>
      ))}
    </section>
  );
}


