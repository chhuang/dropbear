const APIFY_TOKEN = process.env.APIFY_TOKEN!;
const actorId = 'ErD1Yvg2Mvhxo0qCx';

// Top 10 stale suburbs with their postcodes
const suburbs = [
  { name: 'Manly', postcode: '2095' },
  { name: 'Surry Hills', postcode: '2010' },
  { name: 'Campsie', postcode: '2194' },
  { name: 'Darlinghurst', postcode: '2010' },
  { name: 'Ultimo', postcode: '2007' },
  { name: 'Redfern', postcode: '2016' },
  { name: 'Paddington', postcode: '2021' },
  { name: 'Glebe', postcode: '2037' },
  { name: 'Camperdown', postcode: '2050' },
  { name: 'Centennial Park', postcode: '2021' }
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
