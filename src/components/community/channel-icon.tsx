import {
  BookOpen,
  Briefcase,
  Clapperboard,
  ClipboardList,
  Film,
  Handshake,
  Hash,
  HelpCircle,
  Images,
  Megaphone,
  MessageCircle,
  Microscope,
  Newspaper,
  Palette,
  Rocket,
  Search,
  ShoppingCart,
  Sparkles,
  Sprout,
  TrendingUp,
  Trophy,
  UserSquare,
  Wand2,
  Wrench,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Stable channel icon names. The DB still stores a string in `Channel.icon`;
// new seeds write a name like `"message-circle"`, and this helper resolves
// it to a Lucide component. Unknown / legacy emoji strings render as a
// neutral `#` so old dev databases still show *something* instead of
// crashing — but the production look-and-feel is the Lucide icon set.
const CHANNEL_ICON_MAP: Record<string, LucideIcon> = {
  "message-circle": MessageCircle,
  "help-circle": HelpCircle,
  clapperboard: Clapperboard,
  "book-open": BookOpen,
  images: Images,
  "user-square": UserSquare,
  "shopping-cart": ShoppingCart,
  wrench: Wrench,
  sparkles: Sparkles,
  "wand-2": Wand2,
  workflow: Workflow,
  rocket: Rocket,
  film: Film,
  palette: Palette,
  handshake: Handshake,
  briefcase: Briefcase,
  "clipboard-list": ClipboardList,
  newspaper: Newspaper,
  search: Search,
  microscope: Microscope,
  "trending-up": TrendingUp,
  trophy: Trophy,
  sprout: Sprout,
  megaphone: Megaphone,
};

export function resolveChannelIcon(name: string | null | undefined): LucideIcon | null {
  if (!name) return null;
  return CHANNEL_ICON_MAP[name] ?? null;
}

export function ChannelIcon({
  name,
  className,
  fallbackClassName,
}: {
  name: string | null | undefined;
  className?: string;
  /** Class applied to the `#` fallback when `name` is unknown. */
  fallbackClassName?: string;
}) {
  const Icon = resolveChannelIcon(name);
  if (Icon) {
    return <Icon className={cn("size-4", className)} aria-hidden />;
  }
  return (
    <Hash
      className={cn("size-4", className, fallbackClassName)}
      aria-hidden
    />
  );
}
