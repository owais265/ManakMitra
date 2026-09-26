export type Lab = {
  id: string;
  name: string;
  address: string;
  city: string;
  pin: string;
  phone: string;
  email: string;
  lat: number;
  lng: number;
  confidence: "high" | "low";
};

export type RankedLab = Lab & { km: number; productHit?: boolean };

/** BIS own laboratories published on LIMS. Pins are the published locality, not a surveyed gate. */
export const BIS_LABS: Lab[] = [
  {
    id: "CL",
    name: "BIS Central Laboratory, Sahibabad",
    address: "20/9, Site IV, Sahibabad Industrial Area, Ghaziabad, Uttar Pradesh 201010",
    city: "Ghaziabad",
    pin: "201010",
    phone: "0120-2811989",
    email: "sample@bis.gov.in",
    lat: 28.6702,
    lng: 77.3475,
    confidence: "high",
  },
  {
    id: "WRL",
    name: "BIS Western Regional Laboratory, Mumbai",
    address: "Plot E-9, Road 8, MIDC, Andheri East, Mumbai, Maharashtra 400093",
    city: "Mumbai",
    pin: "400093",
    phone: "022-28329295",
    email: "wrol@bis.gov.in",
    lat: 19.1176,
    lng: 72.8694,
    confidence: "high",
  },
  {
    id: "ERL",
    name: "BIS Eastern Regional Laboratory, Kolkata",
    address: "P-230, CIT Scheme VII M, Block W, Kankurgachi, Kolkata, West Bengal 700054",
    city: "Kolkata",
    pin: "700054",
    phone: "033-23208561",
    email: "sample.erol@bis.gov.in",
    lat: 22.5803,
    lng: 88.3901,
    confidence: "high",
  },
  {
    id: "SRL",
    name: "BIS Southern Regional Laboratory, Chennai",
    address: "IV Cross Road, CIT Campus, Taramani, Chennai, Tamil Nadu 600113",
    city: "Chennai",
    pin: "600113",
    phone: "044-22541208",
    email: "srol@bis.gov.in",
    lat: 12.987,
    lng: 80.2395,
    confidence: "high",
  },
  {
    id: "NRL",
    name: "BIS Northern Regional Laboratory, Mohali",
    address: "B-69, Industrial Focal Point, Phase VII, SAS Nagar, Mohali, Punjab 160059",
    city: "Mohali",
    pin: "160059",
    phone: "0172-4802676",
    email: "nrolsample@bis.gov.in",
    lat: 30.7046,
    lng: 76.7179,
    confidence: "high",
  },
  {
    id: "BNBL",
    name: "BIS Bengaluru Branch Laboratory",
    address: "Peenya Industrial Area, 1st Stage, Tumkur Road, Bengaluru, Karnataka 560058",
    city: "Bengaluru",
    pin: "560058",
    phone: "080-29908860",
    email: "bnbol@bis.gov.in",
    lat: 13.03893,
    lng: 77.519505,
    confidence: "high",
  },
  {
    id: "HYBL",
    name: "BIS Hyderabad Branch Laboratory",
    address: "Plot 1, Survey 367/1, Moula Ali, Hyderabad, Telangana 500040",
    city: "Hyderabad",
    pin: "500040",
    phone: "9952993252",
    email: "hybl@bis.gov.in",
    lat: 17.46171,
    lng: 78.55714,
    confidence: "high",
  },
  {
    id: "PBL",
    name: "BIS Patna Branch Laboratory",
    address: "Patliputra Industrial Estate, Patna, Bihar 800013",
    city: "Patna",
    pin: "800013",
    phone: "0612-2262808",
    email: "pbol@bis.gov.in",
    lat: 25.6334,
    lng: 85.087,
    confidence: "high",
  },
  {
    id: "GBL",
    name: "BIS Guwahati Branch Laboratory",
    address: "Housefed Complex, Last Gate, Dispur, Guwahati, Assam 781006",
    city: "Guwahati",
    pin: "781006",
    phone: "0361-2224670",
    email: "gbol@bis.gov.in",
    lat: 26.1433,
    lng: 91.7898,
    confidence: "high",
  },
];

/** Real public laboratories. The pin is the city, so confidence stays low. */
export const OTHER_LABS: Lab[] = [
  { id: "NPL", name: "National Physical Laboratory, Delhi", address: "Dr K S Krishnan Marg, New Delhi 110012", city: "Delhi", pin: "110012", phone: "", email: "", lat: 28.637, lng: 77.172, confidence: "low" },
  { id: "NTH-GZB", name: "National Test House, Ghaziabad", address: "Kamla Nehru Nagar, Ghaziabad, Uttar Pradesh", city: "Ghaziabad", pin: "201002", phone: "", email: "", lat: 28.669, lng: 77.454, confidence: "low" },
  { id: "NTH-MUM", name: "National Test House, Mumbai", address: "Plot W-7, MIDC, Andheri East, Mumbai", city: "Mumbai", pin: "400093", phone: "", email: "", lat: 19.12, lng: 72.87, confidence: "low" },
  { id: "NTH-KOL", name: "National Test House, Kolkata", address: "Block CP, Sector V, Salt Lake, Kolkata", city: "Kolkata", pin: "700091", phone: "", email: "", lat: 22.57, lng: 88.43, confidence: "low" },
  { id: "NTH-CHN", name: "National Test House, Chennai", address: "Taramani, Chennai", city: "Chennai", pin: "600113", phone: "", email: "", lat: 12.99, lng: 80.25, confidence: "low" },
  { id: "NTH-JAI", name: "National Test House, Jaipur", address: "RIICO Industrial Area, Jaipur", city: "Jaipur", pin: "302013", phone: "", email: "", lat: 26.91, lng: 75.79, confidence: "low" },
  { id: "ERTL-MUM", name: "ERTL (West), Mumbai", address: "MIDC, Andheri East, Mumbai", city: "Mumbai", pin: "400093", phone: "", email: "", lat: 19.11, lng: 72.86, confidence: "low" },
  { id: "ETDC-BLR", name: "ETDC, Bengaluru", address: "Peenya Industrial Area, Bengaluru", city: "Bengaluru", pin: "560058", phone: "", email: "", lat: 13.03, lng: 77.52, confidence: "low" },
  { id: "ICAT", name: "ICAT, Gurugram", address: "IMT Manesar, Gurugram, Haryana", city: "Gurugram", pin: "122050", phone: "", email: "", lat: 28.36, lng: 76.92, confidence: "low" },
  { id: "NCCBM", name: "National Council for Cement and Building Materials, Hyderabad", address: "Gachibowli, Hyderabad", city: "Hyderabad", pin: "500104", phone: "", email: "", lat: 17.44, lng: 78.35, confidence: "low" },
  { id: "CPRI", name: "CPRI, Bengaluru", address: "Sadashivanagar, Bengaluru", city: "Bengaluru", pin: "560080", phone: "", email: "", lat: 13.01, lng: 77.58, confidence: "low" },
  { id: "CFTRI", name: "CFTRI, Mysuru", address: "Cheluvamba Mansion, Mysuru", city: "Mysuru", pin: "570020", phone: "", email: "", lat: 12.31, lng: 76.64, confidence: "low" },
  { id: "CIPET-CHN", name: "CIPET, Chennai", address: "Guindy, Chennai", city: "Chennai", pin: "600032", phone: "", email: "", lat: 13.01, lng: 80.22, confidence: "low" },
  { id: "CIPET-AMD", name: "CIPET, Ahmedabad", address: "Vatva, Ahmedabad", city: "Ahmedabad", pin: "382445", phone: "", email: "", lat: 22.96, lng: 72.62, confidence: "low" },
  { id: "CIPET-LKO", name: "CIPET, Lucknow", city: "Lucknow", address: "Lucknow, Uttar Pradesh", pin: "226008", phone: "", email: "", lat: 26.85, lng: 80.95, confidence: "low" },
  { id: "CIPET-BHO", name: "CIPET, Bhopal", city: "Bhopal", address: "Bhopal, Madhya Pradesh", pin: "462023", phone: "", email: "", lat: 23.26, lng: 77.41, confidence: "low" },
  { id: "CMERI", name: "CMERI, Durgapur", city: "Durgapur", address: "Durgapur, West Bengal", pin: "713209", phone: "", email: "", lat: 23.55, lng: 87.29, confidence: "low" },
  { id: "IMMT", name: "IMMT, Bhubaneswar", city: "Bhubaneswar", address: "Bhubaneswar, Odisha", pin: "751013", phone: "", email: "", lat: 20.27, lng: 85.84, confidence: "low" },
  { id: "NML", name: "NML, Jamshedpur", city: "Jamshedpur", address: "Jamshedpur, Jharkhand", pin: "831007", phone: "", email: "", lat: 22.8, lng: 86.2, confidence: "low" },
  { id: "NIIST", name: "NIIST, Thiruvananthapuram", city: "Thiruvananthapuram", address: "Pappanamcode, Thiruvananthapuram", pin: "695019", phone: "", email: "", lat: 8.53, lng: 76.91, confidence: "low" },
  { id: "NEIST", name: "NEIST, Jorhat", city: "Jorhat", address: "Jorhat, Assam", pin: "785006", phone: "", email: "", lat: 26.74, lng: 94.16, confidence: "low" },
  { id: "CSMCRI", name: "CSMCRI, Bhavnagar", city: "Bhavnagar", address: "Bhavnagar, Gujarat", pin: "364002", phone: "", email: "", lat: 21.76, lng: 72.14, confidence: "low" },
  { id: "CGCRI", name: "CGCRI, Kolkata", city: "Kolkata", address: "Jadavpur, Kolkata", pin: "700032", phone: "", email: "", lat: 22.5, lng: 88.37, confidence: "low" },
  { id: "CLRI", name: "CLRI, Chennai", city: "Chennai", address: "Adyar, Chennai", pin: "600020", phone: "", email: "", lat: 13.01, lng: 80.24, confidence: "low" },
];

const EARTH_KM = 6371;

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (deg: number) => (deg * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLng = r(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function rankLabs(lat: number, lng: number, product = ""): RankedLab[] {
  const needle = product.trim().toLowerCase();
  const ranked = [...BIS_LABS, ...OTHER_LABS].map((lab) => ({
    ...lab,
    km: Math.round(haversineKm(lat, lng, lab.lat, lab.lng) * 10) / 10,
    productHit: needle.length > 2 && `${lab.name} ${lab.city}`.toLowerCase().includes(needle),
  }));
  ranked.sort((a, b) => a.km - b.km || a.id.localeCompare(b.id));
  return ranked;
}

export const NEAR_KM = 80;

export function areaMapUrl(lat: number, lng: number, label: string, product = ""): string {
  const query = [product.trim(), "testing laboratory near", label].filter(Boolean).join(" ");
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&ll=${lat},${lng}&z=12&output=embed`;
}

export function labMapUrl(lab: Lab, origin: { lat: number; lng: number }): string {
  return `https://maps.google.com/maps?saddr=${origin.lat},${origin.lng}&daddr=${encodeURIComponent(`${lab.lat},${lab.lng}`)}&z=12&output=embed`;
}

export function mapsSearchUrl(lab: Lab): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lab.lat},${lab.lng}`)}`;
}

export function mapsEmbedUrl(lab: Lab, origin?: { lat: number; lng: number }): string {
  if (!origin) return `https://maps.google.com/maps?q=${lab.lat},${lab.lng}&z=14&output=embed`;
  return labMapUrl(lab, origin);
}

const PIN_CENTROID: Record<string, { lat: number; lng: number; label: string }> = {
  "11": { lat: 28.6139, lng: 77.209, label: "Delhi" },
  "12": { lat: 29.0588, lng: 76.0856, label: "Haryana" },
  "13": { lat: 29.0588, lng: 76.0856, label: "Haryana" },
  "14": { lat: 31.1048, lng: 77.1734, label: "Himachal Pradesh" },
  "15": { lat: 31.1471, lng: 75.3412, label: "Punjab" },
  "16": { lat: 30.7333, lng: 76.7794, label: "Chandigarh" },
  "20": { lat: 28.6692, lng: 77.4538, label: "Ghaziabad" },
  "21": { lat: 26.8467, lng: 80.9462, label: "Lucknow" },
  "22": { lat: 25.3176, lng: 82.9739, label: "Varanasi" },
  "30": { lat: 26.9124, lng: 75.7873, label: "Jaipur" },
  "38": { lat: 23.0225, lng: 72.5714, label: "Ahmedabad" },
  "40": { lat: 19.076, lng: 72.8777, label: "Mumbai" },
  "41": { lat: 18.5204, lng: 73.8567, label: "Pune" },
  "45": { lat: 23.2599, lng: 77.4126, label: "Bhopal" },
  "49": { lat: 21.2514, lng: 81.6296, label: "Raipur" },
  "50": { lat: 17.385, lng: 78.4867, label: "Hyderabad" },
  "56": { lat: 12.9716, lng: 77.5946, label: "Bengaluru" },
  "60": { lat: 13.0827, lng: 80.2707, label: "Chennai" },
  "67": { lat: 9.9312, lng: 76.2673, label: "Kochi" },
  "70": { lat: 22.5726, lng: 88.3639, label: "Kolkata" },
  "75": { lat: 20.2961, lng: 85.8245, label: "Bhubaneswar" },
  "78": { lat: 26.1445, lng: 91.7362, label: "Guwahati" },
  "80": { lat: 25.5941, lng: 85.1376, label: "Patna" },
};

export function pinCentroid(pin: string): { lat: number; lng: number; label: string } | null {
  if (!/^[1-9][0-9]{5}$/.test(pin)) return null;
  return (
    PIN_EXACT[pin] ??
    PIN_CENTROID[pin.slice(0, 2)] ?? { lat: 22.5, lng: 79, label: "India" }
  );
}

const PIN_EXACT: Record<string, { lat: number; lng: number; label: string }> = {
  "400601": { lat: 19.2183, lng: 72.9781, label: "Thane" },
  "324001": { lat: 25.2138, lng: 75.8648, label: "Kota" },
  "625001": { lat: 9.9252, lng: 78.1198, label: "Madurai" },
  "390001": { lat: 22.3072, lng: 73.1812, label: "Vadodara" },
  "440001": { lat: 21.1458, lng: 79.0882, label: "Nagpur" },
  "141001": { lat: 30.901, lng: 75.8573, label: "Ludhiana" },
  "143001": { lat: 31.634, lng: 74.8723, label: "Amritsar" },
  "422001": { lat: 19.9975, lng: 73.7898, label: "Nashik" },
  "282001": { lat: 27.1767, lng: 78.0081, label: "Agra" },
  "395001": { lat: 21.1702, lng: 72.8311, label: "Surat" },
  "452001": { lat: 22.7196, lng: 75.8577, label: "Indore" },
  "641001": { lat: 11.0168, lng: 76.9558, label: "Coimbatore" },
  "190001": { lat: 34.0837, lng: 74.7973, label: "Srinagar" },
  "490001": { lat: 21.1938, lng: 81.3509, label: "Bhilai" },
  "520001": { lat: 16.5062, lng: 80.648, label: "Vijayawada" },
  "208001": { lat: 26.4499, lng: 80.3319, label: "Kanpur" },
  "342001": { lat: 26.2389, lng: 73.0243, label: "Jodhpur" },
  "474001": { lat: 26.2183, lng: 78.1828, label: "Gwalior" },
  "482001": { lat: 23.1815, lng: 79.9864, label: "Jabalpur" },
  "834001": { lat: 23.3441, lng: 85.3096, label: "Ranchi" },
  "360001": { lat: 22.3039, lng: 70.8022, label: "Rajkot" },
  "221001": { lat: 25.3176, lng: 82.9739, label: "Varanasi" },
  "121001": { lat: 28.4089, lng: 77.3178, label: "Faridabad" },
  "250001": { lat: 28.9845, lng: 77.7064, label: "Meerut" },
};

/** A published city, mapped to a real PIN prefix so "labs in Raipur" can rank distance. */
const CITY_PIN: { re: RegExp; pin: string }[] = [
  { re: /new delhi|delhi|दिल्ली|دیلی/i, pin: "110001" },
  { re: /ghaziabad|गाजियाबाद/i, pin: "201001" },
  { re: /lucknow|लखनऊ/i, pin: "226001" },
  { re: /jaipur|जयपुर/i, pin: "302001" },
  { re: /chandigarh|चंडीगढ़/i, pin: "160001" },
  { re: /ahmedabad|अहमदाबाद/i, pin: "380001" },
  { re: /mumbai|bombay|मुंबई/i, pin: "400001" },
  { re: /pune|पुणे/i, pin: "411001" },
  { re: /bhopal|भोपाल/i, pin: "462001" },
  { re: /raipur|रायपुर/i, pin: "492001" },
  { re: /hyderabad|हैदराबाद/i, pin: "500001" },
  { re: /bengaluru|bangalore|बेंगलुरु|बैंगलोर/i, pin: "560001" },
  { re: /chennai|madras|चेन्नई/i, pin: "600001" },
  { re: /kochi|cochin|कोच्चि/i, pin: "682001" },
  { re: /kolkata|calcutta|कोलकाता/i, pin: "700001" },
  { re: /bhubaneswar|भुवनेश्वर/i, pin: "751001" },
  { re: /guwahati|गुवाहाटी/i, pin: "781001" },
  { re: /patna|पटना/i, pin: "800001" },
  { re: /\bthane\b|ठाणे/i, pin: "400601" },
  { re: /\bkota\b|कोटा/i, pin: "324001" },
  { re: /\bmadurai\b|मदुरै/i, pin: "625001" },
  { re: /\bvadodara\b|\bbaroda\b|वडोदरा/i, pin: "390001" },
  { re: /\bnagpur\b|नागपुर/i, pin: "440001" },
  { re: /\bludhiana\b|लुधियाना/i, pin: "141001" },
  { re: /\bamritsar\b|अमृतसर/i, pin: "143001" },
  { re: /\bnashik\b|\bnasik\b|नासिक/i, pin: "422001" },
  { re: /\bagra\b|आगरा/i, pin: "282001" },
  { re: /\bsurat\b|सूरत/i, pin: "395001" },
  { re: /\bindore\b|इंदौर/i, pin: "452001" },
  { re: /\bcoimbatore\b|कोयंबटूर/i, pin: "641001" },
  { re: /\bsrinagar\b|श्रीनगर/i, pin: "190001" },
  { re: /\bbhilai\b|भिलाई/i, pin: "490001" },
  { re: /\bvijayawada\b|विजयवाड़ा/i, pin: "520001" },
  { re: /\bkanpur\b|कानपुर/i, pin: "208001" },
  { re: /\bjodhpur\b|जोधपुर/i, pin: "342001" },
  { re: /\bgwalior\b|ग्वालियर/i, pin: "474001" },
  { re: /\bjabalpur\b|जबलपुर/i, pin: "482001" },
  { re: /\branchi\b|रांची/i, pin: "834001" },
  { re: /\brajkot\b|राजकोट/i, pin: "360001" },
  { re: /\bvaranasi\b|\bbanaras\b|वाराणसी/i, pin: "221001" },
  { re: /\bfaridabad\b|फरीदाबाद/i, pin: "121001" },
  { re: /\bmeerut\b|मेरठ/i, pin: "250001" },
  { re: /mohali|मोहाली/i, pin: "160055" },
];

export function cityToPin(text: string): string | null {
  for (const row of CITY_PIN) {
    if (row.re.test(text)) return row.pin;
  }
  return null;
}
