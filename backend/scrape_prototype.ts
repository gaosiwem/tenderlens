import https from 'https';
import { parse } from 'node-html-parser'; // Assuming node-html-parser might be available? We'll see. Or regex.

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
  const tenderId = 151220; // Example
  const detailsUrl = `https://www.etenders.gov.za/Home/TenderOpportunitiesDetails?id=${tenderId}`;
  
  const html = await fetchPage(detailsUrl);
  
  console.log("HTML length:", html.length);
  
  // Find all links containing 'home/Download/?blobName='
  const regex = /href="([^"]*home\/Download\/\?blobName=[^"]+)"/gi;
  let match;
  const docs = [];
  while ((match = regex.exec(html)) !== null) {
    // The match[1] is the URL path.
    // E.g. /home/Download/?blobName=...&downloadedFileName=...
    const urlStr = match[1].startsWith('http') ? match[1] : `https://www.etenders.gov.za${match[1]}`;
    docs.push(urlStr);
  }
  
  console.log("Found Document URLs:");
  for (const doc of docs) {
     console.log(" - ", doc);
  }
}

main().catch(console.error);
