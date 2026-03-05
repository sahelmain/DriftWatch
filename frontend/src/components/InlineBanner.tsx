import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  X,
} from "lucide-react";
import clsx from "clsx";

type BannerVariant = "success" | "info" | "warning" | "error";

const variantStyles: Record<BannerVariant, string> = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  error: "border-red-500/30 bg-red-500/10 text-red-100",
};

const iconStyles: Record<BannerVariant, string> = {
  success: "text-emerald-300",
  info: "text-blue-300",
  warning: "text-amber-300",
  error: "text-red-300",
};

const variantIcons = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
} satisfies Record<BannerVariant, typeof Info>;

interface InlineBannerProps {
  variant: BannerVariant;
  title: string;
  message?: string;
  actionLabel?: string;
  actionLoading?: boolean;
  onAction?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export default function InlineBanner({
  variant,
  title,
  message,
  actionLabel,
  actionLoading = false,
  onAction,
  onDismiss,
  className,
}: InlineBannerProps) {
  const Icon = variantIcons[variant];

  return (
    <div
      className={clsx(
        "rounded-xl border px-4 py-3",
        variantStyles[variant],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon size={18} className={clsx("mt-0.5 shrink-0", iconStyles[variant])} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          {message && <p className="mt-1 text-sm opacity-90">{message}</p>}
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              disabled={actionLoading}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {actionLoading && <Loader2 size={14} className="animate-spin" />}
              {actionLabel}
            </button>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Dismiss banner"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
