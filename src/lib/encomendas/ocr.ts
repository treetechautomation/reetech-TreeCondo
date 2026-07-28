/**
 * E.3.0 — OCR MODULE (REGEX-BASED).
 *
 * Extrai unidade, bloco, torre e destinatário de texto de etiqueta.
 * NUNCA vincula automaticamente — sempre exige confirmação humana.
 * NUNCA persiste texto OCR bruto.
 */

/** Um match individual do OCR. */
export interface OCRMatch {
  type: "UNIDADE" | "BLOCO" | "TORRE" | "DESTINATARIO";
  value: string;
  raw: string;
}

/** Resultado completo da análise OCR. */
export interface OCRResult {
  unidade?: string;
  bloco?: string;
  torre?: string;
  destinatario?: string;
  confidence: number;
  matches: OCRMatch[];
}

/** Thresholds de confiança. */
export const OCR_CONFIDENCE_HIGH = 0.85;
export const OCR_CONFIDENCE_LOW = 0.5;

// ── REGEX (configuráveis) ────────────────────────────────────────────────────

// Padrões de unidade: APT 302, APTO 302, APARTAMENTO 1204, UNID 504, UN 1203
const UNIT_PATTERNS: Array<{ regex: RegExp; weight: number }> = [
  { regex: /\b(?:APARTAMENTO|APTO?|UNID(?:ADE)?|UN)\s*[:\-]?\s*(\d{2,5}[A-Z]?)\b/gi, weight: 0.9 },
  { regex: /\bN[º°]\s*(\d{2,5}[A-Z]?)\b/gi, weight: 0.6 },
];

// Padrões de bloco: BL B, BLOCO C, BL C, BL:B
const BLOCK_PATTERNS: Array<{ regex: RegExp; weight: number }> = [
  { regex: /\b(?:BLOCO|BL)\s*[:\-]?\s*([A-Z]{1,2})(?:\s|$)/gi, weight: 0.9 },
  { regex: /\bTORRE\s*([A-Z]{1,2})(?:\s|$)/gi, weight: 0.8 },
];

// Padrões de torre: TORRE A, TORRE 1
const TOWER_PATTERNS: Array<{ regex: RegExp; weight: number }> = [
  { regex: /\bTORRE\s*([A-Z0-9]{1,3})(?:\s|$)/gi, weight: 0.9 },
];

// ── OCR Engine ───────────────────────────────────────────────────────────────

export function analyzeOCRText(rawText: string): OCRResult {
  const text = rawText.toUpperCase().replace(/\s+/g, " ").trim();
  const matches: OCRMatch[] = [];

  // Extrair unidade
  for (const p of UNIT_PATTERNS) {
    let m: RegExpExecArray | null;
    p.regex.lastIndex = 0;
    while ((m = p.regex.exec(text)) !== null) {
      matches.push({ type: "UNIDADE", value: m[1], raw: m[0] });
    }
  }

  // Extrair bloco
  for (const p of BLOCK_PATTERNS) {
    let m: RegExpExecArray | null;
    p.regex.lastIndex = 0;
    while ((m = p.regex.exec(text)) !== null) {
      matches.push({ type: "BLOCO", value: m[1], raw: m[0] });
    }
  }

  // Extrair torre
  for (const p of TOWER_PATTERNS) {
    let m: RegExpExecArray | null;
    p.regex.lastIndex = 0;
    while ((m = p.regex.exec(text)) !== null) {
      matches.push({ type: "TORRE", value: m[1], raw: m[0] });
    }
  }

  // Calcular confiança
  const unitMatches = matches.filter(m => m.type === "UNIDADE");
  const blockMatches = matches.filter(m => m.type === "BLOCO");
  const towerMatches = matches.filter(m => m.type === "TORRE");

  let confidence = 0;
  if (matches.length === 0) {
    confidence = 0;
  } else if (unitMatches.length === 1 && blockMatches.length === 0) {
    confidence = 0.5; // apenas unidade, sem bloco
  } else if (unitMatches.length === 1 && blockMatches.length === 1) {
    confidence = 0.85; // bloco + unidade
  } else if (unitMatches.length === 1 && towerMatches.length >= 1) {
    confidence = 0.8; // torre + unidade
  } else if (unitMatches.length === 1) {
    confidence = 0.55;
  } else if (matches.length > 1) {
    confidence = 0.6;
  }

  return {
    unidade: unitMatches[0]?.value,
    bloco: blockMatches[0]?.value,
    torre: towerMatches[0]?.value,
    confidence,
    matches,
  };
}

/**
 * Valida sugestão OCR contra lista de unidades reais do condomínio.
 * Retorna null se nenhuma unidade compatível for encontrada.
 */
export function validateOCRAgainstUnits(
  ocrUnidade: string | undefined,
  ocrBloco: string | undefined,
  knownUnits: Array<{ unidade: string; bloco?: string | null }>,
): Array<{ unidade: string; bloco?: string | null; matchType: "EXACT" | "UNIT_ONLY" }> | null {
  if (!ocrUnidade) return null;

  const results: Array<{ unidade: string; bloco?: string | null; matchType: "EXACT" | "UNIT_ONLY" }> = [];

  for (const unit of knownUnits) {
    const unidadeNorm = unit.unidade.replace(/\D/g, "");
    const ocrNorm = ocrUnidade.replace(/\D/g, "");

    if (unidadeNorm === ocrNorm) {
      if (ocrBloco && unit.bloco && unit.bloco.toUpperCase() === ocrBloco.toUpperCase()) {
        results.push({ unidade: unit.unidade, bloco: unit.bloco, matchType: "EXACT" });
      } else {
        results.push({ unidade: unit.unidade, bloco: unit.bloco, matchType: "UNIT_ONLY" });
      }
    }
  }

  return results.length > 0 ? results : null;
}
