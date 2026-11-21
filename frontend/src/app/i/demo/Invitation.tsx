"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Reveal } from "@/components/Reveal";
import { submitInvitationRsvp } from "@/lib/api";

function useCountdown(target: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(target).getTime() - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

export function Invitation({
  token,
  guestName,
  coupleTitle,
  eventDate,
  venueName,
  venueAddress,
  storyText,
  initialRsvp = "",
}: {
  token: string;
  guestName: string;
  coupleTitle: string;
  eventDate: string;
  venueName: string;
  venueAddress: string;
  storyText: string;
  initialRsvp?: "" | "yes" | "no";
}) {
  const [opened, setOpened] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rsvp, setRsvp] = useState<"" | "yes" | "no">(initialRsvp);
  const [saving, setSaving] = useState(false);
  const [rsvpMessage, setRsvpMessage] = useState("");
  const left = useCountdown(eventDate);

  useEffect(() => {
    if (!opened) return;
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? window.scrollY / h : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [opened]);

  async function handleRsvp(choice: "yes" | "no") {
    setSaving(true);
    setRsvpMessage("");
    try {
      await submitInvitationRsvp(token, {
        status: choice === "yes" ? "ACCEPTED" : "DECLINED",
        count: choice === "yes" ? 1 : 0,
      });
      setRsvp(choice);
      setRsvpMessage("Your RSVP has been saved.");
    } catch {
      setRsvp(choice);
      setRsvpMessage("Preview mode — start the backend to persist RSVPs.");
    } finally {
      setSaving(false);
    }
  }

  const d = left === null ? null : Math.floor(left / 86_400_000);
  const h = left === null ? null : Math.floor((left % 86_400_000) / 3_600_000);
  const m = left === null ? null : Math.floor((left % 3_600_000) / 60_000);

  if (!opened) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center bg-studio px-6 text-center text-white">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">You are invited</p>
        <div className="my-10 flex h-44 w-72 items-center justify-center border border-gold/60 bg-studio-panel" aria-hidden="true">
          <span className="font-display text-5xl text-gold">A &amp; N</span>
        </div>
        <Button onClick={() => setOpened(true)} className="bg-gold text-forest-deep hover:bg-white">Open invitation</Button>
        <p className="mt-6 text-xs text-white/60">Personal invitation for {guestName}</p>
      </div>
    );
  }

  return (
    <article className="bg-ivory">
      <div className="fixed left-0 top-0 z-50 h-0.5 bg-gold" style={{ width: `${progress * 100}%` }} aria-hidden="true" />

      <section className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <Reveal><p className="text-xs uppercase tracking-[0.3em] text-forest/70">{guestName}, we would love you to join us</p></Reveal>
        <Reveal delay={120}><h1 className="mt-6 font-display text-6xl text-forest md:text-8xl">{coupleTitle}</h1></Reveal>
        <Reveal delay={240}><p className="mt-6 text-lg text-muted">{new Date(eventDate).toDateString()} · Colombo</p></Reveal>
      </section>

      <section className="bg-paper py-24 text-center" aria-label="Countdown">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-forest/70">Counting down</p>
          <p className="mt-6 font-display text-5xl text-forest" aria-live="off">
            {d === null ? "—" : `${d}d ${h}h ${m}m`}
          </p>
        </Reveal>
      </section>

      <section className="container-x max-w-2xl py-24 text-center">
        <Reveal><h2 className="font-display text-3xl text-forest">Our story</h2></Reveal>
        <Reveal delay={100}><p className="mt-5 text-muted">{storyText}</p></Reveal>
      </section>

      <section className="bg-paper py-24" aria-label="Venue">
        <div className="container-x max-w-2xl text-center">
          <Reveal>
            <h2 className="font-display text-3xl text-forest">Venue</h2>
            <p className="mt-4 text-muted">{venueName}, {venueAddress}<br />Ceremony 10:00 am · Reception 6:30 pm</p>
            <a className="mt-6 inline-block border border-forest px-5 py-3 text-sm text-forest hover:bg-forest hover:text-white"
              href="https://www.google.com/maps/search/?api=1&query=Colombo" target="_blank" rel="noopener noreferrer">Get directions</a>
          </Reveal>
        </div>
      </section>

      <section className="container-x max-w-xl py-24 text-center" aria-label="RSVP">
        <Reveal>
          <h2 className="font-display text-3xl text-forest">Will you attend?</h2>
          <div className="mt-6 flex justify-center gap-3" role="group" aria-label="RSVP response">
            <Button variant={rsvp === "yes" ? "primary" : "secondary"} disabled={saving} aria-pressed={rsvp === "yes"} onClick={() => handleRsvp("yes")}>Joyfully accept</Button>
            <Button variant={rsvp === "no" ? "primary" : "secondary"} disabled={saving} aria-pressed={rsvp === "no"} onClick={() => handleRsvp("no")}>Regretfully decline</Button>
          </div>
          <p role="status" className="mt-5 min-h-6 text-sm text-muted">{rsvpMessage}</p>
        </Reveal>
      </section>
    </article>
  );
}
