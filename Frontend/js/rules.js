// API base URL comes from js/api-config.js (loaded before this file)
const API_BASE_URL = window.API_URL;

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "./login.html";
}

// ----------------------------------------
// Helpers
// ----------------------------------------

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "./login.html";
    throw new Error("Session expired");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { ok: response.ok, status: response.status, data };
}

// ----------------------------------------
// State
// ----------------------------------------

let rules = [];
let editingId = null; // rule currently being edited inline

const loadingState = document.querySelector("#loadingState");
const errorState = document.querySelector("#errorState");
const errorMessage = document.querySelector("#errorStateMessage");
const retryButton = document.querySelector("#retryButton");
const addForm = document.querySelector("#addRuleForm");
const addButton = document.querySelector("#addRuleButton");
const ruleText = document.querySelector("#ruleText");
const ruleImages = document.querySelector("#ruleImages");
const rulePreview = document.querySelector("#rulePreview");
const rulesList = document.querySelector("#rulesList");
const emptyState = document.querySelector("#emptyState");
const lightbox = document.querySelector("#ruleLightbox");
const lightboxImg = document.querySelector("#ruleLightboxImg");

// ----------------------------------------
// Lightbox
// ----------------------------------------

function openLightbox(url) {
  lightboxImg.src = url;
  lightbox.classList.remove("hidden");
  lightbox.classList.add("flex");
}

function closeLightbox() {
  lightbox.classList.add("hidden");
  lightbox.classList.remove("flex");
}

if (lightbox) {
  lightbox.addEventListener("click", closeLightbox);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLightbox();
  });
}

// ----------------------------------------
// Add-form image previews (chosen or pasted)
// ----------------------------------------

let pendingFiles = []; // File objects waiting to be uploaded
let previewUrls = [];

function renderPreviews() {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls = [];

  if (pendingFiles.length === 0) {
    rulePreview.classList.add("hidden");
    rulePreview.classList.remove("flex");
    rulePreview.innerHTML = "";
    return;
  }

  rulePreview.innerHTML = "";

  pendingFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    previewUrls.push(url);

    const wrap = document.createElement("div");
    wrap.className = "relative";
    wrap.innerHTML = `
      <img src="${url}" alt="Rule example preview"
        class="h-20 w-20 rounded-lg object-cover border border-white/10">
      <button type="button" data-index="${index}"
        class="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white text-xs font-bold leading-none hover:bg-red-400 transition"
        aria-label="Remove image">✕</button>`;
    wrap.querySelector("button").addEventListener("click", () => {
      pendingFiles.splice(index, 1);
      renderPreviews();
    });

    rulePreview.appendChild(wrap);
  });

  rulePreview.classList.remove("hidden");
  rulePreview.classList.add("flex");
}

function acceptFiles(fileList) {
  const incoming = Array.from(fileList || []).filter((file) =>
    file.type.startsWith("image/")
  );

  for (const file of incoming) {
    if (file.size > MAX_IMAGE_BYTES) {
      alert(
        `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. ` +
          "Images must be 10 MB or smaller."
      );
      continue;
    }

    if (pendingFiles.length >= MAX_IMAGES) {
      alert(`You can attach at most ${MAX_IMAGES} images per rule.`);
      break;
    }

    pendingFiles.push(file);
  }

  renderPreviews();
}

if (ruleImages) {
  ruleImages.addEventListener("change", () => {
    acceptFiles(ruleImages.files);
    ruleImages.value = "";
  });
}

// Paste screenshots straight into the add form
document.addEventListener("paste", (event) => {
  if (!event.clipboardData) return;

  const images = Array.from(event.clipboardData.items || []).filter(
    (item) => item.kind === "file" && item.type.startsWith("image/")
  );

  if (images.length === 0) return;

  event.preventDefault();
  acceptFiles(images.map((item) => item.getAsFile()).filter(Boolean));
});

// ----------------------------------------
// Render rules
// ----------------------------------------

function imageStrip(images, { removable = false, onRemove } = {}) {
  if (!images || images.length === 0) return "";

  const thumbs = images
    .map((url, index) => {
      const removeButton = removable
        ? `<button type="button" data-remove="${index}"
             class="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white text-xs font-bold leading-none hover:bg-red-400 transition"
             aria-label="Remove image">✕</button>`
        : "";

      return `
        <span class="relative block">
          <img src="${esc(url)}" data-zoom="${esc(url)}" alt="Rule example"
            class="h-20 w-20 rounded-lg object-cover border border-white/10 cursor-zoom-in hover:border-orange-500/60 transition">
          ${removeButton}
        </span>`;
    })
    .join("");

  return `<div class="mt-3 flex flex-wrap gap-3" data-strip>${thumbs}</div>`;
}

function renderRules() {
  const hasRules = rules.length > 0;
  rulesList.classList.toggle("hidden", !hasRules);
  emptyState.classList.toggle("hidden", hasRules);
  addForm.classList.remove("hidden");

  rulesList.innerHTML = "";

  rules.forEach((rule, index) => {
    const li = document.createElement("li");
    li.className = "rounded-xl border border-white/10 bg-[#101010] p-5";

    if (editingId === rule._id) {
      // ---- Editing this rule ----
      li.innerHTML = `
        <div class="flex items-start gap-3">
          <span class="shrink-0 mt-1 h-7 w-7 rounded-full bg-orange-500/15 border border-orange-500/40
                       text-orange-400 text-sm font-bold flex items-center justify-center">${index + 1}</span>
          <div class="min-w-0 flex-1">
            <textarea data-edit-text rows="3" maxlength="600"
              class="w-full bg-[#0b0b0b] border border-white/10 rounded-xl px-4 py-3 text-sm text-white
                     outline-none focus:border-orange-500 transition resize-none">${esc(rule.text)}</textarea>
            <div data-edit-images>${imageStrip(rule.images, { removable: true })}</div>
            <label class="mt-3 block text-xs text-gray-500">
              Add more images
              <input type="file" accept="image/*" multiple data-edit-files
                class="mt-1 block w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg
                       file:border-0 file:text-xs file:font-semibold file:bg-orange-500 file:text-black
                       hover:file:bg-orange-400 cursor-pointer">
            </label>
            <div class="mt-4 flex items-center gap-3">
              <button type="button" data-save
                class="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-black text-sm font-bold transition">
                Save
              </button>
              <button type="button" data-cancel
                class="px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white text-sm transition">
                Cancel
              </button>
              <span data-edit-error class="text-xs text-red-400"></span>
            </div>
          </div>
        </div>`;

      const keptImages = [...(rule.images || [])];
      const newFiles = [];

      const textArea = li.querySelector("[data-edit-text]");
      const errorEl = li.querySelector("[data-edit-error]");

      const refreshStrip = () => {
        const holder = li.querySelector("[data-edit-images]");
        holder.innerHTML = imageStrip(keptImages, { removable: true });

        holder.querySelectorAll("[data-zoom]").forEach((img) => {
          img.addEventListener("click", () => openLightbox(img.dataset.zoom));
        });

        holder.querySelectorAll("[data-remove]").forEach((button) => {
          button.addEventListener("click", () => {
            keptImages.splice(Number(button.dataset.remove), 1);
            refreshStrip();
          });
        });
      };

      refreshStrip();

      li.querySelector("[data-edit-files]").addEventListener("change", (event) => {
        for (const file of Array.from(event.target.files || [])) {
          if (file.size > MAX_IMAGE_BYTES) {
            alert(`"${file.name}" is over 10 MB.`);
            continue;
          }
          if (keptImages.length + newFiles.length >= MAX_IMAGES) {
            alert(`You can attach at most ${MAX_IMAGES} images per rule.`);
            break;
          }
          newFiles.push(file);
        }
        event.target.value = "";
      });

      li.querySelector("[data-cancel]").addEventListener("click", () => {
        editingId = null;
        renderRules();
      });

      li.querySelector("[data-save]").addEventListener("click", async () => {
        const text = textArea.value.trim();
        if (text.length < 2) {
          errorEl.textContent = "A rule can't be empty.";
          return;
        }

        const formData = new FormData();
        formData.append("text", text);
        formData.append("keepImages", JSON.stringify(keptImages));
        newFiles.forEach((file) => formData.append("images", file));

        const saveButton = li.querySelector("[data-save]");
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        const { ok, data } = await api(`/rules/${rule._id}`, {
          method: "PATCH",
          body: formData,
        });

        if (ok && data && data.data) {
          editingId = null;
          await load();
        } else {
          saveButton.disabled = false;
          saveButton.textContent = "Save";
          errorEl.textContent = data?.message || "Could not save the rule.";
        }
      });
    } else {
      // ---- Reading this rule ----
      const imageCount = (rule.images || []).length;

      li.innerHTML = `
        <div class="flex items-start gap-3">
          <span class="shrink-0 mt-0.5 h-7 w-7 rounded-full bg-orange-500/15 border border-orange-500/40
                       text-orange-400 text-sm font-bold flex items-center justify-center">${index + 1}</span>
          <div class="min-w-0 flex-1">
            <p class="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">${esc(rule.text)}</p>
            ${imageStrip(rule.images)}
            ${imageCount > 0 ? `<p class="mt-2 text-[11px] text-gray-600">${imageCount} example image${imageCount === 1 ? "" : "s"} — click to enlarge</p>` : ""}
          </div>
          <div class="shrink-0 flex items-center gap-2">
            <button type="button" data-edit
              class="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-white hover:border-white/25 transition">
              Edit
            </button>
            <button type="button" data-delete
              class="px-3 py-1.5 rounded-lg border border-red-500/30 text-xs text-red-400 hover:bg-red-500/10 transition">
              Delete
            </button>
          </div>
        </div>`;

      li.querySelectorAll("[data-zoom]").forEach((img) => {
        img.addEventListener("click", () => openLightbox(img.dataset.zoom));
      });

      li.querySelector("[data-edit]").addEventListener("click", () => {
        editingId = rule._id;
        renderRules();
      });

      li.querySelector("[data-delete]").addEventListener("click", async () => {
        if (!confirm("Delete this rule?")) return;

        const { ok, data } = await api(`/rules/${rule._id}`, {
          method: "DELETE",
        });

        if (ok) {
          await load();
        } else {
          alert(data?.message || "Could not delete the rule.");
        }
      });
    }

    rulesList.appendChild(li);
  });
}

// ----------------------------------------
// Load
// ----------------------------------------

async function load() {
  loadingState.classList.remove("hidden");
  errorState.classList.add("hidden");

  const { ok, data } = await api("/rules");

  loadingState.classList.add("hidden");

  if (!ok || !data) {
    errorState.classList.remove("hidden");
    return;
  }

  rules = data.data || [];
  editingId = null;
  renderRules();
}

if (retryButton) {
  retryButton.addEventListener("click", () => load().catch(() => {}));
}

// ----------------------------------------
// Add a rule
// ----------------------------------------

if (addForm) {
  addForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = ruleText.value.trim();
    if (text.length < 2) {
      alert("Write your rule before saving.");
      return;
    }

    addButton.disabled = true;
    addButton.textContent = "Saving...";

    try {
      const formData = new FormData();
      formData.append("text", text);
      pendingFiles.forEach((file) => formData.append("images", file));

      const { ok, data } = await api("/rules", {
        method: "POST",
        body: formData,
      });

      if (ok && data && data.data) {
        addForm.reset();
        pendingFiles = [];
        renderPreviews();
        await load();
      } else {
        alert(data?.message || "Could not save the rule. Please try again.");
      }
    } catch (error) {
      alert(error.message || "An error occurred while saving the rule.");
    } finally {
      addButton.disabled = false;
      addButton.textContent = "Save Rule";
    }
  });
}

load().catch(() => {
  loadingState.classList.add("hidden");
  errorState.classList.remove("hidden");
});
