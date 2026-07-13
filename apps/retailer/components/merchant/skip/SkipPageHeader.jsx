/** Título de página no estilo Skip (Cozinha, Garçom, etc.) */
export function SkipPageHeader({ icon: Icon, title, description }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold flex items-center gap-2 m-0">
        {Icon ? <Icon className="w-7 h-7 text-primary" /> : null}
        {title}
      </h1>
      {description ? (
        <p className="text-sm text-muted-foreground mt-1 m-0">{description}</p>
      ) : null}
    </div>
  );
}
