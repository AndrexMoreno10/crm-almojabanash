import { business } from "../shared/business";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  Circle,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import type { BotResult, BotSession } from "../server/bot";

export interface MetaStatus {
  configured: boolean;
  sendingEnabled: boolean;
  requirements: Record<string, boolean>;
  pending: number;
}
const initial = [
  {
    role: "bot",
    text: "Prueba el recorrido de un interesado. Escribe un saludo para comenzar.",
  },
];
export default function Assistant({ status }: { status: MetaStatus | null }) {
  const [chat, setChat] = useState(initial);
  const [session, setSession] = useState<BotSession | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/bot/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session, message }),
      });
      const result = (await response.json()) as BotResult & { error?: string };
      if (!response.ok)
        throw new Error(result.error || "No pudimos simular el mensaje");
      setChat([
        ...chat,
        { role: "user", text: message },
        ...(result.reply
          ? [{ role: "bot", text: result.reply }]
          : [
              {
                role: "system",
                text:
                  result.state === "opted_out"
                    ? "Seguimiento detenido. No se genera otra respuesta automática."
                    : "Asistente en pausa. La conversación queda para una persona.",
              },
            ]),
      ]);
      setSession({ state: result.state, profile: result.profile });
      setMessage("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="assistant-layout">
      <div className="simulator">
        <div className="section-heading">
          <div>
            <h2>
              <Bot size={20} /> Asistente de oportunidades
            </h2>
            <p>Simulación: no envía mensajes ni crea contactos.</p>
          </div>
          <button
            className="text-button"
            onClick={() => {
              setChat(initial);
              setSession(null);
              setError("");
            }}
          >
            <RotateCcw size={15} /> Reiniciar
          </button>
        </div>
        <div className="chat-messages" aria-live="polite">
          {chat.map((item, i) => (
            <div className={`chat-message chat-${item.role}`} key={i}>
              <small>
                {item.role === "user"
                  ? "Tú, como cliente"
                  : item.role === "bot"
                    ? "Asistente Almo"
                    : "Estado de atención"}
              </small>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <form className="chat-input" onSubmit={send}>
          <input
            aria-label="Mensaje de prueba"
            maxLength={4000}
            required
            placeholder="Escribe como lo haría un cliente…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button
            aria-label="Enviar mensaje de prueba"
            className="primary"
            disabled={busy || !message.trim()}
          >
            <Send size={17} />
          </button>
        </form>
      </div>
      <aside className="assistant-info">
        <article>
          <div className="eyebrow">UN RECORRIDO CON INTENCIÓN</div>
          <h3>Del interés al siguiente paso.</h3>
          <ol>
            <li>Permiso para el seguimiento</li>
            <li>Tipo de negocio y cantidad</li>
            <li>Ciudad y nombre del interesado</li>
            <li>Interés en una muestra</li>
            <li>Equipo confirma condiciones</li>
          </ol>
          <p className="assistant-rule">
            <ShieldCheck size={17} /> Puede pedir un asesor o detener el
            seguimiento en cualquier momento.
          </p>
        </article>
        <article className="business-card">
          <h3>{business.name}</h3>
          <p>
            <strong>Única sede · {business.city}</strong>
            <br />
            {business.address}, {business.landmark}.
          </p>
          <p>Contacto: {business.phone}</p>
          <p>
            <strong>Municipios atendidos</strong>
            <br />
            {business.serviceAreas.join(", ")}.
          </p>
          <p>El equipo confirma las condiciones de cada entrega y muestra.</p>
        </article>
        <article>
          <h3>Lo que ya sabemos</h3>
          {session && Object.keys(session.profile).length ? (
            <dl>
              {session.profile.segment && (
                <>
                  <dt>Tipo de comprador</dt>
                  <dd>{session.profile.segment}</dd>
                </>
              )}
              {session.profile.quantity && (
                <>
                  <dt>Unidades de interés</dt>
                  <dd>{session.profile.quantity}</dd>
                </>
              )}
              {session.profile.city && (
                <>
                  <dt>Ciudad</dt>
                  <dd>{session.profile.city}</dd>
                </>
              )}
              {session.profile.name && (
                <>
                  <dt>Contacto</dt>
                  <dd>{session.profile.name}</dd>
                </>
              )}
              {session.profile.sampleRequested !== undefined && (
                <>
                  <dt>Solicita muestra</dt>
                  <dd>
                    {session.profile.sampleRequested
                      ? "Sí, pendiente de aprobación"
                      : "No"}
                  </dd>
                </>
              )}
            </dl>
          ) : (
            <p>
              La información aparecerá a medida que pruebes la conversación.
            </p>
          )}
          {session && (
            <div className="bot-state">
              {session.state === "human" || session.state === "ready"
                ? "Atención del equipo pendiente"
                : session.state === "opted_out"
                  ? "Seguimiento detenido"
                  : "Recopilando información"}
            </div>
          )}
        </article>
        <article className="connection-card">
          <h3>Conexión con Meta</h3>
          <div className="connection-row">
            <span>WhatsApp Business</span>
            <span className="connection-status">
              {status?.sendingEnabled ? (
                <>
                  <Check size={13} /> Envíos habilitados
                </>
              ) : (
                <>
                  <Circle size={9} /> Atención manual
                </>
              )}
            </span>
          </div>
          <div className="connection-row">
            <span>Instagram</span>
            <span>Próxima integración</span>
          </div>
          <div className="connection-row">
            <span>Facebook</span>
            <span>Próxima integración</span>
          </div>
          <p>
            {status?.sendingEnabled
              ? "Los envíos están habilitados. Falta verificar su recepción real con la cuenta y un número de prueba."
              : "Puedes atender desde la aplicación Business y actualizar cada lead en el CRM. El bot automático requiere conectar y verificar Cloud API; WhatsApp Flows es una función distinta."}
          </p>
          <span className="connection-next">
            Primero: validar el recorrido de WhatsApp <ArrowRight size={14} />
          </span>
        </article>
      </aside>
    </section>
  );
}
