import https from 'https';

async function fetchPage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  const tenderId = 151310; // I know this one has multiple from summarizing it, let me test another one that might have 1, or just print the first from a list.
  const feedUrl = "https://www.etenders.gov.za/Home/PaginatedTenderOpportunities?draw=1&start=0&length=10&status=1";
  
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
    const r = rows.find((x: any) => x.supportDocument && x.supportDocument.length === 1);
    if (!r) {
      console.log("No single-doc tenders found in first 10");
      return;
    }
    
    console.log(`Tender ${r.id} (${r.tender_No}) has ${r.supportDocument.length} docs in feed.`);
    
    // Now let's try to fetch the details page to see if there are more documents.
    const detailsUrl = `https://www.etenders.gov.za/Home/TenderOpportunitiesDetails?id=${r.id}`;
    console.log("Fetching details page:", detailsUrl);
    const html = await fetchPage(detailsUrl);
    
    // Quick regex to count document links
    const matches = html.match(/blobName=/g) || [];
    console.log(`Found ${matches.length} 'blobName' links in the detail page HTML.`);
  }
}

main().catch(console.error);
