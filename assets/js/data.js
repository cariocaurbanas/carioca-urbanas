"use strict";

import { CONFIG } from "./config.js";

let productCache = null;

const STORAGE_KEY = "carioca_catalog_cache_v2";
const FETCH_TIMEOUT_MS = 9000;
const MAX_ATTEMPTS = 3;

export async function loadProducts({ forceRefresh = false } = {}) {
  if (productCache && !forceRefresh) {
    return productCache;
  }

  const errors = [];

  if (CONFIG.catalogUrl) {
    try {
      const products = await loadHostingerCatalog();

      if (products.length) {
        productCache = products;
        saveProductsToStorage(products, "hostinger");
        return productCache;
      }

      errors.push(new Error("El catálogo de Hostinger está vacío."));
    } catch (error) {
      errors.push(error);
      console.warn(
        "No se pudo cargar catalog.json. Se intentará el respaldo temporal.",
        error
      );
    }
  }

  if (CONFIG.sheetUrl) {
    try {
      const products = await loadSheetCatalog();

      if (products.length) {
        productCache = products;
        saveProductsToStorage(products, "google-sheets-fallback");
        return productCache;
      }

      errors.push(new Error("El catálogo de Google Sheets está vacío."));
    } catch (error) {
      errors.push(error);
    }
  }

  const storedProducts = loadProductsFromStorage();

  if (storedProducts.length) {
    productCache = storedProducts;
    console.warn(
      "Las fuentes remotas no respondieron. Se utilizó la última copia local.",
      errors
    );
    return productCache;
  }

  throw (
    errors[errors.length - 1] ||
    new Error("No se pudo cargar el catálogo.")
  );
}

async function loadHostingerCatalog() {
  const json = await fetchJsonWithRetry(CONFIG.catalogUrl);

  if (
    !json ||
    !Array.isArray(json.products) ||
    !json.products.length
  ) {
    return [];
  }

  return normalizeProducts(json.products);
}

async function loadSheetCatalog() {
  const csvText = await fetchTextWithRetry(CONFIG.sheetUrl, {
    Accept: "text/csv,text/plain,*/*"
  });

  return csvToProducts(csvText);
}

async function fetchJsonWithRetry(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const text = await fetchTextWithTimeout(url, {
        Accept: "application/json,text/plain,*/*"
      });

      const json = JSON.parse(text);

      if (!json || typeof json !== "object") {
        throw new Error("Hostinger devolvió un JSON inválido.");
      }

      return json;
    } catch (error) {
      lastError = error;

      if (attempt < MAX_ATTEMPTS) {
        await wait(450 * attempt);
      }
    }
  }

  throw lastError || new Error("No se pudo cargar catalog.json.");
}

async function fetchTextWithRetry(url, headers = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await fetchTextWithTimeout(url, headers);
    } catch (error) {
      lastError = error;

      if (attempt < MAX_ATTEMPTS) {
        await wait(650 * attempt);
      }
    }
  }

  throw lastError || new Error("No se pudo cargar la fuente remota.");
}

async function fetchTextWithTimeout(url, headers = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    FETCH_TIMEOUT_MS
  );

  try {
    const separator = url.includes("?") ? "&" : "?";
    const requestUrl = `${url}${separator}_=${Date.now()}`;

    const response = await fetch(requestUrl, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers
    });

    if (!response.ok) {
      throw new Error(
        `La fuente ${url} respondió ${response.status}.`
      );
    }

    const text = await response.text();

    if (!text.trim()) {
      throw new Error("La fuente devolvió una respuesta vacía.");
    }

    if (
      /^\s*<!doctype html/i.test(text) ||
      /^\s*<html/i.test(text)
    ) {
      throw new Error(
        "La fuente devolvió HTML en lugar de datos de catálogo."
      );
    }

    return text;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("La fuente del catálogo tardó demasiado en responder.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function saveProductsToStorage(products, source) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        source,
        products
      })
    );
  } catch (error) {
    console.warn("No se pudo guardar la copia local del catálogo.", error);
  }
}

function loadProductsFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    return Array.isArray(parsed.products) ? parsed.products : [];
  } catch (error) {
    console.warn("No se pudo leer la copia local del catálogo.", error);
    return [];
  }
}

function wait(milliseconds) {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

export function csvToProducts(csvText) {
  const rows = parseCSV(csvText.replace(/^\uFEFF/, ""));

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);

  const products = rows
    .slice(1)
    .map(values => {
      const product = {};

      headers.forEach((header, index) => {
        product[header] = cleanCell(values[index]);
      });

      return product;
    });

  return normalizeProducts(products);
}

function normalizeProducts(values) {
  return values
    .map(rawProduct => {
      const product = {};

      Object.entries(rawProduct || {}).forEach(([key, value]) => {
        product[normalizeHeader(key)] = cleanCell(value);
      });

      product.images = [
        product.foto_1,
        product.foto_2,
        product.foto_3,
        product.foto_4,
        product.foto_5
      ].filter(isHttpUrl);

      return product;
    })
    .filter(product => isYes(product.activo))
    .sort(compareProducts);
}

function compareProducts(a, b) {
  const brandComparison = String(a.marca || "").localeCompare(
    String(b.marca || ""),
    "es",
    { sensitivity: "base" }
  );

  if (brandComparison !== 0) {
    return brandComparison;
  }

  const modelComparison = String(a.modelo || "").localeCompare(
    String(b.modelo || ""),
    "es",
    {
      sensitivity: "base",
      numeric: true
    }
  );

  if (modelComparison !== 0) {
    return modelComparison;
  }

  return String(a.color || "").localeCompare(
    String(b.color || ""),
    "es",
    { sensitivity: "base" }
  );
}

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      quoted = !quoted;
      continue;
    }

    if (character === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }

      row.push(field);

      if (row.some(value => cleanCell(value) !== "")) {
        rows.push(row);
      }

      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  row.push(field);

  if (row.some(value => cleanCell(value) !== "")) {
    rows.push(row);
  }

  return rows;
}

export function productTitle(product) {
  return [product.marca, product.modelo, product.color]
    .filter(Boolean)
    .join(" ");
}

export function shortProductTitle(product) {
  return [product.modelo, product.color]
    .filter(Boolean)
    .join(" ");
}

export function primaryPrice(product) {
  return (
    validValue(product.precio_transferencia) ||
    validValue(product.precio_contado) ||
    validValue(product.precio_credito)
  );
}

export function formatPrice(value) {
  if (!validValue(value)) {
    return "Consultar";
  }

  const number = safeNumber(value);

  if (!Number.isFinite(number) || number <= 0) {
    return cleanCell(value);
  }

  return new Intl.NumberFormat(CONFIG.locale, {
    style: "currency",
    currency: CONFIG.currency,
    maximumFractionDigits: 0
  }).format(number);
}

export function createWhatsAppLink(product) {
  const message = [
    "Hola, quiero consultar este producto:",
    "",
    `SKU: ${product.sku || "Sin SKU"}`,
    `Producto: ${productTitle(product)}`,
    `Talles: ${product.talles || "Consultar"}`,
    "",
    "¿Está disponible? ¿Me pasás el link de pago, CBU o alias?"
  ].join("\n");

  return `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(
    message
  )}`;
}

export function extractSizes(value) {
  const text = cleanCell(value);

  if (!text) {
    return [];
  }

  const rangeMatch = text.match(/^(\d{2})\s*[-–]\s*(\d{2})$/);

  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);

    if (end >= start && end - start <= 15) {
      return Array.from({ length: end - start + 1 }, (_, index) =>
        String(start + index)
      );
    }
  }

  return text
    .split(/[,;/|·]+/)
    .map(size => size.trim())
    .filter(Boolean);
}

export function uniqueSorted(values) {
  return [
    ...new Set(
      values
        .map(cleanCell)
        .filter(Boolean)
        .filter(value => !isSpreadsheetError(value))
    )
  ].sort((a, b) => a.localeCompare(b, "es"));
}

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function isYes(value) {
  return normalizeText(value) === "si";
}

export function validValue(value) {
  const cleaned = cleanCell(value);
  return cleaned && !isSpreadsheetError(cleaned) ? cleaned : "";
}

export function isSpreadsheetError(value) {
  return /^#(N\/A|VALUE!|REF!|ERROR!|DIV\/0!|NAME\?)/i.test(
    cleanCell(value)
  );
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    };

    return entities[character];
  });
}

export function escapeAttribute(value) {
  return escapeHtml(value);
}

export function cleanCell(value) {
  return String(value ?? "").trim();
}

function normalizeHeader(value) {
  return cleanCell(value)
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(cleanCell(value));
}

function safeNumber(value) {
  const cleaned = cleanCell(value)
    .replace(/\s/g, "")
    .replace(/\$/g, "")
    .replace(/"/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : Number.NaN;
}
