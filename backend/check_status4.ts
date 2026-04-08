async function main() {
  const url = "https://www.etenders.gov.za/Home/PaginatedTenderOpportunities?draw=1&start=0&length=10&status=4";
  
  console.log("Fetching...", url);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0 (compatible; TenderLensBot/1.0)",
      },
      signal: AbortSignal.timeout(10000) // 10s timeout
    });
    console.log("Status:", res.status);
  } catch (err: any) {
    console.error("Fetch failed:", err.message);
  }
}

main().catch(console.error);
