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

function renderSummaryRow(label, value, color, bg) {
  return `
    <td style="padding:12px;border:1px solid #e5e7eb;background:${bg};">
      <div style="font-size:12px;color:#6b7280;">${label}</div>
      <div style="font-size:22px;font-weight:700;color:${color};margin-top:4px;">${value}</div>
    </td>
  `;
}

function renderMobileCard(item, periodLabel) {
  return `
    <div style="border:1px solid #dfe3e8;border-radius:10px;padding:12px;margin-bottom:12px;background:#fff;">
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

  const daysAgo = 30;
  const topN = Math.max(1, Math.min(data.length, Number(process.env.MONTHLY_TOP_N) || 20));
  const { topList, gainers, losers, summary } = buildReportData(data, daysAgo, topN);

  const cardsHtml = topList.map(item => renderMobileCard(item, "30d")).join("");

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
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:760px;margin:auto;background:white;border-collapse:collapse;border:1px solid #e5e7eb;">
    <tr>
      <td style="background:#198754;color:white;padding:18px 20px;text-align:center;font-size:22px;font-weight:bold;">
        Monthly Stock Summary
      </td>
    </tr>
    <tr>
      <td style="padding:20px;font-family: Arial, sans-serif;">
        <p style="font-size:14px;color:#555;margin-top:0;">
          Snapshot window: <b>${start}</b> to <b>${today}</b>. Generated in IST: <b>${istNow}</b>.
        </p>
        <p style="font-size:14px;color:#555;">
          Top <b>${topN}</b> companies with market-cap trend, absolute movement, and derived rank change.
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
          <tr>
            ${renderSummaryRow("Up", summary.up, "#198754", "#eefaf2")}
            ${renderSummaryRow("Down", summary.down, "#dc3545", "#fff1f1")}
          </tr>
          <tr>
            ${renderSummaryRow("Unchanged", summary.unchanged, "#495057", "#f5f6f8")}
            ${renderSummaryRow(`New In Top ${topN}`, summary.newEntries, "#9a6b00", "#fff8e6")}
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:18px;">
          <tr>
            <td style="padding:0 6px 0 0;vertical-align:top;">${renderMoverList("Top 3 Monthly Gainers", gainers)}</td>
            <td style="padding:0 0 0 6px;vertical-align:top;">${renderMoverList("Top 3 Monthly Losers", losers)}</td>
          </tr>
        </table>
        <div>
          ${cardsHtml}
        </div>
        <p style="margin-top:16px;font-size:12px;color:#777;">
          N/A means enough 30-day history is not available yet. Rank change is derived from the historical market-cap snapshot closest to 30 days ago.
        </p>
      </td>
    </tr>
  </table>
</div>
`;

  const text = `Monthly Stock Summary (${start} to ${today})\nGenerated in IST: ${istNow}\nSummary: ${summary.up} up, ${summary.down} down, ${summary.unchanged} unchanged, ${summary.newEntries} new in top ${topN}, ${summary.insufficient} with insufficient history.\n\n${moverText("Top 3 Monthly Gainers", gainers)}\n\n${moverText("Top 3 Monthly Losers", losers)}\n\nTop ${topN} Companies\n${rowsText}\n\nN/A means enough 30-day history is not available yet.`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.TO_EMAIL_LIST,
    subject: `Monthly Stock Summary ${start} to ${today}`,
    text,
    html
  });
}

run();
