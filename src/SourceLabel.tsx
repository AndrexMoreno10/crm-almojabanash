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

export function SourceIcon({
  source,
  className = "source-logo",
  decorative = false,
}: {
  source: string;
  className?: string;
  decorative?: boolean;
}) {
  const normalized = source
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
  const channel = Object.hasOwn(channels, normalized)
    ? channels[normalized as keyof typeof channels]
    : undefined;
  return channel ? (
    <img
      src={`/icons/${channel}.svg`}
      width={14}
      height={14}
      alt={decorative ? "" : source}
      aria-hidden={decorative || undefined}
      title={source}
      className={className}
    />
  ) : null;
}

export default function SourceLabel({
  source,
  showIcon = true,
}: {
  source: string;
  showIcon?: boolean;
}) {
  return (
    <span className="source-label" title={source}>
      {showIcon && <SourceIcon source={source} decorative />}
      <span>{source}</span>
    </span>
  );
}
