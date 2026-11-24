import { TESTIMONIALS } from "@/lib/testimonials";
import { Reveal } from "@/components/motion";

/// Real feedback from shop owners who tried Veriga. Nothing here is made up:
/// every entry comes from lib/testimonials.ts, added as people send it.
export function Testimonials({ title = "What shop owners say", compact = false }: { title?: string; compact?: boolean }) {
  if (!TESTIMONIALS.length) return null;
  return (
    <section className={compact ? "container-page pb-16" : "py-20 sm:py-24"}>
      <div className={compact ? "" : "container-page"}>
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">From the first shops</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={`${t.name}-${i}`} delay={i * 0.06}>
              <figure className="surface flex h-full flex-col justify-between p-6">
                <blockquote className="text-lg leading-8 text-ink-800">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand font-display text-sm font-bold text-white">
                    {t.name.slice(0, 1)}
                  </span>
                  <span>
                    <span className="block font-semibold">{t.name}</span>
                    <span className="block text-sm text-ink-500">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
