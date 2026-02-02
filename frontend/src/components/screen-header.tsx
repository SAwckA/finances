export function ScreenHeader({ title, description }: { title: string; description: string }) {
  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </section>
  );
}
