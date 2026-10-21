export const movementTypes = [
  "opening",
  "purchase",
  "production",
  "sale",
  "return",
  "waste",
  "adjustment_in",
  "adjustment_out",
] as const;
export type MovementType = (typeof movementTypes)[number];
export const movementLabels: Record<MovementType, string> = {
  opening: "Conteo inicial",
  purchase: "Compra / entrada",
  production: "Producción",
  sale: "Venta / salida",
  return: "Devolución recibida",
  waste: "Merma / vencimiento",
  adjustment_in: "Ajuste de entrada",
  adjustment_out: "Ajuste de salida",
};
export interface InventoryProduct {
  id: string;
  name: string;
  presentation: string;
  code: string;
  category: string;
  unit: string;
  retailPrice: number | null;
  wholesalePrice: number | null;
  costPrice: number | null;
  currency: string;
  minimumStock: number | null;
  stock: number | null;
  notes: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
export type ProductInput = Omit<
  InventoryProduct,
  "id" | "stock" | "createdAt" | "updatedAt"
>;
export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  presentation: string;
  type: MovementType;
  quantity: number;
  delta: number;
  balance: number;
  unit: string;
  reason: string;
  reference: string;
  leadId: string | null;
  createdAt: string;
}
export interface MovementPage {
  items: InventoryMovement[];
  total: number;
  page: number;
  limit: number;
}
export const stockStatus = (product: InventoryProduct) =>
  product.stock === null
    ? "unrecorded"
    : product.stock === 0
      ? "empty"
      : product.minimumStock !== null && product.stock <= product.minimumStock
        ? "low"
        : "available";
export const stockLabels = {
  unrecorded: "Sin conteo",
  empty: "Agotado",
  low: "Stock bajo",
  available: "Disponible",
} as const;
export const quantityLabel = (value: number) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: 3 }).format(value);

// Transcripción del catálogo enviado por el usuario. Sin precios, unidades ni existencias inferidos.
export const initialCatalog = {
  Comestibles: [
    "Almojábana",
    "Pandequeso",
    "Empanada de cambray",
    "Achiras",
    "Tostadas",
    "Galletas",
    "Pan maíz",
    "Pan achira",
    "Pan mariquiteño",
    "Pan almojábana",
    "Pan integral",
    "Mantecada",
    "Torta de banano",
  ],
  Bebidas: [
    "Café",
    "Café con leche",
    "Milo caliente",
    "Chocolate en agua",
    "Chocolate en leche",
    "Aromática",
    "Yogurt bolsa (vaso)",
    "Colombiana",
    "Bilac chocolate",
    "Leche personal",
    "Saviloé",
    "Bretaña",
    "Avena",
    "Kumis",
    "Pony Malta",
    "Coca Cola",
    "Jugo Hit",
    "Jugo Cifrut",
    "Gaseosa Postobón",
    "Agua",
    "Agua con gas",
    "Premio",
    "Sprite",
    "Quatro",
    "Gatorade",
    "Speed Max",
    "Vive 100",
  ],
} as const;
