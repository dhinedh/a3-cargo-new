export interface ParsedProductInfo {
  detectedWeightVal: number | null;
  detectedWeightUnit: 'KG' | 'G' | 'Liters' | 'ML' | 'PCS' | 'Boxes' | 'Units';
  convertedWeightKg: number | null;
  detectedQuantity: number | null;
  packSizeText: string | null;
}

/**
 * Parses a product description string like "50-50 BISCUIT 140.6 G" or "MAGGI 70G x 24"
 * and extracts weight, units, and pack size information.
 */
export function parseProductName(input: string): ParsedProductInfo {
  if (!input || !input.trim()) {
    return {
      detectedWeightVal: null,
      detectedWeightUnit: 'KG',
      convertedWeightKg: null,
      detectedQuantity: null,
      packSizeText: null,
    };
  }

  const text = input.trim();

  let detectedWeightVal: number | null = null;
  let detectedWeightUnit: 'KG' | 'G' | 'Liters' | 'ML' | 'PCS' | 'Boxes' | 'Units' = 'KG';
  let convertedWeightKg: number | null = null;
  let detectedQuantity: number | null = null;
  let packSizeText: string | null = null;

  // 1. Detect Pack / Multi-pack Quantity (e.g. "x 24", "24 Pcs", "12 PK", "BOX OF 10")
  const multiPackRegex = /(?:x|\*|\bpack of\b|\bbox of\b)\s*(\d+)|(\d+)\s*(?:pcs|pk|pack|boxes|units)\b/i;
  const multiMatch = text.match(multiPackRegex);
  if (multiMatch) {
    const qtyStr = multiMatch[1] || multiMatch[2];
    if (qtyStr) {
      detectedQuantity = parseInt(qtyStr, 10);
    }
  }

  // 2. Detect Weight / Volume pattern (e.g. "140.6 G", "140.6G", "500 GM", "1.5 KG", "250 ML", "2 L", "750ML")
  // Matches: number followed by unit (G, GM, GRAMS, KG, KGS, ML, L, LTR, LITERS)
  const weightRegex = /(\d+(?:\.\d+)?)\s*(kg|kgs|g|gm|gms|gram|grams|ml|l|ltr|liters)\b/i;
  const weightMatch = text.match(weightRegex);

  if (weightMatch) {
    const numVal = parseFloat(weightMatch[1]);
    const unitRaw = weightMatch[2].toLowerCase();
    packSizeText = weightMatch[0].toUpperCase();

    if (!isNaN(numVal) && numVal > 0) {
      if (unitRaw === 'g' || unitRaw === 'gm' || unitRaw === 'gms' || unitRaw === 'gram' || unitRaw === 'grams') {
        detectedWeightVal = numVal;
        detectedWeightUnit = 'G';
        convertedWeightKg = Number((numVal / 1000).toFixed(4));
      } else if (unitRaw === 'kg' || unitRaw === 'kgs') {
        detectedWeightVal = numVal;
        detectedWeightUnit = 'KG';
        convertedWeightKg = numVal;
      } else if (unitRaw === 'ml') {
        detectedWeightVal = numVal;
        detectedWeightUnit = 'ML';
        convertedWeightKg = Number((numVal / 1000).toFixed(4));
      } else if (unitRaw === 'l' || unitRaw === 'ltr' || unitRaw === 'liters') {
        detectedWeightVal = numVal;
        detectedWeightUnit = 'Liters';
        convertedWeightKg = numVal;
      }
    }
  }

  return {
    detectedWeightVal,
    detectedWeightUnit,
    convertedWeightKg,
    detectedQuantity,
    packSizeText,
  };
}
