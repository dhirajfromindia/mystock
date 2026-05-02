const fs = require("fs");

function readData() {
  if (!fs.existsSync("data.json")) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync("data.json", "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function pctChange(oldVal, newVal) {
  if (oldVal === null || oldVal === undefined || oldVal === 0) return null;
  return ((newVal - oldVal) / oldVal) * 100;
}

function findHistoryEntry(history, daysAgo) {
  if (!Array.isArray(history) || history.length === 0) return null;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);
  const targetTime = targetDate.getTime();

  let best = null;
  let bestTime = -Infinity;

  history.forEach(entry => {
    if (!entry || !entry.date) return;

    const entryDate = new Date(entry.date);
    const entryTime = entryDate.getTime();
    if (Number.isNaN(entryTime) || entryTime > targetTime) return;

    if (entryTime >= bestTime) {
      bestTime = entryTime;
      best = {
        date: entry.date,
        mcap: Number(entry.mcap)
      };
    }
  });

  return best && Number.isFinite(best.mcap) ? best : null;
}

function buildPreviousRankMap(data, daysAgo) {
  const previousSnapshot = data
    .map(item => {
      const historyEntry = findHistoryEntry(item.history, daysAgo);
      if (!historyEntry) return null;

      return {
        SecurityID: item.SecurityID,
        mcap: historyEntry.mcap
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.mcap - a.mcap);

  const rankMap = new Map();
  previousSnapshot.forEach((item, index) => {
    rankMap.set(item.SecurityID, index + 1);
  });

  return rankMap;
}

function formatNumber(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "N/A";
  }

  return Number(value).toLocaleString("en-IN");
}

function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "N/A";
  }

  const numeric = Number(value);
  return `${numeric >= 0 ? "+" : "-"}${Math.abs(numeric).toFixed(2)}%`;
}

function formatAbsoluteChange(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "N/A";
  }

  const numeric = Number(value);
  return `${numeric >= 0 ? "+" : "-"}${formatNumber(Math.abs(numeric))}`;
}

function formatRankChange(currentRank, previousRank, topN) {
  if (previousRank === null || previousRank === undefined) {
    return "N/A";
  }

  if (previousRank > topN) {
    return "New";
  }

  if (currentRank < previousRank) {
    return `Up ${previousRank - currentRank}`;
  }

  if (currentRank > previousRank) {
    return `Down ${currentRank - previousRank}`;
  }

  return "No change";
}

function buildReportData(data, daysAgo, topN) {
  const previousRankMap = buildPreviousRankMap(data, daysAgo);

  const enriched = data.map(item => {
    const previousEntry = findHistoryEntry(item.history, daysAgo);
    const previousMcap = previousEntry ? previousEntry.mcap : null;
    const currentMcap = Number(item.mcap);
    const changePct = pctChange(previousMcap, currentMcap);
    const absoluteChange = previousMcap === null ? null : currentMcap - previousMcap;
    const previousRank = previousRankMap.has(item.SecurityID) ? previousRankMap.get(item.SecurityID) : null;

    return {
      ...item,
      currentRank: Number(item.rank),
      previousDate: previousEntry ? previousEntry.date : null,
      previousMcap,
      previousRank,
      changePct,
      absoluteChange,
      rankChangeText: formatRankChange(Number(item.rank), previousRank, topN),
      isNewInTopN: previousRank === null || previousRank > topN
    };
  });

  const topList = enriched.slice(0, topN);
  const validChanges = enriched.filter(item => item.changePct !== null);

  const gainers = [...validChanges]
    .filter(item => item.changePct > 0)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 3);

  const losers = [...validChanges]
    .filter(item => item.changePct < 0)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, 3);

  const summary = topList.reduce((acc, item) => {
    if (item.changePct === null) {
      acc.insufficient += 1;
    } else if (item.changePct > 0) {
      acc.up += 1;
    } else if (item.changePct < 0) {
      acc.down += 1;
    } else {
      acc.unchanged += 1;
    }

    if (item.isNewInTopN) {
      acc.newEntries += 1;
    }

    return acc;
  }, { up: 0, down: 0, unchanged: 0, insufficient: 0, newEntries: 0 });

  return {
    topList,
    gainers,
    losers,
    summary
  };
}

function formatIsoDate(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function formatIstTimestamp() {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date());
}

module.exports = {
  buildReportData,
  formatAbsoluteChange,
  formatIsoDate,
  formatIstTimestamp,
  formatNumber,
  formatPercent,
  readData
};
