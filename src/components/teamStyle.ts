export type TeamStyle = { text: string; bg: string; soft: string; border: string; hex: string };

const STYLES: Record<string, TeamStyle> = {
  emerald: { text: "text-emerald", bg: "bg-emerald", soft: "bg-emerald-soft", border: "border-emerald", hex: "#087a62" },
  sapphire: { text: "text-sapphire", bg: "bg-sapphire", soft: "bg-sapphire-soft", border: "border-sapphire", hex: "#187bb8" },
  amethyst: { text: "text-amethyst", bg: "bg-amethyst", soft: "bg-amethyst-soft", border: "border-amethyst", hex: "#8556b2" },
};

export const teamStyle = (key: string): TeamStyle => STYLES[key] ?? STYLES.emerald;
