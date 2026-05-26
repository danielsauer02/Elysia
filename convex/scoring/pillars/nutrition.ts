import {
  fNutritionEnergyBalance,
  fNutritionMacro,
  fNutritionProteinPerKg,
} from "../doseResponse";
import type { PillarInput } from "../types";

const NUTRITION_WEIGHTS = {
  macro: 0.4,
  protein: 0.3,
  balance: 0.3,
} as const;

export function computeNutritionScore(input: PillarInput): number | null {
  const eb = input.energyBalance;
  if (!eb) return null;
  if (eb.macroCompliancePct === undefined) return null;

  const macroSub = fNutritionMacro(eb.macroCompliancePct);

  const proteinSub = eb.proteinPerKg !== undefined
    ? fNutritionProteinPerKg(eb.proteinPerKg)
    : null;
  const balanceSub = eb.balanceKcal !== undefined
    ? fNutritionEnergyBalance(eb.balanceKcal)
    : null;

  const parts: Array<{ value: number; weight: number } | null> = [
    { value: macroSub, weight: NUTRITION_WEIGHTS.macro },
    proteinSub !== null ? { value: proteinSub, weight: NUTRITION_WEIGHTS.protein } : null,
    balanceSub !== null ? { value: balanceSub, weight: NUTRITION_WEIGHTS.balance } : null,
  ];
  const active = parts.filter(
    (p): p is { value: number; weight: number } => p !== null
  );

  const totalWeight = active.reduce((s, p) => s + p.weight, 0);
  if (totalWeight === 0) return null;
  const weighted = active.reduce((s, p) => s + p.value * p.weight, 0);
  return Math.round((weighted / totalWeight) * 100);
}
