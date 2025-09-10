const items = [
  { title: 'Dynamic Scheduling', desc: 'Conflict resolution by priority with clear waits and headways.', color: '#0ea5a7' },
  { title: 'Smooth Playback', desc: 'Play/pause timeline to preview movements without clutter.', color: '#0b2545' },
  { title: 'Clear Visualization', desc: 'Express (navy), Local (green), Freight (orange) with simple labels.', color: '#ea580c' }
];

export default function Features() {
  return (
    <section id="features" className="grid md:grid-cols-3 gap-4">
      {items.map(it => (
        <div
          key={it.title}
          className="rounded-xl border border-[#e5e7eb] bg-white p-5 transition duration-150 transform hover:-translate-y-0.5 hover:bg-[#f1f5f9] hover:border-[#d1d5db] hover:shadow-md"
        >
          <div className="w-10 h-10 rounded-full" style={{ background: it.color, opacity: 0.15 }} />
          <h3 className="mt-3 text-lg font-semibold text-[#0b2545]">{it.title}</h3>
          <p className="text-sm text-[#475569]">{it.desc}</p>
        </div>
      ))}
    </section>
  );
}


