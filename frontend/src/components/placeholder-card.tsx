type PlaceholderCardProps = {
  title: string;
  description: string;
  nextSteps: string[];
};

export function PlaceholderCard({ title, description, nextSteps }: PlaceholderCardProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <ul className="mt-3 space-y-2 text-sm text-slate-700">
        {nextSteps.map((step) => (
          <li key={step} className="rounded-xl bg-slate-50 px-3 py-2">
            {step}
          </li>
        ))}
      </ul>
    </section>
  );
}
