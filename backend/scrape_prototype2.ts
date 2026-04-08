async function main() {
  const tenderId = 151220; // Example
  const detailsUrl = `https://www.etenders.gov.za/Home/TenderOpportunitiesDetails?id=${tenderId}`;
  
  const res = await fetch(detailsUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  
  const html = await res.text();
  console.log("HTML length:", html.length);
  
  const regex = /href="([^"]*home\/Download\/\?blobName=[^"]+)"/gi;
  let match;
  const docs = [];
  while ((match = regex.exec(html)) !== null) {
    const urlStr = match[1].startsWith('http') ? match[1] : `https://www.etenders.gov.za${match[1]}`;
    docs.push(urlStr);
  }
  
  console.log("Found Document URLs:");
  for (const doc of docs) {
     console.log(" - ", doc);
  }
}

main().catch(console.error);
