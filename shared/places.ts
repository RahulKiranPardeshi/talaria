// Every place a job search can name: continents, regions, countries and their main cities.
// The location picker suggests from this list (forgiving typos), and the job filter uses it to
// know that "Nordics" covers a job in Stockholm and "Netherlands" one in Amsterdam.

export type PlaceKind = 'continent' | 'region' | 'country' | 'city';

export interface Place {
  name: string; // what is saved and shown: "Netherlands", "Amsterdam, Netherlands", "Nordics"
  kind: PlaceKind;
  hint: string; // the grey text next to it in the picker
  aliases: string[]; // other spellings and names people (and job postings) use
  terms: string[]; // lower-case words a job's location may contain for it to be in this place
}

const CONTINENTS = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'] as const;

// Regions: [name, aliases, member tags or continents]. EMEA, APAC and the Americas span continents.
const REGIONS: [string, string[], string[]][] = [
  ['European Union', ['EU'], ['eu']],
  ['Nordics', ['Nordic countries', 'Norden'], ['nordics']],
  ['Scandinavia', [], ['scand']],
  ['DACH', ['Germany, Austria, Switzerland'], ['dach']],
  ['Benelux', [], ['benelux']],
  ['Baltics', ['Baltic states'], ['baltics']],
  ['Iberia', ['Iberian Peninsula'], ['iberia']],
  ['UK & Ireland', ['British Isles'], ['ukie']],
  ['Central & Eastern Europe', ['CEE', 'Eastern Europe', 'Central Europe'], ['cee']],
  ['Middle East', ['MENA'], ['me']],
  ['Gulf (GCC)', ['GCC', 'Gulf'], ['gcc']],
  ['South Asia', [], ['sa']],
  ['Southeast Asia', ['SEA', 'ASEAN'], ['sea']],
  ['Latin America', ['LATAM', 'LatAm'], ['latam']],
  ['EMEA', ['Europe, Middle East & Africa'], ['Europe', 'Africa', 'me']],
  ['APAC', ['Asia Pacific', 'Asia-Pacific'], ['Asia', 'Oceania']],
  ['Americas', [], ['North America', 'South America']],
];

// Countries: name | continent | region tags | aliases | main cities (each "City" or "City/alias").
const COUNTRIES = `
Albania|Europe|cee||Tirana
Andorra|Europe|||
Austria|Europe|eu,dach|Österreich|Vienna/Wien,Graz,Linz,Salzburg,Innsbruck
Belarus|Europe|cee||Minsk
Belgium|Europe|eu,benelux|België,Belgique|Brussels/Bruxelles,Antwerp,Ghent,Leuven,Liège
Bosnia and Herzegovina|Europe|cee|Bosnia|Sarajevo
Bulgaria|Europe|eu,cee||Sofia,Plovdiv,Varna
Croatia|Europe|eu,cee|Hrvatska|Zagreb,Split
Cyprus|Europe|eu||Nicosia,Limassol
Czechia|Europe|eu,cee|Czech Republic,Czech|Prague/Praha,Brno,Ostrava
Denmark|Europe|eu,nordics,scand|Danmark|Copenhagen/København,Aarhus,Odense,Aalborg
Estonia|Europe|eu,baltics,cee|Eesti|Tallinn,Tartu
Finland|Europe|eu,nordics|Suomi|Helsinki,Espoo,Tampere,Oulu,Turku
France|Europe|eu||Paris,Lyon,Marseille,Toulouse,Nice,Nantes,Bordeaux,Lille,Grenoble,Sophia Antipolis
Germany|Europe|eu,dach|Deutschland|Berlin,Munich/München,Hamburg,Frankfurt,Cologne/Köln,Stuttgart,Düsseldorf,Leipzig,Dresden,Karlsruhe,Hanover/Hannover,Nuremberg/Nürnberg,Bonn,Aachen,Heidelberg
Greece|Europe|eu|Hellas|Athens,Thessaloniki
Hungary|Europe|eu,cee|Magyarország|Budapest,Debrecen
Iceland|Europe|nordics|Ísland|Reykjavík/Reykjavik
Ireland|Europe|eu,ukie|Éire|Dublin,Cork,Galway,Limerick
Italy|Europe|eu|Italia|Milan/Milano,Rome/Roma,Turin/Torino,Bologna,Florence/Firenze,Naples/Napoli
Kosovo|Europe|cee||Pristina
Latvia|Europe|eu,baltics,cee|Latvija|Riga
Liechtenstein|Europe|dach||Vaduz
Lithuania|Europe|eu,baltics,cee|Lietuva|Vilnius,Kaunas
Luxembourg|Europe|eu,benelux||Luxembourg City
Malta|Europe|eu||Valletta
Moldova|Europe|cee||Chișinău/Chisinau
Monaco|Europe|||
Montenegro|Europe|cee||Podgorica
Netherlands|Europe|eu,benelux|Holland,The Netherlands,Nederland|Amsterdam,Rotterdam,The Hague/Den Haag,Utrecht,Eindhoven,Delft,Leiden,Groningen,Nijmegen
North Macedonia|Europe|cee|Macedonia|Skopje
Norway|Europe|nordics,scand|Norge|Oslo,Bergen,Trondheim,Stavanger
Poland|Europe|eu,cee|Polska|Warsaw/Warszawa,Kraków/Krakow,Wrocław/Wroclaw,Gdańsk/Gdansk,Poznań/Poznan,Łódź/Lodz,Katowice
Portugal|Europe|eu,iberia||Lisbon/Lisboa,Porto,Braga,Coimbra
Romania|Europe|eu,cee|România|Bucharest/București,Cluj-Napoca,Iași/Iasi,Timișoara/Timisoara
Russia|Europe||Russian Federation|Moscow,Saint Petersburg
San Marino|Europe|||
Serbia|Europe|cee|Srbija|Belgrade,Novi Sad
Slovakia|Europe|eu,cee|Slovensko|Bratislava,Košice/Kosice
Slovenia|Europe|eu,cee|Slovenija|Ljubljana
Spain|Europe|eu,iberia|España|Madrid,Barcelona,Valencia,Seville/Sevilla,Málaga/Malaga,Bilbao
Sweden|Europe|eu,nordics,scand|Sverige|Stockholm,Gothenburg/Göteborg,Malmö/Malmo,Uppsala,Lund,Linköping/Linkoping,Västerås/Vasteras,Umeå/Umea,Södertälje/Sodertalje,Örebro/Orebro,Jönköping/Jonkoping
Switzerland|Europe|dach|Schweiz,Suisse,Svizzera|Zurich/Zürich,Geneva/Genève,Basel,Lausanne,Bern,Zug,Lugano
Ukraine|Europe|cee|Україна|Kyiv/Kiev,Lviv,Kharkiv,Odesa/Odessa,Dnipro
United Kingdom|Europe|ukie|UK,Great Britain,Britain,England,Scotland,Wales,Northern Ireland|London,Manchester,Edinburgh,Cambridge,Oxford,Bristol,Birmingham,Glasgow,Leeds,Belfast,Reading,Cardiff
Turkey|Asia|me|Türkiye,Turkiye|Istanbul,Ankara,Izmir
Afghanistan|Asia|sa||Kabul
Armenia|Asia|||Yerevan
Azerbaijan|Asia|||Baku
Bahrain|Asia|me,gcc||Manama
Bangladesh|Asia|sa||Dhaka,Chittagong
Bhutan|Asia|sa||Thimphu
Brunei|Asia|sea||
Cambodia|Asia|sea||Phnom Penh
China|Asia||PRC,Mainland China|Beijing,Shanghai,Shenzhen,Guangzhou,Hangzhou,Chengdu,Nanjing,Wuhan,Suzhou
Georgia|Asia|||Tbilisi
Hong Kong|Asia||HK,Hong Kong SAR|
India|Asia|sa|Bharat|Bengaluru/Bangalore,Hyderabad,Pune,Mumbai/Bombay,Delhi/New Delhi,Gurugram/Gurgaon,Noida,Chennai/Madras,Kolkata/Calcutta,Ahmedabad,Kochi/Cochin,Jaipur,Chandigarh,Indore,Coimbatore,Thiruvananthapuram/Trivandrum
Indonesia|Asia|sea||Jakarta,Bandung,Surabaya,Bali
Iran|Asia|me||Tehran
Iraq|Asia|me||Baghdad,Erbil
Israel|Asia|me||Tel Aviv,Jerusalem,Haifa,Herzliya
Japan|Asia||Nippon|Tokyo,Osaka,Kyoto,Yokohama,Fukuoka,Nagoya
Jordan|Asia|me||Amman
Kazakhstan|Asia|||Almaty,Astana
Kuwait|Asia|me,gcc||Kuwait City
Kyrgyzstan|Asia|||Bishkek
Laos|Asia|sea||Vientiane
Lebanon|Asia|me||Beirut
Macau|Asia||Macao|
Malaysia|Asia|sea||Kuala Lumpur,Penang,Cyberjaya,Johor Bahru
Maldives|Asia|sa||Malé
Mongolia|Asia|||Ulaanbaatar
Myanmar|Asia|sea|Burma|Yangon
Nepal|Asia|sa||Kathmandu
Oman|Asia|me,gcc||Muscat
Pakistan|Asia|sa||Karachi,Lahore,Islamabad
Palestine|Asia|me||Ramallah
Philippines|Asia|sea||Manila,Cebu,Makati,Taguig
Qatar|Asia|me,gcc||Doha
Saudi Arabia|Asia|me,gcc|KSA,Saudi|Riyadh,Jeddah,Dammam
Singapore|Asia|sea|SG|
South Korea|Asia||Korea,Republic of Korea|Seoul,Busan,Pangyo
Sri Lanka|Asia|sa||Colombo
Taiwan|Asia|||Taipei,Hsinchu,Taichung
Tajikistan|Asia|||Dushanbe
Thailand|Asia|sea||Bangkok,Chiang Mai
Timor-Leste|Asia|sea|East Timor|
Turkmenistan|Asia|||Ashgabat
United Arab Emirates|Asia|me,gcc|UAE,Emirates|Dubai,Abu Dhabi,Sharjah
Uzbekistan|Asia|||Tashkent
Vietnam|Asia|sea|Viet Nam|Ho Chi Minh City/Saigon,Hanoi,Da Nang
Yemen|Asia|me||
Algeria|Africa|me||Algiers
Angola|Africa|||Luanda
Benin|Africa|||
Botswana|Africa|||Gaborone
Burkina Faso|Africa|||
Burundi|Africa|||
Cameroon|Africa|||Douala,Yaoundé
Cape Verde|Africa||Cabo Verde|
Central African Republic|Africa|||
Chad|Africa|||
Comoros|Africa|||
Congo|Africa||Republic of the Congo|
DR Congo|Africa||Democratic Republic of the Congo,DRC|Kinshasa
Djibouti|Africa|||
Egypt|Africa|me||Cairo,Alexandria
Equatorial Guinea|Africa|||
Eritrea|Africa|||
Eswatini|Africa||Swaziland|
Ethiopia|Africa|||Addis Ababa
Gabon|Africa|||
Gambia|Africa|||
Ghana|Africa|||Accra,Kumasi
Guinea|Africa|||
Guinea-Bissau|Africa|||
Ivory Coast|Africa||Côte d'Ivoire,Cote d'Ivoire|Abidjan
Kenya|Africa|||Nairobi,Mombasa
Lesotho|Africa|||
Liberia|Africa|||
Libya|Africa|me||Tripoli
Madagascar|Africa|||
Malawi|Africa|||
Mali|Africa|||
Mauritania|Africa|||
Mauritius|Africa|||Port Louis
Morocco|Africa|me||Casablanca,Rabat,Marrakesh
Mozambique|Africa|||Maputo
Namibia|Africa|||Windhoek
Niger|Africa|||
Nigeria|Africa|||Lagos,Abuja,Ibadan
Rwanda|Africa|||Kigali
São Tomé and Príncipe|Africa||Sao Tome and Principe|
Senegal|Africa|||Dakar
Seychelles|Africa|||
Sierra Leone|Africa|||
Somalia|Africa|||
South Africa|Africa||RSA|Johannesburg,Cape Town,Durban,Pretoria
South Sudan|Africa|||
Sudan|Africa|||Khartoum
Tanzania|Africa|||Dar es Salaam,Dodoma
Togo|Africa|||
Tunisia|Africa|me||Tunis
Uganda|Africa|||Kampala
Zambia|Africa|||Lusaka
Zimbabwe|Africa|||Harare
Canada|North America|||Toronto,Vancouver,Montreal/Montréal,Ottawa,Calgary,Edmonton,Waterloo,Quebec City
United States|North America||USA,US,U.S.,United States of America,America|New York/NYC,San Francisco/SF,Seattle,Austin,Boston,Los Angeles/LA,Chicago,San Jose,Palo Alto,Mountain View,Sunnyvale,Menlo Park,Washington DC/Washington D.C.,Atlanta,Denver,Miami,Dallas,Houston,San Diego,Pittsburgh,Philadelphia,Portland,Raleigh,Salt Lake City,Minneapolis,Detroit,Phoenix
Mexico|North America|latam|México|Mexico City/CDMX,Guadalajara,Monterrey
Antigua and Barbuda|North America|||
Bahamas|North America|||
Barbados|North America|||
Belize|North America|latam||
Costa Rica|North America|latam||San José
Cuba|North America|latam||Havana
Dominica|North America|||
Dominican Republic|North America|latam||Santo Domingo
El Salvador|North America|latam||San Salvador
Grenada|North America|||
Guatemala|North America|latam||Guatemala City
Haiti|North America|||
Honduras|North America|latam||Tegucigalpa
Jamaica|North America|||Kingston
Nicaragua|North America|latam||Managua
Panama|North America|latam||Panama City
Puerto Rico|North America|latam||San Juan
Saint Lucia|North America|||
Trinidad and Tobago|North America|||Port of Spain
Argentina|South America|latam||Buenos Aires,Córdoba/Cordoba,Rosario,Mendoza
Bolivia|South America|latam||La Paz,Santa Cruz
Brazil|South America|latam|Brasil|São Paulo/Sao Paulo,Rio de Janeiro,Belo Horizonte,Brasília/Brasilia,Curitiba,Porto Alegre,Recife,Florianópolis/Florianopolis
Chile|South America|latam||Santiago,Valparaíso/Valparaiso
Colombia|South America|latam||Bogotá/Bogota,Medellín/Medellin,Cali
Ecuador|South America|latam||Quito,Guayaquil
Guyana|South America|||
Paraguay|South America|latam||Asunción/Asuncion
Peru|South America|latam|Perú|Lima
Suriname|South America|||
Uruguay|South America|latam||Montevideo
Venezuela|South America|latam||Caracas
Australia|Oceania||AU|Sydney,Melbourne,Brisbane,Perth,Adelaide,Canberra
Fiji|Oceania|||Suva
New Zealand|Oceania||NZ,Aotearoa|Auckland,Wellington,Christchurch
Papua New Guinea|Oceania|||Port Moresby
Samoa|Oceania|||
Tonga|Oceania|||
Vanuatu|Oceania|||
`;

const lower = (s: string) => s.toLowerCase();
const split = (s: string, sep: string) => (s ? s.split(sep).map(x => x.trim()).filter(Boolean) : []);

function build(): Place[] {
  type Row = { name: string; continent: string; tags: string[]; aliases: string[]; cities: { name: string; aliases: string[] }[] };
  const rows: Row[] = COUNTRIES.trim()
    .split('\n')
    .map(line => {
      const [name, continent, tags, aliases, cities] = line.split('|');
      return {
        name,
        continent,
        tags: split(tags, ','),
        aliases: split(aliases, ','),
        cities: split(cities, ',').map(c => {
          const [n, ...a] = c.split('/');
          return { name: n, aliases: a };
        }),
      };
    });
  const termsOf = (r: Row) => [r.name, ...r.aliases, ...r.cities.flatMap(c => [c.name, ...c.aliases])].map(lower);
  const out: Place[] = [];

  for (const c of CONTINENTS) {
    const members = rows.filter(r => r.continent === c);
    out.push({ name: c, kind: 'continent', hint: 'Continent', aliases: [], terms: [lower(c), ...members.flatMap(termsOf)] });
  }
  for (const [name, aliases, from] of REGIONS) {
    const members = rows.filter(r => from.some(f => r.tags.includes(f) || r.continent === f));
    const shown = members.slice(0, 4).map(r => r.name);
    out.push({
      name,
      kind: 'region',
      hint: `Region · ${shown.join(', ')}${members.length > shown.length ? ', …' : ''}`,
      aliases,
      terms: [name, ...aliases].map(lower).concat(members.flatMap(termsOf)),
    });
  }
  for (const r of rows) out.push({ name: r.name, kind: 'country', hint: `Country · ${r.continent}`, aliases: r.aliases, terms: termsOf(r) });
  for (const r of rows)
    for (const city of r.cities) {
      // A city-state's capital ("Luxembourg City") still belongs to the country.
      out.push({ name: `${city.name}, ${r.name}`, kind: 'city', hint: `City · ${r.name}`, aliases: city.aliases, terms: [city.name, ...city.aliases].map(lower) });
    }
  return out;
}

export const PLACES: Place[] = build();

const byName = new Map<string, Place>();
for (const p of PLACES) {
  byName.set(lower(p.name), p);
  for (const a of p.aliases) if (!byName.has(lower(a))) byName.set(lower(a), p);
  if (p.kind === 'city') {
    const city = lower(p.name.split(',')[0]);
    if (!byName.has(city)) byName.set(city, p);
  }
}

/** The place a saved location refers to ("Netherlands", "holland", "Amsterdam", "Amsterdam, Netherlands"), if Talaria knows it. */
export function findPlace(text: string): Place | undefined {
  const t = lower(text.trim());
  return byName.get(t) || byName.get(t.split(',')[0].trim());
}

/** The regions and continent a place is part of ("Stockholm" is in Sweden, the Nordics, the EU, Europe, EMEA…). */
export function placesContaining(place: Place): Place[] {
  const own = place.terms[0];
  return PLACES.filter(p => p !== place && p.kind !== 'city' && p.terms.includes(own));
}

// ---------------- search, forgiving typos ----------------

const fold = (s: string) => lower(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Edit distance with transpositions, stopping early once it's clearly too far. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      best = Math.min(best, v);
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

const KIND_ORDER: Record<PlaceKind, number> = { country: 0, continent: 1, region: 2, city: 3 };

function score(q: string, p: Place): number {
  let best = 0;
  [p.name, ...p.aliases].forEach((raw, i) => {
    const n = fold(raw);
    // A place's own name beats one of its other names ("Europe" over "Europe, Middle East & Africa").
    const own = i === 0 ? 0 : 5;
    if (n === q) best = Math.max(best, 100 - own);
    else if (n.startsWith(q)) best = Math.max(best, 80 - own);
    else if (n.split(/[\s,&()-]+/).some(w => w.startsWith(q))) best = Math.max(best, 60 - own);
    else if (q.length >= 3 && n.includes(q)) best = Math.max(best, 40 - own);
    else if (q.length >= 4) {
      // Typos: compare with the start of the name, about as long as what was typed ("netherlnds", "swedn").
      const allowed = q.length >= 7 ? 2 : 1;
      const d = Math.min(distance(q, n.slice(0, q.length), allowed), distance(q, n.slice(0, q.length + 1), allowed), distance(q, n, allowed));
      if (d <= allowed) best = Math.max(best, 30 - d * 5 - own);
    }
  });
  return best;
}

/** Places matching what's been typed so far, best first: countries before regions before cities on a tie. */
export function searchPlaces(query: string, limit = 8): Place[] {
  const q = fold(query.trim());
  if (!q) return [];
  return PLACES.map(p => ({ p, s: score(q, p) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || KIND_ORDER[a.p.kind] - KIND_ORDER[b.p.kind] || a.p.name.length - b.p.name.length)
    .slice(0, limit)
    .map(x => x.p);
}
