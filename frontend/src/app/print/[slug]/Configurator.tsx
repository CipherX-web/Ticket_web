"use client";
import { useMemo, useState } from "react";
import type { Product } from "@/data/products";
import { createPrintOrder } from "@/lib/api";
import { estimate } from "@/lib/pricing";
import { formatLkr } from "@/lib/format";
import { fieldErrors, guestSchema } from "@/lib/validation";
import { Button } from "@/components/Button";
import { Placeholder } from "@/components/Placeholder";
import { Select, TextField } from "@/components/Field";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/tiff"];

export function Configurator({ product }: { product: Product }) {
  const [sizeId, setSizeId] = useState(product.sizes[0]!.id);
  const [materialId, setMaterialId] = useState(product.materials[0]!.id);
  const [finishId, setFinishId] = useState(product.finishes[0]!.id);
  const [quantity, setQuantity] = useState(product.quantities[0]!);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [created, setCreated] = useState<{ reference: string; status: string; totalMinor: number } | null>(null);

  const est = useMemo(
    () => estimate(product, { sizeId, materialId, finishId, quantity }),
    [product, sizeId, materialId, finishId, quantity],
  );

  function onFile(f: File | undefined) {
    setFileError("");
    setFile(null);
    setCreated(null);
    if (!f) return;
    if (!ALLOWED.includes(f.type)) return setFileError("Use a PDF, PNG, JPEG or TIFF file.");
    if (f.size > MAX_BYTES) return setFileError("File is larger than 50 MB.");
    setFile(f);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError("");
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const parsed = guestSchema.safeParse(data);
    const next = parsed.success ? {} : fieldErrors(parsed.error);
    if (!file) setFileError("Upload your artwork file first.");
    setErrors(next);
    if (!est || !file || !parsed.success) return;

    setSubmitting(true);
    try {
      const res = await createPrintOrder({
        productSlug: product.slug,
        sizeId,
        materialId,
        finishId,
        quantity,
        customerName: parsed.data.name,
        customerEmail: parsed.data.email,
        customerPhone: parsed.data.whatsapp,
        artworkName: file.name,
      });
      setCreated(res);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Could not place order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      <form className="space-y-5 border border-line bg-paper p-6" onSubmit={submit} noValidate>
        <Select label="Size" value={sizeId} onChange={setSizeId} options={product.sizes.map((o) => ({ value: o.id, label: o.label }))} />
        <Select label="Material" value={materialId} onChange={setMaterialId} options={product.materials.map((o) => ({ value: o.id, label: o.label }))} />
        <Select label="Finish" value={finishId} onChange={setFinishId} options={product.finishes.map((o) => ({ value: o.id, label: o.label }))} />
        <Select
          label="Quantity"
          value={String(quantity)}
          onChange={(v) => setQuantity(Number(v))}
          options={product.quantities.map((q) => ({ value: String(q), label: q.toLocaleString("en-LK") }))}
        />

        <div>
          <label htmlFor="art" className="block text-sm font-medium text-forest">Artwork</label>
          <input
            id="art"
            type="file"
            accept={ALLOWED.join(",")}
            onChange={(e) => onFile(e.target.files?.[0])}
            aria-describedby="art-help art-err"
            className="mt-2 block w-full border border-line bg-ivory p-2 text-sm file:mr-4 file:border-0 file:bg-forest file:px-4 file:py-2 file:text-ivory"
          />
          <p id="art-help" className="mt-2 text-xs text-muted">
            PDF, PNG, JPEG or TIFF up to 50 MB. 300 DPI at final size, 3 mm bleed, text kept 5 mm inside the trim.
          </p>
          <p id="art-err" role="alert" className="mt-1 min-h-5 text-sm text-danger">{fileError}</p>
        </div>

        <fieldset className="space-y-1 border-t border-line pt-4">
          <legend className="text-xs font-medium uppercase tracking-[0.18em] text-forest/70">Your contact details</legend>
          <TextField label="Full name" name="name" autoComplete="name" error={errors.name} />
          <TextField label="Email" name="email" type="email" autoComplete="email" error={errors.email} />
          <TextField label="WhatsApp number" name="whatsapp" type="tel" autoComplete="tel" placeholder="+94 77 123 4567" error={errors.whatsapp} />
        </fieldset>

        {serverError && <p role="alert" className="border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{serverError}</p>}

        <Button type="submit" disabled={!est || submitting} className="w-full">
          {submitting ? "Creating print order..." : "Submit print order"}
        </Button>

        {created && (
          <div role="status" className="border border-forest bg-sage-soft p-4 text-sm text-forest">
            <p className="font-medium">Order {created.reference} created · {created.status}</p>
            <p className="mt-1">Total: {formatLkr(created.totalMinor)}. Use this reference on the Track Order page.</p>
          </div>
        )}
      </form>

      <aside className="space-y-4" aria-label="Estimate">
        <Placeholder src={`/temp/${product.slug}.svg`} label={`${product.name} preview`} className="aspect-[4/3]" />
        <div className="border border-line bg-paper p-6" aria-live="polite">
          <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-forest/70">Estimate</h2>
          {est ? (
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Unit price</dt><dd>{formatLkr(est.unitMinor)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatLkr(est.subtotalMinor)}</dd></div>
              {est.discountPct > 0 && (
                <div className="flex justify-between"><dt className="text-muted">Volume discount</dt><dd>−{est.discountPct}%</dd></div>
              )}
              <div className="flex justify-between border-t border-line pt-3 text-lg font-medium text-forest">
                <dt>Total (est.)</dt><dd>{formatLkr(est.totalMinor)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-danger">This combination is not available.</p>
          )}
          <ul className="mt-5 space-y-1 border-t border-line pt-4 text-xs text-muted">
            <li>Lead time: {product.leadTime} after proof approval.</li>
            <li>{product.proofRequired ? "A proof is sent for your approval before printing." : "No proof required."}</li>
            <li>Delivery or pickup cost is shown at checkout. Final price is confirmed by Print X.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
