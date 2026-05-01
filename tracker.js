const fs = require("fs");
const axios = require("axios");
const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function run() {

  const res = await axios.get(
    "https://api.stockedge.com/Api/SecurityDashboardApi/GetComposedIndexParts/14801"
  );

  const latest = res.data.sort((a,b)=>b.MCap-a.MCap);

  let old = [];

  if(fs.existsSync("data.json")){
    old = JSON.parse(fs.readFileSync("data.json"));
  }

  let lines = [];

  latest.forEach((x,i)=>{

    const newRank = i + 1;

    const prev = old.find(z => z.SecurityID == x.SecurityID);

    if(prev){

      // Only upward jump
      if(newRank < prev.rank){

        lines.push(
`${x.Nm}
${prev.rank} ➜ ${newRank}
(₹${prev.mcap.toFixed(0)} Cr ➜ ₹${x.MCap.toFixed(0)} Cr)`
        );

      }

    }

  });

  let msg = "";

  if(lines.length > 0){

    msg =
`📈 Market Cap Rank Alert

${lines.join("\n\n")}`;

  } else {

    msg =
`📊 Market Cap Daily Update

Aaj koi rank jump nahi hai.`;

  }

  await client.messages.create({
    from: process.env.TWILIO_FROM,
    to: process.env.TWILIO_TO,
    body: msg
  });

  console.log("WhatsApp Sent");

  // Save latest snapshot
  fs.writeFileSync(
    "data.json",
    JSON.stringify(
      latest.map((x,i)=>({
        SecurityID:x.SecurityID,
        rank:i+1,
        mcap:x.MCap
      })),
      null,
      2
    )
  );

}

run();
