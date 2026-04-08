import https from 'https';

async function fetchPage(url: string, headers: any): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  const feedUrl = "https://www.etenders.gov.za/Home/PaginatedTenderOpportunities?draw=1&start=0&length=10&status=1";
  
  console.log("Fetching feed...");
  const res = await fetch(feedUrl, {
    method: "GET",
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  const payload = await res.json();
  const rows = payload.data || [];
  
  if (rows.length > 0) {
    const r = rows[0];
    const detailsUrl = `https://www.etenders.gov.za/Home/TenderOpportunitiesDetails?id=${r.id}`;
    console.log(`Fetching details for ID ${r.id}...`);
    
    const html = await fetchPage(detailsUrl, {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    });
    
    const index = html.toLowerCase().indexOf('blobname=');
    if (index > -1) {
       console.log("Surrounding HTML:");
       console.log(html.substring(Math.max(0, index - 150), index + 150));
    } else {
       console.log("No blobName found! HTML length:", html.length);
       console.log(html.substring(0, 500));
    }
  }
}

main().catch(console.error);
