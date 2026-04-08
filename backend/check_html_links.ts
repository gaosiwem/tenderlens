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
  
  const regex = /<a[^>]*href="([^"]*home\/Download\/\?blobName=[^"]+)"[^>]*>(.*?)<\/a>/gi;
  let match;
  console.log("Matches found:");
  while ((match = regex.exec(html)) !== null) {
    console.log("-------------------");
    console.log("HREF:", match[1]);
    console.log("TEXT:", match[2].trim());
  }
}

main().catch(console.error);
