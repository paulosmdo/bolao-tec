export type BallState = "hit" | "marked" | "drawn" | "missedDraw" | "idle";

const STYLES: Record<BallState, string> = {
  // dezena jogada E sorteada (acerto)
  hit: "bg-volt text-volt-ink font-bold",
  // dezena jogada que não saiu
  marked: "bg-noir-700 text-zinc-300 border border-noir-600",
  // dezena sorteada (exibição de resultado)
  drawn: "bg-volt text-volt-ink font-bold",
  // dezena sorteada que NÃO estava no jogo
  missedDraw: "bg-transparent border border-amber-400/50 text-amber-300",
  idle: "bg-transparent border border-noir-700 text-zinc-600",
};

interface NumberBallProps {
  n: number;
  state?: BallState;
  size?: "sm" | "md";
}

export default function NumberBall({ n, state = "idle", size = "md" }: NumberBallProps) {
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm md:w-12 md:h-12";
  return (
    <span
      className={`flex items-center justify-center rounded-full ${sizeClass} ${STYLES[state]}`}
    >
      {String(n).padStart(2, "0")}
    </span>
  );
}
