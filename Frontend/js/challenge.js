// API base URL comes from js/api-config.js (loaded before this file)
const API_BASE_URL = window.API_URL;

const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "./login.html";
}

// ----------------------------------------
// Small helpers
// ----------------------------------------

const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const signed = (n) => `${Number(n) > 0 ? "+" : ""}${fmt(n)}`;

const shortDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

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
// DOM refs
// ----------------------------------------

const loadingState = document.querySelector("#loadingState");
const errorState = document.querySelector("#errorState");
const errorMessage = document.querySelector("#errorStateMessage");
const retryButton = document.querySelector("#retryButton");

const startSection = document.querySelector("#startSection");
const startForm = document.querySelector("#startChallengeForm");
const startButton = document.querySelector("#startChallengeButton");

const detailSection = document.querySelector("#detailSection");
const statusPill = document.querySelector("#statusPill");
const challengeTitle = document.querySelector("#challengeTitle");
const challengeDates = document.querySelector("#challengeDates");
const detailActions = document.querySelector("#detailActions");
const balanceValue = document.querySelector("#balanceValue");
const progressValue = document.querySelector("#progressValue");
const progressBar = document.querySelector("#progressBar");
const statusNote = document.querySelector("#statusNote");
const statStart = document.querySelector("#statStart");
const statTarget = document.querySelector("#statTarget");
const statPnl = document.querySelector("#statPnl");
const statTrades = document.querySelector("#statTrades");
const statTimeLeft = document.querySelector("#statTimeLeft");
const statEnds = document.querySelector("#statEnds");
const challengeTrades = document.querySelector("#challengeTrades");

const historySection = document.querySelector("#historySection");
const historyList = document.querySelector("#historyList");

const STATUS_STYLES = {
  active: {
    label: "ACTIVE",
    pill: "bg-orange-500/15 text-orange-400 border border-orange-500/40",
    bar: "bg-orange-500",
    progress: "text-orange-400",
  },
  passed: {
    label: "PASSED",
    pill: "bg-green-500/15 text-green-400 border border-green-500/40",
    bar: "bg-green-500",
    progress: "text-green-400",
  },
  failed: {
    label: "FAILED",
    pill: "bg-red-500/15 text-red-400 border border-red-500/40",
    bar: "bg-red-500",
    progress: "text-red-400",
  },
};

function showOnly(section) {
  for (const el of [startSection, detailSection, errorState]) {
    el.classList.add("hidden");
  }
  if (section) section.classList.remove("hidden");
  loadingState.classList.add("hidden");
}

function showError(message) {
  errorMessage.textContent = message || "Could not load your challenge.";
  showOnly(errorState);
}

// ----------------------------------------
// Render: detail (active or finished)
// ----------------------------------------

async function renderDetail(id) {
  const { ok, data } = await api(`/challenges/${id}`);

  if (!ok || !data || !data.data) {
    showError(data?.message || "Could not load that challenge.");
    return;
  }

  const c = data.data;
  const style = STATUS_STYLES[c.status] || STATUS_STYLES.active;

  statusPill.textContent = style.label;
  statusPill.className = `inline-block rounded-full px-3 py-1 text-xs font-bold tracking-wider ${style.pill}`;

  challengeTitle.textContent = `${fmt(c.startAmount)} → ${fmt(c.targetBalance)} · ${c.durationDays} days`;
  challengeDates.textContent = `${shortDate(c.startDate)} — ${shortDate(c.endDate)}`;

  balanceValue.textContent = fmt(c.balance);
  progressValue.textContent = `${c.progressPct}%`;
  progressValue.className = `mt-1 text-2xl sm:text-3xl font-bold ${style.progress}`;
  progressBar.style.width = `${c.progressPct}%`;
  progressBar.className = `h-full rounded-full transition-all duration-500 ${style.bar}`;

  if (c.status === "active") {
    statusNote.textContent =
      `${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left. ` +
      `Reach ${fmt(c.targetBalance)} before the deadline to pass.`;
  } else if (c.status === "passed") {
    statusNote.textContent = `Target reached on ${shortDate(c.endedAt)}. This challenge's trade log is now locked.`;
  } else {
    statusNote.textContent = `Challenge ended on ${shortDate(c.endedAt)}. This challenge's trade log is now locked.`;
  }

  statStart.textContent = fmt(c.startAmount);
  statTarget.textContent = `${fmt(c.targetBalance)} (+${fmt(c.targetAmount)})`;
  statPnl.textContent = signed(c.totalPnl);
  statPnl.className = `mt-1.5 text-lg font-semibold ${
    c.totalPnl > 0 ? "text-green-400" : c.totalPnl < 0 ? "text-red-400" : "text-white"
  }`;
  statTrades.textContent = String(c.tradeCount);
  statTimeLeft.textContent = c.status === "active" ? `${c.daysLeft} days` : "—";
  statEnds.textContent = shortDate(c.endDate);

  renderActions(c);
  renderTrades(c.trades || []);
  showOnly(detailSection);
}

function renderActions(c) {
  detailActions.innerHTML = "";

  const add = (label, classes, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = classes;
    button.textContent = label;
    button.addEventListener("click", onClick);
    detailActions.appendChild(button);
  };

  const link = (label, href, classes) => {
    const a = document.createElement("a");
    a.href = href;
    a.className = classes;
    a.textContent = label;
    detailActions.appendChild(a);
  };

  const primary =
    "px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 text-black font-bold transition text-sm";
  const ghost =
    "px-5 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/25 transition text-sm";
  const danger =
    "px-5 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition text-sm";

  if (c.status === "active") {
    link("Log a Trade", "./add-trade.html", primary);
    add("Quit Challenge", danger, async () => {
      if (!confirm("Quit this challenge? It will be marked as failed.")) return;
      const { ok, data } = await api(`/challenges/${c._id}/quit`, { method: "POST" });
      if (!ok) {
        alert(data?.message || "Could not quit the challenge.");
        return;
      }
      await load();
    });
  } else {
    add("Start New Challenge", primary, () => showOnly(startSection));
    add("Delete", danger, async () => {
      if (!confirm("Delete this challenge? Its trades stay in your journal.")) return;
      const { ok, data } = await api(`/challenges/${c._id}`, { method: "DELETE" });
      if (!ok) {
        alert(data?.message || "Could not delete the challenge.");
        return;
      }
      await load();
    });
  }
}

function renderTrades(trades) {
  if (trades.length === 0) {
    challengeTrades.innerHTML = `
      <div class="rounded-xl border border-dashed border-white/10 bg-[#101010] p-6 text-center">
        <p class="text-sm text-gray-400">No trades logged under this challenge yet.</p>
        <a href="./add-trade.html" class="mt-3 inline-block text-sm font-semibold text-orange-400 hover:text-orange-300 transition">
          Log your first trade →
        </a>
      </div>`;
    return;
  }

  const rows = trades
    .map((t) => {
      const pnlClass =
        t.pnl > 0 ? "text-green-400" : t.pnl < 0 ? "text-red-400" : "text-gray-400";
      const resultClass =
        t.result === "profit"
          ? "text-green-400"
          : t.result === "loss"
            ? "text-red-400"
            : "text-gray-400";

      return `
        <tr class="border-t border-white/5">
          <td class="px-3 py-3 text-sm text-gray-400 whitespace-nowrap">${esc(shortDate(t.date))}</td>
          <td class="px-3 py-3 text-sm font-semibold whitespace-nowrap">${esc(t.pair)}</td>
          <td class="px-3 py-3 text-sm capitalize ${resultClass}">${esc(t.result)}</td>
          <td class="px-3 py-3 text-sm text-right font-semibold ${pnlClass}">${esc(signed(t.pnl))}</td>
          <td class="px-3 py-3 text-sm text-right text-gray-300 whitespace-nowrap">${esc(fmt(t.runningBalance))}</td>
        </tr>`;
    })
    .join("");

  challengeTrades.innerHTML = `
    <div class="overflow-x-auto rounded-xl border border-white/10 bg-[#101010]">
      <table class="w-full text-left">
        <thead>
          <tr class="border-b border-white/10 text-xs text-gray-500">
            <th class="px-3 py-3 font-medium">Date</th>
            <th class="px-3 py-3 font-medium">Pair</th>
            <th class="px-3 py-3 font-medium">Result</th>
            <th class="px-3 py-3 font-medium text-right">P&amp;L</th>
            <th class="px-3 py-3 font-medium text-right">Balance</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ----------------------------------------
// Render: history list
// ----------------------------------------

function renderHistory(finished) {
  if (finished.length === 0) {
    historySection.classList.add("hidden");
    return;
  }

  historyList.innerHTML = "";

  for (const c of finished) {
    const style = STATUS_STYLES[c.status] || STATUS_STYLES.failed;

    const li = document.createElement("li");
    li.className =
      "rounded-xl border border-white/10 bg-[#101010] p-4 flex items-center justify-between gap-4 cursor-pointer hover:border-orange-500/40 transition";

    li.innerHTML = `
      <div class="min-w-0">
        <span class="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wider ${style.pill}">
          ${style.label}
        </span>
        <p class="mt-2 text-sm font-semibold truncate">
          ${esc(fmt(c.startAmount))} → ${esc(fmt(c.targetBalance))} · ${esc(String(c.durationDays))} days
        </p>
        <p class="mt-0.5 text-xs text-gray-500">
          Ended ${esc(shortDate(c.endedAt || c.endDate))} · ${esc(String(c.tradeCount))} trade${c.tradeCount === 1 ? "" : "s"}
        </p>
      </div>
      <span class="shrink-0 text-lg font-bold ${
        c.balance > c.startAmount ? "text-green-400" : c.balance < c.startAmount ? "text-red-400" : "text-gray-400"
      }">
        ${esc(signed(c.totalPnl))}
      </span>`;

    li.addEventListener("click", () => renderDetail(c._id).catch(() => {}));
    historyList.appendChild(li);
  }

  historySection.classList.remove("hidden");
}

// ----------------------------------------
// Load everything
// ----------------------------------------

async function load() {
  loadingState.classList.remove("hidden");
  errorState.classList.add("hidden");

  const { ok, data } = await api("/challenges");

  if (!ok || !data) {
    showError("Could not load your challenge. Check your connection and try again.");
    return;
  }

  const list = data.data || [];
  const active = list.find((c) => c.status === "active");
  const finished = list.filter((c) => c.status !== "active");

  renderHistory(finished);

  if (active) {
    await renderDetail(active._id);
  } else if (finished.length > 0) {
    // No active challenge: show the most recent result (list is
    // newest-first) so finishing one doesn't dump you straight
    // onto the start form. "Start New" is one click away.
    await renderDetail(finished[0]._id);
  } else {
    showOnly(startSection);
  }
}

// ----------------------------------------
// Start a challenge
// ----------------------------------------

if (startForm) {
  startForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const body = {
      startAmount: Number(startForm.startAmount.value),
      targetAmount: Number(startForm.targetAmount.value),
      durationDays: Number(startForm.durationDays.value),
    };

    startButton.disabled = true;
    startButton.textContent = "Starting...";

    try {
      const { ok, data } = await api("/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (ok && data && data.data) {
        startForm.reset();
        await load();
      } else {
        alert(data?.message || "Could not start the challenge. Please try again.");
      }
    } catch (error) {
      alert(error.message || "An error occurred while starting the challenge.");
    } finally {
      startButton.disabled = false;
      startButton.textContent = "Start Challenge";
    }
  });
}

if (retryButton) {
  retryButton.addEventListener("click", () => load().catch(() => {}));
}

load().catch(() => showError());
