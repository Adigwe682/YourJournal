// API base URL comes from js/api-config.js (loaded before this file)
const API_BASE_URL = window.API_URL;

const tradeForm = document.querySelector("#addTradeForm") || document.querySelector("form");
const submitButton = tradeForm?.querySelector('button[type="submit"]');

if (tradeForm) {
  tradeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const token = localStorage.getItem("token");

    if (!token) {
      window.location.href = "./login.html";
      return;
    }

    // Rules gate: every personal rule must be ticked before a
    // trade can be saved. Inline hint + scroll, no alert spam.
    if (rulesGate && !rulesGate.classList.contains("hidden")) {
      const boxes = rulesGateList.querySelectorAll('input[type="checkbox"]');
      const allChecked =
        boxes.length > 0 && Array.from(boxes).every((box) => box.checked);

      if (!allChecked) {
        rulesGateHint.classList.remove("hidden");
        rulesGate.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    const formData = new FormData(tradeForm);

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Saving...";
    }

    try {
      const response = await fetch(`${API_BASE_URL}/trades`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "./login.html";
        return;
      }

      // Parse defensively: a proxy/502 can return HTML instead of JSON.
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (response.ok && data && data.success) {
        // A trade linked to a challenge jumps straight to the
        // challenge page so the updated balance is visible.
        const linkedChallenge = formData.get("challengeId");
        window.location.href = linkedChallenge
          ? "./challenge.html"
          : "./dashboard.html";
      } else if (data && data.message) {
        alert(data.message);
      } else {
        alert(
          response.status >= 500
            ? "The server ran into a problem. Please try again."
            : `Could not save the trade (error ${response.status}). Please try again.`
        );
      }
    } catch (error) {
      console.error("Error saving trade:", error);
      alert(error.message || "An error occurred while saving the trade.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Save Trade";
      }
    }
  });
}

// ========================================
// IMAGE PREVIEW + PASTE-TO-UPLOAD
// ----------------------------------------
// A screenshot on the clipboard (PrtScn, Win+V,
// or copy image) can be pasted straight into the
// file input, so the existing FormData flow uploads
// it unchanged.
// ========================================

const imageInput = document.querySelector("#image");
const imagePreview = document.querySelector("#imagePreview");
const imagePreviewImg = document.querySelector("#imagePreviewImg");
const imagePreviewName = document.querySelector("#imagePreviewName");
const imagePreviewSize = document.querySelector("#imagePreviewSize");
const imagePreviewRemove = document.querySelector("#imagePreviewRemove");

// Cloudinary rejects anything over 10 MB, so catch it here first
// and tell the user in plain words instead of letting the upload fail.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

let previewObjectUrl = null;

function rejectOversizedImage(file) {
  if (file.size <= MAX_IMAGE_BYTES) {
    return false;
  }

  alert(
    `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. ` +
      "Screenshots must be 10 MB or smaller. Crop or compress it, then try again."
  );
  clearImagePreview();
  return true;
}

function showImagePreview(file) {
  if (!file || !imagePreview) return;

  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
  }

  previewObjectUrl = URL.createObjectURL(file);
  imagePreviewImg.src = previewObjectUrl;
  imagePreviewName.textContent = file.name || "pasted-screenshot.png";
  imagePreviewSize.textContent = `${(file.size / 1024).toFixed(1)} KB · ready to upload`;

  imagePreview.classList.remove("hidden");
  imagePreview.classList.add("flex");
}

function clearImagePreview() {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }

  if (imageInput) {
    imageInput.value = "";
  }

  if (imagePreview) {
    imagePreview.classList.add("hidden");
    imagePreview.classList.remove("flex");
  }
}

if (imageInput) {
  imageInput.addEventListener("change", () => {
    const file = imageInput.files[0];
    if (file && rejectOversizedImage(file)) {
      return;
    }
    if (file) {
      showImagePreview(file);
    } else {
      clearImagePreview();
    }
  });
}

if (imagePreviewRemove) {
  imagePreviewRemove.addEventListener("click", clearImagePreview);
}

// Paste an image anywhere on this page.
// Text pastes are left alone so normal copy/paste still works.
document.addEventListener("paste", (event) => {
  if (!imageInput || !event.clipboardData) return;

  const items = Array.from(event.clipboardData.items || []);
  const imageItem = items.find(
    (item) => item.kind === "file" && item.type.startsWith("image/")
  );

  if (!imageItem) return;

  const file = imageItem.getAsFile();
  if (!file) return;

  event.preventDefault();

  if (rejectOversizedImage(file)) {
    return;
  }

  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    imageInput.files = transfer.files;
  } catch (error) {
    console.error("Could not attach pasted image:", error);
    return;
  }

  showImagePreview(file);
});

// ========================================
// CHALLENGE SELECTOR
// ----------------------------------------
// If the trader has an active challenge, offer it on this form
// and default to it, so each logged P&L is added to / deducted
// from the challenge balance automatically. Hidden entirely when
// there is no active challenge.
// ========================================

const challengeFmt = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

async function loadChallengeSelector() {
  const authToken = localStorage.getItem("token");
  const field = document.querySelector("#challengeField");
  const select = document.querySelector("#challengeId");
  const hint = document.querySelector("#challengeHint");

  if (!authToken || !field || !select) return;

  try {
    const response = await fetch(`${API_BASE_URL}/challenges`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!response.ok) return;

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    const active = (payload?.data || []).find((c) => c.status === "active");
    if (!active) return;

    const option = document.createElement("option");
    option.value = active._id;
    option.textContent =
      `${challengeFmt(active.startAmount)} → ${challengeFmt(active.targetBalance)}` +
      ` (${active.daysLeft} day${active.daysLeft === 1 ? "" : "s"} left)`;
    select.appendChild(option);
    select.value = active._id;

    if (hint) {
      hint.textContent =
        "This trade counts toward your active challenge — its P&L updates the challenge balance.";
    }

    field.classList.remove("hidden");
  } catch {
    // Challenge list unavailable: trade simply won't be linked
  }
}

loadChallengeSelector();

// ========================================
// RULES GATE
// ----------------------------------------
// The trader's personal rules must all be ticked before a
// trade can be saved. If the rules API is unreachable the
// gate stays hidden - a network hiccup should never lock
// someone out of their own journal.
// ========================================

const rulesGate = document.querySelector("#rulesGate");
const rulesGateList = document.querySelector("#rulesGateList");
const rulesProgress = document.querySelector("#rulesProgress");
const rulesGateHint = document.querySelector("#rulesGateHint");
const ruleLightbox = document.querySelector("#ruleLightbox");
const ruleLightboxImg = document.querySelector("#ruleLightboxImg");

let gateRules = [];

const ruleEsc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function updateRulesProgress() {
  if (!rulesGate || rulesGate.classList.contains("hidden")) return;

  const boxes = rulesGateList.querySelectorAll('input[type="checkbox"]');
  const checked = Array.from(boxes).filter((box) => box.checked).length;

  rulesProgress.textContent = `${checked} of ${boxes.length} confirmed`;

  if (checked === boxes.length) {
    rulesGateHint.classList.add("hidden");
  }
}

function renderRulesGate() {
  rulesGateList.innerHTML = "";

  gateRules.forEach((rule, index) => {
    const li = document.createElement("li");
    li.className = "flex items-start gap-3";
    const checkboxId = `ruleCheck${index}`;

    const thumbs = (rule.images || []).length
      ? `<span class="mt-2 flex flex-wrap gap-2">${rule.images
          .map(
            (url) =>
              `<img src="${ruleEsc(url)}" data-zoom="${ruleEsc(url)}" alt="Rule example"
                class="h-14 w-14 rounded-lg object-cover border border-white/10 cursor-zoom-in hover:border-orange-500/60 transition">`
          )
          .join("")}</span>`
      : "";

    li.innerHTML = `
      <input type="checkbox" id="${checkboxId}"
        class="mt-1 h-5 w-5 shrink-0 rounded border-white/30 bg-[#0b0b0b] text-orange-500 focus:ring-orange-500/60 cursor-pointer">
      <label for="${checkboxId}" class="min-w-0 flex-1 cursor-pointer">
        <span class="block text-sm leading-relaxed text-gray-300 whitespace-pre-wrap">${ruleEsc(rule.text)}</span>
        ${thumbs}
      </label>`;

    li.querySelectorAll("[data-zoom]").forEach((img) => {
      img.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        ruleLightboxImg.src = img.dataset.zoom;
        ruleLightbox.classList.remove("hidden");
        ruleLightbox.classList.add("flex");
      });
    });

    rulesGateList.appendChild(li);
  });

  rulesGateList.addEventListener("change", updateRulesProgress);
  updateRulesProgress();
}

async function loadRulesGate() {
  const authToken = localStorage.getItem("token");
  if (!authToken || !rulesGate) return;

  try {
    const response = await fetch(`${API_BASE_URL}/rules`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    if (!response.ok) return;

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    gateRules = payload?.data || [];
    if (gateRules.length === 0) return;

    renderRulesGate();
    rulesGate.classList.remove("hidden");
    // The gate was hidden during render, so the initial
    // "0 of N" progress has to be computed now.
    updateRulesProgress();
  } catch {
    // Leave the gate hidden - never block trading on a network error
  }
}

if (ruleLightbox) {
  const closeRuleLightbox = () => {
    ruleLightbox.classList.add("hidden");
    ruleLightbox.classList.remove("flex");
  };

  ruleLightbox.addEventListener("click", closeRuleLightbox);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeRuleLightbox();
  });
}

loadRulesGate();