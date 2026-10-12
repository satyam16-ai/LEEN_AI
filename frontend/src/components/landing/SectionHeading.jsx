export function SectionHeading({ eyebrow, title, description, id }) {
  return (
    <div className="mx-auto mb-14 max-w-2xl space-y-4 text-center">
      <p className="text-sm font-semibold tracking-wide text-primary uppercase">{eyebrow}</p>
      <h2 id={id} className="text-3xl leading-tight font-extrabold sm:text-4xl">
        {title}
      </h2>
      {description && <p className="text-lg text-muted-foreground">{description}</p>}
    </div>
  );
}
