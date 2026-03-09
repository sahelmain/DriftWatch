export type MonitoringTone =
  | "healthy"
  | "attention"
  | "watch"
  | "quiet"
  | "active";

export type SignalTone = "blue" | "green" | "amber" | "red" | "violet";

export const monitoringToneStyles = {
  healthy: {
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    icon: "bg-emerald-500/15 text-emerald-300",
    panel: "border-emerald-500/20 bg-emerald-500/5",
  },
  attention: {
    badge: "border-red-500/30 bg-red-500/10 text-red-200",
    icon: "bg-red-500/15 text-red-300",
    panel: "border-red-500/20 bg-red-500/5",
  },
  watch: {
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-200",
    icon: "bg-amber-500/15 text-amber-300",
    panel: "border-amber-500/20 bg-amber-500/5",
  },
  quiet: {
    badge: "border-surface-600 bg-surface-800/80 text-gray-200",
    icon: "bg-surface-700/70 text-gray-300",
    panel: "border-surface-700 bg-surface-900/40",
  },
  active: {
    badge: "border-drift-500/30 bg-drift-500/10 text-drift-200",
    icon: "bg-drift-500/15 text-drift-300",
    panel: "border-drift-500/20 bg-drift-500/5",
  },
} as const;

export const monitoringSignalToneStyles = {
  blue: {
    icon: "bg-drift-500/15 text-drift-300",
    ring: "from-drift-500/20 via-drift-500/5 to-transparent",
  },
  green: {
    icon: "bg-emerald-500/15 text-emerald-300",
    ring: "from-emerald-500/20 via-emerald-500/5 to-transparent",
  },
  amber: {
    icon: "bg-amber-500/15 text-amber-300",
    ring: "from-amber-500/20 via-amber-500/5 to-transparent",
  },
  red: {
    icon: "bg-red-500/15 text-red-300",
    ring: "from-red-500/20 via-red-500/5 to-transparent",
  },
  violet: {
    icon: "bg-violet-500/15 text-violet-300",
    ring: "from-violet-500/20 via-violet-500/5 to-transparent",
  },
} as const;
