const APIFY_TOKEN = '6vBNK4evANPCjs9WMur2SkD6C';
const actorId = 'ErD1Yvg2Mvhxo0qCx';

// Next 10 stale suburbs
const suburbs = [
  { name: 'Elizabeth Bay', postcode: '2011' },
  { name: 'Rushcutters Bay', postcode: '2011' },
  { name: 'St Peters', postcode: '2044' },
  { name: 'Woolloomooloo', postcode: '2011' },
  { name: 'Millers Point', postcode: '2000' },
  { name: 'The Rocks', postcode: '2000' },
  { name: 'Forest Lodge', postcode: '2037' },
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
  console.log('Starting batch scrape for', suburbs.length, 'suburbs...');
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
  console.log('\nApify response:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
