import { ALL_NUMBERS } from "@/lib/lotofacil/constants";
import NumberBall, { BallState } from "./NumberBall";

interface VolanteProps {
  /** Dezenas apostadas */
  marked: number[];
  /** Dezenas sorteadas — quando presente, os acertos ficam verdes */
  drawn?: number[];
  size?: "sm" | "md";
}

/** Grade 5x5 do volante da Lotofácil com destaque de acertos */
export default function Volante({ marked, drawn, size = "md" }: VolanteProps) {
  const markedSet = new Set(marked);
  const drawnSet = new Set(drawn ?? []);
  const hasResult = (drawn?.length ?? 0) > 0;

  const stateFor = (n: number): BallState => {
    const isMarked = markedSet.has(n);
    const isDrawn = drawnSet.has(n);
    if (isMarked && isDrawn) return "hit";
    if (isMarked) return "marked";
    if (hasResult && isDrawn) return "missedDraw";
    return "idle";
  };

  return (
    <div className="grid grid-cols-5 gap-1 w-fit">
      {ALL_NUMBERS.map((n) => (
        <NumberBall key={n} n={n} state={stateFor(n)} size={size} />
      ))}
    </div>
  );
}
