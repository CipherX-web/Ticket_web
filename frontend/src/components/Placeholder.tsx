import Image from "next/image";

/**
 * Renders local studio imagery via `next/image` with a clean fallback frame.
 */
export function Placeholder({
  label,
  src,
  priority = false,
  className = "",
}: {
  label: string;
  src?: string;
  priority?: boolean;
  className?: string;
}) {
  if (src) {
    return (
      <div className={`relative overflow-hidden border border-line bg-studio-panel ${className}`}>
        <Image
          src={src}
          alt={label}
          fill
          priority={priority}
          unoptimized={src.endsWith(".svg")}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={label}
      className={`flex items-end border border-line bg-sage-soft p-3 text-xs uppercase tracking-widest text-forest/70 ${className}`}
      style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 14px, rgba(17,24,39,.05) 14px 15px)" }}
    >
      {label}
    </div>
  );
}
