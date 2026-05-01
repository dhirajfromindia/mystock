const twilio = require("twilio");

const client = twilio(
 process.env.TWILIO_ACCOUNT_SID,
 process.env.TWILIO_AUTH_TOKEN
);

async function run(){

 await client.messages.create({
   from: process.env.TWILIO_FROM,
   to: process.env.TWILIO_TO,
   body: "✅ Test WhatsApp from GitHub Actions"
 });

 console.log("Message Sent");

}

run();
