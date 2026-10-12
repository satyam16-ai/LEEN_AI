export function AuthHeader({ title, description }) {
  return (
    <div className="mb-8 space-y-2">
      <h1 className="text-[1.75rem] leading-tight font-extrabold">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
