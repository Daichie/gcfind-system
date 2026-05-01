/* =========================================================
   GCFind - Basic UI Interactions (Beginner-friendly)
   - Component loader (optional "Blade-like" includes)
   - Simple navigation helpers
   - Dashboard: search + filters (demo)
   - Forms: required-field validation + submit feedback
   - Role demo (user vs admin) + logout
   ========================================================= */

// ---------- Small DOM helpers ----------
function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------- Role demo (kept simple; frontend-only) ----------
const STORAGE = {
  role: "gcfind.role", // "user" | "admin"
  user: "gcfind.user",
};

function getRole() {
  return localStorage.getItem(STORAGE.role) || "";
}

function setRole(role) {
  localStorage.setItem(STORAGE.role, role);
}

function setUser(profile) {
  localStorage.setItem(STORAGE.user, JSON.stringify(profile));
}

function clearSession() {
  localStorage.removeItem(STORAGE.role);
  localStorage.removeItem(STORAGE.user);
}

function guardPage() {
  const required = document.body?.getAttribute("data-requires-role") || "";
  if (!required) return;

  const role = getRole();
  if (role !== required) {
    if (required === "admin") window.location.replace("../login.html");
    else window.location.replace("login.html");
  }
}

function wireLogoutButtons() {
  $all("[data-action='logout']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      clearSession();
      window.location.href = "login.html";
    });
  });
}

function initUserLogin() {
  const btn = $("#googleLoginBtn");
  if (!btn) return;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    setRole("user");
    setUser({ name: "GC Student", email: "student@gordoncollege.edu.ph" });
    window.location.href = "dashboard.html";
  });
}

// ---------- "Blade-like" component includes ----------
// Usage:
// <div data-include="../components/navbar.html"></div>
async function loadIncludes() {
  const includeTargets = $all("[data-include]");
  await Promise.all(
    includeTargets.map(async (el) => {
      const path = el.getAttribute("data-include");
      if (!path) return;

      try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`Failed to load ${path}`);
        const html = await res.text();
        el.outerHTML = html;
      } catch (err) {
        // Fail gracefully so the page still renders.
        el.innerHTML = `<div class="text-sm text-red-600">Component failed to load: ${escapeHtml(path)}</div>`;
        // eslint-disable-next-line no-console
        console.warn(err);
      }
    })
  );
}

// ---------- Modal (simple) ----------
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
}

function wireModals() {
  // Close when clicking background
  $all("[data-modal-backdrop]").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      if (e.target !== backdrop) return;
      const modalId = backdrop.getAttribute("data-modal-backdrop");
      if (modalId) closeModal(modalId);
    });
  });

  // Close buttons
  $all("[data-modal-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-modal-close");
      if (modalId) closeModal(modalId);
    });
  });

  // Open buttons
  $all("[data-modal-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-modal-open");
      if (modalId) openModal(modalId);
    });
  });

  // Escape closes any open modal
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = $all(".gcfind-modal").find((m) => !m.classList.contains("hidden"));
    if (open?.id) closeModal(open.id);
  });
}

// ---------- Navigation helpers ----------
function navigateTo(path) {
  window.location.href = path;
}

function wireNavigation() {
  $all("[data-nav]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const path = el.getAttribute("data-nav");
      if (path) navigateTo(path);
    });
  });
}

// ---------- Dashboard: mock data + search/filter (demo) ----------
const MOCK_ITEMS = [
  {
    id: "1",
    name: "Blue Water Bottle",
    category: "Personal Item",
    location: "Library (2F)",
    date: "2026-04-05",
    image: "../assets/img/item-water-bottle.svg",
    type: "Found",
  },
  {
    id: "2",
    name: "Student ID (Jane D.)",
    category: "ID / Card",
    location: "Cafeteria",
    date: "2026-04-04",
    image: "../assets/img/item-id-card.svg",
    type: "Found",
  },
  {
    id: "3",
    name: "Black Umbrella",
    category: "Accessories",
    location: "Main Gate",
    date: "2026-04-02",
    image: "../assets/img/item-umbrella.svg",
    type: "Lost",
  },
  {
    id: "4",
    name: "Wireless Earbuds Case",
    category: "Electronics",
    location: "Engineering Building",
    date: "2026-03-31",
    image: "../assets/img/item-earbuds.svg",
    type: "Lost",
  },
  {
    id: "5",
    name: "Notebook (Blue Cover)",
    category: "School Supplies",
    location: "Room 204",
    date: "2026-03-29",
    image: "../assets/img/item-notebook.svg",
    type: "Found",
  },
  {
    id: "6",
    name: "Silver Ring",
    category: "Accessories",
    location: "Gym",
    date: "2026-03-27",
    image: "../assets/img/item-ring.svg",
    type: "Found",
  },
];

function renderItemCard(item) {
  const badgeClass =
    item.type === "Found"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : "bg-amber-50 text-amber-700 ring-1 ring-amber-200";

  return `
    <article class="group rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      <!-- Item image -->
      <div class="aspect-[4/3] bg-slate-50 flex items-center justify-center">
        <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="h-32 w-32 object-contain" />
      </div>

      <!-- Item content -->
      <div class="p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-semibold text-slate-900 leading-tight">${escapeHtml(item.name)}</h3>
            <p class="text-sm text-slate-600 mt-1">${escapeHtml(item.location)}</p>
          </div>
          <span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badgeClass}">${escapeHtml(item.type)}</span>
        </div>

        <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span class="inline-flex items-center gap-1">
            <span class="i">Category:</span>
            <span class="font-medium text-slate-700">${escapeHtml(item.category)}</span>
          </span>
          <time datetime="${escapeHtml(item.date)}">${escapeHtml(item.date)}</time>
        </div>

        <div class="mt-4">
          <a
            class="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            href="item-details.html?id=${encodeURIComponent(item.id)}"
          >
            View Details
          </a>
        </div>
      </div>
    </article>
  `;
}

function applyDashboardFilters(items, query, category, location, dateSort) {
  const q = query.trim().toLowerCase();
  let filtered = items.filter((it) => {
    const matchQuery =
      !q ||
      it.name.toLowerCase().includes(q) ||
      it.location.toLowerCase().includes(q) ||
      it.category.toLowerCase().includes(q);

    const matchCategory = !category || it.category === category;
    const matchLocation = !location || it.location === location;
    return matchQuery && matchCategory && matchLocation;
  });

  if (dateSort === "newest") {
    filtered = filtered.sort((a, b) => b.date.localeCompare(a.date));
  } else if (dateSort === "oldest") {
    filtered = filtered.sort((a, b) => a.date.localeCompare(b.date));
  }

  return filtered;
}

function initDashboard() {
  const grid = $("#itemsGrid");
  if (!grid) return;

  const searchInput = $("#searchInput");
  const categorySelect = $("#filterCategory");
  const locationSelect = $("#filterLocation");
  const dateSelect = $("#filterDate");
  const resultsMeta = $("#resultsMeta");

  // Populate filter dropdowns from data (beginner-friendly)
  const categories = Array.from(new Set(MOCK_ITEMS.map((i) => i.category))).sort();
  const locations = Array.from(new Set(MOCK_ITEMS.map((i) => i.location))).sort();

  function fillSelect(selectEl, options) {
    if (!selectEl) return;
    options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      selectEl.appendChild(o);
    });
  }

  fillSelect(categorySelect, categories);
  fillSelect(locationSelect, locations);

  function render() {
    const items = applyDashboardFilters(
      MOCK_ITEMS,
      searchInput?.value ?? "",
      categorySelect?.value ?? "",
      locationSelect?.value ?? "",
      dateSelect?.value ?? ""
    );

    grid.innerHTML = items.map(renderItemCard).join("");
    if (resultsMeta) resultsMeta.textContent = `${items.length} item(s) shown`;
  }

  ["input", "change"].forEach((evt) => {
    searchInput?.addEventListener(evt, render);
    categorySelect?.addEventListener(evt, render);
    locationSelect?.addEventListener(evt, render);
    dateSelect?.addEventListener(evt, render);
  });

  render();
}

// ---------- Item details: read query param and show mock data ----------
function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function initItemDetails() {
  const mount = $("#itemDetailsMount");
  if (!mount) return;

  const id = getQueryParam("id") || "1";
  const item = MOCK_ITEMS.find((i) => i.id === id) || MOCK_ITEMS[0];

  mount.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <!-- Image -->
      <section class="lg:col-span-2 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-200">
          <h2 class="text-lg font-semibold text-slate-900">Item Preview</h2>
          <p class="text-sm text-slate-600 mt-1">Clear photo helps with quick verification.</p>
        </div>
        <div class="aspect-[4/3] bg-slate-50 flex items-center justify-center">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" class="h-52 w-52 object-contain" />
        </div>
      </section>

      <!-- Info -->
      <section class="lg:col-span-3 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div class="p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 class="text-2xl font-bold text-slate-900">${escapeHtml(item.name)}</h1>
              <p class="text-slate-600 mt-1">Reported as: <span class="font-semibold text-slate-900">${escapeHtml(item.type)}</span></p>
            </div>
            <span class="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700 ring-1 ring-blue-200">${escapeHtml(item.category)}</span>
          </div>

          <dl class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <dt class="text-xs uppercase tracking-wide text-slate-500">Location</dt>
              <dd class="mt-1 font-semibold text-slate-900">${escapeHtml(item.location)}</dd>
            </div>
            <div class="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <dt class="text-xs uppercase tracking-wide text-slate-500">Date</dt>
              <dd class="mt-1 font-semibold text-slate-900">${escapeHtml(item.date)}</dd>
            </div>
            <div class="sm:col-span-2 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <dt class="text-xs uppercase tracking-wide text-slate-500">Description</dt>
              <dd class="mt-1 text-slate-800">
                Minimal description placeholder. Replace this with user-submitted details from your backend.
              </dd>
            </div>
          </dl>

          <div class="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              data-modal-open="contactModal"
              class="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Contact Owner / Claim Item
            </button>
            <a
              href="dashboard.html"
              class="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 transition-colors"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </section>
    </div>
  `;
}

// ---------- Basic required-field validation ----------
function setFieldError(input, message) {
  const id = input.id || input.name;
  const help = id ? document.querySelector(`[data-error-for="${CSS.escape(id)}"]`) : null;
  if (help) help.textContent = message || "";

  if (message) {
    input.classList.add("ring-2", "ring-red-500");
  } else {
    input.classList.remove("ring-2", "ring-red-500");
  }
}

function validateRequired(form) {
  let ok = true;
  const required = $all("[data-required='true']", form);

  required.forEach((input) => {
    const value = (input.value || "").trim();
    const isFile = input.type === "file";
    const hasFile = isFile ? input.files && input.files.length > 0 : true;

    if (!value || !hasFile) {
      ok = false;
      setFieldError(input, "This field is required.");
    } else {
      setFieldError(input, "");
    }
  });

  return ok;
}

function wireForms() {
  $all("form[data-gcfind-form]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const ok = validateRequired(form);
      if (!ok) {
        openModal("errorModal");
        return;
      }

      // Demo submit feedback (replace with real POST later)
      openModal("successModal");
      form.reset();

      // Clear error styling after reset
      $all("[data-required='true']", form).forEach((input) => setFieldError(input, ""));
    });

    // Validate live
    $all("[data-required='true']", form).forEach((input) => {
      input.addEventListener("input", () => setFieldError(input, ""));
      input.addEventListener("change", () => setFieldError(input, ""));
    });
  });
}

// ---------- Admin: Approve/Reject interactions (demo) ----------
function initAdmin() {
  const table = $("#adminReportsTable");
  if (!table) return;

  table.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-admin-action]");
    if (!btn) return;

    const action = btn.getAttribute("data-admin-action");
    const row = btn.closest("tr");
    const statusCell = row?.querySelector("[data-status]");
    if (!statusCell) return;

    if (action === "approve") {
      statusCell.textContent = "Approved";
      statusCell.className =
        "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200";
    }

    if (action === "reject") {
      statusCell.textContent = "Rejected";
      statusCell.className =
        "inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200";
    }
  });
}

// ---------- Boot ----------
document.addEventListener("DOMContentLoaded", async () => {
  guardPage();
  await loadIncludes();
  wireNavigation();
  wireModals();
  wireForms();
  wireLogoutButtons();
  initUserLogin();

  initDashboard();
  initItemDetails();
  initAdmin();
});

