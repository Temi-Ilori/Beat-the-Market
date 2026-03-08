const FINNHUB_BASE = "https://finnhub.io/api/v1";
const WATCHLIST_KEY = "btm_watchlist";
const MAX_PICKS = 3;

const playBtn = document.getElementById("play-btn");
const resultsDiv = document.getElementById("results");
const apiKeyInput = document.getElementById("api-key");
const saveKeyBtn = document.getElementById("save-key-btn");
const searchInput = document.getElementById("asset-search");
const searchResultsDiv = document.getElementById("search-results");
const selectedPicksDiv = document.getElementById("selected-picks");
const watchlistDiv = document.getElementById("watchlist");

let selectedSymbols = [];
let searchMatches = [];
let searchDebounce = null;
let watchlist = [];

const storedKey = localStorage.getItem("finnhub_api_key");
if (storedKey) {
  apiKeyInput.value = storedKey;
}

try {
  const parsed = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]");
  if (Array.isArray(parsed)) {
    watchlist = parsed.map((symbol) => String(symbol).toUpperCase()).slice(0, 50);
  }
} catch (_error) {
  watchlist = [];
}

renderSelectedPicks();
renderWatchlist();

saveKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    resultsDiv.innerHTML = '<p class="warning">Enter an API key before saving.</p>';
    return;
  }

  localStorage.setItem("finnhub_api_key", key);
  resultsDiv.innerHTML = "<p>API key saved in this browser. You can now run live analysis.</p>";
});

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim();
  const token = getToken();

  if (searchDebounce) {
    clearTimeout(searchDebounce);
  }

  if (!query) {
    searchMatches = [];
    renderSearchResults();
    return;
  }

  if (!token) {
    searchResultsDiv.innerHTML = '<p class="hint">Save your Finnhub API key to search symbols.</p>';
    return;
  }

  searchDebounce = setTimeout(async () => {
    searchResultsDiv.innerHTML = "<p class='hint'>Searching...</p>";
    searchMatches = await searchAssets(query, token);
    renderSearchResults();
  }, 280);
});

function getToken() {
  return apiKeyInput.value.trim() || localStorage.getItem("finnhub_api_key") || "";
}

function saveWatchlist() {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
}

function formatPct(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

async function searchAssets(query, token) {
  const url = `${FINNHUB_BASE}/search?q=${encodeURIComponent(query)}&token=${token}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const rows = Array.isArray(data.result) ? data.result : [];

    const filtered = rows.filter((item) => {
      if (!item || !item.symbol) {
        return false;
      }

      const type = String(item.type || "").toLowerCase();
      return type.includes("stock") || type.includes("etf") || type.includes("etp") || type === "";
    });

    const unique = [];
    const seen = new Set();

    filtered.forEach((item) => {
      const symbol = String(item.symbol).toUpperCase();
      if (seen.has(symbol)) {
        return;
      }
      seen.add(symbol);
      unique.push({
        symbol,
        description: item.description || "No description",
        type: item.type || ""
      });
    });

    return unique.slice(0, 10);
  } catch (_error) {
    return [];
  }
}

async function getQuote(symbol, token) {
  const url = `${FINNHUB_BASE}/quote?symbol=${symbol}&token=${token}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Quote request failed for ${symbol}`);
  }

  const data = await response.json();
  if (!data || typeof data.dp !== "number") {
    throw new Error(`No quote data for ${symbol}`);
  }

  return {
    symbol,
    current: data.c,
    dayChangePct: data.dp,
    previousClose: data.pc
  };
}

async function getAssetProfile(symbol, token) {
  const url = `${FINNHUB_BASE}/stock/profile2?symbol=${symbol}&token=${token}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { symbol, industry: null };
    }

    const data = await response.json();
    return {
      symbol,
      industry: data && data.finnhubIndustry ? String(data.finnhubIndustry) : null
    };
  } catch (_error) {
    return { symbol, industry: null };
  }
}

function formatNewsTime(unixSeconds) {
  if (!unixSeconds) {
    return "time unavailable";
  }
  return new Date(unixSeconds * 1000).toLocaleString();
}

async function getMarketEvents(token) {
  const url = `${FINNHUB_BASE}/news?category=general&token=${token}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .filter((item) => item && item.headline && item.url)
      .slice(0, 3)
      .map((item) => ({
        headline: item.headline,
        source: item.source || "Unknown source",
        datetime: formatNewsTime(item.datetime),
        url: item.url
      }));
  } catch (_error) {
    return [];
  }
}

function riskLabel(avgAbsChange) {
  if (avgAbsChange > 2.4) {
    return "High";
  }

  if (avgAbsChange > 1.5) {
    return "Medium";
  }

  return "Low";
}

function diversificationSummary(profiles) {
  const industries = profiles
    .map((profile) => profile.industry)
    .filter((industry) => typeof industry === "string" && industry.trim().length > 0);
  const uniqueIndustries = new Set(industries);

  if (!uniqueIndustries.size) {
    return "Industry mix unavailable for one or more picks. Add at least one ETF plus different sectors to reduce concentration risk.";
  }

  if (uniqueIndustries.size >= 3) {
    return "Strong diversification mix: each pick is from a different industry, which can reduce single-theme risk.";
  }

  if (uniqueIndustries.size === 2) {
    return "Moderate diversification mix: two industries covered. Consider one uncorrelated sector or broad ETF for better balance.";
  }

  return "Concentrated mix: all picks map to one industry. Add another sector or broad ETF to diversify daily volatility.";
}

function addPick(symbol) {
  const normalized = String(symbol).toUpperCase();
  if (selectedSymbols.includes(normalized)) {
    return;
  }

  if (selectedSymbols.length >= MAX_PICKS) {
    resultsDiv.innerHTML = `<p class='warning'>You can only choose ${MAX_PICKS} picks.</p>`;
    return;
  }

  selectedSymbols.push(normalized);
  renderSelectedPicks();
  renderSearchResults();
  renderWatchlist();
}

function removePick(symbol) {
  const normalized = String(symbol).toUpperCase();
  selectedSymbols = selectedSymbols.filter((item) => item !== normalized);
  renderSelectedPicks();
  renderSearchResults();
  renderWatchlist();
}

function addToWatchlist(symbol) {
  const normalized = String(symbol).toUpperCase();
  if (watchlist.includes(normalized)) {
    return;
  }

  watchlist.unshift(normalized);
  watchlist = watchlist.slice(0, 50);
  saveWatchlist();
  renderWatchlist();
  renderSearchResults();
}

function removeFromWatchlist(symbol) {
  const normalized = String(symbol).toUpperCase();
  watchlist = watchlist.filter((item) => item !== normalized);
  saveWatchlist();
  renderWatchlist();
  renderSearchResults();
}

function renderSelectedPicks() {
  if (!selectedSymbols.length) {
    selectedPicksDiv.innerHTML = '<p class="hint">No picks yet.</p>';
    return;
  }

  selectedPicksDiv.innerHTML = selectedSymbols
    .map(
      (symbol) => `
        <div class="symbol-chip">
          <span>${symbol}</span>
          <button class="chip-btn" data-remove-pick="${symbol}">Remove</button>
        </div>
      `
    )
    .join("");

  selectedPicksDiv.querySelectorAll("[data-remove-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      removePick(btn.dataset.removePick);
    });
  });
}

function renderSearchResults() {
  if (!searchInput.value.trim()) {
    searchResultsDiv.innerHTML = "";
    return;
  }

  if (!searchMatches.length) {
    searchResultsDiv.innerHTML = '<p class="hint">No matching stock/ETF found.</p>';
    return;
  }

  searchResultsDiv.innerHTML = searchMatches
    .map((match) => {
      const selected = selectedSymbols.includes(match.symbol);
      const watched = watchlist.includes(match.symbol);
      return `
        <article class="result-row">
          <div>
            <p class="result-symbol">${match.symbol}</p>
            <p class="result-desc">${match.description}</p>
          </div>
          <div class="result-actions">
            <button class="pill" data-pick="${match.symbol}" ${selected || selectedSymbols.length >= MAX_PICKS ? "disabled" : ""}>
              ${selected ? "Picked" : "Pick"}
            </button>
            <button class="pill" data-watch="${match.symbol}" ${watched ? "disabled" : ""}>
              ${watched ? "Watching" : "Watch"}
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  searchResultsDiv.querySelectorAll("[data-pick]").forEach((btn) => {
    btn.addEventListener("click", () => addPick(btn.dataset.pick));
  });

  searchResultsDiv.querySelectorAll("[data-watch]").forEach((btn) => {
    btn.addEventListener("click", () => addToWatchlist(btn.dataset.watch));
  });
}

function renderWatchlist() {
  if (!watchlist.length) {
    watchlistDiv.innerHTML = '<p class="hint">No symbols saved yet.</p>';
    return;
  }

  watchlistDiv.innerHTML = watchlist
    .map((symbol) => {
      const selected = selectedSymbols.includes(symbol);
      return `
        <div class="watch-row">
          <span>${symbol}</span>
          <div class="watch-actions">
            <button class="pill" data-pick-watch="${symbol}" ${selected || selectedSymbols.length >= MAX_PICKS ? "disabled" : ""}>
              ${selected ? "Picked" : "Pick"}
            </button>
            <button class="pill" data-remove-watch="${symbol}">Remove</button>
          </div>
        </div>
      `;
    })
    .join("");

  watchlistDiv.querySelectorAll("[data-pick-watch]").forEach((btn) => {
    btn.addEventListener("click", () => addPick(btn.dataset.pickWatch));
  });

  watchlistDiv.querySelectorAll("[data-remove-watch]").forEach((btn) => {
    btn.addEventListener("click", () => removeFromWatchlist(btn.dataset.removeWatch));
  });
}

playBtn.addEventListener("click", async () => {
  const selected = [...selectedSymbols];
  const token = getToken();

  if (selected.length !== MAX_PICKS) {
    resultsDiv.innerHTML = `<p class='warning'>Select exactly ${MAX_PICKS} stocks to run analysis.</p>`;
    return;
  }

  if (!token) {
    resultsDiv.innerHTML = "<p class='warning'>Add your Finnhub API key first.</p>";
    return;
  }

  playBtn.disabled = true;
  playBtn.textContent = "Analyzing...";
  resultsDiv.innerHTML = "<p>Fetching live market data...</p>";

  try {
    const symbols = [...selected, "SPY"];
    const [quoteResults, profileResults, marketEvents] = await Promise.all([
      Promise.all(symbols.map((symbol) => getQuote(symbol, token))),
      Promise.all(selected.map((symbol) => getAssetProfile(symbol, token))),
      getMarketEvents(token)
    ]);
    const quoteMap = Object.fromEntries(quoteResults.map((item) => [item.symbol, item]));

    const pickQuotes = selected.map((symbol) => quoteMap[symbol]);
    const pickDayAvg = pickQuotes.reduce((sum, stock) => sum + stock.dayChangePct, 0) / pickQuotes.length;
    const spyDay = quoteMap.SPY.dayChangePct;
    const beatMarketToday = pickDayAvg > spyDay;
    const topMover = [...pickQuotes].sort((a, b) => Math.abs(b.dayChangePct) - Math.abs(a.dayChangePct))[0];
    const avgAbsMove = pickQuotes.reduce((sum, item) => sum + Math.abs(item.dayChangePct), 0) / pickQuotes.length;
    const risk = riskLabel(avgAbsMove);
    const mixSummary = diversificationSummary(profileResults);

    const statusToday = beatMarketToday ? "You are outperforming SPY today." : "SPY is outperforming your picks today.";
    const eventsHtml = marketEvents.length
      ? marketEvents
          .map(
            (event) =>
              `<li><a href="${event.url}" target="_blank" rel="noopener noreferrer">${event.headline}</a> <span class="hint">(${event.source}, ${event.datetime})</span></li>`
          )
          .join("")
      : "<li>No market events available right now. Try again in a moment.</li>";
    const generatedAt = new Date().toLocaleString();

    resultsDiv.innerHTML = `
      <h2>Live Results</h2>
      <p><strong>Your picks:</strong> ${selected.join(", ")}</p>
      <p><strong>Today:</strong> ${statusToday}</p>
      <div class="kpi-grid">
        <article class="kpi">
          <p class="kpi-label">Your Avg Change (Today)</p>
          <p class="kpi-value ${pickDayAvg >= 0 ? "good" : "bad"}">${formatPct(pickDayAvg)}</p>
        </article>
        <article class="kpi">
          <p class="kpi-label">SPY Change (Today)</p>
          <p class="kpi-value ${spyDay >= 0 ? "good" : "bad"}">${formatPct(spyDay)}</p>
        </article>
        <article class="kpi">
          <p class="kpi-label">Portfolio Risk Meter</p>
          <p class="kpi-value">${risk}</p>
        </article>
      </div>
      <div class="learn-card">
        <p><strong>Top Mover:</strong> ${topMover.symbol} at ${formatPct(topMover.dayChangePct)} today.</p>
        <p><strong>Mix Check:</strong> ${mixSummary}</p>
        <p><strong>Market Events That May Influence Picks:</strong></p>
        <ul class="events-list">${eventsHtml}</ul>
      </div>
      <p class="hint">Updated: ${generatedAt}</p>
    `;
  } catch (error) {
    resultsDiv.innerHTML = `
      <p class="warning">Could not load live data. Check your API key, symbol limits, and market-hours availability.</p>
      <p class="hint">Error: ${error.message}</p>
    `;
  } finally {
    playBtn.disabled = false;
    playBtn.textContent = "Analyze My Picks";
  }
});
