import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  /** Badge tipo variação: ex. "+34,5%" */
  badge?: string;
  badgeTone?: "up" | "down" | "neutral";
  sub?: string;
  icon?: ReactNode;
}

const BADGE_TONES = {
  up: "text-volt bg-volt/10",
  down: "text-red-400 bg-red-400/10",
  neutral: "text-zinc-400 bg-noir-700",
};

export default function StatCard({
  label,
  value,
  badge,
  badgeTone = "up",
  sub,
  icon,
}: StatCardProps) {
  return (
    <div className="bg-noir-800 border border-noir-600 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-noir-700 border border-noir-600 flex items-center justify-center text-zinc-300">
          {icon ?? <span className="w-2 h-2 rounded-full bg-volt" />}
        </span>
        <span className="text-sm text-zinc-400">{label}</span>
        <span className="ml-auto text-zinc-600 tracking-widest leading-none select-none">···</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-2xl font-bold text-zinc-50">{value}</span>
        {badge && (
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${BADGE_TONES[badgeTone]}`}
          >
            {badge}
          </span>
        )}
      </div>
      {sub && <span className="text-xs text-zinc-500 -mt-2">{sub}</span>}
    </div>
  );
}
