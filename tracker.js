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

let old=[];

if(fs.existsSync("data.json")){
old=JSON.parse(fs.readFileSync("data.json"));
}

let jumps=[];

latest.forEach((x,i)=>{

const newRank=i+1;
const prev=old.find(z=>z.SecurityID==x.SecurityID);

if(prev && newRank < prev.rank){

jumps.push({
name:x.Nm,
from:prev.rank,
to:newRank,
mcap:x.MCap
});

}

});

let msg="";

if(jumps.length>0){

jumps.sort((a,b)=>(b.from-b.to)-(a.from-a.to));

const top=jumps[0];

msg =
`🚀 Biggest Mover Today

${top.name}
${top.from} ➜ ${top.to}
Jumped ${top.from-top.to} ranks`;

}else{

msg=`📊 Daily Update

Aaj koi jump nahi hai.`;

}

await client.messages.create({
from:process.env.TWILIO_FROM,
to:process.env.TWILIO_TO,
body:msg
});

fs.writeFileSync(
"data.json",
JSON.stringify(
latest.map((x,i)=>({
SecurityID:x.SecurityID,
rank:i+1,
mcap:x.MCap,
name:x.Nm
})),null,2
));

}

run();
