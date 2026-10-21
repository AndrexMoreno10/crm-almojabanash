import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, LoaderCircle } from "lucide-react";

export default function BrandIdentity({
  onHome,
  onLogoChange,
}: {
  onHome: () => void;
  onLogoChange: (url: string | null) => void;
}) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const versionRef = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const version = versionRef.current;
    void (async () => {
      const response = await fetch("/api/branding", {
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          "No pudimos consultar el logo. Puedes volver a cargarlo.",
        );
      const result = (await response.json()) as { logoUrl: string | null };
      if (!controller.signal.aborted && version === versionRef.current)
        setLogoUrl(result.logoUrl);
    })().catch((error) => {
      if (!controller.signal.aborted) setError(error.message);
    });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    onLogoChange(logoUrl);
  }, [logoUrl, onLogoChange]);
  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 4000);
    return () => clearTimeout(timer);
  }, [status]);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    setError("");
    setStatus("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setError("Elige un PNG, JPG o WebP de hasta 2 MB.");
      return;
    }
    versionRef.current++;
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width > 4096 || bitmap.height > 4096)
          throw new Error(
            "El logo debe medir como máximo 4096 × 4096 píxeles.",
          );
      } finally {
        bitmap.close();
      }
      const response = await fetch("/api/branding/logo", {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const result = (await response.json()) as {
        logoUrl: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "No pudimos guardar el logo.");
      setLogoUrl(result.logoUrl);
      setStatus("Logo guardado");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No pudimos leer el archivo del logo.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="brand-identity">
      <div className="brand">
        <button
          className="brand-logo-control"
          aria-label="Cambiar logo del negocio"
          title="Cargar el logo desde tu computador (PNG, JPG o WebP)"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {logoUrl ? (
            <img
              className="brand-logo"
              src={logoUrl}
              alt="Logo de Almojábanas Huilenses"
              onError={() => {
                setLogoUrl(null);
                setError(
                  "No pudimos mostrar el logo. Vuelve a cargar el archivo.",
                );
              }}
            />
          ) : (
            <span className="brand-symbol" aria-hidden="true">
              AH
              <span />
            </span>
          )}
          <span className="brand-logo-edit" aria-hidden="true">
            {busy ? (
              <LoaderCircle className="spin" size={12} />
            ) : (
              <Camera size={12} />
            )}
          </span>
        </button>
        <a
          className="brand-copy"
          href="#overview"
          aria-label="Almojábanas Huilenses: inicio"
          onClick={(event) => {
            event.preventDefault();
            onHome();
          }}
        >
          <strong>ALMOJÁBANAS</strong>
          <strong>HUILENSES</strong>
          <span className="brand-caption">GESTIÓN COMERCIAL</span>
        </a>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Archivo del logo"
          tabIndex={-1}
          onChange={(event) => void upload(event)}
        />
      </div>
      {error && (
        <p className="brand-feedback brand-error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="brand-feedback" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
