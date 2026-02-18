type PlaceholderCardProps = {
  title: string;
  description: string;
  nextSteps: string[];
};

export function PlaceholderCard({ title, description, nextSteps }: PlaceholderCardProps) {
  return (
    <section className="app-panel p-4">
      <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p>
      <ul className="mt-3 space-y-2 text-sm text-[var(--text-primary)]">
        {nextSteps.map((step) => (
          <li key={step} className="rounded-xl bg-default-50/80 px-3 py-2">
            {step}
          </li>
        ))}
      </ul>
    </section>
  );
}
