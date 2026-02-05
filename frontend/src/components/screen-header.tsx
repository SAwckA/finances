export function ScreenHeader({ title, description }: { title: string; description: string }) {
  return (
    <section className="app-panel mb-4 p-4">
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
    </section>
  );
}
