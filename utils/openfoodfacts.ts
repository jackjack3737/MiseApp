const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

export interface OpenFoodFactsProduct {
  id: string;
  name: string;
  brand: string;
  nutriments: {
    kcal: number;
    carbs: number;
    proteins: number;
    fat: number;
  };
}

function num(val: unknown): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(',', '.'));
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

export async function searchOpenFoodFacts(query: string): Promise<OpenFoodFactsProduct[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({
    search_terms: trimmed,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '15',
  });

  const res = await fetch(`${SEARCH_URL}?${params.toString()}`);
  if (!res.ok) return [];

  const data = await res.json();
  const products = data.products ?? [];
  if (!Array.isArray(products)) return [];

  return products
    .filter((p: any) => p.code)
    .map((p: any) => {
      const nut = p.nutriments ?? {};
      return {
        id: String(p.code),
        name: typeof p.product_name === 'string' ? p.product_name.trim() : '',
        brand: typeof p.brands === 'string' ? p.brands.trim() : '',
        nutriments: {
          kcal: num(nut['energy-kcal_100g'] ?? nut['energy-kcal'] ?? 0),
          carbs: num(nut.carbohydrates_100g ?? 0),
          proteins: num(nut.proteins_100g ?? 0),
          fat: num(nut.fat_100g ?? 0),
        },
      };
    });
}
