const axios = require("axios");

async function run(){
 const res = await axios.get("https://api.stockedge.com/Api/SecurityDashboardApi/GetComposedIndexParts/14801");
 console.log("Total Companies:", res.data.length);
 console.log(res.data[0]);
}

run();
