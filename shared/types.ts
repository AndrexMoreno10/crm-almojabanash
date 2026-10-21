// Ocho etapas comerciales. La pérdida se conserva como cierre separado.
export const pipelineStages = [
  "new",
  "conversation",
  "proposal",
  "interested",
  "sample",
  "closing",
  "won",
  "recurring",
] as const;
export const stages = [...pipelineStages, "lost"] as const;
export type Stage = (typeof stages)[number];
export const defaultLabels: Record<Stage, string> = {
  new: "Nuevo lead",
  conversation: "En atención",
  proposal: "Información comercial enviada",
  interested: "Interés confirmado",
  sample: "Muestra en evaluación",
  closing: "Pedido en cierre",
  won: "Primera compra realizada",
  recurring: "Cliente recurrente",
  lost: "Oportunidad perdida",
};
export const stageHints: Record<Stage, string> = {
  new: "El contacto llegó y todavía falta atenderlo.",
  conversation:
    "Ya respondimos y estamos entendiendo su necesidad y resolviendo dudas iniciales.",
  proposal:
    "Se envió el catálogo o la cotización pertinente. Registra en notas qué recibió y cuándo.",
  interested:
    "El cliente expresó intención de avanzar y conocemos su necesidad.",
  sample:
    "El equipo aprobó la muestra y se coordina o espera su valoración. Esta etapa es opcional.",
  closing:
    "Se están concretando cantidad, precio, entrega y pago del primer pedido.",
  won: "Se entregó el primer pedido. La clasificación se confirma manualmente.",
  recurring:
    "El cliente ya repite compras. Registra su frecuencia y cantidad habitual en las notas.",
  lost: "El contacto no va a continuar. Registra el motivo; puedes recuperar la oportunidad si vuelve a interesarse.",
};
export const isConvertedStage = (stage: Stage) =>
  stage === "won" || stage === "recurring";
export const isOpenStage = (stage: Stage) =>
  !isConvertedStage(stage) && stage !== "lost";
export const canFollowUp = (stage: Stage) => stage !== "lost";
export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  campaign: string;
  owner: string;
  stage: Stage;
  value: number;
  nextContactAt: string | null;
  lostReason: string;
  createdAt: string;
  updatedAt: string;
}
export type LeadInput = Omit<Lead, "id" | "createdAt" | "updatedAt">;
export interface Activity {
  id: string;
  leadId: string;
  kind: "note" | "event";
  body: string;
  createdAt: string;
}
export interface Settings {
  stageLabels: Record<Stage, string>;
}
export interface LeadDetail {
  lead: Lead;
  activities: Activity[];
}
