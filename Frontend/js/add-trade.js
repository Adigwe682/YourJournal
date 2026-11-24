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

      const data = await response.json();

      if (response.ok && data.success) {
        window.location.href = "./dashboard.html";
      } else {
        alert(data.message || "Failed to save trade.");
      }
    } catch (error) {
      console.error("Error saving trade:", error);
      alert("An error occurred while saving the trade.");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Save Trade";
      }
    }
  });
}