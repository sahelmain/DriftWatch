import type { ReactNode } from "react";
import clsx from "clsx";
import { Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  monitoringToneStyles,
  type MonitoringTone,
} from "@/lib/monitoringTone";

interface PageHeroProps {
  tone: MonitoringTone;
  label: string;
  title: string;
  description: string;
  insight?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  badgeIcon?: LucideIcon;
}

export default function PageHero({
  tone,
  label,
  title,
  description,
  insight,
  meta,
  actions,
  aside,
  badgeIcon: BadgeIcon = Sparkles,
}: PageHeroProps) {
  const toneStyle = monitoringToneStyles[tone];

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-surface-700 bg-[radial-gradient(circle_at_top_left,rgba(59,110,255,0.22),transparent_38%),linear-gradient(135deg,#16203a_0%,#0c1326_58%,#09101e_100%)] p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-24 top-0 h-64 w-64 rounded-full bg-drift-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />

      <div
        className={clsx(
          "relative grid gap-6",
          aside && "xl:grid-cols-[minmax(0,1.7fr)_360px]",
        )}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={clsx(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
                toneStyle.badge,
              )}
            >
              <BadgeIcon size={14} />
              {label}
            </span>
            {meta}
          </div>

          <div className="space-y-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-gray-300">
                {description}
              </p>
            </div>
            {insight && (
              <p className="max-w-3xl text-sm text-gray-400">{insight}</p>
            )}
          </div>

          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>

        {aside && (
          <div
            className={clsx(
              "rounded-[24px] border p-5 backdrop-blur-sm",
              toneStyle.panel,
            )}
          >
            {aside}
          </div>
        )}
      </div>
    </section>
  );
}
