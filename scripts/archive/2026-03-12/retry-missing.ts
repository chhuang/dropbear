const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C';
const actorId = 'ErD1Yvg2Mvhxo0qCx';

// Retry the 3 missing suburbs
const suburbs = [
  { name: 'Killara', postcode: '2071' },
  { name: 'Pymble', postcode: '2073' },
  { name: 'Turramurra', postcode: '2074' }
];

function toSlug(name: string) {
  return name.toLowerCase().replace(/ /g, '-');
}

const searchUrls = suburbs.map(s => 
  `https://www.domain.com.au/sale/${toSlug(s.name)}-nsw-${s.postcode}/?excludeunderoffer=1&ssubs=0`
);

async function main() {
  console.log('Retrying 3 missing suburbs...');
  console.log('URLs:', searchUrls);

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
  console.log('\nRun ID:', data.data?.id);
  console.log('Dataset ID:', data.data?.defaultDatasetId);
}

main().catch(console.error);
