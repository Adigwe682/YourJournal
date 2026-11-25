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
        window.location.href = "./dashboard.html";
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