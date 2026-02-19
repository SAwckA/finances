export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--bg-app)] px-3 py-6">
      <div className="mx-auto w-full max-w-[430px]">
        <section className="dark-hero rounded-[24px] border border-[color:color-mix(in_srgb,var(--border-soft)_78%,transparent)] px-4 py-6 shadow-[var(--shadow-strong)]">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Финансы</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[var(--text-primary)]">С возвращением</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Управляйте бюджетом спокойно, точно и в одном месте.
          </p>
        </section>
        <div className="-mt-5">{children}</div>
      </div>
    </main>
  );
}
