import LandingPage from './components/Landing';

export default function App() {

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between whitespace-nowrap">
          <div className="flex items-center gap-3">
            <img src="/images/sanchaarlogo-photoaidcom-cropped.jpg" alt="Sanchaar logo" className="h-8 w-8 rounded-sm object-cover" />
            <h2 className="text-2xl font-bold text-slate-800">Sanchaar</h2>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-500">
            <a className="hover:text-slate-900" href="/">Home</a>
            <a className="text-sky-600 font-semibold" href="/schedule">Scheduling</a>
          </nav>
          <div />
        </div>
      </header>

      <main className="px-6 py-12 lg:px-10 xl:px-16 flex-1 bg-white">
        <div className="max-w-7xl mx-auto">
          <LandingPage />
        </div>
      </main>
    </div>
  );
}

