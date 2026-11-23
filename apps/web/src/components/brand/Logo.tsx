/* eslint-disable @next/next/no-img-element */

/// The Veriga logo, from the original artwork (public/brand). The mark and the
/// wordmark are cut from the source file with a transparent background; the
/// wordmark has an ink version for light pages and a white one for dark bands.

export function LogoMark({ className = "h-8 w-auto" }: { className?: string }) {
  return <img src="/brand/veriga-mark.png" alt="Veriga" className={`select-none object-contain ${className}`} draggable={false} />;
}

export function Logo({ className = "", tone = "dark", size = "md" }: { className?: string; tone?: "dark" | "light"; size?: "sm" | "md" | "lg" }) {
  const markH = size === "sm" ? "h-6" : size === "lg" ? "h-10" : "h-8";
  const wordH = size === "sm" ? "h-[18px]" : size === "lg" ? "h-7" : "h-[22px]";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src="/brand/veriga-mark.png" alt="" aria-hidden className={`${markH} w-auto select-none`} draggable={false} />
      <img
        src={tone === "light" ? "/brand/veriga-wordmark-light.png" : "/brand/veriga-wordmark-dark.png"}
        alt="Veriga"
        className={`${wordH} w-auto select-none`}
        draggable={false}
      />
    </span>
  );
}
