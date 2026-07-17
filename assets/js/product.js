"use strict";

import { CONFIG } from "./config.js";
import {
  loadProducts,
  productTitle,
  shortProductTitle,
  primaryPrice,
  formatPrice,
  createWhatsAppLink,
  extractSizes,
  normalizeText,
  isYes,
  validValue,
  escapeHtml,
  escapeAttribute
} from "./data.js";

const elements = {
  loading: document.getElementById("productLoading"),
  error: document.getElementById("productError"),
  detail: document.getElementById("productDetail"),
  mainImage: document.getElementById("mainImage"),
  thumbnails: document.getElementById("thumbnails"),
  badges: document.getElementById("productBadges"),
  brand: document.getElementById("productBrand"),
  title: document.getElementById("productTitle"),
  category: document.getElementById("productCategory"),
  price: document.getElementById("productPrice"),
  installments: document.getElementById("productInstallments"),
  sizes: document.getElementById("productSizes"),
  stock: document.getElementById("productStock"),
  description: document.getElementById("productDescription"),
  descriptionSection: document.getElementById("descriptionSection"),
  buyButton: document.getElementById("buyButton"),
  sku: document.getElementById("productSku"),
  previous: document.getElementById("previousImage"),
  next: document.getElementById("nextImage"),
  counter: document.getElementById("imageCounter"),
  galleryMain: document.getElementById("galleryMain"),
  mobileBuyBar: document.getElementById("mobileBuyBar"),
  mobileProductName: document.getElementById("mobileProductName"),
  mobileProductPrice: document.getElementById("mobileProductPrice"),
  mobileBuyButton: document.getElementById("mobileBuyButton")
};

const state = {
  product: null,
  images: [],
  currentImage: 0,
  touchStartX: 0,
  touchEndX: 0
};

document.addEventListener("DOMContentLoaded", initializeProduct);

async function initializeProduct() {
  try {
    const sku = new URLSearchParams(window.location.search).get("sku");

    if (!sku) {
      throw new Error("No se indicó el producto.");
    }

    const products = await loadProducts();
    const product = products.find(
      item => normalizeText(item.sku) === normalizeText(sku)
    );

    if (!product) {
      throw new Error("No encontramos ese producto.");
    }

    state.product = product;
    state.images = product.images.length
      ? product.images
      : [CONFIG.placeholderImage];

    renderProduct();
    bindEvents();

    elements.loading.hidden = true;
    elements.detail.hidden = false;
  } catch (error) {
    console.error(error);
    elements.loading.hidden = true;
    elements.error.hidden = false;
    elements.error.querySelector("p").textContent = error.message;
  }
}

function renderProduct() {
  const product = state.product;

  const fullTitle = `${productTitle(product)} | Carioca Urbanas`;
  const description =
    product.descripcion_corta ||
    `${productTitle(product)}. Zapatillas premium importadas de Brasil.`;

  document.title = fullTitle;
  updateMetaTag("metaDescription", "content", description);
  updateMetaTag("ogTitle", "content", fullTitle);
  updateMetaTag("ogDescription", "content", description);
  updateMetaTag("ogImage", "content", state.images[0] || "");

  elements.brand.textContent = product.marca || "Carioca Urbanas";
  elements.title.textContent = shortProductTitle(product);
  elements.category.textContent = product.categoria || "Zapatillas";
  elements.price.textContent = formatPrice(primaryPrice(product));
  elements.sku.textContent = `SKU: ${product.sku || "Sin SKU"}`;
  const whatsappLink = createWhatsAppLink(product);

  elements.buyButton.href = whatsappLink;
  elements.mobileBuyButton.href = whatsappLink;
  elements.mobileProductName.textContent = shortProductTitle(product);
  elements.mobileProductPrice.textContent = formatPrice(primaryPrice(product));
  elements.mobileBuyBar.hidden = false;

  renderBadges();
  renderGallery();
  renderInstallments();
  renderSizes();
  renderStock();
  renderDescription();
}

function renderBadges() {
  elements.badges.innerHTML = [
    isYes(state.product.nuevo)
      ? '<span class="badge badge--dark">Nuevo</span>'
      : "",
    isYes(state.product.oferta)
      ? '<span class="badge badge--offer">Oferta</span>'
      : "",
    isYes(state.product.destacado)
      ? '<span class="badge badge--light">Destacado</span>'
      : ""
  ].join("");
}

function renderGallery() {
  elements.thumbnails.innerHTML = state.images
    .map(
      (image, index) => `
        <button
          type="button"
          class="thumbnail ${index === 0 ? "is-active" : ""}"
          data-index="${index}"
          aria-label="Ver imagen ${index + 1}"
        >
          <img
            src="${escapeAttribute(image)}"
            alt="${escapeAttribute(
              `${productTitle(state.product)} - imagen ${index + 1}`
            )}"
          >
        </button>
      `
    )
    .join("");

  showImage(0);

  const multiple = state.images.length > 1;
  elements.previous.hidden = !multiple;
  elements.next.hidden = !multiple;
  elements.counter.hidden = !multiple;
}

function renderInstallments() {
  const value =
    validValue(state.product.precio_credito_3) ||
    validValue(state.product.precio_credito);

  if (!value) {
    elements.installments.hidden = true;
    return;
  }

  elements.installments.hidden = false;
  const total = parsePriceNumber(value);

  if (!Number.isFinite(total) || total <= 0) {
    elements.installments.innerHTML = `
      <span>Precio en 3 cuotas</span>
      <strong>${escapeHtml(formatPrice(value))}</strong>
    `;
    return;
  }

  const installmentValue = Math.ceil(total / 3);

  elements.installments.innerHTML = `
    <span>3 cuotas de</span>
    <strong>${escapeHtml(formatPrice(installmentValue))}</strong>
    <small>Total financiado: ${escapeHtml(formatPrice(total))}</small>
  `;
}

function renderSizes() {
  const sizes = extractSizes(state.product.talles);

  elements.sizes.innerHTML = (sizes.length ? sizes : ["Consultar"])
    .map(size => `<span>${escapeHtml(size)}</span>`)
    .join("");
}

function renderStock() {
  const stock = validValue(state.product.stock_visible) || "Consultar";
  elements.stock.textContent = stock;

  const normalized = normalizeText(stock);
  elements.stock.className = "stock-pill";

  if (normalized.includes("sin stock") || normalized.includes("agotado")) {
    elements.stock.classList.add("stock-pill--out");
    elements.buyButton.textContent = "CONSULTAR";
  } else if (normalized.includes("pedido")) {
    elements.stock.classList.add("stock-pill--order");
  } else {
    elements.stock.classList.add("stock-pill--available");
  }
}

function renderDescription() {
  const description = validValue(state.product.descripcion_corta);

  if (!description) {
    elements.descriptionSection.hidden = true;
    return;
  }

  elements.description.textContent = description;
}

function bindEvents() {
  elements.previous.addEventListener("click", showPreviousImage);
  elements.next.addEventListener("click", showNextImage);

  elements.mainImage.addEventListener("load", () => {
    elements.mainImage.classList.add("is-visible");
  });

  elements.thumbnails.addEventListener("click", event => {
    const button = event.target.closest("[data-index]");

    if (button) {
      showImage(Number(button.dataset.index));
    }
  });

  elements.galleryMain.addEventListener("touchstart", event => {
    state.touchStartX = event.changedTouches[0].screenX;
  }, { passive: true });

  elements.galleryMain.addEventListener("touchend", event => {
    state.touchEndX = event.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  document.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") {
      showPreviousImage();
    }

    if (event.key === "ArrowRight") {
      showNextImage();
    }
  });
}

function showImage(index) {
  state.currentImage = index;
  elements.mainImage.classList.remove("is-visible");

  window.setTimeout(() => {
    elements.mainImage.src = state.images[index];
    elements.mainImage.alt = productTitle(state.product);

    if (elements.mainImage.complete) {
      elements.mainImage.classList.add("is-visible");
    }
  }, 90);
  elements.counter.textContent = `${index + 1} / ${state.images.length}`;

  elements.thumbnails
    .querySelectorAll(".thumbnail")
    .forEach((thumbnail, thumbnailIndex) => {
      thumbnail.classList.toggle("is-active", thumbnailIndex === index);
    });
}


function showPreviousImage() {
  if (state.images.length <= 1) {
    return;
  }

  const nextIndex =
    state.currentImage === 0
      ? state.images.length - 1
      : state.currentImage - 1;

  showImage(nextIndex);
}

function showNextImage() {
  if (state.images.length <= 1) {
    return;
  }

  const nextIndex =
    state.currentImage === state.images.length - 1
      ? 0
      : state.currentImage + 1;

  showImage(nextIndex);
}

function handleSwipe() {
  const distance = state.touchEndX - state.touchStartX;
  const minimumDistance = 45;

  if (Math.abs(distance) < minimumDistance) {
    return;
  }

  if (distance > 0) {
    showPreviousImage();
  } else {
    showNextImage();
  }
}


function parsePriceNumber(value) {
  const cleaned = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/\$/g, "")
    .replace(/"/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : Number.NaN;
}


function updateMetaTag(id, attribute, value) {
  const element = document.getElementById(id);

  if (element && value) {
    element.setAttribute(attribute, value);
  }
}
