import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface EmptyStatePanelProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
}

export default function EmptyStatePanel({
  icon: Icon,
  title,
  description,
  actions,
}: EmptyStatePanelProps) {
  return (
    <div className="rounded-[24px] border border-surface-700 bg-surface-800/90 p-10 sm:p-12">
      <div className="rounded-[20px] border border-dashed border-surface-700 bg-surface-950/35 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-800 text-drift-300">
          <Icon size={20} />
        </div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-gray-400">
          {description}
        </p>
        {actions && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
