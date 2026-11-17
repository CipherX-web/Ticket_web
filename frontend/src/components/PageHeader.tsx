export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="border-b border-line bg-paper">
      <div className="container-x py-12 md:py-16">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight text-forest md:text-5xl">{title}</h1>
        {children ? <p className="mt-4 max-w-2xl text-lg text-muted">{children}</p> : null}
      </div>
    </section>
  );
}
