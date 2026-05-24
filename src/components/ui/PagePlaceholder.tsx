type PagePlaceholderProps = {
  title: string;
  description: string;
};

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-card p-12 text-center shadow-sm">
      <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>
      <p className="mt-6 text-xs font-medium uppercase tracking-wide text-slate-400">
        Coming in a future phase
      </p>
    </div>
  );
}
