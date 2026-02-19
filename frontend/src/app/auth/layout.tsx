export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--bg-app)] px-3 py-6">
      <div className="mx-auto w-full max-w-[430px] md:max-w-[1100px]">
        <section className="dark-hero rounded-[24px] border border-white/15 px-4 py-6 shadow-[var(--shadow-strong)]">
          <p className="text-xs uppercase tracking-[0.12em] text-white/65">Финансы</p>
          <h1 className="mt-1 text-2xl font-extrabold text-white">С возвращением</h1>
          <p className="mt-1 text-sm text-white/75">Управляйте бюджетом спокойно, точно и в одном месте.</p>
        </section>
        <div className="-mt-5">{children}</div>
      </div>
    </main>
  );
}
