export const stages = [
  "new",
  "conversation",
  "proposal",
  "won",
  "lost",
] as const;
export type Stage = (typeof stages)[number];
export const defaultLabels: Record<Stage, string> = {
  new: "Nuevo contacto",
  conversation: "En conversación",
  proposal: "Propuesta enviada",
  won: "Venta ganada",
  lost: "Venta perdida",
};
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
