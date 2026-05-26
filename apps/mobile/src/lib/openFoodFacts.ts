/**
 * Client-side lookup against Open Food Facts (HTTPS).
 * https://wiki.openfoodfacts.org/API
 */
export type OffParsedProduct = {
  name: string;
  brand?: string;
  /** Per declared serving (defaults to per 100g) */
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  quantity: number;
  unit: string;
};

export async function fetchProductByBarcode(barcode: string): Promise<OffParsedProduct> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode.trim())}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Network error (${res.status})`);
  }
  const data = (await res.json()) as {
    status?: number;
    product?: {
      product_name?: string;
      product_name_en?: string;
      brands?: string;
      nutriments?: Record<string, number | string | undefined>;
    };
  };

  if (data.status !== 1 || !data.product) {
    throw new Error("Product not found in Open Food Facts");
  }

  const p = data.product;
  const n = p.nutriments ?? {};
  const name =
    p.product_name?.trim() ||
    p.product_name_en?.trim() ||
    "Scanned product";

  let kcal = Number(n["energy-kcal_100g"] ?? 0);
  if (!Number.isFinite(kcal) || kcal <= 0) {
    const kj = Number(n.energy_100g ?? 0);
    if (Number.isFinite(kj) && kj > 0) kcal = kj / 4.184;
  }

  const proteinG = Number(n.proteins_100g ?? 0) || 0;
  const carbsG = Number(n.carbohydrates_100g ?? 0) || 0;
  const fatG = Number(n.fat_100g ?? 0) || 0;

  if ((!Number.isFinite(kcal) || kcal <= 0) && (proteinG > 0 || carbsG > 0 || fatG > 0)) {
    kcal = Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
  }

  return {
    name,
    brand: typeof p.brands === "string" ? p.brands.split(",")[0]?.trim() : undefined,
    calories: Math.max(0, Math.round(kcal)),
    proteinG: Math.round(proteinG * 10) / 10,
    carbsG: Math.round(carbsG * 10) / 10,
    fatG: Math.round(fatG * 10) / 10,
    quantity: 100,
    unit: "g",
  };
}

export async function searchProductsByName(
  query: string,
  limit = 10
): Promise<OffParsedProduct[]> {
  const params = new URLSearchParams({
    search_terms: query,
    page_size: String(limit),
    json: "1",
    fields:
      "product_name,product_name_en,brands,nutriments,quantity,serving_size",
  });
  const url = `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Network error (${res.status})`);
  const data = (await res.json()) as { products?: any[] };
  const products = data.products ?? [];
  return products.flatMap((p) => {
    const n = (p.nutriments ?? {}) as Record<string, number | string | undefined>;
    const name =
      String(p.product_name ?? p.product_name_en ?? "").trim() || null;
    if (!name) return [];
    let kcal = Number(n["energy-kcal_100g"] ?? 0);
    if (!Number.isFinite(kcal) || kcal <= 0) {
      const kj = Number(n.energy_100g ?? 0);
      if (Number.isFinite(kj) && kj > 0) kcal = kj / 4.184;
    }
    const proteinG = Number(n.proteins_100g ?? 0) || 0;
    const carbsG = Number(n.carbohydrates_100g ?? 0) || 0;
    const fatG = Number(n.fat_100g ?? 0) || 0;
    if ((!Number.isFinite(kcal) || kcal <= 0) && (proteinG > 0 || carbsG > 0 || fatG > 0)) {
      kcal = Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
    }
    return [{
      name,
      brand: typeof p.brands === "string" ? p.brands.split(",")[0]?.trim() : undefined,
      calories: Math.max(0, Math.round(kcal)),
      proteinG: Math.round(proteinG * 10) / 10,
      carbsG: Math.round(carbsG * 10) / 10,
      fatG: Math.round(fatG * 10) / 10,
      quantity: 100,
      unit: "g",
    }];
  });
}
