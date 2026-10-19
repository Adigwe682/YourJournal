
const API_URL = "https://yourjournal.onrender.com/api";
const token = localStorage.getItem("token");

let user = null;

try {
  user = JSON.parse(localStorage.getItem("user"));
} catch {
  user = null;
}

const currentPage = window.location.pathname.toLowerCase();

if (
  currentPage.endsWith("/pages/dashboard.html") &&
  !token
) {
  window.location.href = "../login.html";
}

const userName = document.querySelector("#userName");
const userAvatar = document.querySelector("#userAvatar");

if (user) {
  const displayName = user.name || "Trader";

  if (userName) userName.textContent = displayName;
  if (userAvatar) userAvatar.textContent = displayName.charAt(0).toUpperCase();
}
// ========================================
// AUTHENTICATION
// ========================================

function handleUnauthorized() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "./login.html";
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    handleUnauthorized();
    throw new Error("Your session has expired. Please log in again.");
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function getSelectedMonth() {
  return document.querySelector("#month")?.value || "";
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `${amount >= 0 ? "+" : "-"}$${Math.abs(amount).toFixed(2)}`;
}

function formatDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateForInput(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// ========================================
// LOAD TRADES AND STATISTICS
// ========================================

async function loadTrades(month) {
  const tradeList = document.querySelector("#tradeList");

  if (!tradeList || !month) return;

  tradeList.innerHTML = `
    <p class="col-span-full py-6 text-sm text-gray-500">
      Loading trades...
    </p>
  `;

  try {
    const data = await apiRequest(
      `${API_URL}/trades?month=${encodeURIComponent(month)}`
    );

    if (!Array.isArray(data.data)) {
      throw new Error("Invalid trade data received.");
    }

    const trades = data.data;
    const totalTrades = trades.length;

    const wins = trades.filter((trade) => trade.result === "profit");
    const losses = trades.filter((trade) => trade.result === "loss");

    const winRate = totalTrades
      ? ((wins.length / totalTrades) * 100).toFixed(1)
      : "0.0";

    const monthlyPnl = trades.reduce(
      (total, trade) => total + Number(trade.pnl || 0),
      0
    );

    document.querySelector("#totalTrades").textContent = totalTrades;
    document.querySelector("#totalWins").textContent = wins.length;
    document.querySelector("#totalLosses").textContent = losses.length;
    document.querySelector("#winRate").textContent = `${winRate}%`;

    const pnlElement = document.querySelector("#monthlyPnl");

    pnlElement.textContent = formatMoney(monthlyPnl);
    pnlElement.classList.toggle("text-green-400", monthlyPnl >= 0);
    pnlElement.classList.toggle("text-red-400", monthlyPnl < 0);

    const selectedDate = new Date(`${month}-01T12:00:00`);

    document.querySelector("#pnlMonth").textContent =
      selectedDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

    document.querySelector("#historyMonth").textContent =
      selectedDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

    tradeList.innerHTML = "";

    if (trades.length === 0) {
      tradeList.innerHTML = `
        <p class="col-span-full py-8 text-center text-sm text-gray-500">
          No trades recorded for this month.
          <br />
          Add a trade to start tracking your performance.
        </p>
      `;
      return;
    }

    trades.forEach((trade) => {
      const pnl = Number(trade.pnl || 0);
      const isProfit = pnl >= 0;
      const tradeCard = document.createElement("article");

      tradeCard.className = `
        rounded-2xl border p-4 transition duration-200
        hover:-translate-y-0.5 hover:border-white/20
        ${isProfit
          ? "bg-green-500/5 border-green-500/20"
          : "bg-red-500/5 border-red-500/20"}
      `;

      tradeCard.innerHTML = `
        <div
          class="rounded-2xl px-4 py-3 border ${isProfit
          ? "bg-green-500/10 border-green-500/20"
          : "bg-red-500/10 border-red-500/20"
        }"
        >
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-bold text-white truncate">
              ${escapeHTML(trade.pair)}
            </h3>

            <div class="flex shrink-0 items-center gap-2">
              <button
                type="button"
                data-action="edit"
                data-id="${escapeHTML(trade._id)}"
                class="rounded-lg border border-white/10 px-2.5 py-1.5
                  text-xs font-medium text-gray-200 hover:bg-white/10"
              >
                Edit
              </button>

              <button
                type="button"
                data-action="delete"
                data-id="${escapeHTML(trade._id)}"
                class="rounded-lg border border-red-500/20 px-2.5 py-1.5
                  text-xs font-medium text-red-400 hover:bg-red-500/10"
              >
                Delete
              </button>
            </div>
          </div>

          <div class="mt-3 text-center">
            <p class="text-xl font-bold ${isProfit ? "text-green-400" : "text-red-400"
        }">
              ${isProfit ? "+" : ""}$${pnl.toFixed(2)}
            </p>

            <span
              class="mt-2 inline-flex rounded-full px-2.5 py-1
                text-[10px] font-semibold ${isProfit
          ? "bg-green-500/10 text-green-400"
          : "bg-red-500/10 text-red-400"
        }"
            >
              ${isProfit ? "PROFIT" : "LOSS"}
            </span>

            <p class="mt-2 text-[11px] text-gray-400">
              ${escapeHTML(formatDate(trade.date))}
            </p>
          </div>
        </div>
      `;

      tradeList.appendChild(tradeCard);
    });
  } catch (error) {
    console.error("Error loading trades:", error.message);

    tradeList.innerHTML = `
      <p class="col-span-full py-6 text-sm text-red-400">
        Could not load trades. Check your connection and try again.
      </p>
    `;
  }
}

// ========================================
// BEST-PERFORMING PAIRS
// ========================================

async function loadBestPairs(month) {
  const bestPairsList = document.querySelector("#bestPairsList");
  const bestPairsMonth = document.querySelector("#bestPairsMonth");

  if (!bestPairsList || !bestPairsMonth || !month) return;

  bestPairsList.innerHTML = `
    <p class="col-span-full text-sm text-gray-500">
      Loading best-performing pairs...
    </p>
  `;

  try {
    const data = await apiRequest(
      `${API_URL}/trades/best-pairs?month=${encodeURIComponent(month)}`
    );

    if (!Array.isArray(data.data)) {
      throw new Error("Invalid best-pairs data received.");
    }

    const selectedDate = new Date(`${month}-01T12:00:00`);

    bestPairsMonth.textContent = selectedDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    bestPairsList.innerHTML = "";

    if (data.data.length === 0) {
      bestPairsList.innerHTML = `
        <p class="col-span-full text-sm text-gray-500">
          No winning pairs recorded for this month.
        </p>
      `;
      return;
    }

    data.data.forEach((pair, index) => {
      const pairCard = document.createElement("div");

      pairCard.className =
        "rounded-xl border border-white/10 bg-[#0b0b0b] p-4";

      pairCard.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs text-gray-500">#${index + 1}</span>

          <span class="text-xs font-medium text-green-400">
            ${Number(pair.wins)}
            ${Number(pair.wins) === 1 ? "Win" : "Wins"}
          </span>
        </div>

        <h3 class="mt-3 text-lg font-bold text-white">
          ${escapeHTML(pair._id)}
        </h3>
      `;

      bestPairsList.appendChild(pairCard);
    });
  } catch (error) {
    console.error("Error loading best pairs:", error.message);

    bestPairsList.innerHTML = `
      <p class="col-span-full text-sm text-red-400">
        Could not load best-performing pairs.
      </p>
    `;
  }
}

// ========================================
// EDIT TRADE MODAL
// ========================================

let previousBodyOverflow = "";

function closeEditModal() {
  const modal = document.querySelector("#editTradeModal");

  if (!modal) return;

  modal.style.display = "none";
  document.body.style.overflow = previousBodyOverflow;
}

function createEditModal() {
  if (document.querySelector("#editTradeModal")) return;

  const modal = document.createElement("div");

  modal.id = "editTradeModal";

  // Fixed positioning keeps the form over the dashboard.
  // Inline styles ensure the overlay works independently of Tailwind.
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: none;
    align-items: center;
    justify-content: center;
    overflow-y: auto;
    box-sizing: border-box;
    padding: 16px;
    background: rgba(0, 0, 0, 0.82);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  `;

  modal.innerHTML = `
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="editTradeTitle"
      style="
        width: 100%;
        max-width: 440px;
        max-height: calc(100% - 8px);
        overflow-y: auto;
        box-sizing: border-box;
        padding: 24px;
        border: 1px solid #292929;
        border-radius: 20px;
        background: #101010;
        color: #ffffff;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5);
      "
    >
      <div
        style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 22px;
        "
      >
        <div>
          <p
            style="
              color: #f97316;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 2px;
              margin: 0 0 6px;
            "
          >
            MAZII TRADE
          </p>

          <h2
            id="editTradeTitle"
            style="font-size: 21px; font-weight: 700; margin: 0;"
          >
            Edit Trade
          </h2>

          <p style="margin: 6px 0 0; font-size: 13px; color: #9ca3af;">
            Update your trade details.
          </p>
        </div>

        <button
          type="button"
          id="closeEditModal"
          aria-label="Close edit form"
          style="
            width: 38px;
            height: 38px;
            flex-shrink: 0;
            border: 1px solid #303030;
            border-radius: 10px;
            background: #191919;
            color: #d1d5db;
            font-size: 19px;
            cursor: pointer;
          "
        >
          &times;
        </button>
      </div>

      <form id="editTradeForm">
        <div
          style="
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 16px;
          "
        >
          <div style="min-width: 0; grid-column: 1 / -1;">
            <label
              for="editPair"
              style="display: block; margin-bottom: 7px; font-size: 13px; color: #d1d5db;"
            >
              Trading pair
            </label>

            <input
              id="editPair"
              name="pair"
              type="text"
              maxlength="30"
              required
              style="
                display: block;
                width: 100%;
                min-width: 0;
                box-sizing: border-box;
                border: 1px solid #303030;
                border-radius: 11px;
                background: #080808;
                color: #ffffff;
                padding: 12px;
                font-size: 16px;
                outline-color: #f97316;
              "
            />
          </div>

          <div style="min-width: 0; grid-column: 1 / -1;">
            <label
              for="editDate"
              style="display: block; margin-bottom: 7px; font-size: 13px; color: #d1d5db;"
            >
              Trade date
            </label>

            <input
              id="editDate"
              name="date"
              type="date"
              required
              style="
                display: block;
                width: 100%;
                min-width: 0;
                box-sizing: border-box;
                border: 1px solid #303030;
                border-radius: 11px;
                background: #080808;
                color: #ffffff;
                padding: 12px;
                font-size: 16px;
                outline-color: #f97316;
              "
            />
          </div>

          <div style="min-width: 0;">
            <label
              for="editRR"
              style="display: block; margin-bottom: 7px; font-size: 13px; color: #d1d5db;"
            >
              Risk-to-reward
            </label>

            <input
              id="editRR"
              name="RR"
              type="number"
              step="any"
              required
              style="
                display: block;
                width: 100%;
                min-width: 0;
                box-sizing: border-box;
                border: 1px solid #303030;
                border-radius: 11px;
                background: #080808;
                color: #ffffff;
                padding: 12px;
                font-size: 16px;
                outline-color: #f97316;
              "
            />
          </div>

          <div style="min-width: 0;">
            <label
              for="editPnl"
              style="display: block; margin-bottom: 7px; font-size: 13px; color: #d1d5db;"
            >
              P&L ($)
            </label>

            <input
              id="editPnl"
              name="pnl"
              type="number"
              step="any"
              required
              style="
                display: block;
                width: 100%;
                min-width: 0;
                box-sizing: border-box;
                border: 1px solid #303030;
                border-radius: 11px;
                background: #080808;
                color: #ffffff;
                padding: 12px;
                font-size: 16px;
                outline-color: #f97316;
              "
            />
          </div>

          <div style="min-width: 0; grid-column: 1 / -1;">
            <label
              for="editResult"
              style="display: block; margin-bottom: 7px; font-size: 13px; color: #d1d5db;"
            >
              Trade result
            </label>

            <select
              id="editResult"
              name="result"
              required
              style="
                display: block;
                width: 100%;
                min-width: 0;
                box-sizing: border-box;
                border: 1px solid #303030;
                border-radius: 11px;
                background: #080808;
                color: #ffffff;
                padding: 12px;
                font-size: 16px;
                outline-color: #f97316;
              "
            >
              <option value="profit">Profit</option>
              <option value="loss">Loss</option>
              <option value="breakeven">Break-even</option>
            </select>
          </div>
        </div>

        <p
          id="editTradeError"
          role="alert"
          style="display: none; margin: 14px 0 0; color: #f87171; font-size: 13px;"
        ></p>

        <div
          style="
            display: flex;
            gap: 12px;
            margin-top: 24px;
            padding-top: 18px;
            border-top: 1px solid #292929;
          "
        >
          <button
            type="button"
            id="cancelEditTrade"
            style="
              flex: 1;
              min-width: 0;
              padding: 12px 8px;
              border: 1px solid #333333;
              border-radius: 11px;
              background: #191919;
              color: #e5e7eb;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
            "
          >
            Cancel
          </button>

          <button
            type="submit"
            id="saveEditTrade"
            style="
              flex: 1;
              min-width: 0;
              padding: 12px 8px;
              border: 1px solid #f97316;
              border-radius: 11px;
              background: #f97316;
              color: #ffffff;
              font-size: 13px;
              font-weight: 700;
              cursor: pointer;
            "
          >
            Save Changes
          </button>
        </div>
      </form>
    </section>
  `;

  document.body.appendChild(modal);

  document
    .querySelector("#closeEditModal")
    .addEventListener("click", closeEditModal);

  document
    .querySelector("#cancelEditTrade")
    .addEventListener("click", closeEditModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      closeEditModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.style.display !== "none") {
      closeEditModal();
    }
  });

  document
    .querySelector("#editTradeForm")
    .addEventListener("submit", saveTradeChanges);
}

function openEditModal(trade) {
  createEditModal();

  const modal = document.querySelector("#editTradeModal");
  const form = document.querySelector("#editTradeForm");
  const resultSelect = document.querySelector("#editResult");

  form.dataset.tradeId = trade._id;

  document.querySelector("#editPair").value = trade.pair || "";
  document.querySelector("#editDate").value = formatDateForInput(trade.date);
  document.querySelector("#editRR").value = trade.RR ?? "";
  document.querySelector("#editPnl").value = trade.pnl ?? "";

  const currentResult = trade.result || "profit";

  // Preserve the existing database result value if it differs.
  if (
    !Array.from(resultSelect.options).some(
      (option) => option.value === currentResult
    )
  ) {
    const option = document.createElement("option");
    option.value = currentResult;
    option.textContent = currentResult;
    resultSelect.appendChild(option);
  }

  resultSelect.value = currentResult;

  const errorElement = document.querySelector("#editTradeError");
  errorElement.textContent = "";
  errorElement.style.display = "none";

  // Prevent the dashboard behind the modal from scrolling.
  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  // Display as a fixed overlay, not as content at the bottom.
  modal.style.display = "flex";

  document.querySelector("#editPair").focus();
}

// ========================================
// SAVE EDITED TRADE
// ========================================

async function saveTradeChanges(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const tradeId = form.dataset.tradeId;
  const saveButton = document.querySelector("#saveEditTrade");
  const errorElement = document.querySelector("#editTradeError");

  const pair = document.querySelector("#editPair").value.trim();
  const date = document.querySelector("#editDate").value;
  const RR = document.querySelector("#editRR").value;
  const pnl = document.querySelector("#editPnl").value;
  const result = document.querySelector("#editResult").value;

  if (!pair || !date || RR === "" || pnl === "" || !result) {
    errorElement.textContent = "Please complete all fields.";
    errorElement.style.display = "block";
    return;
  }

  const numericRR = Number(RR);
  const numericPnl = Number(pnl);

  if (!Number.isFinite(numericRR) || !Number.isFinite(numericPnl)) {
    errorElement.textContent =
      "Enter valid numeric values for RR and P&L.";
    errorElement.style.display = "block";
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";
  saveButton.style.opacity = "0.65";

  try {
    await apiRequest(
      `${API_URL}/trades/${encodeURIComponent(tradeId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          pair,
          date,
          RR: numericRR,
          pnl: numericPnl,
          result,
        }),
      }
    );

    closeEditModal();
    await refreshDashboard();
  } catch (error) {
    errorElement.textContent =
      error.message || "Could not update trade.";
    errorElement.style.display = "block";
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Save Changes";
    saveButton.style.opacity = "1";
  }
}

// ========================================
// DELETE TRADE
// ========================================

async function deleteTrade(tradeId) {
  const confirmed = window.confirm(
    "Are you sure you want to delete this trade? This action cannot be undone."
  );

  if (!confirmed) return;

  try {
    await apiRequest(
      `${API_URL}/trades/${encodeURIComponent(tradeId)}`,
      {
        method: "DELETE",
      }
    );

    await refreshDashboard();
  } catch (error) {
    window.alert(error.message || "Could not delete trade.");
  }
}

// ========================================
// TRADE CARD BUTTONS
// ========================================

const tradeListElement = document.querySelector("#tradeList");

if (tradeListElement) {
  tradeListElement.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button || button.disabled) return;

    const tradeId = button.dataset.id;
    const action = button.dataset.action;

    if (!tradeId) return;

    if (action === "edit") {
      button.disabled = true;

      try {
        const data = await apiRequest(
          `${API_URL}/trades/${encodeURIComponent(tradeId)}`
        );

        openEditModal(data.data);
      } catch (error) {
        window.alert(error.message || "Could not open this trade.");
      } finally {
        button.disabled = false;
      }
    }

    if (action === "delete") {
      button.disabled = true;

      try {
        await deleteTrade(tradeId);
      } finally {
        button.disabled = false;
      }
    }
  });
}

// ========================================
// REFRESH DASHBOARD
// ========================================

async function refreshDashboard() {
  const month = getSelectedMonth();

  if (!month) return;

  await Promise.all([
    loadTrades(month),
    loadBestPairs(month),
  ]);
}

// ========================================
// MONTH FILTER
// ========================================

const monthInput = document.querySelector("#month");

if (monthInput) {
  refreshDashboard();
  monthInput.addEventListener("change", refreshDashboard);
}

// ========================================
// LOGOUT
// ========================================

const logoutButton = document.querySelector("#logoutButton");

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "./login.html";
  });
}