// Datos comerciales confirmados por el usuario. No contiene credenciales.
export const business = {
  name: "Almojábanas Huilenses",
  city: "Armenia, Quindío",
  address: "Cra. 14 #11-56",
  landmark: "media cuadra arriba del parque Sucre",
  phone: "3152457853",
  serviceAreas: [
    "Armenia",
    "Buenavista",
    "Calarcá",
    "Circasia",
    "Filandia",
    "Montenegro",
    "Salento",
    "La Tebaida",
  ],
} as const;

export const locationAnswer = `Nuestra única sede está en ${business.city}, ${business.address}, ${business.landmark}. Puedes contactarnos al ${business.phone}. Nuestro producto principal son las almojábanas huilenses.`;
export const coverageAnswer = `Actualmente atendemos ${business.serviceAreas.join(", ")}, en Quindío. El equipo confirma las condiciones de entrega para tu dirección; esta información no confirma un envío ni un costo.`;

// Exige indicativo internacional para no adivinar el país del contacto.
export function whatsappContactUrl(phone: string): string | null {
  const compact = phone.trim().replace(/[\s().-]/g, "");
  const digits = compact.replace(/^(\+|00)/, "");
  if (!/^[1-9]\d{10,14}$/.test(digits)) return null;
  return `https://wa.me/${digits}`;
}
