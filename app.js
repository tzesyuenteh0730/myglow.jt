const STORAGE_KEY = "book-nook-shop-state-v1";
const ADMIN_SESSION_KEY = "myglow-admin-session-until";
const ADMIN_SESSION_MS = 24 * 60 * 60 * 1000;
const CUSTOMER_SESSION_KEY = "myglow-customer-session-v1";
const CUSTOMER_CART_PREFIX = "myglow-customer-cart-";
const money = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });

let state = loadState();
let currentOrder = null;
let activeSection = "inventory";
let appMode = "customer";
let pendingCoverImage = "";
let pendingReceipt = null;
let adminTriggerClicks = 0;
let adminTriggerTimer = null;
let cloud = {
  url: "",
  anonKey: "",
  enabled: false,
  ready: false,
  error: ""
};

const els = {
  brandAdminTrigger: document.querySelector("#brandAdminTrigger"),
  customerViewBtn: document.querySelector("#customerViewBtn"),
  logoutAdminBtn: document.querySelector("#logoutAdminBtn"),
  adminLockPanel: document.querySelector("#adminLockPanel"),
  adminPassInput: document.querySelector("#adminPassInput"),
  unlockAdminBtn: document.querySelector("#unlockAdminBtn"),
  adminSections: document.querySelectorAll("[data-admin-section]"),
  sectionButtons: document.querySelectorAll("[data-section-target]"),
  catalogGrid: document.querySelector("#catalogGrid"),
  bookDetailModal: document.querySelector("#bookDetailModal"),
  bookDetailContent: document.querySelector("#bookDetailContent"),
  searchInput: document.querySelector("#searchInput"),
  inventorySearchInput: document.querySelector("#inventorySearchInput"),
  ordersSearchInput: document.querySelector("#ordersSearchInput"),
  cartItems: document.querySelector("#cartItems"),
  cartCount: document.querySelector("#cartCount"),
  cartTotal: document.querySelector("#cartTotal"),
  paymentPanel: document.querySelector("#paymentPanel"),
  checkoutQrImage: document.querySelector("#checkoutQrImage"),
  receiveCodeText: document.querySelector("#receiveCodeText"),
  checkoutBankDetails: document.querySelector("#checkoutBankDetails"),
  orderCodeText: document.querySelector("#orderCodeText"),
  orderAmountText: document.querySelector("#orderAmountText"),
  checkoutBtn: document.querySelector("#checkoutBtn"),
  copyPaymentBtn: document.querySelector("#copyPaymentBtn"),
  paidBtn: document.querySelector("#paidBtn"),
  receiptFileInput: document.querySelector("#receiptFileInput"),
  transferDetailsInput: document.querySelector("#transferDetailsInput"),
  receiptPreview: document.querySelector("#receiptPreview"),
  customerCloudStatus: document.querySelector("#customerCloudStatus"),
  customerNameInput: document.querySelector("#customerNameInput"),
  customerPhoneInput: document.querySelector("#customerPhoneInput"),
  customerWhatsappInput: document.querySelector("#customerWhatsappInput"),
  customerAddressInput: document.querySelector("#customerAddressInput"),
  bookForm: document.querySelector("#bookForm"),
  bookId: document.querySelector("#bookId"),
  coverDataInput: document.querySelector("#coverDataInput"),
  titleInput: document.querySelector("#titleInput"),
  authorInput: document.querySelector("#authorInput"),
  categoryInput: document.querySelector("#categoryInput"),
  coverInput: document.querySelector("#coverInput"),
  coverFileInput: document.querySelector("#coverFileInput"),
  clearCoverBtn: document.querySelector("#clearCoverBtn"),
  coverPreview: document.querySelector("#coverPreview"),
  coverEmptyText: document.querySelector("#coverEmptyText"),
  descriptionInput: document.querySelector("#descriptionInput"),
  activeInput: document.querySelector("#activeInput"),
  variantRows: document.querySelector("#variantRows"),
  variantTemplate: document.querySelector("#variantTemplate"),
  adminList: document.querySelector("#adminList"),
  paymentCodeInput: document.querySelector("#paymentCodeInput"),
  qrImageInput: document.querySelector("#qrImageInput"),
  clearQrBtn: document.querySelector("#clearQrBtn"),
  qrPreview: document.querySelector("#qrPreview"),
  qrEmptyText: document.querySelector("#qrEmptyText"),
  bankRows: document.querySelector("#bankRows"),
  bankTemplate: document.querySelector("#bankTemplate"),
  addBankBtn: document.querySelector("#addBankBtn"),
  savePaymentBtn: document.querySelector("#savePaymentBtn"),
  savePaymentBottomBtn: document.querySelector("#savePaymentBottomBtn"),
  saveBookBtn: document.querySelector("#saveBookBtn"),
  saveBookBottomBtn: document.querySelector("#saveBookBottomBtn"),
  newBookBtn: document.querySelector("#newBookBtn"),
  resetDemoBtn: document.querySelector("#resetDemoBtn"),
  ordersList: document.querySelector("#ordersList"),
  ordersCount: document.querySelector("#ordersCount"),
  cloudStatus: document.querySelector("#cloudStatus"),
  refreshOrdersBtn: document.querySelector("#refreshOrdersBtn"),
  bulkPrice: document.querySelector("#bulkPrice"),
  bulkStock: document.querySelector("#bulkStock"),
  applyBulkBtn: document.querySelector("#applyBulkBtn"),
  bulkAssignBtn: document.querySelector("#bulkAssignBtn"),
  bulkAssignModal: document.querySelector("#bulkAssignModal"),
  closeBulkBtn: document.querySelector("#closeBulkBtn"),
  addVariantBtn: document.querySelector("#addVariantBtn"),
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    const parsed = normalizeState(JSON.parse(saved));

    // Always load orders from Supabase instead of localStorage
    parsed.orders = [];

    return parsed;
  }

  return normalizeState({
    books: [],
    cart: [],
    orders: [],
    paymentCode: "DuitNow receive code: MYGLOWJT-8842"
  });
}

function normalizeState(data) {
  const paymentCode = (data.paymentCode || "DuitNow receive code: MYGLOWJT-8842").replace("BOOKNOOK", "MYGLOWJT");
  const sourceBooks = data.books || [];
  return {
    books: sourceBooks.map((book) => ({
      ...book,
      variants: (book.variants || []).map((variant) => ({
        ...variant,
        photo: variant.photo || ""
      }))
    })),
    cart: data.cart || [],
    orders: [],
    adminPasscode: "J@ey0730",
    paymentCode,
    qrImage: data.qrImage || "",
    bankDetails: data.bankDetails?.length ? data.bankDetails.map((bank) => ({
      ...bank,
      holder: bank.holder === "Book Nook Shop" ? "myglow.jt" : bank.holder
    })) : [
      { id: crypto.randomUUID(), bank: "Maybank", holder: "myglow.jt", number: "5142 8820 9011", note: "Use order code as reference" },
      { id: crypto.randomUUID(), bank: "CIMB", holder: "myglow.jt", number: "800 229 4487", note: "Instant transfer accepted" }
    ]
  };
}

function saveState() {
  try {
    const lightState = {
      books: state.books.map(book => ({
      ...book,
      variants: book.variants.map(v => ({
      ...v,
      photo: ""
    }))
  })),
      cart: state.cart,
      paymentCode: state.paymentCode,
      qrImage: state.qrImage,
      bankDetails: state.bankDetails
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(lightState));
  } catch (error) {
    console.error("Storage full:", error);
  }
}

async function authRequest(path, body) {
  if (!cloud.enabled) throw new Error("Supabase is not configured yet.");
  const response = await fetch(`${cloud.url}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: cloud.anonKey,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.msg || data?.message || text || `Account request failed (${response.status})`);
  }
  return data;
}

function initSupabase() {
  const config = window.MYGLOW_SUPABASE || {};

  const hasKeys =
    config.url &&
    config.anonKey &&
    !config.url.includes("YOUR_") &&
    !config.anonKey.includes("YOUR_");

  if (!hasKeys) {
    console.error("Supabase configuration missing");

    cloud = {
      url: "",
      anonKey: "",
      enabled: false,
      ready: false,
      error: "Missing config"
    };

    return;
  }

  cloud = {
    url: config.url.replace(/\/$/, ""),
    anonKey: config.anonKey,
    enabled: true,
    ready: false,
    error: ""
  };

  console.log("Supabase initialized");
}

async function cloudRequest(path, options = {}) {
  if (!cloud.enabled) throw new Error("Supabase is not configured.");
  const response = await fetch(`${cloud.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: cloud.anonKey,
      authorization: `Bearer ${cloud.anonKey}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || text || `Supabase request failed (${response.status})`);
  }
  return data;
}

function setCloudStatus(message, isOnline = false) {
  if (!els.cloudStatus) return;
  els.cloudStatus.textContent = message;
  els.cloudStatus.classList.toggle("online", isOnline);
  if (els.customerCloudStatus) {
    els.customerCloudStatus.textContent = message;
    els.customerCloudStatus.classList.toggle("online", isOnline);
  }
}

async function loadCloudOrders() {
  if (!cloud.enabled) {
    setCloudStatus("Local orders");
    return;
  }
  try {
    const data = await cloudRequest("orders?select=*&order=created_at.desc");
    state.orders = (data || []).map((row) => row.payload || {
      code: row.code,
      status: row.status,
      total: Number(row.total || 0),
      paymentDetails: row.payment_details || "",
      receipt: row.receipt || null,
      lines: row.lines || [],
      createdAt: row.created_at,
      paidAt: row.created_at
    });
    cloud.ready = true;
    cloud.error = "";
    renderOrders();
    setCloudStatus("Cloud synced", true);
  } catch (error) {
    cloud.ready = false;
    cloud.error = error.message;
    setCloudStatus("Cloud error");
    console.warn("Supabase orders failed:", error);
  }
}

async function loadCloudBooks() {
  if (!cloud.enabled) return;
  try {
    const data = await cloudRequest(
  "books?select=payload&order=updated_at.desc"
);
    if (!data?.length) {
  state.books = [];
  renderCatalog();
  renderAdminList();
  return;
}
    state.books = data.map((row) => row.payload).filter(Boolean);
    renderCatalog();
    renderAdminList();
    cloud.ready = true;
    cloud.error = "";
    saveState();
  } catch (error) {
    cloud.ready = false;
    cloud.error = error.message;
    if (!state.books.length) {
      state.books = [];
      saveState();
    }
    setCloudStatus("Cloud books error");
    console.warn("Supabase books failed:", error);
  }
}

async function seedCloudBooks() {
  if (!cloud.enabled || !state.books.length) return;
  const rows = state.books.map((book) => ({
    id: book.id,
    payload: book,
    updated_at: new Date().toISOString()
  }));
  await cloudRequest("books?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows)
  });
}

async function saveCloudBook(book) {
  if (!cloud.enabled) return;
  await cloudRequest("books?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
    id: book.id,
    payload: book,
    updated_at: new Date().toISOString()
    })
  });
}

async function deleteCloudBook(bookId) {
  if (!cloud.enabled) return;
  await cloudRequest(`books?id=eq.${encodeURIComponent(bookId)}`, { method: "DELETE" });
}

async function loadCloudSettings() {
  if (!cloud.enabled) return;
  try {
    const rows = await cloudRequest("settings?select=*&id=eq.shop&limit=1");
    const data = rows?.[0];
    if (!data?.payload) {
      await saveCloudSettings();
      return;
    }
    state.paymentCode = data.payload.paymentCode || state.paymentCode;
    state.qrImage = data.payload.qrImage || "";
    state.bankDetails = data.payload.bankDetails?.length ? data.payload.bankDetails : state.bankDetails;
    saveState();
  } catch (error) {
    cloud.ready = false;
    cloud.error = error.message;
    setCloudStatus("Cloud settings error");
    console.warn("Supabase settings failed:", error);
  }
}

async function saveCloudSettings() {
  if (!cloud.enabled) return;
  const payload = {
    paymentCode: state.paymentCode,
    qrImage: state.qrImage,
    bankDetails: state.bankDetails
  };
  await cloudRequest("settings?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
    id: "shop",
    payload,
    updated_at: new Date().toISOString()
    })
  });
}

async function loadCloudStore() {
  if (!cloud.enabled) {
    if (!state.books.length) {
      state.books = [];
      saveState();
    }
    setCloudStatus("Local only");
    return;
  }
  await loadCloudBooks();
  await loadCloudSettings();
  await loadCloudOrders();
  if (!cloud.error) {
    setCloudStatus("Cloud synced", true);
  }
}

async function saveCloudOrder(order) {
  if (!cloud.enabled) return;
  await cloudRequest("orders", {
    method: "POST",
    body: JSON.stringify({
    code: order.code,
    status: order.status,
    total: order.total,
    payment_details: order.paymentDetails,
    receipt: order.receipt,
    lines: order.lines,
    payload: order,
    created_at: order.createdAt
    })
  });
}

function formatPrice(value) {
  return money.format(Number(value || 0));
}

function getBook(bookId) {
  return state.books.find((book) => book.id === bookId);
}

function getVariant(book, variantId) {
  return book?.variants.find((variant) => variant.id === variantId);
}

function cartTotal() {
  return state.cart.reduce((sum, line) => {
    const book = getBook(line.bookId);
    const variant = getVariant(book, line.variantId);
    return sum + (variant ? variant.price * line.qty : 0);
  }, 0);
}

function render() {
  saveState();
  renderMode();
  renderAdminSections();
  renderCatalog();
  renderCart();
  renderAdminList();
  renderOrders();
}

function renderMode() {
  document.body.classList.toggle("customer-mode", appMode === "customer");
  document.body.classList.toggle("admin-mode", appMode === "admin");
  document.body.classList.toggle("lock-mode", appMode === "lock");
  els.adminLockPanel.hidden = appMode !== "lock";
  els.customerViewBtn.classList.toggle("active", appMode === "customer");
}

function variationPriceRange(book) {
  const prices = (book.variants || []).map((variant) => Number(variant.price)).filter(Number.isFinite);
  if (!prices.length) return "Price not set";
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? formatPrice(low) : `${formatPrice(low)} - ${formatPrice(high)}`;
}

function renderCatalog() {
  const query = els.searchInput.value.trim().toLowerCase();
  const books = state.books.filter((book) => {
    if (!book.active) return false;
    const text = `${book.title} ${book.author} `.toLowerCase();
    return text.includes(query);
  });

  els.catalogGrid.innerHTML = "";
  if (!books.length) {
    els.catalogGrid.innerHTML = `<p class="empty-state">No visible books match your search.</p>`;
    return;
  }

  books.forEach((book) => {
    const card = document.createElement("article");
    card.className = "book-card";
    const firstAvailable = book.variants.find((variant) => variant.stock > 0) || book.variants[0];
    const heroImage = firstAvailable?.photo || book.cover;
    const coverStyle = heroImage
      ? `style="background-image: linear-gradient(145deg, rgba(0,0,0,.36), transparent 56%), url('${escapeAttr(heroImage)}')"`
      : `style="--cover-color: ${escapeAttr(book.color || "#176d62")}"`;
    card.innerHTML = `
      <button class="book-cover ${heroImage ? "has-image" : ""}" data-open-detail="${book.id}" data-cover-for="${book.id}" ${coverStyle} aria-label="View details for ${escapeAttr(book.title)}">
        <span>${escapeHtml(book.title)}</span>
      </button>
      <div class="book-body">
        <div>
          <button class="book-title-link" type="button" data-open-detail="${book.id}">${escapeHtml(book.title)}</button>
          <p class="meta">${escapeHtml(book.author)}</p>
        </div>
        <p class="price-range">${variationPriceRange(book)}</p>
        <button class="secondary-button wide" type="button" data-open-detail="${book.id}">View details</button>
      </div>
    `;
    els.catalogGrid.appendChild(card);
  });
}

function renderCart() {
  els.cartItems.innerHTML = "";
  const count = state.cart.reduce((sum, line) => sum + line.qty, 0);
  els.cartCount.textContent = `${count} ${count === 1 ? "item" : "items"}`;
  els.cartTotal.textContent = formatPrice(cartTotal());

  if (!state.cart.length) {
    els.cartItems.innerHTML = `<p class="empty-state">Your cart is empty.</p>`;
    els.paymentPanel.hidden = true;
    resetPaymentProof();
    return;
  }

  state.cart.forEach((line) => {
    const book = getBook(line.bookId);
    const variant = getVariant(book, line.variantId);
    if (!book || !variant) return;
    const item = document.createElement("div");
    item.className = "cart-line";
    const image = variant.photo || book.cover || "";
    item.innerHTML = `
      <div class="cart-line-main">
        <div class="cart-thumb">${image ? `<img src="${escapeAttr(image)}" alt="${escapeAttr(variant.label)}">` : `<span>${escapeHtml(book.title.slice(0, 1).toUpperCase())}</span>`}</div>
        <div>
          <strong>${escapeHtml(book.title)}</strong>
          <span>${escapeHtml(variant.label)} · ${formatPrice(variant.price)}</span>
        </div>
      </div>
      <input type="number" min="1" max="${variant.stock}" value="${line.qty}" data-cart-qty="${line.bookId}:${line.variantId}" aria-label="Cart quantity">
      <button class="icon-button" type="button" data-remove-cart="${line.bookId}:${line.variantId}" aria-label="Remove ${escapeAttr(book.title)}">×</button>
    `;
    els.cartItems.appendChild(item);
  });
}

function renderAdminList() {
  els.adminList.innerHTML = "";
  const query = els.inventorySearchInput.value.trim().toLowerCase();
  const books = state.books.filter((book) => {
    const text = [
      book.title,
      book.author,
      book.category,
      book.description,
      ...book.variants.flatMap((variant) => [variant.label, String(variant.price), String(variant.stock)])
    ].join(" ").toLowerCase();
    return text.includes(query);
  });
  if (!books.length) {
    els.adminList.innerHTML = `<p class="empty-state">No inventory items match your search.</p>`;
    return;
  }
  books.forEach((book) => {
    const low = Math.min(...book.variants.map((variant) => variant.price));
    const high = Math.max(...book.variants.map((variant) => variant.price));
    const item = document.createElement("div");
    item.className = "admin-book";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(book.title)}</strong>
        <p>${book.variants.length} variations · ${formatPrice(low)}${low === high ? "" : ` to ${formatPrice(high)}`} · ${book.active ? "visible" : "hidden"}</p>
      </div>
      <div class="admin-book-actions">
    <button class="ghost-button" data-edit="${book.id}">
        Edit
    </button>

    <button class="ghost-button" data-copy="${book.id}">
        Caption
    </button>

    <button class="ghost-button danger" data-delete="${book.id}">
        Delete
    </button>
</div>
    `;
    els.adminList.appendChild(item);
  });
}

function renderAdminSections() {
  els.adminSections.forEach((section) => {
    section.hidden = section.dataset.adminSection !== activeSection;
  });
  els.sectionButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.sectionTarget === activeSection);
  });
}

function renderPaymentSetup() {
  els.paymentCodeInput.value = state.paymentCode;
  renderQrPreview();
  renderBankRows();
}

function renderQrPreview() {
  const image = state.qrImage;
  els.qrPreview.hidden = !image;
  els.qrEmptyText.hidden = Boolean(image);
  if (image) {
    els.qrPreview.src = image;
  } else {
    els.qrPreview.removeAttribute("src");
  }
}

function renderBankRows() {
  els.bankRows.innerHTML = "";
  state.bankDetails.forEach(addBankRow);
}

function resetForm(book = null) {
  els.bookForm.reset();
  els.variantRows.innerHTML = "";
  pendingCoverImage = book?.cover || "";
  els.bookId.value = book?.id || "";
  els.coverDataInput.value = book?.cover || "";
  els.titleInput.value = book?.title || "";
  els.authorInput.value = book?.author || "";
  els.coverFileInput.value = "";
  els.descriptionInput.value = book?.description || "";
  els.activeInput.checked = book?.active ?? true;
  renderCoverPreview();

if (book?.variants?.length) {
    book.variants.forEach(addVariantRow);
} else {
    addVariantRow({
        label: "",
        price: "",
        stock: ""
    });
}
}

function addVariantRow(variant = {}) {

    const row =
        els.variantTemplate.content.firstElementChild.cloneNode(true);

    row.dataset.variantId =
        variant.id || crypto.randomUUID();

    row.setAttribute("draggable", "true");

    row.querySelector(".variant-photo-data").value =
        variant.photo || "";

    row.querySelector(".variant-label").value =
        variant.label || "";

    row.querySelector(".variant-price").value =
        variant.price ?? "";

    row.querySelector(".variant-stock").value =
        variant.stock ?? "";

    updateVariantPhotoPreview(
        row,
        variant.photo || ""
    );

    els.variantRows.appendChild(row);
}

function addBankRow(bank = {}) {
  const row = els.bankTemplate.content.firstElementChild.cloneNode(true);
  row.dataset.bankId = bank.id || crypto.randomUUID();
  row.querySelector(".bank-name").value = bank.bank || "";
  row.querySelector(".bank-holder").value = bank.holder || "";
  row.querySelector(".bank-number").value = bank.number || "";
  row.querySelector(".bank-note").value = bank.note || "";
  els.bankRows.appendChild(row);
}

function collectBookFromForm() {
  const variants = [...els.variantRows.querySelectorAll(".variant-row")]
    .map((row) => ({
      id: row.dataset.variantId || crypto.randomUUID(),
      photo: row.querySelector(".variant-photo-data").value.trim(),
      label: row.querySelector(".variant-label").value.trim(),
      price: Number(row.querySelector(".variant-price").value),
      stock: Number.parseInt(row.querySelector(".variant-stock").value, 10),
    }))
    .filter((variant) => variant.label && Number.isFinite(variant.price) && Number.isFinite(variant.stock));

  if (!els.titleInput.value.trim() || !els.authorInput.value.trim()) {
    throw new Error("Please enter a book title and author.");
  }
  if (!variants.length) {
    throw new Error("Please add at least one valid variation with price and stock.");
  }

  return {
    id: els.bookId.value || crypto.randomUUID(),
    title: els.titleInput.value.trim(),
    author: els.authorInput.value.trim(),
    cover: els.coverDataInput.value.trim(),
    description: els.descriptionInput.value.trim(),
    color: colorFromTitle(els.titleInput.value),
    active: els.activeInput.checked,
    variants
  };
}

function addToCart(bookId, variantId = null, quantity = null) {
  const variantSelect = document.querySelector(`[data-variant-for="${bookId}"]`);
  const qtyInput = document.querySelector(`[data-qty-for="${bookId}"]`);
  const book = getBook(bookId);
  const selectedVariantId = variantId || variantSelect?.value;
  const variant = getVariant(book, selectedVariantId);
  const rawQty = quantity ?? qtyInput?.value ?? 1;
  const qty = Math.max(1, Number.parseInt(rawQty, 10) || 1);
  if (!book || !variant || variant.stock <= 0) return;
  const nextQty = Math.min(qty, variant.stock);
  const existing = state.cart.find((line) => line.bookId === bookId && line.variantId === variant.id);
  if (existing) {
    existing.qty = Math.min(existing.qty + nextQty, variant.stock);
  } else {
    state.cart.push({ bookId, variantId: variant.id, qty: nextQty });
  }
  currentOrder = null;
  els.paymentPanel.hidden = true;
  resetPaymentProof();
  render();
}

function openBookDetail(bookId) {
  const book = getBook(bookId);
  if (!book) return;
  const firstAvailable = book.variants.find((variant) => variant.stock > 0) || book.variants[0];
  const heroImage = firstAvailable?.photo || book.cover || "";
  els.bookDetailContent.innerHTML = `
    <div class="detail-layout" data-detail-book="${book.id}">
     <div class="detail-media">
  <button
      class="image-nav prev"
      type="button"
      data-image-prev>
      ‹
  </button>

  <button
      class="detail-main-image ${heroImage ? "has-image" : ""}"
      type="button"
      data-enlarge-photo="${escapeAttr(heroImage)}"
      style="${
        heroImage
          ? `background-image:url('${escapeAttr(heroImage)}')`
          : `--cover-color:${escapeAttr(book.color || "#176d62")}`
      }">

      <span>${escapeHtml(firstAvailable?.label || book.title)}</span>

  </button>

  <button
      class="image-nav next"
      type="button"
      data-image-next>
      ›
  </button>
</div>
      <div class="detail-copy">
        <h2 id="bookDetailTitle">
  ${escapeHtml(firstAvailable?.label || book.title)}
</h2>
        <p class="meta">${escapeHtml(book.author)}</p>
        <p>${escapeHtml(book.description || "No description yet.")}</p>
        <div class="detail-variants">
          ${book.variants.map((variant) => `
            <label class="detail-variant-card ${variant.id === firstAvailable?.id ? "selected" : ""}">
              <input type="radio" name="detailVariant" value="${variant.id}" ${variant.id === firstAvailable?.id ? "checked" : ""} ${variant.stock <= 0 ? "disabled" : ""}>
              <span>
                <strong>${escapeHtml(variant.label)}</strong>
                <small>${variant.stock} left</small>
              </span>
              <b>${formatPrice(variant.price)}</b>
            </label>
          `).join("")}
        </div>
        <div class="detail-cart-row">
          <input id="detailQtyInput" type="number" min="1" value="1" aria-label="Book detail quantity">
          <button class="primary-button" type="button" data-detail-add="${book.id}" ${!firstAvailable || firstAvailable.stock <= 0 ? "disabled" : ""}>Add to cart</button>
        </div>
      </div>
    </div>
  `;
  els.bookDetailModal.hidden = false;
  document.body.classList.add("detail-open");
}

function closeBookDetail() {
  els.bookDetailModal.hidden = true;
  els.bookDetailContent.innerHTML = "";
  document.body.classList.remove("detail-open");
}

function updateDetailVariant(variantId) {
  const layout = els.bookDetailContent.querySelector("[data-detail-book]");
  if (!layout) return;
  const book = getBook(layout.dataset.detailBook);
  const variant = getVariant(book, variantId);
  if (!book || !variant) return;
  const detailTitle = els.bookDetailContent.querySelector("#bookDetailTitle");
  if (detailTitle) {
  detailTitle.textContent = variant.label;
}
  const image = variant.photo || book.cover || "";
  const main = els.bookDetailContent.querySelector(".detail-main-image");
  main.dataset.enlargePhoto = image;
  const imageLabel = main.querySelector("span");
  if (imageLabel) {
  imageLabel.textContent = variant.label;
}
  if (image) {
    main.classList.add("has-image");
    main.style.backgroundImage = `url('${image}')`;
  } else {
    main.classList.remove("has-image");
    main.style.backgroundImage = "";
    main.style.setProperty("--cover-color", book.color || "#176d62");
  }
  els.bookDetailContent.querySelectorAll(".detail-thumb").forEach((thumb) => {
    thumb.classList.toggle("active", thumb.dataset.detailVariant === variantId);
  });
  els.bookDetailContent.querySelectorAll(".detail-variant-card").forEach((card) => {
    const input = card.querySelector("input");
    card.classList.toggle("selected", input.value === variantId);
  });
}

function enlargePhoto(image) {
  if (!image) return;
  const overlay = document.createElement("div");
  overlay.className = "photo-lightbox";
  overlay.innerHTML = `
    <button class="icon-button" type="button" aria-label="Close enlarged photo">×</button>
    <img src="${escapeAttr(image)}" alt="Enlarged variation photo">
  `;
  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
}

function showPayment() {
  if (!state.cart.length) return;
  currentOrder = {
    code: `BN-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${String(Date.now()).slice(-4)}`,
    total: cartTotal()
  };
  resetPaymentProof();
  els.receiveCodeText.textContent = state.paymentCode || "Add your payment receive code in Payment setup.";
  els.checkoutQrImage.hidden = !state.qrImage;
  if (state.qrImage) {
    els.checkoutQrImage.src = state.qrImage;
  } else {
    els.checkoutQrImage.removeAttribute("src");
  }
  els.checkoutBankDetails.innerHTML = state.bankDetails.length
    ? state.bankDetails.map((bank) => `
        <div class="checkout-bank">
          <strong>${escapeHtml(bank.bank || "Bank")}</strong>
          <span>${escapeHtml(bank.holder || "")}</span>
          <span>${escapeHtml(bank.number || "")}</span>
          ${bank.note ? `<small>${escapeHtml(bank.note)}</small>` : ""}
        </div>
      `).join("")
    : `<p class="empty-state">No bank details added yet.</p>`;
  els.orderCodeText.textContent = currentOrder.code;
  els.orderAmountText.textContent = formatPrice(currentOrder.total);
  els.paymentPanel.hidden = false;
}

async function markPaid() {
  if (!currentOrder) return;
  if (!pendingReceipt && !els.transferDetailsInput.value.trim()) {
    alert("Please upload a bank transfer receipt or enter transfer details.");
    return;
  }
  const customerName = els.customerNameInput.value.trim();
  const customerPhone = els.customerPhoneInput.value.trim();
  const customerWhatsapp = els.customerWhatsappInput.value.trim();
  const customerAddress = els.customerAddressInput.value.trim();

  if (!customerName || !customerPhone || !customerWhatsapp || !customerAddress) {
  alert("Please complete all customer information.");
  return;
}
  const createdAt = new Date().toISOString();
  const order = {
    ...currentOrder,
    status: "Payment proof submitted",
    createdAt,
    paidAt: createdAt,
    paymentDetails: els.transferDetailsInput.value.trim(),
    receipt: pendingReceipt ? structuredClone(pendingReceipt) : null,
    customer: {
      name: customerName,
      phone: customerPhone,
      whatsapp: customerWhatsapp,
      address: customerAddress
    },
    lines: state.cart.map((line) => {
      const book = getBook(line.bookId);
      const variant = getVariant(book, line.variantId);
      return {
        bookId: line.bookId,
        variantId: line.variantId,
        title: book?.title || "Unknown book",
        author: book?.author || "",
        variant: variant?.label || "Variation",
        sku: variant?.sku || "",
        photo: variant?.photo || book?.cover || "",
        price: variant?.price || 0,
        qty: line.qty,
        lineTotal: (variant?.price || 0) * line.qty
      };
    })
  };
  try {
    await saveCloudOrder(order);
    if (cloud.enabled) {
      await loadCloudOrders();
      setCloudStatus("Order saved to cloud", true);
    } else {
      state.orders.unshift(order);
      setCloudStatus("Saved locally only");
    }
  } catch (error) {
    console.warn("Cloud order save failed, keeping local copy:", error);
    setCloudStatus(`Cloud save failed`);
    alert(`Cloud save failed: ${error.message}. The order was not submitted. Please try again or contact admin.`);
    return;
  }
  state.cart = [];
  currentOrder = null;
  pendingReceipt = null;
  resetPaymentProof();
  render();
  alert("Order paid details submitted. Thank you.");
}

function renderOrders() {
  els.ordersList.innerHTML = "";
  const query = els.ordersSearchInput.value.trim().toLowerCase();
  const orders = state.orders.filter((order) => {
    const lineText = (order.lines || []).map((line) => [
      line.title,
      line.author,
      line.variant,
      line.sku,
      line.qty,
      line.price,
      line.lineTotal
    ].join(" ")).join(" ");
    const text = [
      order.code,
      order.status,
      order.paymentDetails,
      order.total,
      order.receipt?.name,
      lineText
    ].join(" ").toLowerCase();
    return text.includes(query);
  });
  els.ordersCount.textContent = `${orders.length} ${orders.length === 1 ? "order" : "orders"}`;
  if (!state.orders.length) {
    els.ordersList.innerHTML = `<p class="empty-state">No orders yet.</p>`;
    return;
  }
  if (!orders.length) {
    els.ordersList.innerHTML = `<p class="empty-state">No orders match your search.</p>`;
    return;
  }
  orders.forEach((order) => {
    const item = document.createElement("article");
    item.className = "order-card";
    const rows = (order.lines || []).map((line) => `
      <div class="order-line">
        <span>${escapeHtml(line.title || "Book")} · ${escapeHtml(line.variant || "")}</span>
        <strong>${line.qty} × ${formatPrice(line.price || 0)}</strong>
      </div>
    `).join("");
    item.innerHTML = `
      <div class="order-card-head">
        <div>
        <strong>${escapeHtml(order.code || "Order")}</strong>
        <p>${formatDate(order.createdAt || order.paidAt)} · ${escapeHtml(order.status || "Order paid")}</p>
      </div>
        <strong>${formatPrice(order.total || 0)}</strong>
      </div>
      <div class="order-lines">${rows}</div>
      <div class="order-customer">
        <strong>Customer Details</strong>
          <p>
            Name:
            ${escapeHtml(order.customer?.name || "-")}
          </p>
        
          <p>
            Phone:
            ${escapeHtml(order.customer?.phone || "-")}
          </p>
        
          <p>
            WhatsApp:
            ${escapeHtml(order.customer?.whatsapp || "-")}
          </p>
        
          <p>
            Address:
            ${escapeHtml(order.customer?.address || "-")}
          </p>
        </div>
      <div class="order-payment">
        <span>Payment details</span>
        <p>${escapeHtml(order.paymentDetails || "No transfer details entered.")}</p>
        ${renderReceipt(order.receipt)}
      </div>
    `;
    els.ordersList.appendChild(item);
  });
}

async function saveBook() {
  try {
    const book = collectBookFromForm();
    const index = state.books.findIndex((item) => item.id === book.id);
    if (index >= 0) {
      state.books[index] = book;
    } else {
      state.books.unshift(book);
    }
    await saveCloudBook(book);
    await loadCloudBooks();
    resetForm();
    render();
  } catch (error) {
    console.warn("Book save failed:", error);
    alert(`Book save failed: ${error.message}`);
  }
}

function collectBankDetails() {
  return [...els.bankRows.querySelectorAll(".bank-row")]
    .map((row) => ({
      id: row.dataset.bankId || crypto.randomUUID(),
      bank: row.querySelector(".bank-name").value.trim(),
      holder: row.querySelector(".bank-holder").value.trim(),
      number: row.querySelector(".bank-number").value.trim(),
      note: row.querySelector(".bank-note").value.trim()
    }))
    .filter((bank) => bank.bank || bank.holder || bank.number || bank.note);
}

async function savePaymentSetup() {
  state.paymentCode = els.paymentCodeInput.value.trim();
  state.qrImage = state.qrImage || "";
  state.bankDetails = collectBankDetails();
  try {
    await saveCloudSettings();
    saveState();
    renderQrPreview();
    if (currentOrder) showPayment();
    setCloudStatus(cloud.enabled ? "Cloud synced" : "Local only", cloud.enabled);
  } catch (error) {
    console.warn("Payment setup save failed:", error);
    setCloudStatus("Cloud settings error");
    alert(`Payment setup save failed: ${error.message}`);
  }
}

async function switchSection(section) {
  if (section === "payment" && activeSection !== "payment") {
    renderPaymentSetup();
  }
  activeSection = section;
  renderAdminSections();
  if (section === "orders") {
    await loadCloudOrders();
    renderOrders();
  }
  document.querySelector(`[data-admin-section="${section}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function addVariationLabel(imageSrc, label) {

    if (!label) return imageSrc;

    const img = new Image();

    img.src = imageSrc;

    await new Promise(resolve => {
        img.onload = resolve;
    });

    const canvas =
        document.createElement("canvas");

    canvas.width = img.width;
    canvas.height = img.height;

    const ctx =
        canvas.getContext("2d");

    ctx.drawImage(img, 0, 0);

const fontSize = Math.max(
    14,
    Math.round(canvas.width * 0.060)
);

ctx.font = `bold ${fontSize}px Arial`;

const paddingX = 10;
const paddingY = 6;

const textWidth =
    ctx.measureText(label).width;

const boxWidth =
    textWidth + paddingX * 2;

const boxHeight =
    fontSize + paddingY * 2;

const margin = 12;

const x = margin;
const y = margin;

ctx.fillStyle = "rgba(255,255,255,0.95)";
ctx.fillRect(
    x,
    y,
    boxWidth,
    boxHeight
);

ctx.strokeStyle = "#D8D8D8";
ctx.lineWidth = 1;
ctx.strokeRect(
    x,
    y,
    boxWidth,
    boxHeight
);

ctx.fillStyle = "#000";
ctx.textBaseline = "middle";
ctx.textAlign = "left";

ctx.fillText(
    label,
    x + paddingX,
    y + boxHeight / 2
);

    return canvas.toDataURL(
        "image/jpeg",
        0.95
    );
}

function switchMode(mode) {
  appMode = mode;
  if (mode === "admin") {
    activeSection = "inventory";
    saveAdminSession();
  }
  if (mode !== "lock") {
    els.adminPassInput.value = "";
  }
  render();
}

function unlockAdmin() {
  if (els.adminPassInput.value === state.adminPasscode) {
    switchMode("admin");
    return;
  }
  alert("Wrong admin passcode.");
}

function saveAdminSession() {
  localStorage.setItem(ADMIN_SESSION_KEY, String(Date.now() + ADMIN_SESSION_MS));
}

function clearAdminSession() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

function hasValidAdminSession() {
  return Number(localStorage.getItem(ADMIN_SESSION_KEY) || 0) > Date.now();
}

function renderCoverPreview() {
  const image =
  els.coverDataInput.value.trim();
  els.coverPreview.hidden = !image;
  els.coverEmptyText.hidden = Boolean(image);
  if (image) {
    els.coverPreview.src = image;
  } else {
    els.coverPreview.removeAttribute("src");
  }
}

function readImageFile(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => callback(reader.result));
  reader.readAsDataURL(file);
}

function dataUrlToFile(dataUrl, originalName = "variation-photo.jpg") {
  const [meta, data] = dataUrl.split(",");
  const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
  const ext = mime.split("/")[1]?.split("+")[0] || "jpg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const baseName = originalName.replace(/\.[^.]+$/, "") || "variation-photo";
  return new File([bytes], `${baseName}-labelled.${ext}`, { type: mime });
}

function readProofFile(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => callback({
    name: file.name,
    type: file.type,
    data: reader.result
  }));
  reader.readAsDataURL(file);
}

function renderReceipt(receipt) {
  if (!receipt) return `<p class="empty-state">No receipt uploaded.</p>`;
  if (receipt.type?.startsWith("image/")) {
    return `<img class="order-receipt" src="${escapeAttr(receipt.data)}" alt="${escapeAttr(receipt.name || "Payment receipt")}">`;
  }
  return `<a class="receipt-link" href="${escapeAttr(receipt.data)}" download="${escapeAttr(receipt.name || "payment-receipt")}">${escapeHtml(receipt.name || "Download receipt")}</a>`;
}

function resetPaymentProof() {
  pendingReceipt = null;
  if (els.receiptFileInput) els.receiptFileInput.value = "";
  if (els.transferDetailsInput) els.transferDetailsInput.value = "";
  if (els.receiptPreview) {
    els.receiptPreview.hidden = true;
    els.receiptPreview.innerHTML = "";
  }
}

function renderReceiptPreview() {
  if (!pendingReceipt) {
    els.receiptPreview.hidden = true;
    els.receiptPreview.innerHTML = "";
    return;
  }
  els.receiptPreview.hidden = false;
  els.receiptPreview.innerHTML = pendingReceipt.type?.startsWith("image/")
    ? `<img src="${escapeAttr(pendingReceipt.data)}" alt="${escapeAttr(pendingReceipt.name)}">`
    : `<span>${escapeHtml(pendingReceipt.name)}</span>`;
}

function formatDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function updateVariantPhotoPreview(row, image) {
  const preview = row.querySelector(".variant-photo-box");
  const img = preview.querySelector("img");
  const text = preview.querySelector("span");
  img.hidden = !image;
  text.hidden = Boolean(image);
  if (image) {
    img.src = image;
  } else {
    img.removeAttribute("src");
  }
}

function enableVariantSorting() {

    let draggedRow = null;

    // ONLY allow dragging when ☰ is held
    document.addEventListener("mousedown", (e) => {

        const handle =
            e.target.closest(".drag-handle");

        if (!handle) return;

        const row =
            handle.closest(".variant-row");

        if (row) {
            row.setAttribute("draggable", "true");
        }
    });

    document.addEventListener("mouseup", () => {

        document
            .querySelectorAll(".variant-row")
            .forEach(row =>
                row.removeAttribute("draggable")
            );
    });

    els.variantRows.addEventListener("dragstart", (e) => {

        const row =
            e.target.closest(".variant-row");

        if (!row) return;

        draggedRow = row;

        row.classList.add("dragging");
    });

    els.variantRows.addEventListener("dragend", () => {

        draggedRow?.classList.remove("dragging");

        draggedRow = null;
    });

    els.variantRows.addEventListener("dragover", (e) => {

        e.preventDefault();

        const target =
            e.target.closest(".variant-row");

        if (!target || target === draggedRow) {
            return;
        }

        const rect =
            target.getBoundingClientRect();

        const midpoint =
            rect.top + rect.height / 2;

        if (e.clientY < midpoint) {

            els.variantRows.insertBefore(
                draggedRow,
                target
            );

        } else {

            els.variantRows.insertBefore(
                draggedRow,
                target.nextSibling
            );
        }
    });
}
function updateSelectedVariantPhoto(select) {
  const bookId = select.dataset.variantFor;
  const option = select.options[select.selectedIndex];
  const image = option?.dataset.photo || select.dataset.bookCover || "";
  const cover = document.querySelector(`[data-cover-for="${bookId}"]`);
  const preview = document.querySelector(`[data-variant-preview-for="${bookId}"]`);
  if (cover) {
    if (image) {
      cover.classList.add("has-image");
      cover.style.backgroundImage = `linear-gradient(145deg, rgba(0,0,0,.36), transparent 56%), url("${image}")`;
    } else {
      cover.classList.remove("has-image");
      cover.style.backgroundImage = "";
    }
  }
  if (!preview) return;
  if (option?.dataset.photo) {
    if (preview.tagName === "IMG") {
      preview.src = option.dataset.photo;
    } else {
      const img = document.createElement("img");
      img.className = "variation-photo";
      img.dataset.variantPreviewFor = bookId;
      img.src = option.dataset.photo;
      img.alt = option.textContent.trim();
      preview.replaceWith(img);
    }
  } else if (preview.tagName === "IMG") {
    const fallback = document.createElement("span");
    fallback.className = "pill";
    fallback.dataset.variantPreviewFor = bookId;
    fallback.textContent = "Photo";
    preview.replaceWith(fallback);
  }
}

function colorFromTitle(title) {
  const colors = ["#176d62", "#bd5760", "#c4832c", "#365f7f", "#6f5b8c", "#4f7240"];
  const score = [...title].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[score % colors.length];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
function navigateVariant(direction) {

  const layout =
    els.bookDetailContent.querySelector("[data-detail-book]");

  if (!layout) return;

  const book = getBook(layout.dataset.detailBook);

  const current =
    els.bookDetailContent.querySelector(
      'input[name="detailVariant"]:checked'
    );

  if (!current) return;

  const index =
    book.variants.findIndex(v => v.id === current.value);

  let nextIndex = index + direction;

  if (nextIndex < 0)
    nextIndex = book.variants.length - 1;

  if (nextIndex >= book.variants.length)
    nextIndex = 0;

  const nextVariant =
    book.variants[nextIndex];

  const nextRadio =
    els.bookDetailContent.querySelector(
      `input[value="${nextVariant.id}"]`
    );

  nextRadio.checked = true;

  updateDetailVariant(nextVariant.id);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

els.bookDetailModal.addEventListener("click", (event) => {

  if (event.target.closest("[data-image-prev]")) {
    navigateVariant(-1);
    return;
  }

  if (event.target.closest("[data-image-next]")) {
    navigateVariant(1);
    return;
  }

});

els.catalogGrid.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add]");
  const detailButton = event.target.closest("[data-open-detail]");
  if (addButton) addToCart(addButton.dataset.add);
  if (detailButton) openBookDetail(detailButton.dataset.openDetail);
});

els.catalogGrid.addEventListener("change", (event) => {
  const select = event.target.closest("[data-variant-for]");
  if (select) updateSelectedVariantPhoto(select);
});

els.bookDetailModal.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-close-detail]");
  const addButton = event.target.closest("[data-detail-add]");
  const thumbButton = event.target.closest("[data-detail-variant]");
  const enlargeButton = event.target.closest("[data-enlarge-photo]");
  if (closeButton) closeBookDetail();
  if (thumbButton) {
    const input = els.bookDetailContent.querySelector(`input[name="detailVariant"][value="${thumbButton.dataset.detailVariant}"]`);
    if (input && !input.disabled) {
      input.checked = true;
      updateDetailVariant(thumbButton.dataset.detailVariant);
    }
  }
  if (enlargeButton) enlargePhoto(enlargeButton.dataset.enlargePhoto);
  if (addButton) {
    const selected = els.bookDetailContent.querySelector('input[name="detailVariant"]:checked');
    const qty = els.bookDetailContent.querySelector("#detailQtyInput")?.value || 1;
    addToCart(addButton.dataset.detailAdd, selected?.value, qty);
    closeBookDetail();
  }
});

els.bookDetailModal.addEventListener("change", (event) => {
  const input = event.target.closest('input[name="detailVariant"]');
  if (input) updateDetailVariant(input.value);
});

els.cartItems.addEventListener("input", (event) => {
  const input = event.target.closest("[data-cart-qty]");
  if (!input) return;
  const [bookId, variantId] = input.dataset.cartQty.split(":");
  const book = getBook(bookId);
  const variant = getVariant(book, variantId);
  const line = state.cart.find((item) => item.bookId === bookId && item.variantId === variantId);
  if (line && variant) {
    line.qty = Math.max(1, Math.min(Number.parseInt(input.value, 10) || 1, variant.stock));
    currentOrder = null;
    els.paymentPanel.hidden = true;
    render();
  }
});

els.cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-cart]");
  if (!button) return;
  const [bookId, variantId] = button.dataset.removeCart.split(":");
  state.cart = state.cart.filter((line) => line.bookId !== bookId || line.variantId !== variantId);
  currentOrder = null;
  els.paymentPanel.hidden = true;
  render();
});

els.adminList.addEventListener("click", async (event) => {

  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  const copyButton = event.target.closest("[data-copy]");
if (copyButton) {

    const book = getBook(copyButton.dataset.copy);

    if (!book) return;

    const priceSection = (() => {

        const variants = book.variants || [];

        if (!variants.length) return "";

        const priceGroups = {};

        variants.forEach(v => {
            const price = Number(v.price);

            if (!priceGroups[price]) {
                priceGroups[price] = [];
            }

            priceGroups[price].push(v.label);
        });

        const prices = Object.keys(priceGroups);

        if (prices.length === 1) {
            return formatPrice(prices[0]);
        }

        const sorted = Object.entries(priceGroups)
            .sort((a, b) => {
    const countDiff = b[1].length - a[1].length;

    if (countDiff !== 0) return countDiff;

    return Number(a[0]) - Number(b[0]);
});

        const [mainPrice] = sorted[0];

        const lines = [formatPrice(mainPrice)];

        sorted.slice(1).forEach(([price, labels]) => {
            lines.push(
                `${labels.join(", ")} : ${formatPrice(price)}`
            );
        });

        return lines.join("\n");
    })();

    const caption =
`🇲🇾 《${book.title}》｜${book.author}
${priceSection}

${book.description || ""}

#${book.title.replace(/[《》【】（）()\\s]/g, "")}
#${book.author.replace(/\\s/g, "")}
#马来西亚`;

    await navigator.clipboard.writeText(caption);

    alert("Caption copied!");
    return;
}

  if (editButton) {
    activeSection = "inventory";
    renderAdminSections();
    resetForm(getBook(editButton.dataset.edit));
    window.scrollTo({
      top: document.querySelector(".admin-panel").offsetTop - 12,
      behavior: "smooth"
    });
  }

  if (deleteButton) {

    const bookId = deleteButton.dataset.delete;

    state.books = state.books.filter(
      (book) => book.id !== bookId
    );

    state.cart = state.cart.filter(
      (line) => line.bookId !== bookId
    );

    deleteCloudBook(bookId)
      .catch((error) => {
        alert(error.message);
      })
      .finally(() => {
        resetForm();
        render();
      });
  }
});

els.sectionButtons.forEach((button) => {
  button.addEventListener("click", () => switchSection(button.dataset.sectionTarget));
});

els.variantRows.addEventListener("click", (event) => {

    const photo =
        event.target.closest(".variant-photo-box img");

    if (!photo) return;

    const row =
        photo.closest(".variant-row");

    const image =
        row.querySelector(".variant-photo-data").value;

    if (image) {
        enlargePhoto(image);
    }

});

els.variantRows.addEventListener("change", (event) => {
  const input = event.target.closest(".variant-photo-file");
  if (!input) return;

  const row = input.closest(".variant-row");
  const file = input.files?.[0];
  if (!file) return;

  readImageFile(file, async (image) => {
    try {
      const label = row.querySelector(".variant-label").value.trim();
      const finalImage = await addVariationLabel(image, label);
      const labelledFile = dataUrlToFile(finalImage, file.name);
      const imageUrl = await uploadToStorage(labelledFile, "books");

      row.querySelector(".variant-photo-data").value = imageUrl;
      updateVariantPhotoPreview(row, imageUrl);
    } catch (err) {
      console.error("Variation photo upload failed:", err);
      alert(`Variation photo upload failed: ${err.message}`);
    }
  });
});

els.addVariantBtn.addEventListener("click", () => {
    addVariantRow();
});

els.variantRows.addEventListener("click", (event) => {

    const removeBtn =
        event.target.closest(".remove-variant");

    if (!removeBtn) return;

    const row =
        removeBtn.closest(".variant-row");

    if (!row) return;

    row.remove();
});

els.bankRows.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-bank");
  if (!button) return;
  button.closest(".bank-row").remove();
});

els.saveBookBtn.addEventListener("click", saveBook);
els.saveBookBottomBtn.addEventListener("click", saveBook);
els.applyBulkBtn.addEventListener("click", () => {

    const price = els.bulkPrice.value;
    const stock = els.bulkStock.value;

    document
        .querySelectorAll(".variant-row")
        .forEach(row => {

            if (price !== "") {
                row.querySelector(".variant-price").value = price;
            }

            if (stock !== "") {
                row.querySelector(".variant-stock").value = stock;
            }
        });

    els.bulkAssignModal.hidden = true;

    els.bulkPrice.value = "";
    els.bulkStock.value = "";
});
els.bulkAssignBtn.addEventListener("click", () => {
    els.bulkAssignModal.hidden = false;
});

els.closeBulkBtn.addEventListener("click", () => {
    els.bulkAssignModal.hidden = true;
});
els.addBankBtn.addEventListener("click", () => addBankRow());
els.customerViewBtn.addEventListener("click", () => switchMode("customer"));
els.logoutAdminBtn.addEventListener("click", () => {
  clearAdminSession();
  switchMode("customer");
});
els.unlockAdminBtn.addEventListener("click", unlockAdmin);
els.adminPassInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") unlockAdmin();
});
let adminPressTimer;

els.brandAdminTrigger.addEventListener("pointerdown", () => {
  adminPressTimer = setTimeout(() => {
    switchMode("lock");

    setTimeout(() => {
      els.adminPassInput?.focus();
    }, 100);
  }, 1500);
});

els.brandAdminTrigger.addEventListener("pointerup", () => {
  clearTimeout(adminPressTimer);
});

els.brandAdminTrigger.addEventListener("pointerleave", () => {
  clearTimeout(adminPressTimer);
});

els.brandAdminTrigger.addEventListener("pointercancel", () => {
  clearTimeout(adminPressTimer);
});
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "a" && appMode !== "admin") {
    switchMode("lock");
    window.setTimeout(() => els.adminPassInput.focus(), 60);
  }
});
els.newBookBtn.addEventListener("click", () => {
  appMode = "admin";
  activeSection = "inventory";
  renderMode();
  renderAdminSections();
  resetForm();
  document.querySelector(".admin-panel").scrollIntoView({ behavior: "smooth", block: "start" });
});
els.searchInput.addEventListener("input", renderCatalog);
els.inventorySearchInput.addEventListener("input", renderAdminList);
els.ordersSearchInput.addEventListener("input", renderOrders);
if (els.refreshOrdersBtn) {
  els.refreshOrdersBtn.addEventListener("click", async () => {
    await loadCloudStore();
    renderOrders();
    renderCatalog();
    renderAdminList();
    renderPaymentSetup();
  });
}
els.checkoutBtn.addEventListener("click", showPayment);
els.paidBtn.addEventListener("click", markPaid);

els.receiptFileInput.addEventListener("change", async () => {
  const file = els.receiptFileInput.files?.[0];

  if (!file) return;

  try {
    const receiptUrl = await uploadToStorage(file, "receipts");

    pendingReceipt = {
      name: file.name,
      type: file.type,
      data: receiptUrl
    };

    renderReceiptPreview();
  } catch (err) {
    alert(err.message);
  }
});

els.copyPaymentBtn.addEventListener("click", async () => {
  if (!currentOrder) return;
  const bankText = state.bankDetails.map((bank) => `${bank.bank}: ${bank.holder} ${bank.number}${bank.note ? ` (${bank.note})` : ""}`).join("\n");
  const text = `Payment code: ${state.paymentCode}\n${bankText ? `${bankText}\n` : ""}Order: ${currentOrder.code}\nAmount: ${formatPrice(currentOrder.total)}`;
  await navigator.clipboard.writeText(text);
  els.copyPaymentBtn.textContent = "Copied";
  window.setTimeout(() => {
    els.copyPaymentBtn.textContent = "Copy payment details";
  }, 1400);
});

els.qrImageInput.addEventListener("change", () => {
  const file = els.qrImageInput.files?.[0];
  readImageFile(file, (image) => {
    state.qrImage = image;
    savePaymentSetup();
  });
});

els.coverFileInput.addEventListener("change", async () => {
  const file = els.coverFileInput.files?.[0];

  if (!file) return;

  try {
    const imageUrl = await uploadToStorage(file, "books");

    pendingCoverImage = imageUrl;
    els.coverDataInput.value = imageUrl;

    renderCoverPreview();
  } catch (err) {
    alert(err.message);
  }
});

els.clearCoverBtn.addEventListener("click", () => {
  pendingCoverImage = "";
  els.coverDataInput.value = "";
  els.coverFileInput.value = "";
  renderCoverPreview();
});

els.clearQrBtn.addEventListener("click", () => {
  state.qrImage = "";
  els.qrImageInput.value = "";
  savePaymentSetup();
});

els.savePaymentBtn.addEventListener("click", savePaymentSetup);
els.savePaymentBottomBtn.addEventListener("click", savePaymentSetup);

async function boot() {
  initSupabase();
  if (hasValidAdminSession()) {
    appMode = "admin";
    activeSection = "inventory";
  }
  resetForm();
  renderPaymentSetup();
  els.catalogGrid.innerHTML =
  '<p class="empty-state">Loading books...</p>';
  enableVariantSorting();
  await loadCloudStore();
  render();
}

boot();

async function uploadToStorage(file, bucket) {
  const safeName =
  file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

const fileName =
  `${Date.now()}-${safeName}`;
  
  const response = await fetch(
    `${cloud.url}/storage/v1/object/${bucket}/${fileName}`,
    {
      method: "POST",
      headers: {
  apikey: cloud.anonKey,
  Authorization: `Bearer ${cloud.anonKey}`,
  "Content-Type": file.type || "application/octet-stream",
  "x-upsert": "true"
},
      body: file
    }
  );

if (!response.ok) {

  const errorText = await response.text();

  console.error(
    "Storage upload error:",
    response.status,
    errorText
  );

  throw new Error(
    `Upload failed (${response.status}): ${errorText}`
  );
}

  return `${cloud.url}/storage/v1/object/public/${bucket}/${fileName}`;
}
