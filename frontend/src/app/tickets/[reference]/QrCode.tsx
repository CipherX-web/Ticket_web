"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface Props {
  value: string;
  size?: number;
}

export function QrCode({ value, size = 200 }: Props) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!value) return;
    let active = true;

    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: {
        dark: "#334B45", // forest brand color
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "M",
    })
      .then((url: string) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
    };
  }, [value, size]);

  if (error || !dataUrl) {
    return (
      <div
        role="img"
        aria-label={`QR code for ticket ${value}`}
        style={{ width: size, height: size }}
        className="flex flex-col items-center justify-center border border-line bg-paper p-3 text-center"
      >
        <span className="font-mono text-xs text-forest break-all">{value}</span>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`Scannable QR code for ticket ${value}`}
      width={size}
      height={size}
      className="border border-line bg-white p-1"
    />
  );
}
