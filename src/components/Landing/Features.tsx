const items = [
  { title: 'Dynamic Scheduling', desc: 'Conflict resolution by priority with clear waits and headways.', color: '#0ea5a7', emoji: '🗓️' },
  { title: 'Smooth Playback', desc: 'Play/pause timeline to preview movements without clutter.', color: '#0b2545', emoji: '▶️' },
  { title: 'Clear Visualization', desc: 'Express (navy), Local (green), Freight (orange) with simple labels.', color: '#ea580c', emoji: '📊' }
];

export default function Features() {
  return (
    <section id="features" className="grid md:grid-cols-3 gap-4">
      {items.map(it => (
        <div
          key={it.title}
          className="rounded-xl border border-[#34989c] bg-[#f8f8f8] p-5 transition duration-150 transform hover:-translate-y-0.5 hover:bg-[#e7e7e7] hover:border-[#34989c] hover:shadow-md"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background: `${it.color}22` }}>
            <span style={{ opacity: 0.95 }}>{it.emoji}</span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-[#0b2545]">{it.title}</h3>
          <p className="text-sm text-[#475569]">{it.desc}</p>
        </div>
      ))}
    </section>
  );
}


