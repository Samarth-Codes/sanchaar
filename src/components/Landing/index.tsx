import Hero from './Hero';
import Features from './Features';
import CTA from './CTA';
import Stats from './Stats';

function ModuleSanchaar() {
  return (
    <section className="rounded-xl border border-[#e5e7eb] bg-white p-6">
      <h3 className="text-xl font-semibold text-[#0b2545]">Module 2: Sanchaar — Optimization Module</h3>
      <p className="text-[#475569] mt-2">This module improves <strong>punctuality</strong> and <strong>network efficiency</strong> across the corridor.</p>
      <div className="mt-3 text-[#334155]">
        <div className="font-semibold text-[#0b2545]">Dynamic Scheduling</div>
        <p className="text-sm">Resolves traffic conflicts using train priority (e.g., Express over Freight) and suggests the best possible schedule to minimize delays and reduce network blockages.</p>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="space-y-8 polka-bg">
      <Hero />
      <ModuleSanchaar />
      <Features />
    </div>
  );
}


