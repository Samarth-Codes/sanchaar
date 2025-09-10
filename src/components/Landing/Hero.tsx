import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section className="rounded-2xl border border-[#e5e7eb] bg-white p-8 flex flex-col md:flex-row items-center gap-8">
      <div className="flex-1">
        <h1 className="text-4xl font-extrabold text-[#0b2545]">GatiRakshak · Sanchaar</h1>
        <p className="text-[#334155] mt-3 max-w-xl">Optimize and visualize Indian Railways network schedules with clear timelines, conflict resolution, and intuitive controls.</p>
        <div className="mt-5 flex gap-3">
          <Link
            to="/schedule"
            className="px-5 py-2.5 rounded-lg bg-[#0ea5a7] text-white shadow-sm transition transform hover:-translate-y-0.5 hover:shadow-md hover:brightness-110 active:translate-y-0"
            aria-label="Start now"
          >
            Start now
          </Link>
          <a
            href="#features"
            className="px-5 py-2.5 rounded-lg bg-[#ffedd5] text-[#ea580c] border border-[#fed7aa] transition transform hover:-translate-y-0.5 hover:bg-[#ffe8c7] active:translate-y-0"
          >
            Explore features
          </a>
        </div>
      </div>
    </section>
  );
}


