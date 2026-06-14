/**
 * Shared tone palette for category badges.
 *
 * Tailwind class strings used across post / work / collaboration / tool
 * category metadata. Centralized so every domain pulls from the same set —
 * if you tweak `cyan` here, it updates everywhere it's referenced.
 *
 * Most tones follow the standard recipe:
 *   bg-{color}-500/10 text-{color}-700 border-{color}-500/40
 *   dark:bg-{color}-500/15 dark:text-{color}-300 dark:border-{color}-500/30
 *
 * A few keys ending in `Deep` / `Soft` are one-off variants that use a
 * darker text shade (700 → 800, 300 → 200) — preserved as-is from the
 * original inline strings to keep visible colors identical.
 */
export type ToneKey =
  | "slate"
  | "zinc"
  | "stoneSoft"
  | "cyan"
  | "cyanDeep"
  | "sky"
  | "blue"
  | "indigo"
  | "violet"
  | "purple"
  | "fuchsia"
  | "rose"
  | "amber"
  | "yellowDeep"
  | "emerald"
  | "teal";

export const CATEGORY_TONE: Record<ToneKey, string> = {
  slate:
    "bg-slate-500/10 text-slate-700 border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300 dark:border-slate-500/30",
  zinc:
    "bg-zinc-500/10 text-zinc-700 border-zinc-500/40 dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/30",
  stoneSoft:
    "bg-stone-500/10 text-stone-700 border-stone-500/40 dark:bg-stone-500/15 dark:text-stone-200 dark:border-stone-500/30",
  cyan:
    "bg-cyan-500/10 text-cyan-700 border-cyan-500/40 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30",
  cyanDeep:
    "bg-cyan-500/10 text-cyan-800 border-cyan-500/40 dark:bg-cyan-500/15 dark:text-cyan-200 dark:border-cyan-500/30",
  sky:
    "bg-sky-500/10 text-sky-700 border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30",
  blue:
    "bg-blue-500/10 text-blue-700 border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  indigo:
    "bg-indigo-500/10 text-indigo-700 border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30",
  violet:
    "bg-violet-500/10 text-violet-700 border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  purple:
    "bg-purple-500/10 text-purple-700 border-purple-500/40 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30",
  fuchsia:
    "bg-fuchsia-500/10 text-fuchsia-700 border-fuchsia-500/40 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:border-fuchsia-500/30",
  rose:
    "bg-rose-500/10 text-rose-700 border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  amber:
    "bg-amber-500/10 text-amber-700 border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  yellowDeep:
    "bg-yellow-500/10 text-yellow-800 border-yellow-500/40 dark:bg-yellow-500/15 dark:text-yellow-200 dark:border-yellow-500/30",
  emerald:
    "bg-emerald-500/10 text-emerald-700 border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  teal:
    "bg-teal-500/10 text-teal-700 border-teal-500/40 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30",
};
