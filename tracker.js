const fs = require("fs");
const axios = require("axios");
const twilio = require("twilio");

const client = twilio(
 process.env.TWILIO_ACCOUNT_SID,
 process.env.TWILIO_AUTH_TOKEN
);

async function run(){

 const res = await axios.get(
 "https://api.stockedge.com/Api/SecurityDashboardApi/GetComposedIndexParts/14801"
 );

 const latest = res.data.sort((a,b)=>b.MCap-a.MCap);

 let old = [];

 if(fs.existsSync("data.json")){
   old = JSON.parse(fs.readFileSync("data.json"));
 }

 let alerts = [];

 latest.forEach((x,i)=>{

   let newRank = i+1;

   let prev = old.find(z => z.SecurityID == x.SecurityID);

   if(prev){

     if(prev.rank > 5 && newRank <=5)
       alerts.push(`${x.Nm} entered Top 5`);

     else if(prev.rank >10 && newRank <=10)
       alerts.push(`${x.Nm} entered Top 10`);

     else if(prev.rank >20 && newRank <=20)
       alerts.push(`${x.Nm} entered Top 20`);

   }

 });

 if(alerts.length > 0){

   await client.messages.create({
     from: process.env.TWILIO_FROM,
     to: process.env.TWILIO_TO,
     body:
`🚨 Market Cap Alert

${alerts.join("\n")}`
   });

   console.log("WhatsApp Sent");
 } else {
   console.log("No movement today");
 }

 fs.writeFileSync(
   "data.json",
   JSON.stringify(
     latest.map((x,i)=>({
       SecurityID:x.SecurityID,
       rank:i+1
     })), null, 2
   )
 );

}

run();
