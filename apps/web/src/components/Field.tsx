"use client";
import { useId } from "react";

export function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-forest">{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 block w-full border border-line bg-ivory px-3 py-3 text-sm">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function TextField({ label, name, error, textarea, ...rest }: { label: string; name: string; error?: string; textarea?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const cls = "mt-2 block w-full border bg-ivory px-3 py-3 text-sm " + (error ? "border-danger" : "border-line");
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-forest">{label}</label>
      {textarea ? (
        <textarea id={id} name={name} rows={5} aria-invalid={!!error} aria-describedby={`${id}-e`} className={cls} />
      ) : (
        <input id={id} name={name} aria-invalid={!!error} aria-describedby={`${id}-e`} className={cls} {...rest} />
      )}
      <p id={`${id}-e`} role={error ? "alert" : undefined} className="mt-1 min-h-5 text-sm text-danger">{error}</p>
    </div>
  );
}

