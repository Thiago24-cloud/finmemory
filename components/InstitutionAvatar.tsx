"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { cn } from "../lib/utils";

export type ResolvedInstitutionAsset =
  | { kind: "logo"; uri: string; backgroundColor?: string | null }
  | { kind: "wallet" };

export type InstitutionAvatarProps = {
  /** Resultado de `resolveInstitutionAsset(tx)` — não recalcula dentro do componente */
  asset: ResolvedInstitutionAsset;
  /** Lado em px (padrão 40 × FinMemory). */
  size?: number;
  className?: string;
  /** Acessibilidade — ex.: nome do banco */
  label?: string;
};

export function InstitutionAvatar({ asset, size = 40, className, label }: InstitutionAvatarProps) {
  const safe =
    asset && typeof asset === "object"
      ? asset
      : { kind: "wallet" as const };

  const logoUri = safe.kind === "logo" ? safe.uri : "";
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const altBase = normalizeAlt(label ?? "");

  useEffect(() => {
    setImgLoaded(false);
    setImgFailed(false);
  }, [safe.kind, logoUri]);

  const iconPx = Math.max(16, Math.round(size * 0.52));

  if (safe.kind === "wallet" || imgFailed) {
    return (
      <div
        className={cn(
          "shrink-0 rounded-md overflow-hidden border border-[#e5e7eb] bg-[#f1f5f9] flex items-center justify-center text-[#64748b]",
          className
        )}
        style={{ width: size, height: size }}
        aria-label={altBase}
        role="img"
      >
        <Wallet width={iconPx} height={iconPx} strokeWidth={2} aria-hidden />
      </div>
    );
  }

  const showSkeleton = !imgLoaded && !imgFailed;

  return (
    <div
      className={cn(
        "relative shrink-0 rounded-md overflow-hidden border border-[#e5e7eb] bg-[#f8fafc]",
        safe.backgroundColor && "border-transparent",
        className
      )}
      style={{
        width: size,
        height: size,
        ...(safe.backgroundColor ? { backgroundColor: safe.backgroundColor } : {}),
      }}
    >
      {showSkeleton ? <div className="absolute inset-0 z-10 animate-pulse bg-black/10" aria-hidden /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={safe.uri}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={cn(
          "h-full w-full object-contain bg-white/5 transition-opacity duration-150",
          imgLoaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgFailed(true)}
      />
      <span className="sr-only">{altBase}</span>
    </div>
  );
}

function normalizeAlt(s: string) {
  const v = String(s || "").trim();
  return v ? `Logo: ${v}` : "Ícone carteira — sem instituição vinculada";
}
