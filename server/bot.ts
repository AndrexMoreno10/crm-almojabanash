export type BotState =
  | "consent"
  | "segment"
  | "quantity"
  | "city"
  | "name"
  | "sample"
  | "ready"
  | "human"
  | "opted_out";
export interface BuyerProfile {
  segment?: string;
  quantity?: number;
  city?: string;
  name?: string;
  sampleRequested?: boolean;
}
export interface BotSession {
  state: BotState;
  profile: BuyerProfile;
}
export interface BotResult extends BotSession {
  reply: string | null;
  handoff?: boolean;
  optedOut?: boolean;
}
const normalized = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[.!¡¿?]+$/g, "");
const yes = new Set([
  "si",
  "acepto",
  "si acepto",
  "de acuerdo",
  "claro",
  "ok",
  "vale",
]);
const no = new Set(["no", "no gracias", "no acepto"]);
const stop =
  /^(salir|parar|stop|cancelar|baja|no me escriban|no me contacten|no quiero mas mensajes|no quiero recibir mensajes)$/;
const asksHuman =
  /\b(asesor|persona|humano|administrador|hablar con alguien)\b/;
const needsFacts =
  /\b(precio|precios|cuesta|cuestan|ubicacion|direccion|ubicados|horario|horarios|domicilio|envio|pago|pagos|catalogo|ingrediente|ingredientes|alergia|alergias)\b/;
const welcome =
  "¡Hola! Podemos ayudarte a organizar tu solicitud de compra. ¿Aceptas que el equipo use los datos que compartas para atender esta consulta y hacerle seguimiento? Responde ACEPTO para continuar, ASESOR para hablar con una persona o SALIR para detener el seguimiento.";

// Guided, deterministic assistant: never invents product, delivery or commercial terms.
export function advanceBot(
  session: BotSession | null,
  message: string,
): BotResult {
  const input = normalized(message);
  const profile = { ...(session?.profile || {}) };
  const state = session?.state || "consent";
  if (stop.test(input))
    return {
      state: "opted_out",
      profile,
      optedOut: true,
      reply:
        "Entendido. Detuvimos el seguimiento automático. Si necesitas algo más, puedes volver a escribirnos y pedir un ASESOR.",
    };
  if (state === "opted_out") {
    if (yes.has(input) || input === "iniciar")
      return { state: "consent", profile, reply: welcome };
    if (asksHuman.test(input))
      return {
        state: "human",
        profile,
        handoff: true,
        reply:
          "Dejamos tu solicitud para el equipo. El seguimiento automático sigue detenido.",
      };
    return { state, profile, reply: null };
  }
  if (asksHuman.test(input) || needsFacts.test(input))
    return {
      state: "human",
      profile,
      handoff: true,
      reply:
        "Para darte información correcta, dejamos tu consulta al equipo. Una persona debe confirmar los detalles; no te puedo prometer disponibilidad ni condiciones. El asistente automático queda en pausa.",
    };
  if (state === "human") return { state, profile, reply: null };
  if (!session) return { state: "consent", profile, reply: welcome };
  switch (state) {
    case "consent":
      if (no.has(input))
        return {
          state: "opted_out",
          profile,
          optedOut: true,
          reply:
            "De acuerdo, no continuaremos el seguimiento automático. Puedes pedir un ASESOR si necesitas atención.",
        };
      if (!yes.has(input))
        return {
          state,
          profile,
          reply:
            "Para continuar responde ACEPTO. También puedes pedir un ASESOR o escribir SALIR.",
        };
      return {
        state: "segment",
        profile,
        reply:
          "Gracias. ¿Compras para un hotel, un evento, para revender o para otro tipo de negocio?",
      };
    case "segment":
      if (!input || message.length > 160)
        return {
          state,
          profile,
          reply:
            "Cuéntanos en pocas palabras para qué tipo de negocio o evento compras. Si prefieres, escribe ASESOR.",
        };
      return {
        state: "quantity",
        profile: { ...profile, segment: message.trim() },
        reply:
          "¿Cuántas unidades te interesan aproximadamente? Esta cifra es una referencia, no confirma un pedido ni un mínimo de compra.",
      };
    case "quantity": {
      if (!/^\d{1,7}$/.test(input) || Number(input) < 1)
        return {
          state: "human",
          profile,
          handoff: true,
          reply:
            "Dejamos tu consulta al equipo para ayudarte a definir la cantidad. El asistente queda en pausa.",
        };
      return {
        state: "city",
        profile: { ...profile, quantity: Number(input) },
        reply:
          "¿En qué ciudad o municipio necesitas el producto? El equipo confirmará si podemos atender esa zona.",
      };
    }
    case "city":
      if (!input || message.length > 160)
        return {
          state,
          profile,
          reply: "Escribe solo tu ciudad o municipio, o pide un ASESOR.",
        };
      return {
        state: "name",
        profile: { ...profile, city: message.trim() },
        reply: "¿Cuál es tu nombre o el nombre del negocio?",
      };
    case "name":
      if (!input || message.length > 160)
        return {
          state,
          profile,
          reply: "Escribe un nombre de hasta 160 caracteres, o pide un ASESOR.",
        };
      return {
        state: "sample",
        profile: { ...profile, name: message.trim() },
        reply:
          "¿Te interesa solicitar una muestra para conocer el producto? Responde SÍ o NO. El equipo debe confirmar disponibilidad, costo y entrega; aún no se ha aprobado ningún envío.",
      };
    case "sample":
      if (!yes.has(input) && !no.has(input))
        return {
          state,
          profile,
          reply:
            "Responde SÍ o NO sobre la muestra, o escribe ASESOR si tienes una pregunta.",
        };
      return {
        state: "ready",
        profile: { ...profile, sampleRequested: yes.has(input) },
        handoff: true,
        reply: `Gracias. Registramos tu interés${yes.has(input) ? " en una muestra" : " de compra"}. El equipo revisará tu solicitud y confirmará las condiciones y el siguiente paso. Esto todavía no confirma una venta ni un envío.`,
      };
    case "ready":
      return {
        state: "human",
        profile,
        handoff: true,
        reply:
          "Tu solicitud quedó registrada para el equipo. Dejamos también este mensaje para continuar la atención personalmente.",
      };
  }
}
