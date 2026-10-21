const channels = {
  whatsapp: "whatsapp",
  whatsappbusiness: "whatsapp",
  wa: "whatsapp",
  wpp: "whatsapp",
  instagram: "instagram",
  ig: "instagram",
  facebook: "facebook",
  fb: "facebook",
  facebookmessenger: "facebook",
  messenger: "facebook",
} as const;

export default function SourceLabel({ source }: { source: string }) {
  const normalized = source
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
  const channel = Object.hasOwn(channels, normalized)
    ? channels[normalized as keyof typeof channels]
    : undefined;
  return (
    <span className="source-label" title={source}>
      {channel && (
        <img
          src={`/icons/${channel}.svg`}
          width={14}
          height={14}
          alt=""
          aria-hidden="true"
          className="source-logo"
        />
      )}
      <span>{source}</span>
    </span>
  );
}
