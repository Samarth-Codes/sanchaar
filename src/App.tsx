import LandingPage from './components/Landing';

export default function App() {

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between whitespace-nowrap">
          <div className="flex items-center gap-3">
            <div className="size-8 text-sky-600">
              <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15.5v-5l-3.29 3.29c-.39.39-1.02.39-1.41 0s-.39-1.02 0-1.41L10.59 10 6.3 5.71c-.39-.39-.39-1.02 0-1.41s1.02-.39 1.41 0L11 7.59V4.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v3.09l3.29-3.29c.39-.39 1.02-.39 1.41 0s.39 1.02 0 1.41L14.41 10l4.29 4.29c.39.39.39 1.02 0 1.41s-1.02.39-1.41 0L14 12.41v5.09c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5z"/></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Sanchaar</h2>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-slate-500">
            <a className="hover:text-slate-900" href="/">Home</a>
            <a className="text-sky-600 font-semibold" href="/schedule">Scheduling</a>
          </nav>
          <div />
        </div>
      </header>

      <main className="px-6 py-12 lg:px-10 xl:px-16 flex-1 bg-white polka-bg">
        <div className="max-w-7xl mx-auto">
          <LandingPage />
        </div>
      </main>
    </div>
  );
}

