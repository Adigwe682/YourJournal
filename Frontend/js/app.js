// API base URL comes from js/api-config.js (loaded before this file)
const API_URL = window.API_URL;

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
  window.location.href = "./login.html";
}

const userName = document.querySelector("#userName");
const userAvatar = document.querySelector("#userAvatar");

if (user) {
  const displayName = user.name || "Trader";

  if (userName) userName.textContent = displayName;
  if (userAvatar) userAvatar.textContent = displayName.charAt(0).toUpperCase();
}

// State for currently loaded month trades & active calendar day filter
let currentMonthTrades = [];
let selectedCalendarDate = null;
// Quick lookup of trades rendered in the history list (used by the lightbox)
let tradeCardsById = {};

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
      // Only force JSON content-type for string bodies; let FormData
      // (file uploads) set its own multipart boundary.
      ...(typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
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
// EQUITY CURVE CHART (CHART.JS)
// ========================================

let equityChartInstance = null;

function renderEquityCurve(trades) {
  const canvas = document.getElementById("equityCurveChart");
  if (!canvas) return;

  const sortedTrades = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

  let cumulativePnl = 0;
  const labels = ["Start"];
  const dataPoints = [0];

  sortedTrades.forEach((trade, index) => {
    cumulativePnl += Number(trade.pnl || 0);
    const label = trade.date ? new Date(trade.date).toLocaleDateString("en-GB", { month: "short", day: "numeric" }) : `Trade ${index + 1}`;
    labels.push(label);
    dataPoints.push(cumulativePnl);
  });

  if (equityChartInstance) {
    equityChartInstance.destroy();
  }

  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, "rgba(249, 115, 22, 0.3)");
  gradient.addColorStop(1, "rgba(249, 115, 22, 0.0)");

  equityChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Cumulative P&L ($)",
        data: dataPoints,
        borderColor: "#f97316",
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.2,
        pointRadius: 3,
        pointBackgroundColor: "#f97316"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#191919",
          titleColor: "#ffffff",
          bodyColor: "#f97316",
          borderColor: "#333333",
          borderWidth: 1,
          callbacks: {
            label: function (context) {
              let val = context.raw || 0;
              return ` Equity: ${val >= 0 ? "+" : ""}$${val.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.04)" },
          ticks: { color: "#6b7280", font: { size: 10 } }
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.04)" },
          ticks: {
            color: "#6b7280",
            font: { size: 10 },
            callback: function (value) {
              return `$${value}`;
            }
          }
        }
      }
    }
  });
}

// ========================================
// SESSION & PSYCHOLOGY ANALYTICS
// ========================================

function renderSessionAndPsychologyStats(trades) {
  const container = document.getElementById("sessionStatsList");
  if (!container) return;

  const sessionMap = {};
  let followedPnl = 0;
  let followedCount = 0;
  let ruleBreakPnl = 0;
  let ruleBreakCount = 0;

  trades.forEach((trade) => {
    const pnl = Number(trade.pnl || 0);

    if (trade.session) {
      if (!sessionMap[trade.session]) {
        sessionMap[trade.session] = { pnl: 0, count: 0 };
      }
      sessionMap[trade.session].pnl += pnl;
      sessionMap[trade.session].count += 1;
    }

    const psych = trade.psychology || "Followed Plan";
    if (psych === "Followed Plan") {
      followedPnl += pnl;
      followedCount += 1;
    } else {
      ruleBreakPnl += pnl;
      ruleBreakCount += 1;
    }
  });

  let html = "";

  // Render Session Cards
  const sessions = Object.entries(sessionMap);
  sessions.forEach(([sessionName, stat]) => {
    const isPos = stat.pnl >= 0;
    html += `
      <div class="rounded-xl border border-white/10 bg-[#0b0b0b] p-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-gray-400">${escapeHTML(sessionName)} Session</span>
          <span class="text-[11px] text-gray-500">${stat.count}t</span>
        </div>
        <p class="mt-2 text-lg font-bold ${isPos ? "text-green-400" : "text-red-400"}">
          ${formatMoney(stat.pnl)}
        </p>
      </div>
    `;
  });

  // Render Discipline vs Rule-Break Card
  html += `
    <div class="rounded-xl border border-white/10 bg-[#0b0b0b] p-4">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-green-400">Followed Plan</span>
        <span class="text-[11px] text-gray-500">${followedCount}t</span>
      </div>
      <p class="mt-2 text-lg font-bold ${followedPnl >= 0 ? "text-green-400" : "text-red-400"}">
        ${formatMoney(followedPnl)}
      </p>
    </div>

    <div class="rounded-xl border border-white/10 bg-[#0b0b0b] p-4">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-amber-400">Rule Breaks</span>
        <span class="text-[11px] text-gray-500">${ruleBreakCount}t</span>
      </div>
      <p class="mt-2 text-lg font-bold ${ruleBreakPnl >= 0 ? "text-green-400" : "text-red-400"}">
        ${formatMoney(ruleBreakPnl)}
      </p>
    </div>
  `;

  container.innerHTML = html;
}

// ========================================
// SETUP PERFORMANCE BREAKDOWN
// ========================================

function renderSetupStats(trades) {
  const container = document.getElementById("setupStatsList");
  if (!container) return;

  const setupMap = {};

  trades.forEach((trade) => {
    const tag = trade.setupTag;
    if (!tag) return;

    if (!setupMap[tag]) {
      setupMap[tag] = { pnl: 0, count: 0, wins: 0 };
    }

    const pnl = Number(trade.pnl || 0);
    setupMap[tag].pnl += pnl;
    setupMap[tag].count += 1;

    if (trade.result === "profit") setupMap[tag].wins += 1;
  });

  const setups = Object.entries(setupMap).sort(
    (a, b) => b[1].pnl - a[1].pnl
  );

  if (setups.length === 0) {
    container.innerHTML = `
      <p class="text-sm text-gray-500 col-span-full">
        No setup tags recorded for this month. Tag trades when you add them to see which setups pay.
      </p>
    `;
    return;
  }

  let html = "";

  setups.forEach(([setupName, stat]) => {
    const isPos = stat.pnl >= 0;
    const winRate = stat.count > 0 ? ((stat.wins / stat.count) * 100).toFixed(0) : "0";

    html += `
      <div class="rounded-xl border border-white/10 bg-[#0b0b0b] p-4">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold text-orange-400 truncate">${escapeHTML(setupName)}</span>
          <span class="text-[11px] text-gray-500 shrink-0">${stat.count}t</span>
        </div>
        <p class="mt-2 text-lg font-bold ${isPos ? "text-green-400" : "text-red-400"}">
          ${formatMoney(stat.pnl)}
        </p>
        <p class="mt-1 text-[11px] text-gray-500">
          ${stat.wins}/${stat.count} wins &middot; ${winRate}% win rate
        </p>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ========================================
// MONTHLY P&L CALENDAR VIEW (WITH CLICK FILTER)
// ========================================

function renderPnlCalendar(trades, selectedMonth) {
  const calendarGrid = document.getElementById("pnlCalendarGrid");
  const calendarMonthEl = document.getElementById("calendarMonth");
  if (!calendarGrid || !selectedMonth) return;

  const [year, month] = selectedMonth.split("-").map(Number);

  const selectedDateObj = new Date(year, month - 1, 1);
  if (calendarMonthEl) {
    calendarMonthEl.textContent = selectedDateObj.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  const dailyStats = {};
  trades.forEach((trade) => {
    if (!trade.date) return;
    const dayStr = trade.date.split("T")[0];
    if (!dailyStats[dayStr]) {
      dailyStats[dayStr] = { pnl: 0, count: 0 };
    }
    dailyStats[dayStr].pnl += Number(trade.pnl || 0);
    dailyStats[dayStr].count += 1;
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const startDayOfWeek = new Date(year, month - 1, 1).getDay();

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let html = "";

  dayNames.forEach((name) => {
    html += `<div style="text-align: center; font-size: 11px; font-weight: 600; color: #6b7280; padding: 4px 0;">${name}</div>`;
  });

  for (let i = 0; i < startDayOfWeek; i++) {
    html += `<div style="height: 80px; background: rgba(8, 8, 8, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; opacity: 0.3;"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayFormatted = String(day).padStart(2, "0");
    const monthFormatted = String(month).padStart(2, "0");
    const dateKey = `${year}-${monthFormatted}-${dayFormatted}`;

    const stat = dailyStats[dateKey];
    const hasTrades = stat && stat.count > 0;
    const isProfit = hasTrades && stat.pnl >= 0;
    const isSelected = selectedCalendarDate === dateKey;

    let bgStyle = "background: #0b0b0b; border-color: rgba(255, 255, 255, 0.05); color: #4b5563;";
    let pnlText = "";

    if (hasTrades) {
      if (isProfit) {
        bgStyle = "background: rgba(34, 197, 94, 0.1); border-color: rgba(34, 197, 94, 0.3); color: #4ade80;";
        pnlText = `+$${stat.pnl.toFixed(0)}`;
      } else {
        bgStyle = "background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: #f87171;";
        pnlText = `-$${Math.abs(stat.pnl).toFixed(0)}`;
      }
    }

    if (isSelected) {
      bgStyle += " outline: 2px solid #f97316; outline-offset: -2px;";
    }

    html += `
      <div
        data-calendar-date="${dateKey}"
        style="height: 80px; border: 1px solid; border-radius: 12px; padding: 8px; display: flex; flex-direction: column; justify-content: space-between; cursor: ${hasTrades ? "pointer" : "default"}; transition: transform 0.15s; ${bgStyle}"
        title="${hasTrades ? "Click to filter trades for " + dateKey : ""}"
      >
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 12px; font-weight: 600; color: ${hasTrades ? "#ffffff" : "#6b7280"};">${day}</span>
          ${hasTrades ? `<span style="font-size: 10px; padding: 1px 4px; border-radius: 4px; background: rgba(255,255,255,0.05); color: #9ca3af;">${stat.count}t</span>` : ""}
        </div>
        <div style="text-align: right;">
          ${hasTrades ? `<span style="font-size: 11px; font-weight: bold; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pnlText}</span>` : `<span style="font-size: 10px; color: #374151; display: block;">-</span>`}
        </div>
      </div>
    `;
  }

  calendarGrid.innerHTML = html;
}

// ========================================
// RENDER TRADE CARDS LIST
// ========================================

function renderTradeCards(tradesToDisplay) {
  const tradeList = document.querySelector("#tradeList");
  const clearBtn = document.querySelector("#clearDateFilterBtn");
  const subtitle = document.querySelector("#historySubtitle");

  if (!tradeList) return;

  if (selectedCalendarDate) {
    if (clearBtn) clearBtn.classList.remove("hidden");
    if (subtitle) subtitle.textContent = `Showing trades for ${formatDate(selectedCalendarDate)}`;
  } else {
    if (clearBtn) clearBtn.classList.add("hidden");
    if (subtitle) subtitle.textContent = "Your trades for the selected month.";
  }

  tradeList.innerHTML = "";
  tradeCardsById = {};

  if (tradesToDisplay.length === 0) {
    tradeList.innerHTML = `
      <p class="col-span-full py-8 text-center text-sm text-gray-500">
        ${selectedCalendarDate ? "No trades found for this specific day." : "No trades recorded for this month.<br />Add a trade to start tracking your performance."}
      </p>
    `;
    return;
  }

  tradesToDisplay.forEach((trade) => {
    tradeCardsById[trade._id] = trade;
    const pnl = Number(trade.pnl || 0);
    const isProfit = pnl >= 0;
    const tradeCard = document.createElement("article");

    const isRuleBreak = trade.psychology && trade.psychology !== "Followed Plan";

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

        <!-- Quick Tags Row (Session, Setup, Psychology) -->
        <div class="flex flex-wrap gap-1.5 mt-2.5">
          ${trade.session ? `<span class="px-2 py-0.5 text-[10px] font-medium rounded-md bg-white/10 text-gray-300">${escapeHTML(trade.session)}</span>` : ""}
          ${trade.setupTag ? `<span class="px-2 py-0.5 text-[10px] font-medium rounded-md bg-orange-500/15 text-orange-400 border border-orange-500/20">${escapeHTML(trade.setupTag)}</span>` : ""}
          ${trade.psychology ? `
            <span class="px-2 py-0.5 text-[10px] font-medium rounded-md ${isRuleBreak ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-emerald-500/10 text-emerald-400"}">
              ${escapeHTML(trade.psychology)}
            </span>
          ` : ""}
        </div>

        <div class="mt-3 text-center">
          <p class="text-xl font-bold ${isProfit ? "text-green-400" : "text-red-400"}">
            ${isProfit ? "+" : ""}$${pnl.toFixed(2)}
          </p>

          <div class="mt-2 flex items-center justify-center gap-2">
            <span
              class="inline-flex rounded-full px-2.5 py-1
                text-[10px] font-semibold ${isProfit
        ? "bg-green-500/10 text-green-400"
        : "bg-red-500/10 text-red-400"
      }"
            >
              ${isProfit ? "PROFIT" : "LOSS"}
            </span>

            ${trade.rr ? `<span class="text-[11px] font-semibold text-gray-400">${escapeHTML(trade.rr)}R</span>` : ""}
          </div>

          <p class="mt-2 text-[11px] text-gray-400">
            ${escapeHTML(formatDate(trade.date))}
          </p>
        </div>

        ${trade.criteria ? `
          <div class="mt-3 pt-3 border-t border-white/5">
            <p class="text-xs text-gray-300"><strong>Criteria:</strong> ${escapeHTML(trade.criteria)}</p>
          </div>
        ` : ""}

        ${trade.image ? `
          <button
            type="button"
            data-action="view"
            data-id="${escapeHTML(trade._id)}"
            class="mt-3 w-full group text-left"
          >
            <img
              src="${escapeHTML(trade.image)}"
              alt="Chart screenshot for ${escapeHTML(trade.pair)}"
              loading="lazy"
              class="w-full h-28 object-cover rounded-lg border border-white/10 group-hover:border-orange-500/50 transition"
            />
            <span class="mt-1.5 flex items-center gap-1 text-xs text-orange-400 group-hover:underline">
              View screenshot &amp; notes &#8599;
            </span>
          </button>
        ` : ""}
      </div>
    `;

    tradeList.appendChild(tradeCard);
  });
}

// ========================================
// LOAD TRADES AND STATISTICS
// ========================================

async function loadTrades(month) {
  const tradeList = document.querySelector("#tradeList");

  if (!tradeList || !month) return;

  selectedCalendarDate = null;

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
    currentMonthTrades = trades;
    const totalTrades = trades.length;

    const wins = trades.filter((trade) => trade.result === "profit");
    const losses = trades.filter((trade) => trade.result === "loss");

    const winRate = totalTrades
      ? ((wins.length / totalTrades) * 100).toFixed(1)
      : "0.0";

    const monthlyPnl = trades.reduce(
      (total, trade) => total + (Number(trade.pnl) || 0),
      0
    );

    let grossProfit = 0;
    let grossLoss = 0;
    let totalRR = 0;
    let rrCount = 0;

    trades.forEach((trade) => {
      // Number(x) || 0 keeps a malformed value from turning the total into NaN
      const pnl = Number(trade.pnl) || 0;
      if (pnl > 0) {
        grossProfit += pnl;
      } else if (pnl < 0) {
        grossLoss += Math.abs(pnl);
      }

      const tradeRR = trade.rr ?? trade.RR;
      if (tradeRR !== undefined && tradeRR !== null && tradeRR !== "") {
        const numericRR = Number(tradeRR);
        if (Number.isFinite(numericRR)) {
          totalRR += numericRR;
          rrCount++;
        }
      }
    });

    let profitFactor = "0.00";
    if (grossLoss > 0) {
      profitFactor = (grossProfit / grossLoss).toFixed(2);
    } else if (grossProfit > 0) {
      profitFactor = "Inf";
    }

    const avgRr = rrCount > 0 ? (totalRR / rrCount).toFixed(2) : "0.00";

    document.querySelector("#totalTrades").textContent = totalTrades;
    document.querySelector("#totalWins").textContent = wins.length;
    document.querySelector("#totalLosses").textContent = losses.length;
    document.querySelector("#winRate").textContent = `${winRate}%`;
    document.querySelector("#profitFactor").textContent = profitFactor;
    document.querySelector("#avgRr").textContent = `${avgRr}R`;

    const pnlElement = document.querySelector("#monthlyPnl");

    pnlElement.textContent = formatMoney(monthlyPnl);
    pnlElement.classList.toggle("text-green-400", monthlyPnl >= 0);
    pnlElement.classList.toggle("text-red-400", monthlyPnl < 0);

    // Render Equity Curve, Calendar, and Session/Psychology Breakdown
    renderEquityCurve(trades);
    renderPnlCalendar(trades, month);
    renderSessionAndPsychologyStats(trades);
    renderSetupStats(trades);

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

    renderTradeCards(trades);
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
// CALENDAR DAY CLICK LISTENER
// ========================================

const calendarGridEl = document.getElementById("pnlCalendarGrid");
if (calendarGridEl) {
  calendarGridEl.addEventListener("click", (event) => {
    const dayCell = event.target.closest("[data-calendar-date]");
    if (!dayCell) return;

    const clickedDate = dayCell.dataset.calendarDate;
    const dayTrades = currentMonthTrades.filter(
      (t) => t.date && t.date.split("T")[0] === clickedDate
    );

    if (dayTrades.length === 0) return;

    // Toggle selection off if clicking the same active date
    if (selectedCalendarDate === clickedDate) {
      selectedCalendarDate = null;
      renderPnlCalendar(currentMonthTrades, getSelectedMonth());
      renderTradeCards(currentMonthTrades);
    } else {
      selectedCalendarDate = clickedDate;
      renderPnlCalendar(currentMonthTrades, getSelectedMonth());
      renderTradeCards(dayTrades);
      document.querySelector("#tradeList")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
}

const clearDateFilterBtn = document.getElementById("clearDateFilterBtn");
if (clearDateFilterBtn) {
  clearDateFilterBtn.addEventListener("click", () => {
    selectedCalendarDate = null;
    renderPnlCalendar(currentMonthTrades, getSelectedMonth());
    renderTradeCards(currentMonthTrades);
  });
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
// EDIT TRADE MODAL (WITH SESSION, SETUP & PSYCHOLOGY)
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
        max-width: 460px;
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
          margin-bottom: 20px;
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
            YourJournal
          </p>

          <h2
            id="editTradeTitle"
            style="font-size: 21px; font-weight: 700; margin: 0;"
          >
            Edit Trade
          </h2>
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
            gap: 14px;
          "
        >
          <div style="min-width: 0;">
            <label for="editPair" style="display: block; margin-bottom: 6px; font-size: 12px; color: #d1d5db;">
              Trading pair
            </label>
            <input id="editPair" name="pair" type="text" maxlength="30" required
              style="display: block; width: 100%; box-sizing: border-box; border: 1px solid #303030; border-radius: 11px; background: #080808; color: #ffffff; padding: 10px 12px; font-size: 14px; outline-color: #f97316;" />
          </div>

          <div style="min-width: 0;">
            <label for="editDate" style="display: block; margin-bottom: 6px; font-size: 12px; color: #d1d5db;">
              Trade date
            </label>
            <input id="editDate" name="date" type="date" required
              style="display: block; width: 100%; box-sizing: border-box; border: 1px solid #303030; border-radius: 11px; background: #080808; color: #ffffff; padding: 10px 12px; font-size: 14px; outline-color: #f97316;" />
          </div>

          <div style="min-width: 0;">
            <label for="editRR" style="display: block; margin-bottom: 6px; font-size: 12px; color: #d1d5db;">
              Risk-to-reward
            </label>
            <input id="editRR" name="RR" type="number" step="any" required
              style="display: block; width: 100%; box-sizing: border-box; border: 1px solid #303030; border-radius: 11px; background: #080808; color: #ffffff; padding: 10px 12px; font-size: 14px; outline-color: #f97316;" />
          </div>

          <div style="min-width: 0;">
            <label for="editPnl" style="display: block; margin-bottom: 6px; font-size: 12px; color: #d1d5db;">
              P&L ($)
            </label>
            <input id="editPnl" name="pnl" type="number" step="any" required
              style="display: block; width: 100%; box-sizing: border-box; border: 1px solid #303030; border-radius: 11px; background: #080808; color: #ffffff; padding: 10px 12px; font-size: 14px; outline-color: #f97316;" />
          </div>

          <div style="min-width: 0;">
            <label for="editSession" style="display: block; margin-bottom: 6px; font-size: 12px; color: #d1d5db;">
              Session
            </label>
            <select id="editSession" name="session"
              style="display: block; width: 100%; box-sizing: border-box; border: 1px solid #303030; border-radius: 11px; background: #080808; color: #ffffff; padding: 10px 12px; font-size: 14px; outline-color: #f97316;">
              <option value="">None</option>
              <option value="London">London</option>
              <option value="New York">New York</option>
              <option value="Asia">Asia</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div style="min-width: 0;">
            <label for="editSetupTag" style="display: block; margin-bottom: 6px; font-size: 12px; color: #d1d5db;">
              Setup Tag
            </label>
            <input id="editSetupTag" name="setupTag" type="text" maxlength="40"
              placeholder="e.g. BOS, CHoCH, Discount"
              style="display: block; width: 100%; box-sizing: border-box; border: 1px solid #303030; border-radius: 11px; background: #080808; color: #ffffff; padding: 10px 12px; font-size: 14px; outline-color: #f97316;" />
          </div>

          <div style="min-width: 0;">
            <label for="editResult" style="display: block; margin-bottom: 6px; font-size: 12px; color: #d1d5db;">
              Trade result
            </label>
            <select id="editResult" name="result" required
              style="display: block; width: 100%; box-sizing: border-box; border: 1px solid #303030; border-radius: 11px; background: #080808; color: #ffffff; padding: 10px 12px; font-size: 14px; outline-color: #f97316;">
              <option value="profit">Profit</option>
              <option value="loss">Loss</option>
              <option value="breakeven">Break-even</option>
            </select>
          </div>

          <div style="min-width: 0;">
            <label for="editPsychology" style="display: block; margin-bottom: 6px; font-size: 12px; color: #d1d5db;">
              Psychology / Discipline
            </label>
            <select id="editPsychology" name="psychology"
              style="display: block; width: 100%; box-sizing: border-box; border: 1px solid #303030; border-radius: 11px; background: #080808; color: #ffffff; padding: 10px 12px; font-size: 14px; outline-color: #f97316;">
              <option value="Followed Plan">Followed Plan</option>
              <option value="FOMO">FOMO</option>
              <option value="Revenge Trade">Revenge Trade</option>
              <option value="Early Exit">Early Exit</option>
              <option value="Over-leveraged">Over-leveraged</option>
            </select>
          </div>
        </div>

        <div style="margin-top: 16px;">
          <label for="editCriteria" style="display: block; margin-bottom: 6px; font-size: 12px; color: #d1d5db;">
            Criteria / Setup Notes
          </label>
          <textarea id="editCriteria" name="criteria" rows="3"
            placeholder="Describe the confluence and criteria for this trade..."
            style="display: block; width: 100%; box-sizing: border-box; border: 1px solid #303030; border-radius: 11px; background: #080808; color: #ffffff; padding: 10px 12px; font-size: 14px; outline-color: #f97316; resize: vertical; font-family: inherit;"></textarea>
        </div>

        <div style="margin-top: 16px;">
          <label for="editImage" style="display: block; margin-bottom: 6px; font-size: 12px; color: #d1d5db;">
            Replace chart screenshot (optional)
          </label>
          <input id="editImage" name="image" type="file" accept="image/*"
            style="display: block; width: 100%; box-sizing: border-box; border: 1px solid #303030; border-radius: 11px; background: #080808; color: #9ca3af; padding: 9px 12px; font-size: 13px; outline-color: #f97316;" />
          <div id="editImageHint" style="margin-top: 8px; font-size: 11px; color: #6b7280; overflow-wrap: anywhere;"></div>
          <p style="margin-top: 6px; font-size: 11px; color: #9ca3af;">
            Tip: take a screenshot (PrtScn), then press Ctrl+V to attach it.
          </p>
        </div>

        <p id="editTradeError" role="alert"
          style="display: none; margin: 14px 0 0; color: #f87171; font-size: 13px;"></p>

        <div style="display: flex; gap: 12px; margin-top: 22px; padding-top: 16px; border-top: 1px solid #292929;">
          <button type="button" id="cancelEditTrade"
            style="flex: 1; padding: 12px 8px; border: 1px solid #333333; border-radius: 11px; background: #191919; color: #e5e7eb; font-size: 13px; font-weight: 600; cursor: pointer;">
            Cancel
          </button>

          <button type="submit" id="saveEditTrade"
            style="flex: 1; padding: 12px 8px; border: 1px solid #f97316; border-radius: 11px; background: #f97316; color: #ffffff; font-size: 13px; font-weight: 700; cursor: pointer;">
            Save Changes
          </button>
        </div>
      </form>
    </section>
  `;

  document.body.appendChild(modal);

  document.querySelector("#closeEditModal").addEventListener("click", closeEditModal);
  document.querySelector("#cancelEditTrade").addEventListener("click", closeEditModal);

  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeEditModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.style.display !== "none") closeEditModal();
  });

  document.querySelector("#editTradeForm").addEventListener("submit", saveTradeChanges);
}

function openEditModal(trade) {
  createEditModal();

  const modal = document.querySelector("#editTradeModal");
  const form = document.querySelector("#editTradeForm");
  const resultSelect = document.querySelector("#editResult");

  form.dataset.tradeId = trade._id;

  document.querySelector("#editPair").value = trade.pair || "";
  document.querySelector("#editDate").value = formatDateForInput(trade.date);
  document.querySelector("#editRR").value = trade.rr ?? trade.RR ?? "";
  document.querySelector("#editPnl").value = trade.pnl ?? "";
  document.querySelector("#editSession").value = trade.session || "";
  document.querySelector("#editSetupTag").value = trade.setupTag || "";
  document.querySelector("#editPsychology").value = trade.psychology || "Followed Plan";
  document.querySelector("#editCriteria").value = trade.criteria || "";

  // Reset the file input and show what's currently attached
  const imageInput = document.querySelector("#editImage");
  const imageHint = document.querySelector("#editImageHint");
  imageInput.value = "";

  if (trade.image) {
    imageHint.innerHTML = `Current screenshot: <a href="${escapeHTML(trade.image)}" target="_blank" rel="noopener noreferrer" style="color: #f97316;">view current image &#8599;</a> &middot; choose a file below to replace it.`;
  } else {
    imageHint.textContent = "No screenshot attached yet. Choose a file to add one.";
  }

  const currentResult = trade.result || "profit";

  if (!Array.from(resultSelect.options).some((option) => option.value === currentResult)) {
    const option = document.createElement("option");
    option.value = currentResult;
    option.textContent = currentResult;
    resultSelect.appendChild(option);
  }

  resultSelect.value = currentResult;

  const errorElement = document.querySelector("#editTradeError");
  errorElement.textContent = "";
  errorElement.style.display = "none";

  previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  modal.style.display = "flex";

  document.querySelector("#editPair").focus();
}

// ========================================
// PASTE A SCREENSHOT INTO THE EDIT MODAL
// ----------------------------------------
// Ctrl+V while the edit modal is open attaches a
// clipboard image to #editImage, so Save Changes
// uploads it through the existing multipart flow.
// ========================================

function showEditImageReady(file) {
  const imageHint = document.querySelector("#editImageHint");
  if (!imageHint || !file) return;

  imageHint.innerHTML = `New image ready: <span style="color: #ffffff;">${escapeHTML(
    file.name || "pasted-screenshot.png"
  )}</span> — replaces the current screenshot when you save.`;
}

// Delegated on document so it works regardless of when the modal is created
document.addEventListener(
  "change",
  (event) => {
    if (event.target && event.target.id === "editImage") {
      showEditImageReady(event.target.files[0]);
    }
  },
  true
);

document.addEventListener("paste", (event) => {
  const modal = document.querySelector("#editTradeModal");
  const editImageInput = document.querySelector("#editImage");

  if (!editImageInput || !modal || modal.style.display !== "flex" || !event.clipboardData) {
    return;
  }

  const items = Array.from(event.clipboardData.items || []);
  const imageItem = items.find(
    (item) => item.kind === "file" && item.type.startsWith("image/")
  );

  if (!imageItem) return;

  const file = imageItem.getAsFile();
  if (!file) return;

  event.preventDefault();

  try {
    const transfer = new DataTransfer();
    transfer.items.add(file);
    editImageInput.files = transfer.files;
  } catch (error) {
    console.error("Could not attach pasted image:", error);
    return;
  }

  showEditImageReady(file);
});

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
  const session = document.querySelector("#editSession").value;
  const setupTag = document.querySelector("#editSetupTag").value;
  const psychology = document.querySelector("#editPsychology").value;
  const criteria = document.querySelector("#editCriteria").value.trim();
  const imageFile = document.querySelector("#editImage").files[0];

  if (!pair || !date || RR === "" || pnl === "" || !result) {
    errorElement.textContent = "Please complete all required fields.";
    errorElement.style.display = "block";
    return;
  }

  const numericRR = Number(RR);
  const numericPnl = Number(pnl);

  if (!Number.isFinite(numericRR) || !Number.isFinite(numericPnl)) {
    errorElement.textContent = "Enter valid numeric values for RR and P&L.";
    errorElement.style.display = "block";
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = "Saving...";
  saveButton.style.opacity = "0.65";

  try {
    // FormData so the PATCH can also carry a replacement screenshot
    const formData = new FormData();
    formData.append("pair", pair);
    formData.append("date", date);
    formData.append("rr", String(numericRR));
    formData.append("pnl", String(numericPnl));
    formData.append("result", result);
    formData.append("session", session);
    formData.append("setupTag", setupTag);
    formData.append("psychology", psychology);
    formData.append("criteria", criteria);

    if (imageFile) {
      formData.append("image", imageFile);
    }

    await apiRequest(
      `${API_URL}/trades/${encodeURIComponent(tradeId)}`,
      {
        method: "PATCH",
        body: formData,
      }
    );

    closeEditModal();
    await refreshDashboard();
  } catch (error) {
    errorElement.textContent = error.message || "Could not update trade.";
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

    if (action === "view") {
      const trade = tradeCardsById[tradeId];
      if (trade) openLightbox(trade);
      return;
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
// IMAGE LIGHTBOX MODAL (SCREENSHOT + CRITERIA)
// ========================================

let lightboxPreviousBodyOverflow = "";

function closeLightbox() {
  const lightbox = document.querySelector("#tradeLightbox");
  if (!lightbox) return;

  lightbox.style.display = "none";
  document.body.style.overflow = lightboxPreviousBodyOverflow;
}

function openLightbox(trade) {
  let lightbox = document.querySelector("#tradeLightbox");

  if (!lightbox) {
    lightbox = document.createElement("div");
    lightbox.id = "tradeLightbox";
    lightbox.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
      overflow-y: auto;
      box-sizing: border-box;
      padding: 16px;
      background: rgba(0, 0, 0, 0.88);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    `;
    lightbox.innerHTML = `
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Trade screenshot and notes"
        id="tradeLightboxDialog"
        style="
          width: 100%;
          max-width: 1040px;
          max-height: calc(100vh - 32px);
          overflow-y: auto;
          box-sizing: border-box;
          border: 1px solid #292929;
          border-radius: 20px;
          background: #101010;
          color: #ffffff;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
        "
      ></section>
    `;

    document.body.appendChild(lightbox);

    const responsiveStyle = document.createElement("style");
    responsiveStyle.textContent = `
      @media (max-width: 760px) {
        #tradeLightboxDialog .lightbox-grid { grid-template-columns: minmax(0, 1fr) !important; }
      }
    `;
    document.head.appendChild(responsiveStyle);

    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) closeLightbox();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && lightbox.style.display !== "none") {
        closeLightbox();
      }
    });
  }

  const dialog = lightbox.querySelector("#tradeLightboxDialog");
  const pnl = Number(trade.pnl || 0);
  const isProfit = pnl >= 0;
  const hasImage = Boolean(trade.image);

  const metaItem = (label, value) => `
    <div style="min-width: 0;">
      <p style="margin: 0; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280;">
        ${escapeHTML(label)}
      </p>
      <p style="margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #e5e7eb; overflow-wrap: anywhere;">
        ${escapeHTML(value)}
      </p>
    </div>
  `;

  dialog.innerHTML = `
    <header
      style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 20px 24px;
        border-bottom: 1px solid #292929;
      "
    >
      <div style="min-width: 0;">
        <p style="margin: 0 0 4px; color: #f97316; font-size: 11px; font-weight: 700; letter-spacing: 2px;">
          YourJournal
        </p>
        <h2 style="margin: 0; font-size: 19px; font-weight: 700; overflow-wrap: anywhere;">
          ${escapeHTML(trade.pair)} &mdash;
          <span style="color: ${isProfit ? "#4ade80" : "#f87171"};">
            ${isProfit ? "+" : ""}$${pnl.toFixed(2)}
          </span>
        </h2>
      </div>

      <button
        type="button"
        id="closeLightbox"
        aria-label="Close screenshot viewer"
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
    </header>

    <div
      class="lightbox-grid"
      style="
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
        gap: 20px;
        padding: 20px 24px 24px;
      "
    >
      <!-- Screenshot -->
      <div style="min-width: 0;">
        ${hasImage
          ? `
            <a href="${escapeHTML(trade.image)}" target="_blank" rel="noopener noreferrer"
              style="display: block; border: 1px solid #292929; border-radius: 14px; overflow: hidden; background: #080808;">
              <img
                src="${escapeHTML(trade.image)}"
                alt="Chart screenshot for ${escapeHTML(trade.pair)}"
                style="display: block; width: 100%; max-height: 60vh; object-fit: contain; background: #080808;"
              />
            </a>
            <p style="margin: 8px 0 0; font-size: 11px; color: #6b7280;">
              Click the image to open the full-size version.
            </p>
          `
          : `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 220px; border: 1px dashed #303030; border-radius: 14px; color: #6b7280; font-size: 13px; text-align: center; padding: 24px;">
              No chart screenshot was attached to this trade.
            </div>
          `}
      </div>

      <!-- Criteria notes + meta -->
      <aside style="min-width: 0; display: flex; flex-direction: column; gap: 16px;">
        <div>
          <p style="margin: 0 0 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280;">
            Criteria / Setup Notes
          </p>
          <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #d1d5db; white-space: pre-wrap; overflow-wrap: anywhere;">
            ${trade.criteria ? escapeHTML(trade.criteria) : "<span style='color: #6b7280;'>No criteria notes were recorded for this trade.</span>"}
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding-top: 14px; border-top: 1px solid #292929;">
          ${metaItem("Date", formatDate(trade.date))}
          ${metaItem("Result", trade.result || "-")}
          ${metaItem("Risk : Reward", trade.rr ?? trade.RR ? `${trade.rr ?? trade.RR}R` : "-")}
          ${metaItem("Session", trade.session || "-")}
          ${metaItem("Setup", trade.setupTag || "-")}
          ${metaItem("Psychology", trade.psychology || "-")}
        </div>
      </aside>
    </div>
  `;

  dialog.querySelector("#closeLightbox").addEventListener("click", closeLightbox);

  lightboxPreviousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  lightbox.style.display = "flex";
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
// EXPORT MONTH (CSV)
// ========================================

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function exportMonthCsv() {
  const month = getSelectedMonth();
  const trades = currentMonthTrades;

  if (!month) {
    window.alert("Please select a month first.");
    return;
  }

  if (!Array.isArray(trades) || trades.length === 0) {
    window.alert("There are no trades to export for this month.");
    return;
  }

  const headers = [
    "Date",
    "Pair",
    "Result",
    "PnL",
    "RR",
    "Session",
    "Setup",
    "Psychology",
    "Criteria",
    "Screenshot URL",
  ];

  const rows = [...trades]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((trade) =>
      [
        formatDateForInput(trade.date),
        trade.pair,
        trade.result,
        Number(trade.pnl || 0),
        trade.rr ?? trade.RR ?? "",
        trade.session || "",
        trade.setupTag || "",
        trade.psychology || "",
        trade.criteria || "",
        trade.image || "",
      ]
        .map(csvEscape)
        .join(",")
    );

  // BOM so Excel opens UTF-8 correctly
  const csv = `\uFEFF${headers.map(csvEscape).join(",")}\r\n${rows.join("\r\n")}`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = `trades-${month}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(downloadUrl);
}

const exportCsvButton = document.querySelector("#exportCsvButton");

if (exportCsvButton) {
  exportCsvButton.addEventListener("click", exportMonthCsv);
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