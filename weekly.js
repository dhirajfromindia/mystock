const nodemailer = require("nodemailer");
const {
  buildReportData,
  formatAbsoluteChange,
  formatIsoDate,
  formatIstTimestamp,
  formatNumber,
  formatPercent,
  readData
} = require("./report-utils");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function changeHtml(changePct) {
  if (changePct === null) return "N/A";
  const isUp = changePct >= 0;
  const color = isUp ? "#198754" : "#dc3545";
  const arrow = isUp ? "&uarr;" : "&darr;";
  return `<span style="color:${color};font-weight:600;">${arrow} ${Math.abs(changePct).toFixed(2)}%</span>`;
}

function changeCellStyle(changePct) {
  if (changePct === null) return "";
  return `background:${changePct >= 0 ? "#eefaf2" : "#fff1f1"};`;
}

function renderMoverList(title, items) {
  if (items.length === 0) {
    return `
      <div class="mover-card" style="flex:1;min-width:240px;border:1px solid #e5e7eb;border-radius:10px;padding:14px;background:#fafafa;">
        <div style="font-weight:700;margin-bottom:8px;">${title}</div>
        <div style="font-size:13px;color:#666;">No data available yet.</div>
      </div>
    `;
  }

  const rows = items.map(item => `
    <li style="margin-bottom:8px;">
      <b>${item.name}</b><br />
      <span style="font-size:13px;color:#555;">${formatPercent(item.changePct)} | ${formatAbsoluteChange(item.absoluteChange)}</span>
    </li>
  `).join("");

  return `
    <div class="mover-card" style="flex:1;min-width:240px;border:1px solid #e5e7eb;border-radius:10px;padding:14px;background:#fafafa;">
      <div style="font-weight:700;margin-bottom:8px;">${title}</div>
      <ol style="margin:0;padding-left:18px;font-size:14px;color:#222;">
        ${rows}
      </ol>
    </div>
  `;
}

function renderDesktopRow(item) {
  return `
    <tr>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;font-weight:700;">${item.currentRank}</td>
      <td style="padding:10px;border:1px solid #ddd;line-height:1.4;">
        ${item.name}${item.isNewInTopN ? ' <span style="background:#fff3cd;color:#7a5d00;font-size:11px;padding:2px 6px;border-radius:999px;">New</span>' : ""}
      </td>
      <td style="padding:10px;border:1px solid #ddd;text-align:right;">${formatNumber(item.mcap)}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:right;">${formatNumber(item.previousMcap)}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:right;${changeCellStyle(item.changePct)}">${formatAbsoluteChange(item.absoluteChange)}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;${changeCellStyle(item.changePct)}">${changeHtml(item.changePct)}</td>
      <td style="padding:10px;border:1px solid #ddd;text-align:center;">${item.rankChangeText}</td>
    </tr>
  `;
}

function renderMobileCard(item, periodLabel) {
  return `
    <div class="mobile-card" style="display:none;border:1px solid #dfe3e8;border-radius:10px;padding:12px;margin-bottom:12px;background:#fff;">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:10px;">
        <div style="font-size:15px;font-weight:700;color:#111;">#${item.currentRank} ${item.name}</div>
        ${item.isNewInTopN ? '<span style="background:#fff3cd;color:#7a5d00;font-size:11px;padding:2px 6px;border-radius:999px;white-space:nowrap;">New</span>' : ""}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="padding:6px 0;color:#6b7280;width:44%;">Current MCap</td>
          <td style="padding:6px 0;text-align:right;font-weight:700;">${formatNumber(item.mcap)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280;">Previous MCap</td>
          <td style="padding:6px 0;text-align:right;">${formatNumber(item.previousMcap)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280;">Abs Change</td>
          <td style="padding:6px 0;text-align:right;">${formatAbsoluteChange(item.absoluteChange)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280;">Change (${periodLabel})</td>
          <td style="padding:6px 0;text-align:right;">${changeHtml(item.changePct)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#6b7280;">Rank Change</td>
          <td style="padding:6px 0;text-align:right;">${item.rankChangeText}</td>
        </tr>
      </table>
    </div>
  `;
}

async function run() {
  const data = readData();
  if (data.length === 0) return;

  const daysAgo = 7;
  const topN = Math.max(1, Math.min(data.length, Number(process.env.WEEKLY_TOP_N) || 20));
  const { topList, gainers, losers, summary } = buildReportData(data, daysAgo, topN);

  const rowsHtml = topList.map(renderDesktopRow).join("");
  const mobileCardsHtml = topList.map(item => renderMobileCard(item, "7d")).join("");

  const rowsText = topList.map(item => {
    const marker = item.isNewInTopN ? " [New]" : "";
    return `${item.currentRank}. ${item.name}${marker} | Current: ${formatNumber(item.mcap)} | Previous: ${formatNumber(item.previousMcap)} | Abs: ${formatAbsoluteChange(item.absoluteChange)} | Change: ${formatPercent(item.changePct)} | Rank: ${item.rankChangeText}`;
  }).join("\n");

  const moverText = (title, items) => {
    if (items.length === 0) return `${title}: No data available yet.`;
    return `${title}:\n${items.map((item, index) => `${index + 1}. ${item.name} (${formatPercent(item.changePct)}, ${formatAbsoluteChange(item.absoluteChange)})`).join("\n")}`;
  };

  const today = formatIsoDate(0);
  const start = formatIsoDate(daysAgo);
  const istNow = formatIstTimestamp();

  const html = `
<div style="font-family: Arial, sans-serif; background:#f4f6f9; padding:12px;">
  <style>
    @media only screen and (max-width: 640px) {
      .report-shell { width: 100% !important; border-radius: 0 !important; }
      .report-body { padding: 14px !important; }
      .summary-card { min-width: calc(50% - 8px) !important; }
      .mover-card { min-width: 100% !important; }
      .desktop-table-wrap { display: none !important; max-height: 0 !important; overflow: hidden !important; }
      .mobile-card { display: block !important; }
    }
  </style>
  <div class="report-shell" style="max-width:980px;margin:auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.08);">
    <div style="background:#0d6efd;color:white;padding:18px 20px;text-align:center;font-size:22px;font-weight:bold;">
      Weekly Stock Summary
    </div>
    <div class="report-body" style="padding:20px;">
      <p style="font-size:14px;color:#555;margin-top:0;">
        Snapshot window: <b>${start}</b> to <b>${today}</b>. Generated in IST: <b>${istNow}</b>.
      </p>
      <p style="font-size:14px;color:#555;">
        Top <b>${topN}</b> companies with market-cap trend, absolute movement, and derived rank change.
      </p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin:16px 0;">
        <div class="summary-card" style="flex:1;min-width:160px;background:#eefaf2;border:1px solid #d6f0df;border-radius:10px;padding:12px;">
          <div style="font-size:12px;color:#4d6b57;">Up</div>
          <div style="font-size:22px;font-weight:700;color:#198754;">${summary.up}</div>
        </div>
        <div class="summary-card" style="flex:1;min-width:160px;background:#fff1f1;border:1px solid #f1d3d3;border-radius:10px;padding:12px;">
          <div style="font-size:12px;color:#7d5a5a;">Down</div>
          <div style="font-size:22px;font-weight:700;color:#dc3545;">${summary.down}</div>
        </div>
        <div class="summary-card" style="flex:1;min-width:160px;background:#f5f6f8;border:1px solid #e4e6eb;border-radius:10px;padding:12px;">
          <div style="font-size:12px;color:#626a73;">Unchanged</div>
          <div style="font-size:22px;font-weight:700;color:#495057;">${summary.unchanged}</div>
        </div>
        <div class="summary-card" style="flex:1;min-width:160px;background:#fff8e6;border:1px solid #f5e3a9;border-radius:10px;padding:12px;">
          <div style="font-size:12px;color:#7a5d00;">New In Top ${topN}</div>
          <div style="font-size:22px;font-weight:700;color:#9a6b00;">${summary.newEntries}</div>
        </div>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px;">
        ${renderMoverList("Top 3 Weekly Gainers", gainers)}
        ${renderMoverList("Top 3 Weekly Losers", losers)}
      </div>
      <div class="desktop-table-wrap">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f1f3f5;">
              <th style="padding:10px;border:1px solid #ddd;">Rank</th>
              <th style="padding:10px;border:1px solid #ddd;">Company</th>
              <th style="padding:10px;border:1px solid #ddd;">Current MCap</th>
              <th style="padding:10px;border:1px solid #ddd;">Previous MCap</th>
              <th style="padding:10px;border:1px solid #ddd;">Abs Change</th>
              <th style="padding:10px;border:1px solid #ddd;">Change (7d)</th>
              <th style="padding:10px;border:1px solid #ddd;">Rank Change</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
      <div>
        ${mobileCardsHtml}
      </div>
      <p style="margin-top:16px;font-size:12px;color:#777;">
        N/A means enough 7-day history is not available yet. Rank change is derived from the historical market-cap snapshot closest to 7 days ago.
      </p>
    </div>
  </div>
</div>
`;

  const text = `Weekly Stock Summary (${start} to ${today})\nGenerated in IST: ${istNow}\nSummary: ${summary.up} up, ${summary.down} down, ${summary.unchanged} unchanged, ${summary.newEntries} new in top ${topN}, ${summary.insufficient} with insufficient history.\n\n${moverText("Top 3 Weekly Gainers", gainers)}\n\n${moverText("Top 3 Weekly Losers", losers)}\n\nTop ${topN} Companies\n${rowsText}\n\nN/A means enough 7-day history is not available yet.`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.TO_EMAIL_LIST,
    subject: `Weekly Stock Summary ${start} to ${today}`,
    text,
    html
  });
}

run();
