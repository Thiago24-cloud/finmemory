"use client";

import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { cn } from "../lib/utils";

export type ResolvedInstitutionAsset =
  | {
      kind: "logo";
      uri: string;
      backgroundColor?: string | null;
      logoScale?: number;
      logoPad?: "brand" | "light";
      monogram?: string | null;
      textColor?: string | null;
    }
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

  const altBase = normalizeAlt(
    label ?? (safe.kind === "logo" ? safe.monogram ?? "" : "")
  );

  useEffect(() => {
    setImgLoaded(false);
    setImgFailed(false);
  }, [safe.kind, logoUri]);

  const iconPx = Math.max(16, Math.round(size * 0.52));
  const logoScale = safe.kind === "logo" ? safe.logoScale ?? 1 : 1;
  const logoPad = safe.kind === "logo" ? safe.logoPad ?? "light" : "light";
  const bgColor =
    safe.kind === "logo" && safe.backgroundColor ? safe.backgroundColor : "#334155";
  const monogram =
    safe.kind === "logo" && safe.monogram
      ? String(safe.monogram).trim().slice(0, 2).toUpperCase()
      : null;
  const monogramColor =
    safe.kind === "logo" && safe.textColor ? safe.textColor : "#FFFFFF";

  if (safe.kind === "wallet" || imgFailed) {
    return (
      <div
        className={cn(
          "shrink-0 rounded-xl overflow-hidden border border-white/10 bg-[#334155] shadow-[0_4px_12px_rgba(0,0,0,0.18)] flex items-center justify-center text-white/90",
          className
        )}
        style={{ width: size, height: size }}
        aria-label={altBase}
        role="img"
      >
        {monogram ? (
          <span className="text-[11px] font-extrabold tracking-tight" aria-hidden>
            {monogram}
          </span>
        ) : (
          <Wallet width={iconPx} height={iconPx} strokeWidth={2.25} aria-hidden />
        )}
      </div>
    );
  }

  const showSkeleton = !imgLoaded && !imgFailed;
  const useLightPad = logoPad === "light";

  return (
    <div
      className={cn(
        "relative shrink-0 rounded-xl overflow-hidden shadow-[0_4px_14px_rgba(0,0,0,0.16)] ring-1 ring-white/15",
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: useLightPad ? "#FFFFFF" : bgColor,
      }}
    >
      {showSkeleton ? (
        <div
          className="absolute inset-0 z-10 animate-pulse bg-white/20"
          aria-hidden
        />
      ) : null}
      <div
        className={cn(
          "flex h-full w-full items-center justify-center",
          useLightPad ? "p-1.5 bg-white" : "p-0.5"
        )}
      >
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
            "max-h-full max-w-full object-contain transition-opacity duration-200",
            useLightPad ? "drop-shadow-sm" : "",
            imgLoaded ? "opacity-100" : "opacity-0"
          )}
          style={{ transform: `scale(${logoScale})` }}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
        />
      </div>
      <span className="sr-only">{altBase}</span>
    </div>
  );
}

function normalizeAlt(s: string) {
  const v = String(s || "").trim();
  return v ? `Logo: ${v}` : "Ícone carteira — sem instituição vinculada";
}
