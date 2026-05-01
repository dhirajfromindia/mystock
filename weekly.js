const fs=require("fs");
const twilio=require("twilio");

const client=twilio(
process.env.TWILIO_ACCOUNT_SID,
process.env.TWILIO_AUTH_TOKEN
);

async function run(){

if(!fs.existsSync("data.json")){
return;
}

const data=JSON.parse(fs.readFileSync("data.json"));

const top5=data.slice(0,5).map((x,i)=>
`${i+1}. ${x.name}`
).join("\n");

await client.messages.create({
from:process.env.TWILIO_FROM,
to:process.env.TWILIO_TO,
body:
`📊 Weekly Summary

Current Top 5

${top5}`
});

}

run();
