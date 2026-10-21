import { canFollowUp, isOpenStage, type Lead } from "./types.ts";

export const attentionLabels = {
  unreviewed: "Sin revisar en CRM",
  new: "Primera atención pendiente",
  unassigned: "Sin responsable",
  unscheduled: "Sin próximo contacto",
  pending: "Por atender",
  followups: "Seguimientos pendientes",
  closing: "Por cerrar",
} as const;
export type AttentionFilter = keyof typeof attentionLabels;
export interface AttentionSummary {
  unreviewedIds: string[];
}
export function matchesAttention(
  lead: Lead,
  filter: AttentionFilter,
  unreviewed: ReadonlySet<string>,
) {
  if (filter === "unreviewed")
    return canFollowUp(lead.stage) && unreviewed.has(lead.id);
  if (filter === "new") return lead.stage === "new";
  if (filter === "pending")
    return (
      canFollowUp(lead.stage) &&
      (lead.stage === "new" || unreviewed.has(lead.id))
    );
  if (filter === "followups")
    return (
      canFollowUp(lead.stage) &&
      Boolean(
        lead.nextContactAt || (isOpenStage(lead.stage) && lead.stage !== "new"),
      )
    );
  if (filter === "closing") return lead.stage === "closing";
  if (filter === "unassigned")
    return isOpenStage(lead.stage) && !lead.owner.trim();
  return isOpenStage(lead.stage) && !lead.nextContactAt;
}
