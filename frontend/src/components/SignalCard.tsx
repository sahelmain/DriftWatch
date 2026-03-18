import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  monitoringSignalToneStyles,
  type SignalTone,
} from "@/lib/monitoringTone";

interface SignalCardProps {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: SignalTone;
}

export default function SignalCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
}: SignalCardProps) {
  const toneStyle = monitoringSignalToneStyles[tone];

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-surface-700 bg-surface-800/90 p-5">
      <div
        className={clsx(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
          toneStyle.ring,
        )}
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-400">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-white">
            {value}
          </p>
          <p className="mt-2 text-sm text-gray-400">{helper}</p>
        </div>
        <div className={clsx("rounded-2xl p-3", toneStyle.icon)}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}
