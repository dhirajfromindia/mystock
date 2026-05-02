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

async function sendEmail(msg) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.TO_EMAIL_LIST,
    subject: "📊 Stock Tracker Update",
    text: msg
  });
}

async function run() {

  const res = await axios.get(process.env.STOCK_API_URL);

  const latest = res.data.sort((a, b) => b.MCap - a.MCap);

  let old = [];

  if (fs.existsSync("data.json")) {
    old = JSON.parse(fs.readFileSync("data.json"));
  }

  let jumps = [];

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

    msg =
`🚀 Biggest Mover Today

${top.name}
${top.from} ➜ ${top.to}
Jumped ${top.from - top.to} ranks`;

  } else {
    msg = `📊 Daily Update\n\nNo major movement today.`;
  }

  await sendEmail(msg);

  // 💾 update file
  // create a snapshot array once and write both a current snapshot and a dated snapshot
  const snapshot = latest.map((x, i) => ({
    SecurityID: x.SecurityID,
    rank: i + 1,
    mcap: Number(x.MCap),
    name: x.Nm
  }));

  // write the canonical data.json used by other scripts
  fs.writeFileSync("data.json", JSON.stringify(snapshot, null, 2));

  // also save a dated snapshot for weekly comparisons
  const snapshotsDir = "snapshots";
  if (!fs.existsSync(snapshotsDir)) fs.mkdirSync(snapshotsDir, { recursive: true });
  const dateStr = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(`${snapshotsDir}/${dateStr}.json`, JSON.stringify(snapshot, null, 2));
}

run();
