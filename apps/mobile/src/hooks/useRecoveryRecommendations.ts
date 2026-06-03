import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { mockTemplates } from "@/mocks/data";
import type { ProtocolTemplate } from "@elysia/domain";
import { getHabitVisual, type HabitVisual } from "@/components/elysia/habitImages";

export interface ResolvedRecommendation {
  templateId: string;
  efficiency: number;
  reasons: string[];
  template: ProtocolTemplate;
  visual: HabitVisual;
}

export interface ResolvedActiveHabit {
  habitId: string;
  templateId: string;
  title: string;
  category: string;
  template: ProtocolTemplate | null;
  visual: HabitVisual;
}

/**
 * Per-user "How can I improve my Recovery?" data.
 *
 * Joins the server-side ranked list (Convex `getRecoveryRecommendations`)
 * back to the full mobile catalog (`mockTemplates`) so the UI gets title /
 * description / references without a second round-trip. Recommendations
 * whose templateId no longer exists in the catalog are dropped — keeps the
 * surface resilient to catalog edits.
 *
 * Returns `loading: true` until the first query lands so the section can
 * skeleton without a flash of "no recommendations".
 */
export function useRecoveryRecommendations() {
  // Pass the catalog (id + category) so the server scores every present and
  // future library card — new cards become candidates with no backend change.
  const catalogArg = useMemo(
    () =>
      mockTemplates.map((t) => ({
        templateId: t.templateId,
        category: t.category,
      })),
    []
  );
  const data = useQuery(api.recommendations.getRecoveryRecommendations, {
    catalog: catalogArg,
  });
  const dismiss = useMutation(api.recommendations.dismissRecoveryRecommendation);

  const catalog = useMemo(
    () => new Map(mockTemplates.map((t) => [t.templateId, t])),
    []
  );

  const recommendations = useMemo<ResolvedRecommendation[]>(() => {
    if (!data) return [];
    return data.recommendations
      .map((r) => {
        const template = catalog.get(r.templateId);
        if (!template) return null;
        return {
          templateId: r.templateId,
          efficiency: r.efficiency,
          reasons: r.reasons,
          template,
          visual: getHabitVisual(template.slug, template.category),
        };
      })
      .filter((x): x is ResolvedRecommendation => x !== null);
  }, [data, catalog]);

  const alreadyInPlace = useMemo<ResolvedActiveHabit[]>(() => {
    if (!data) return [];
    return data.alreadyInPlace.map((h) => {
      const template = catalog.get(h.templateId) ?? null;
      const slug = template?.slug;
      return {
        habitId: h.habitId,
        templateId: h.templateId,
        title: template?.title ?? h.title,
        category: h.category,
        template,
        visual: getHabitVisual(slug, h.category),
      };
    });
  }, [data, catalog]);

  return {
    loading: data === undefined,
    generatedAt: data?.generatedAt ?? null,
    subScores7d: data?.subScores7d ?? null,
    recommendations,
    alreadyInPlace,
    dismiss: (templateId: string) => dismiss({ templateId }),
  };
}
