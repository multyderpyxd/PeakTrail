export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-sm uppercase tracking-[0.3em] text-sky-400">
        Pirineo Aragonés
      </p>
      <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
        PeakTrail
      </h1>
      <p className="max-w-xl text-lg text-slate-400">
        Ibones, tresmiles, refugios y rutas del Pirineo aragonés en un mapa
        2.5D. En construcción — Hito 0 completado.
      </p>
      <div className="flex gap-4 text-sm uppercase tracking-widest text-slate-500">
        <span>Tresmiles</span>
        <span aria-hidden="true">·</span>
        <span>Ibones</span>
        <span aria-hidden="true">·</span>
        <span>Refugios</span>
        <span aria-hidden="true">·</span>
        <span>Rutas GR / PR / SL</span>
      </div>
    </main>
  );
}
