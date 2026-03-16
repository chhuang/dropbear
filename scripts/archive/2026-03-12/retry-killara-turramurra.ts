const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C';
const actorId = 'ErD1Yvg2Mvhxo0qCx';

const searchUrls = [
  'https://www.domain.com.au/sale/killara-nsw-2071/?excludeunderoffer=1&ssubs=0',
  'https://www.domain.com.au/sale/turramurra-nsw-2074/?excludeunderoffer=1&ssubs=0'
];

async function main() {
  console.log('Retrying Killara & Turramurra...');

  const res = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      searchUrls,
      maxItems: 50000,
      proxyConfiguration: { useApifyProxy: true }
    })
  });

  const data = await res.json();
  console.log('Run ID:', data.data?.id);
  console.log('Dataset ID:', data.data?.defaultDatasetId);
}

main().catch(console.error);
