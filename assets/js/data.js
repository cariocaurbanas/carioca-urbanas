"use strict";

import { CONFIG } from "./config.js";

let productCache = null;

const STORAGE_KEY = "carioca_catalog_cache_v1";
const FETCH_TIMEOUT_MS = 9000;
const MAX_ATTEMPTS = 3;

export async function loadProducts({ forceRefresh = false } = {}) {
  if (productCache && !forceRefresh) {
    return productCache;
  }

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const csvText = await fetchCatalogWithTimeout(CONFIG.sheetUrl);
      const products = csvToProducts(csvText);

      if (!products.length) {
        throw new Error("El catálogo recibido no contiene productos activos.");
      }

      productCache = products;
      saveProductsToStorage(products);

      return productCache;
    } catch (error) {
      lastError = error;

      if (attempt < MAX_ATTEMPTS) {
        await wait(650 * attempt);
      }
    }
  }

  const storedProducts = loadProductsFromStorage();

  if (storedProducts.length) {
    productCache = storedProducts;
    console.warn(
      "Google Sheets no respondió. Se utilizó la última copia guardada.",
      lastError
    );
    return productCache;
  }

  throw lastError || new Error("No se pudo cargar el catálogo.");
}

async function fetchCatalogWithTimeout(url) {
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
      cache: "default",
      signal: controller.signal,
      headers: {
        Accept: "text/csv,text/plain,*/*"
      }
    });

    if (!response.ok) {
      throw new Error(`Google Sheets respondió ${response.status}.`);
    }

    const text = await response.text();

    if (!text.trim()) {
      throw new Error("Google Sheets devolvió un catálogo vacío.");
    }

    if (/^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text)) {
      throw new Error(
        "Google Sheets devolvió una página HTML en lugar del CSV."
      );
    }

    return text;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Google Sheets tardó demasiado en responder.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function saveProductsToStorage(products) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
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

  return rows
    .slice(1)
    .map(values => {
      const product = {};

      headers.forEach((header, index) => {
        product[header] = cleanCell(values[index]);
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
    .sort((a, b) => {
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
});
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
