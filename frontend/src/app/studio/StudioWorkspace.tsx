"use client";
import { useState } from "react";
import Link from "next/link";

type StudioMode = "invitation" | "print";
type Device = "mobile" | "tablet" | "desktop";
type ThemeTone = "ivory" | "paper" | "studio";

const ACCENTS = [
  { id: "vermilion", label: "Vermilion", hex: "#E14D2A" },
  { id: "gold", label: "Warm Gold", hex: "#D4A853" },
  { id: "obsidian", label: "Obsidian", hex: "#111827" },
  { id: "indigo", label: "Cobalt", hex: "#2563EB" },
];

const SCENES = [
  { id: "envelope", label: "01 · Envelope & Seal", duration: "1.2s reveal" },
  { id: "hero", label: "02 · Couple & Date", duration: "Pinned 120vh" },
  { id: "countdown", label: "03 · Live Countdown", duration: "Counter scrub" },
  { id: "venue", label: "04 · Venue & Map", duration: "Fade 0.6s" },
  { id: "rsvp", label: "05 · Guest RSVP", duration: "Interactive" },
];

const PRINT_PRESETS = [
  { id: "pass", label: "VIP Event Pass", size: "90 × 140 mm", bleed: "3 mm" },
  { id: "card", label: "Business Card", size: "90 × 55 mm", bleed: "3 mm" },
  { id: "poster", label: "Event Poster", size: "A3 · 297 × 420 mm", bleed: "5 mm" },
];

export function StudioWorkspace() {
  const [mode, setMode] = useState<StudioMode>("invitation");
  const [device, setDevice] = useState<Device>("mobile");
  const [showGuides, setShowGuides] = useState(true);
  const [activeScene, setActiveScene] = useState("envelope");
  const [activePreset, setActivePreset] = useState("pass");

  // Live editable properties
  const [title, setTitle] = useState("Amaya & Nuwan");
  const [subtitle, setSubtitle] = useState("Sunday, 14 February 2027 · Colombo");
  const [guestLabel, setGuestLabel] = useState("Dear Nimali Perera");
  const [accent, setAccent] = useState(ACCENTS[1]!);
  const [tone, setTone] = useState<ThemeTone>("studio");
  const [savedAt, setSavedAt] = useState("Saved locally");

  const frameWidth =
    mode === "print"
      ? "max-w-md"
      : device === "mobile"
        ? "max-w-[360px]"
        : device === "tablet"
          ? "max-w-[540px]"
          : "max-w-[720px]";

  const canvasSurface =
    tone === "studio"
      ? "bg-studio text-white border-studio-line"
      : tone === "paper"
        ? "bg-paper text-ink border-line"
        : "bg-ivory text-ink border-line";

  function handleSave() {
    setSavedAt(`Preview updated · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-studio text-white">
      {/* Studio Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-studio-line bg-studio-panel px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="rounded-sm bg-accent/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-widest text-accent">
            Studio
          </span>
          <div className="flex rounded-sm border border-studio-line bg-studio p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setMode("invitation");
                setTitle("Amaya & Nuwan");
                setSubtitle("Sunday, 14 February 2027 · Colombo");
              }}
              className={`rounded-sm px-3 py-1 transition-colors ${mode === "invitation" ? "bg-white text-ink font-medium" : "text-white/70 hover:text-white"}`}
            >
              Invitation Studio
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("print");
                setTitle("COLOMBO JAZZ NIGHT");
                setSubtitle("VIP ADMISSION · OPEN AIR THEATRE · 12 DEC");
              }}
              className={`rounded-sm px-3 py-1 transition-colors ${mode === "print" ? "bg-white text-ink font-medium" : "text-white/70 hover:text-white"}`}
            >
              Print &amp; Pass Proof
            </button>
          </div>
          <span className="hidden text-xs text-white/50 sm:inline">{savedAt}</span>
        </div>

        <div className="flex items-center gap-2">
          {mode === "invitation" && (
            <div className="hidden items-center rounded-sm border border-studio-line bg-studio p-0.5 text-xs sm:flex" role="group" aria-label="Device frame">
              {(["mobile", "tablet", "desktop"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDevice(d)}
                  className={`rounded-sm px-2.5 py-1 capitalize ${device === d ? "bg-studio-panel text-white" : "text-white/60 hover:text-white"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowGuides((g) => !g)}
            aria-pressed={showGuides}
            className={`rounded-sm border px-3 py-1.5 text-xs transition-colors ${
              showGuides ? "border-accent text-accent" : "border-studio-line text-white/70 hover:text-white"
            }`}
          >
            {showGuides ? "Guides: On" : "Guides: Off"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-sm bg-accent px-3.5 py-1.5 text-xs font-medium text-white hover:bg-accent-deep"
          >
            Save Snapshot
          </button>
          <Link
            href={mode === "invitation" ? "/i/demo" : "/print/business-cards"}
            className="hidden rounded-sm border border-studio-line px-3 py-1.5 text-xs text-white/80 hover:border-white hover:text-white md:inline-block"
          >
            Full View ↗
          </Link>
        </div>
      </div>

      {/* Main 3-Column Studio Workspace */}
      <div className="grid flex-1 lg:grid-cols-[260px_1fr_300px]">
        {/* Left Rail: Scenes or Presets */}
        <aside className="border-b border-studio-line bg-studio-panel p-4 lg:border-b-0 lg:border-r" aria-label="Layers and scenes">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
            {mode === "invitation" ? "Scene Sequence" : "Print Formats"}
          </p>
          <ul className="mt-3 space-y-1.5">
            {mode === "invitation"
              ? SCENES.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setActiveScene(s.id)}
                      className={`w-full rounded-sm border px-3 py-2.5 text-left transition-colors ${
                        activeScene === s.id
                          ? "border-accent bg-studio text-white"
                          : "border-transparent text-white/70 hover:border-studio-line hover:text-white"
                      }`}
                    >
                      <p className="text-xs font-medium">{s.label}</p>
                      <p className="mt-0.5 text-[11px] text-white/45">{s.duration}</p>
                    </button>
                  </li>
                ))
              : PRINT_PRESETS.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setActivePreset(p.id)}
                      className={`w-full rounded-sm border px-3 py-2.5 text-left transition-colors ${
                        activePreset === p.id
                          ? "border-accent bg-studio text-white"
                          : "border-transparent text-white/70 hover:border-studio-line hover:text-white"
                      }`}
                    >
                      <p className="text-xs font-medium">{p.label}</p>
                      <p className="mt-0.5 text-[11px] text-white/45">{p.size} · Bleed {p.bleed}</p>
                    </button>
                  </li>
                ))}
          </ul>

          <div className="mt-6 border-t border-studio-line pt-4 text-xs text-white/55">
            <p className="font-medium text-white/80">Preflight Check</p>
            <ul className="mt-2 space-y-1.5 text-[11px]">
              <li className="flex items-center justify-between"><span>Colour profile</span><span className="text-emerald-400">CMYK / sRGB OK</span></li>
              <li className="flex items-center justify-between"><span>Safe margin</span><span className="text-emerald-400">5 mm clear</span></li>
              <li className="flex items-center justify-between"><span>Motion budget</span><span className="text-emerald-400">60 FPS / Reduced</span></li>
            </ul>
          </div>
        </aside>

        {/* Center Live Canvas */}
        <section className="studio-grid relative flex flex-col items-center justify-center p-6 md:p-10" aria-label="Live studio canvas">
          <div className={`relative w-full transition-all duration-300 ${frameWidth}`}>
            {/* Optional Bleed & Safe-Zone Crop Marks */}
            {showGuides && (
              <div className="pointer-events-none absolute -inset-3 border border-dashed border-accent/55" aria-hidden="true">
                <span className="absolute -top-5 left-0 text-[10px] uppercase tracking-widest text-accent">
                  {mode === "print" ? "3mm Bleed Boundary" : `${device} viewport · safe area`}
                </span>
              </div>
            )}

            <div className={`relative overflow-hidden border p-8 shadow-2xl md:p-10 ${canvasSurface}`}>
              {showGuides && (
                <div className="pointer-events-none absolute inset-4 border border-dotted border-current/20" aria-hidden="true" />
              )}

              {mode === "invitation" ? (
                <div className="relative z-10 flex min-h-[420px] flex-col items-center justify-between text-center">
                  <p className="text-[11px] uppercase tracking-[0.28em]" style={{ color: accent.hex }}>
                    {guestLabel}
                  </p>
                  <div className="my-6">
                    <p className="text-xs uppercase tracking-[0.2em] opacity-60">
                      {SCENES.find((s) => s.id === activeScene)?.label}
                    </p>
                    <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">{title}</h2>
                    <p className="mt-3 text-sm opacity-75">{subtitle}</p>
                  </div>
                  <div className="w-full max-w-xs border-t border-current/15 pt-5">
                    <span
                      className="inline-block rounded-sm px-5 py-2.5 text-xs font-medium uppercase tracking-widest text-white"
                      style={{ backgroundColor: accent.hex }}
                    >
                      {activeScene === "rsvp" ? "Confirm Attendance" : "Open Invitation"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="relative z-10 flex min-h-[340px] flex-col justify-between">
                  <div className="flex items-start justify-between border-b border-current/15 pb-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] opacity-60">
                        {PRINT_PRESETS.find((p) => p.id === activePreset)?.label}
                      </p>
                      <h2 className="mt-2 font-display text-2xl tracking-wide md:text-3xl">{title}</h2>
                    </div>
                    <span className="h-6 w-6 rounded-full" style={{ backgroundColor: accent.hex }} aria-hidden="true" />
                  </div>
                  <p className="my-6 text-xs uppercase tracking-[0.2em] opacity-75">{subtitle}</p>
                  <div className="flex items-end justify-between border-t border-dashed border-current/25 pt-4">
                    <div className="text-[11px] opacity-65">
                      <p>GUEST: {guestLabel}</p>
                      <p className="mt-0.5">REF: PX-2026-8492</p>
                    </div>
                    <div className="grid h-14 w-14 grid-cols-3 gap-0.5 border border-current/30 p-1" aria-label="Sample QR placeholder">
                      {Array.from({ length: 9 }).map((_, idx) => (
                        <span key={idx} className={idx % 2 === 0 ? "bg-current" : "bg-transparent"} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Right Inspector */}
        <aside className="border-t border-studio-line bg-studio-panel p-5 lg:border-l lg:border-t-0" aria-label="Properties inspector">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">Inspector</p>

          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="st-title" className="block text-xs text-white/75">Headline / Names</label>
              <input
                id="st-title"
                value={title}
                maxLength={60}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1.5 w-full rounded-sm border border-studio-line bg-studio px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="st-sub" className="block text-xs text-white/75">Date / Venue Line</label>
              <input
                id="st-sub"
                value={subtitle}
                maxLength={90}
                onChange={(e) => setSubtitle(e.target.value)}
                className="mt-1.5 w-full rounded-sm border border-studio-line bg-studio px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="st-guest" className="block text-xs text-white/75">Personalization Token Preview</label>
              <input
                id="st-guest"
                value={guestLabel}
                maxLength={60}
                onChange={(e) => setGuestLabel(e.target.value)}
                className="mt-1.5 w-full rounded-sm border border-studio-line bg-studio px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
              />
            </div>

            <div>
              <p className="text-xs text-white/75">Accent Colour</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {ACCENTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAccent(a)}
                    className={`flex items-center gap-2 rounded-sm border px-2.5 py-2 text-xs ${
                      accent.id === a.id ? "border-white bg-studio text-white" : "border-studio-line text-white/70 hover:text-white"
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: a.hex }} aria-hidden="true" />
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-white/75">Surface Tone</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                {(["studio", "paper", "ivory"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`rounded-sm border py-2 capitalize ${
                      tone === t ? "border-accent bg-studio text-white" : "border-studio-line text-white/70 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-6 border-t border-studio-line pt-4 text-[11px] text-white/50">
            Interactive studio preview. Server-side template publishing, CSV guest import, and proof approval connect in Phases 2 &amp; 4.
          </p>
        </aside>
      </div>
    </div>
  );
}
