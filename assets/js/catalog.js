"use strict";

import { CONFIG } from "./config.js";
import {
  loadProducts,
  primaryPrice,
  formatPrice,
  productTitle,
  shortProductTitle,
  uniqueSorted,
  normalizeText,
  isYes,
  escapeHtml,
  escapeAttribute
} from "./data.js";

const elements = {
  productGrid: document.getElementById("productGrid"),
  catalogStatus: document.getElementById("catalogStatus"),
  searchInput: document.getElementById("searchInput"),
  brandFilter: document.getElementById("brandFilter"),
  categoryFilter: document.getElementById("categoryFilter")
};

const state = {
  products: []
};

document.addEventListener("DOMContentLoaded", initializeCatalog);

async function initializeCatalog() {
  bindEvents();
  showLoading();

  try {
    const loadedProducts = await loadProducts();

    // En producción no mostramos productos sin fotografía.
    state.products = loadedProducts.filter(
      product => Array.isArray(product.images) && product.images.length > 0
    );
    populateFilters();
    renderFilteredProducts();
  } catch (error) {
    console.error(error);
    showError();
  }
}

function bindEvents() {
  elements.searchInput.addEventListener("input", renderFilteredProducts);
  elements.brandFilter.addEventListener("change", renderFilteredProducts);
  elements.categoryFilter.addEventListener("change", renderFilteredProducts);

  elements.productGrid.addEventListener("load", handleImageLoad, true);
  elements.productGrid.addEventListener("error", handleImageLoad, true);
  elements.productGrid.addEventListener("click", handleCatalogAction);
}

function populateFilters() {
  const brands = uniqueSorted(state.products.map(product => product.marca));
  const categories = uniqueSorted(
    state.products.map(product => product.categoria)
  );

  elements.brandFilter.innerHTML = [
    '<option value="">Todas las marcas</option>',
    ...brands.map(
      brand =>
        `<option value="${escapeAttribute(brand)}">${escapeHtml(brand)}</option>`
    )
  ].join("");

  elements.categoryFilter.innerHTML = [
    '<option value="">Todas las categorías</option>',
    ...categories.map(
      category =>
        `<option value="${escapeAttribute(category)}">${escapeHtml(
          category
        )}</option>`
    )
  ].join("");
}

function renderFilteredProducts() {
  const search = normalizeText(elements.searchInput.value);
  const brand = elements.brandFilter.value;
  const category = elements.categoryFilter.value;

  const products = state.products.filter(product => {
    const searchable = normalizeText(
      [
        product.marca,
        product.modelo,
        product.color,
        product.categoria,
        product.sku,
        product.talles
      ].join(" ")
    );

    return (
      searchable.includes(search) &&
      (!brand || product.marca === brand) &&
      (!category || product.categoria === category)
    );
  });

  renderProducts(products);
}

function renderProducts(products) {
  elements.catalogStatus.textContent =
    products.length === 1
      ? "1 producto"
      : `${products.length} productos`;

  if (!products.length) {
    elements.productGrid.innerHTML = `
      <div class="empty-state">
        <h3>No encontramos productos</h3>
        <p>Probá con otra marca, modelo o categoría.</p>
      </div>
    `;
    return;
  }

  elements.productGrid.innerHTML = products
    .map((product, index) => createProductCard(product, index))
    .join("");

  requestAnimationFrame(() => {
    elements.productGrid
      .querySelectorAll(".product-card")
      .forEach(card => card.classList.add("is-visible"));
  });
}

function createProductCard(product, index) {
  const image = product.images[0] || CONFIG.placeholderImage;
  const sku = product.sku || "";

  return `
    <article class="product-card" style="--card-delay: ${Math.min(index, 12) * 45}ms;">
      <a
        class="product-card__media"
        href="producto.html?sku=${encodeURIComponent(sku)}"
        aria-label="Ver ${escapeAttribute(productTitle(product))}"
      >
        <img
          src="${escapeAttribute(image)}"
          alt="${escapeAttribute(
            product.seo_alt || productTitle(product)
          )}"
          loading="lazy"
          decoding="async"
        >

        <div class="product-card__badges">
          ${createBadges(product)}
        </div>
      </a>

      <div class="product-card__content">
        <p class="product-card__brand">
          ${escapeHtml(product.marca || "Carioca Urbanas")}
        </p>

        <h3>
          <a href="producto.html?sku=${encodeURIComponent(sku)}">
            ${escapeHtml(shortProductTitle(product))}
          </a>
        </h3>

        <p class="product-card__price">
          ${escapeHtml(formatPrice(primaryPrice(product)))}
        </p>
        ${product.talles ? `
        <p class="product-card__sizes">
        Talles: ${escapeHtml(product.talles)}
        </p>
        ` : ""}
        <a
          class="product-card__link"
          href="producto.html?sku=${encodeURIComponent(sku)}"
        >
          Ver producto <span aria-hidden="true">→</span>
        </a>
      </div>
    </article>
  `;
}

function createBadges(product) {
  return [
    isYes(product.nuevo)
      ? '<span class="badge badge--dark">Nuevo</span>'
      : "",
    isYes(product.oferta)
      ? '<span class="badge badge--offer">Oferta</span>'
      : "",
    isYes(product.destacado)
      ? '<span class="badge badge--light">Destacado</span>'
      : ""
  ].join("");
}

function showLoading() {
  elements.catalogStatus.textContent = "Cargando…";
  elements.productGrid.innerHTML = Array.from(
    { length: 8 },
    () => `
      <article class="product-card product-card--skeleton">
        <div class="skeleton skeleton--image"></div>
        <div class="product-card__content">
          <div class="skeleton skeleton--small"></div>
          <div class="skeleton skeleton--title"></div>
          <div class="skeleton skeleton--price"></div>
        </div>
      </article>
    `
  ).join("");
}

function showError() {
  elements.catalogStatus.textContent = "Sin conexión";

  elements.productGrid.innerHTML = `
    <div class="empty-state">
      <h3>No pudimos conectar con el catálogo</h3>
      <p>Podés volver a intentarlo sin recargar toda la página.</p>
      <button type="button" class="retry-button" data-action="retry-catalog">
        Reintentar
      </button>
    </div>
  `;
}

async function handleCatalogAction(event) {
  const retryButton = event.target.closest('[data-action="retry-catalog"]');

  if (!retryButton) {
    return;
  }

  retryButton.disabled = true;
  retryButton.textContent = "Reintentando…";
  showLoading();

  try {
    const loadedProducts = await loadProducts({ forceRefresh: true });

    state.products = loadedProducts.filter(
      product => Array.isArray(product.images) && product.images.length > 0
    );

    populateFilters();
    renderFilteredProducts();
  } catch (error) {
    console.error(error);
    showError();
  }
}


function handleImageLoad(event) {
  if (event.target.matches(".product-card__media img")) {
    event.target.classList.add("is-loaded");
  }
}
