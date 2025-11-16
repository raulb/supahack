import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-16 text-center text-slate-100">
      <section className="max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/70 p-12 shadow-2xl shadow-slate-950/40">
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Supabase Demo</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Realtime submissions playground</h1>
        <p className="mt-4 text-base text-slate-300">
          Submit text snippets, watch them stream into the database via Supabase Realtime, and explore additional RPC-powered tools.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/demo"
            className="rounded-2xl bg-emerald-500 px-6 py-3 text-base font-semibold text-emerald-950 transition hover:bg-emerald-400"
          >
            Open the demo
          </Link>
          <Link
            href="https://supabase.com"
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-slate-600 px-6 py-3 text-base font-semibold text-white transition hover:border-slate-400"
          >
            Learn more
          </Link>
        </div>
      </section>
    </main>
  );
}

