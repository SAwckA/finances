import { FinanceWorkbench } from "../components/finance-workbench";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(165deg,#f4f7fb_0%,#ebf1fa_35%,#f8f5ef_100%)] px-4 py-6 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,#0f766e22,transparent_50%),radial-gradient(circle_at_bottom_right,#b4530917,transparent_45%)]" />
      <div className="relative mx-auto w-full max-w-7xl">
        <FinanceWorkbench />
      </div>
    </main>
  );
}
