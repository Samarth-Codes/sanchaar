import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section className="flex flex-col md:flex-row items-center gap-10">
      <div className="flex-1">
        <h1 className="text-5xl md:text-6xl font-extrabold text-[#0b2545] tracking-tight" style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Sanchaar</h1>
        <p className="text-[#334155] mt-4 md:mt-5 max-w-2xl text-lg">Optimize and visualize Indian Railways network schedules with clear timelines, conflict resolution, and intuitive controls.</p>
        <div className="mt-5 flex gap-3">
          <Link
            to="/schedule"
            className="px-5 py-2.5 rounded-lg bg-[#0ea5a7] text-white shadow-sm transition transform hover:-translate-y-0.5 hover:shadow-md hover:brightness-110 active:translate-y-0"
            aria-label="Start now"
          >
            Start now
          </Link>
        </div>
      </div>
      <div className="flex-1 w-full">
        <img
          src="/images/vandebharat.jpg"
          alt="Vande Bharat"
          className="w-full max-h-64 md:max-h-80 object-cover rounded-xl border border-[#e5e7eb]"
        />
      </div>
    </section>
  );
}


