import { HeroDemo } from "../components/hero-demo";

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,#0ea5e922,transparent_50%),radial-gradient(circle_at_bottom_right,#22d3ee1a,transparent_45%)]" />
      <HeroDemo />
    </main>
  );
}
