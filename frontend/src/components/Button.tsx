import Link from "next/link";
import type { ComponentProps } from "react";

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm px-5 py-3 text-sm font-medium tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variants = {
  primary: "bg-accent text-white hover:bg-accent-deep",
  dark: "bg-forest text-white hover:bg-forest-deep",
  secondary: "border border-forest text-forest hover:bg-forest hover:text-white",
  "secondary-light": "border border-white/25 text-white hover:border-white hover:bg-white/10",
  ghost: "text-forest underline-offset-4 hover:underline",
};

export function ButtonLink({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: keyof typeof variants }) {
  return <Link className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: keyof typeof variants }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
