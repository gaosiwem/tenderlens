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
  
  const index = html.indexOf('blobName=');
  if (index > -1) {
     console.log("Surrounding HTML:");
     console.log(html.substring(index - 150, index + 150));
  } else {
     console.log("No blobName found!");
  }
}

main().catch(console.error);
