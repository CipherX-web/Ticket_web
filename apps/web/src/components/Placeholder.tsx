import Image from "next/image";

/**
 * TEMPORARY imagery. `src` points at illustrative SVGs in /public/temp.
 * Replace with real, compressed photography (see printx-frontend-quality) before launch.
 */
export function Placeholder({ label, src, className = "" }: { label: string; src?: string; className?: string }) {
  if (src) {
    return (
      <div className={`relative overflow-hidden border border-line bg-sage-soft ${className}`}>
        <Image src={src} alt={label} fill unoptimized sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={label}
      className={`flex items-end border border-line bg-sage-soft p-3 text-xs uppercase tracking-widest text-forest/70 ${className}`}
      style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 14px, rgba(51,75,69,.05) 14px 15px)" }}
    >
      {label}
    </div>
  );
}
