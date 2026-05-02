const fs = require("fs");
const axios = require("axios");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const HISTORY_RETENTION_DAYS = 90;

async function sendEmail(msg) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.TO_EMAIL_LIST,
    subject: "Stock Tracker Update",
    text: msg
  });
}

function readExistingData() {
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

function buildHistory(previousHistory, dateStr, mcap) {
  const normalizedHistory = Array.isArray(previousHistory)
    ? previousHistory
        .filter(item => item && item.date && Number.isFinite(Number(item.mcap)))
        .map(item => ({
          date: item.date,
          mcap: Number(item.mcap)
        }))
    : [];

  const lastEntry = normalizedHistory[normalizedHistory.length - 1];
  if (lastEntry && lastEntry.date === dateStr) {
    lastEntry.mcap = mcap;
    return normalizedHistory.slice(-HISTORY_RETENTION_DAYS);
  }

  normalizedHistory.push({ date: dateStr, mcap });
  return normalizedHistory.slice(-HISTORY_RETENTION_DAYS);
}

async function run() {
  const res = await axios.get(process.env.STOCK_API_URL);
  const latest = res.data.sort((a, b) => b.MCap - a.MCap);
  const old = readExistingData();
  const dateStr = new Date().toISOString().slice(0, 10);

  const jumps = [];

  latest.forEach((x, i) => {
    const newRank = i + 1;
    const prev = old.find(z => z.SecurityID === x.SecurityID);

    if (prev && newRank < prev.rank) {
      jumps.push({
        name: x.Nm,
        from: prev.rank,
        to: newRank
      });
    }
  });

  let msg = "";

  if (jumps.length > 0) {
    jumps.sort((a, b) => (b.from - b.to) - (a.from - a.to));
    const top = jumps[0];

    msg = `Biggest Mover Today

${top.name}
${top.from} -> ${top.to}
Jumped ${top.from - top.to} ranks`;
  } else {
    msg = "Daily Update\n\nNo major movement today.";
  }

  await sendEmail(msg);

  const snapshot = latest.map((x, i) => ({
    SecurityID: x.SecurityID,
    rank: i + 1,
    mcap: Number(x.MCap),
    name: x.Nm,
    history: buildHistory(
      old.find(z => z.SecurityID === x.SecurityID)?.history,
      dateStr,
      Number(x.MCap)
    )
  }));

  fs.writeFileSync("data.json", JSON.stringify(snapshot, null, 2));
}

run();
