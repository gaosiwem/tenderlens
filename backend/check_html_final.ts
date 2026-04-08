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
  const tenderId = 151220; 
  const detailsUrl = `https://www.etenders.gov.za/Home/TenderOpportunitiesDetails?id=${tenderId}`;
  
  const html = await fetchPage(detailsUrl);
  
  // Let's just grab the whole A tag block
  const index = html.indexOf('blobName=');
  if (index > -1) {
     console.log("HTML Surroundings:");
     console.log(html.substring(Math.max(0, index - 200), index + 200));
  } else {
     console.log("Not found in HTML!");
  }
}

main().catch(console.error);
