import type { AppLang } from "./language.ts";
import { pageOverlay } from "./desk-page.ts";

export type DeskUi = {
  verifyEyebrow: string;
  verifyH1: string;
  verifyLede: string;
  licenceTitle: string;
  licenceLine: string;
  photoTitle: string;
  photoLine: string;
  brandTitle: string;
  brandLine: string;
  numberLabel: string;
  brandLabel: string;
  photoLabel: string;
  photoHelp: string;
  upload: string;
  checking: string;
  check: string;
  startCheck: string;
  labsEyebrow: string;
  labsH1: string;
  labsLede: string;
  pinLabel: string;
  productLabel: string;
  find: string;
  finding: string;
  useDevice: string;
  mapEmpty: string;
  openMaps: string;
  within: string;
  farther: string;
  bisLab: string;
  cityList: string;
  fileEyebrow: string;
  fileH1: string;
  fileLede: string;
  product: string;
  licenceLabel: string;
  makeSheet: string;
  fileEmpty: string;
  pinned: string;
  family: string;
  wrote: string;
  stillOpen: string;
  findLab: string;
  copyFile: string;
  copied: string;
  notScore: string;
  pinNeed: string;
  pinExample: string;
  pinCity: string;
  limsLine: string;
  nearYes: string;
  nearNo: string;
  scopeLine: string;
  fileNeed: string;
  fileExample: string;
  fileNoScore: string;
  scheme: string;
  marks: string;
  noted: string;
  noLicence: string;
  shapeOk: string;
  shapeBad: string;
  noPercent: string;
  official: string;
  isiShape: string;
  isiLive: string;
  crsShape: string;
  crsNot: string;
  crsLive: string;
  huidShape: string;
  huidNot: string;
  noShape: string;
  noShape2: string;
  verifyStart: string;
  isiEg: string;
  crsEg: string;
  huidEg: string;
  hit1: string;
  hit2: string;
  unclear1: string;
  unclear2: string;
  miss1: string;
  miss2: string;
  openManak: string;
  openCrs: string;
  openHuid: string;
  openKys: string;
  openLims: string;
  highNote: string;
  lowNote: string;
  noneNote: string;
  titleIsi: string;
  titleCrs: string;
  titleHuid: string;
  titleBadNumber: string;
  titleNeedNumber: string;
  titleNeedProduct: string;
  titleMissing: string;
  titleFamilyOpen: string;
  titleNoPin: string;
  titlePhoto: string;
  titleUnread: string;
  titleNamed: string;
  errCheck: string;
  errRetry: string;
  errPhoto: string;
  errLabs: string;
  errNoGeo: string;
  errGeoDenied: string;
  errPin: string;
  productPh: string;
  brandPh: string;
  bulbPh: string;
  fromPlace: string;
  thisDevice: string;
  noteNear: string;
  noteFar: string;
  factPower: string;
  factVoltage: string;
  factFrequency: string;
  factCap: string;
  factColour: string;
};

const EN: DeskUi = {
  verifyEyebrow: "Certification desk",
  verifyH1: "Verify product",
  verifyLede: "Choose one check. The result names the standard or the number shape, then the official page.",
  licenceTitle: "Licence number",
  licenceLine: "CM/L, CRS R-number, or a jewellery HUID.",
  photoTitle: "Photo of the mark",
  photoLine: "A photograph of the ISI, CRS, or hallmark on the product.",
  brandTitle: "Product name",
  brandLine: "The product or brand printed on the pack.",
  numberLabel: "Number printed with the mark",
  brandLabel: "Product or brand",
  photoLabel: "Photograph of the mark",
  photoHelp: "JPG, PNG, or WEBP. The desk reads the number it can see.",
  upload: "Upload a photo",
  checking: "Checking…",
  check: "Check",
  startCheck: "Start check",
  labsEyebrow: "Laboratories",
  labsH1: "Find a laboratory",
  labsLede: "A PIN and a product area place the laboratories. Each name opens in Google Maps.",
  pinLabel: "PIN code",
  productLabel: "Product area",
  find: "Find laboratories",
  finding: "Finding…",
  useDevice: "Use this device's location",
  mapEmpty: "The map opens after a search. Each laboratory is a separate card.",
  openMaps: "Open in Google Maps",
  within: "Within 80 km",
  farther: "Farther",
  bisLab: "BIS laboratory",
  cityList: "City listing. Confirm the test on LIMS before booking",
  fileEyebrow: "Before an application",
  fileH1: "Product file",
  fileLede: "One product. The file names the catalogue standard, keeps what you typed, and lists what is still open.",
  product: "Product",
  licenceLabel: "Licence number, if it is already printed",
  makeSheet: "Make the file",
  fileEmpty: "The file will show the standard, the family, the figures you typed, and the open points. No percentage.",
  pinned: "Pinned standard",
  family: "Also in this family",
  wrote: "What you wrote",
  stillOpen: "Still open",
  findLab: "Find a laboratory",
  copyFile: "Copy file",
  copied: "Copied",
  notScore: "Catalogue pin. Not a compliance score.",
  pinNeed: "A 6-digit PIN code places the laboratories.",
  pinExample: "Example: labs near 492001.",
  pinCity: "A city name alone is not used as the location.",
  limsLine: "Test scope for a named standard stays on",
  nearYes: "Laboratories within",
  nearNo: "No listed laboratory is within",
  scopeLine: "Scope of a named standard is confirmed on",
  fileNeed: "A product name is enough to open the file.",
  fileExample: "Example: product file for a 20W LED bulb.",
  fileNoScore: "The file names the standard. It does not score clauses.",
  scheme: "Scheme",
  marks: "Catalogue marks",
  noted: "Noted as typed",
  noLicence: "No licence number was included, so the mark on the pack was not checked.",
  shapeOk: "has the expected shape. The live register was not opened.",
  shapeBad: "The number on the pack does not match a known licence shape.",
  noPercent: "A compliance percentage is not shown.",
  official: "Official page",
  isiShape: "The number has the CM/L shape used on Scheme-I (ISI) marks.",
  isiLive: "The live list sits on MANAK. This note only checks the shape.",
  crsShape: "The number has the R- shape used on Scheme-II (CRS) registrations.",
  crsNot: "It is not an ISI CM/L number and not a jewellery HUID.",
  crsLive: "The live list sits on CRS. This note only checks the shape.",
  huidShape: "The code has the 6-character shape used for a jewellery HUID.",
  huidNot: "It is not a factory licence. The live check is on the hallmarking portal.",
  noShape: "It does not match a CM/L licence, an R- registration, or a 6-character HUID.",
  noShape2: "A different shape on the pack can be checked again on MANAK.",
  verifyStart: "A number or a product name is enough to start.",
  isiEg: "ISI licences look like CM/L-1234567.",
  crsEg: "CRS registrations look like R-41000001.",
  huidEg: "A jewellery HUID is 6 characters. A photo can be read on Verify product.",
  hit1: "This names the standard in the public catalogue. It does not say the pack holds a licence.",
  hit2: "The CM/L, R-number, or HUID printed on the product can be checked on the official page.",
  unclear1: "One more detail is needed before a single standard is named.",
  unclear2: "The family is known. A missing detail is not a failed mark.",
  miss1: "The public catalogue has no pin for this name.",
  miss2: "That is not a finding against the product. The title can be checked on Know Your Standard.",
  openManak: "Check on MANAK",
  openCrs: "Open CRS",
  openHuid: "Open hallmarking",
  openKys: "Know Your Standard",
  openLims: "BIS LIMS",
  highNote: "Number shape only. Not a live register.",
  lowNote: "Catalogue or possible HUID. Not a licence.",
  noneNote: "No match in this desk.",
  titleIsi: "ISI licence shape",
  titleCrs: "CRS registration shape",
  titleHuid: "possible jewellery HUID",
  titleBadNumber: "That number does not match a known mark",
  titleNeedNumber: "Enter a licence or registration number",
  titleNeedProduct: "Enter a product or brand",
  titleMissing: "one detail missing",
  titleFamilyOpen: "The family is known. The standard is not pinned.",
  titleNoPin: "No catalogue pin for that name",
  titlePhoto: "Read from the photo",
  titleUnread: "The mark could not be read",
  titleNamed: "named standard",
  errCheck: "The check could not be completed.",
  errRetry: "That did not finish. Try again.",
  errPhoto: "That photo could not be read.",
  errLabs: "Could not look up laboratories.",
  errNoGeo: "This browser cannot share a location. Enter a PIN code.",
  errGeoDenied: "Location permission was not granted. Enter a PIN code.",
  errPin: "Enter a 6-digit PIN code, or use this device's location.",
  productPh: "Cement, LED lamp",
  brandPh: "Ordinary Portland cement",
  bulbPh: "20W LED bulb, 220–240V, 50Hz, B22",
  fromPlace: "From",
  thisDevice: "this device",
  noteNear: "High means a BIS laboratory with a published address. Low means the pin is only the city. The map is Google’s listing for this place.",
  noteFar: "No laboratory on this desk sits within 80 km. The distances below are real. The map still shows what Google lists around this PIN.",
  factPower: "Power",
  factVoltage: "Voltage",
  factFrequency: "Frequency",
  factCap: "Cap",
  factColour: "Colour",
};

const HI: DeskUi = {
  ...EN,
  verifyEyebrow: "प्रमाणन डेस्क",
  verifyH1: "उत्पाद जाँचें",
  verifyLede: "एक जाँच चुनें। नतीजा मानक या नंबर का आकार बताता है, फिर आधिकारिक पेज।",
  licenceTitle: "लाइसेंस नंबर",
  licenceLine: "CM/L, CRS का R-नंबर, या गहनों का HUID।",
  photoTitle: "मार्क की फ़ोटो",
  photoLine: "उत्पाद पर ISI, CRS या हॉलमार्क की तस्वीर।",
  brandTitle: "उत्पाद का नाम",
  brandLine: "पैक पर छपा उत्पाद या ब्रांड।",
  numberLabel: "मार्क के साथ छपा नंबर",
  brandLabel: "उत्पाद या ब्रांड",
  photoLabel: "मार्क की तस्वीर",
  photoHelp: "JPG, PNG या WEBP। डेस्क वही नंबर पढ़ता है जो दिखे।",
  upload: "फ़ोटो अपलोड करें",
  checking: "जाँच हो रही है…",
  check: "जाँचें",
  startCheck: "जाँच शुरू करें",
  labsEyebrow: "प्रयोगशालाएँ",
  labsH1: "प्रयोगशाला खोजें",
  labsLede: "PIN और उत्पाद क्षेत्र से प्रयोगशालाएँ रखी जाती हैं। हर नाम Google Maps में खुलता है।",
  pinLabel: "पिन कोड",
  productLabel: "उत्पाद क्षेत्र",
  find: "प्रयोगशालाएँ खोजें",
  finding: "खोज रहे हैं…",
  useDevice: "इस डिवाइस का स्थान लें",
  mapEmpty: "खोज के बाद नक्शा खुलेगा। हर प्रयोगशाला अलग कार्ड है।",
  openMaps: "Google Maps में खोलें",
  within: "80 किमी के अंदर",
  farther: "दूर",
  bisLab: "BIS प्रयोगशाला",
  cityList: "शहर की सूची। बुकिंग से पहले LIMS पर जाँच पुष्टि करें",
  fileEyebrow: "आवेदन से पहले",
  fileH1: "उत्पाद फ़ाइल",
  fileLede: "एक उत्पाद। फ़ाइल कैटलॉग मानक बताती है, आपके आँकड़े रखती है, और खुले बिंदु लिखती है।",
  product: "उत्पाद",
  licenceLabel: "लाइसेंस नंबर, अगर पैक पर छपा हो",
  makeSheet: "फ़ाइल बनाएँ",
  fileEmpty: "फ़ाइल मानक, परिवार, आपके आँकड़े और खुले बिंदु दिखाएगी। प्रतिशत नहीं।",
  pinned: "पिन्ड मानक",
  family: "इसी परिवार में और",
  wrote: "आपने जो लिखा",
  stillOpen: "अभी खुला",
  findLab: "प्रयोगशाला खोजें",
  copyFile: "फ़ाइल कॉपी करें",
  copied: "कॉपी हो गई",
  notScore: "कैटलॉग पिन। अनुपालन अंक नहीं।",
  pinNeed: "प्रयोगशालाएँ रखने के लिए 6 अंकों का पिन कोड चाहिए।",
  pinExample: "उदाहरण: 492001 के पास प्रयोगशाला।",
  pinCity: "सिर्फ़ शहर के नाम से स्थान नहीं लिया जाता।",
  limsLine: "नाम वाले मानक का परीक्षण दायरा यहाँ रहता है",
  nearYes: "इसके",
  nearNo: "इस सूची में कोई प्रयोगशाला",
  scopeLine: "नाम वाले मानक का दायरा दूरी से नहीं, यहाँ पक्का होता है",
  fileNeed: "फ़ाइल के लिए उत्पाद का नाम काफी है।",
  fileExample: "उदाहरण: 20W LED बल्ब की उत्पाद फ़ाइल।",
  fileNoScore: "फ़ाइल मानक का नाम बताती है। खंड का अंक नहीं देती।",
  scheme: "योजना",
  marks: "कैटलॉग चिह्न",
  noted: "जैसा लिखा गया",
  noLicence: "लाइसेंस नंबर नहीं दिया गया, इसलिए पैक का मार्क नहीं जाँचा गया।",
  shapeOk: "का आकार अपेक्षित है। लाइव रजिस्टर नहीं खोला गया।",
  shapeBad: "पैक का नंबर ज्ञात लाइसेंस आकार से नहीं मिलता।",
  noPercent: "अनुपालन प्रतिशत नहीं दिखाया जाता।",
  official: "आधिकारिक पेज",
  isiShape: "नंबर का आकार Scheme-I (ISI) के CM/L जैसा है।",
  isiLive: "लाइव सूची MANAK पर है। यह नोट सिर्फ़ आकार देखता है।",
  crsShape: "नंबर का आकार Scheme-II (CRS) के R- जैसा है।",
  crsNot: "यह ISI CM/L नहीं है और गहनों का HUID भी नहीं।",
  crsLive: "लाइव सूची CRS पर है। यह नोट सिर्फ़ आकार देखता है।",
  huidShape: "कोड का आकार गहनों के 6 अक्षर वाले HUID जैसा है।",
  huidNot: "यह फ़ैक्टरी लाइसेंस नहीं है। लाइव जाँच हॉलमार्किंग पोर्टल पर है।",
  noShape: "यह CM/L, R- रजिस्ट्रेशन या 6 अक्षर वाले HUID से नहीं मिलता।",
  noShape2: "पैक पर दूसरा आकार हो तो MANAK पर फिर देखें।",
  verifyStart: "शुरुआत के लिए नंबर या उत्पाद का नाम काफी है।",
  isiEg: "ISI लाइसेंस CM/L-1234567 जैसा दिखता है।",
  crsEg: "CRS रजिस्ट्रेशन R-41000001 जैसा दिखता है।",
  huidEg: "गहनों का HUID 6 अक्षर का होता है। फ़ोटो उत्पाद जाँच पर पढ़ी जा सकती है।",
  hit1: "यह सार्वजनिक कैटलॉग में मानक का नाम है। इससे यह नहीं बनता कि पैक पर लाइसेंस है।",
  hit2: "उत्पाद पर छपा CM/L, R-नंबर या HUID आधिकारिक पेज पर देखा जा सकता है।",
  unclear1: "एक मानक नामने से पहले एक और विवरण चाहिए।",
  unclear2: "परिवार पता है। छूटा विवरण असफल मार्क नहीं है।",
  miss1: "इस नाम का पिन सार्वजनिक कैटलॉग में नहीं है।",
  miss2: "यह उत्पाद के खिलाफ निष्कर्ष नहीं है। शीर्षक Know Your Standard पर देखा जा सकता है।",
  openManak: "MANAK पर देखें",
  openCrs: "CRS खोलें",
  openHuid: "हॉलमार्किंग खोलें",
  openKys: "Know Your Standard",
  openLims: "BIS LIMS",
  highNote: "सिर्फ़ नंबर का आकार। लाइव रजिस्टर नहीं।",
  lowNote: "कैटलॉग या संभव HUID। लाइसेंस नहीं।",
  noneNote: "इस डेस्क पर मेल नहीं।",
  titleIsi: "ISI लाइसेंस का आकार",
  titleCrs: "CRS रजिस्ट्रेशन का आकार",
  titleHuid: "संभव ज्वेलरी HUID",
  titleBadNumber: "यह नंबर ज्ञात मार्क से नहीं मिलता",
  titleNeedNumber: "लाइसेंस या रजिस्ट्रेशन नंबर लिखें",
  titleNeedProduct: "उत्पाद या ब्रांड लिखें",
  titleMissing: "एक विवरण बाकी",
  titleFamilyOpen: "परिवार पता है। मानक पिन नहीं हुआ।",
  titleNoPin: "इस नाम का कैटलॉग पिन नहीं",
  titlePhoto: "फ़ोटो से पढ़ा गया",
  titleUnread: "मार्क पढ़ा नहीं जा सका",
  titleNamed: "नामित मानक",
  errCheck: "जाँच पूरी नहीं हुई।",
  errRetry: "पूरा नहीं हुआ। फिर कोशिश करें।",
  errPhoto: "यह फ़ोटो पढ़ी नहीं जा सकी।",
  errLabs: "प्रयोगशालाएँ नहीं मिल सकीं।",
  errNoGeo: "यह ब्राउज़र स्थान नहीं बाँट सकता। पिन कोड लिखें।",
  errGeoDenied: "स्थान की अनुमति नहीं मिली। पिन कोड लिखें।",
  errPin: "6 अंकों का पिन लिखें, या इस डिवाइस का स्थान लें।",
  productPh: "सीमेंट, LED लैंप",
  brandPh: "साधारण पोर्टलैंड सीमेंट",
  bulbPh: "20W LED बल्ब, 220–240V, 50Hz, B22",
  fromPlace: "स्थान",
  thisDevice: "यह डिवाइस",
  noteNear: "उच्च मतलब प्रकाशित पते वाली BIS प्रयोगशाला। निम्न मतलब पिन सिर्फ़ शहर का है। नक्शा इस जगह की Google सूची है।",
  noteFar: "इस डेस्क पर 80 किमी के अंदर कोई प्रयोगशाला नहीं। नीचे की दूरियाँ असली हैं। नक्शा फिर भी इस पिन के आसपास Google की सूची दिखाता है।",
  factPower: "शक्ति",
  factVoltage: "वोल्टेज",
  factFrequency: "आवृत्ति",
  factCap: "कैप",
  factColour: "रंग",
};

function pack(over: Partial<DeskUi>): DeskUi {
  return { ...EN, ...over };
}

export const DESK_UI: Record<AppLang, DeskUi> = {
  en: EN,
  hi: HI,
  bn: pack({
    verifyH1: "পণ্য যাচাই",
    labsH1: "গবেষণাগার খুঁজুন",
    fileH1: "পণ্য ফাইল",
    pinNeed: "গবেষণাগার রাখতে ৬ অঙ্কের পিন কোড লাগে।",
    pinExample: "উদাহরণ: 492001-এর কাছে ল্যাব।",
    pinCity: "শুধু শহরের নাম দিয়ে জায়গা ধরা হয় না।",
    nearYes: "এর",
    nearNo: "এই তালিকায় কোনো গবেষণাগার নেই",
    scopeLine: "নাম করা মানের পরিসর দূরত্ব দিয়ে নয়, এখানে নিশ্চিত হয়",
    limsLine: "নাম করা মানের পরীক্ষার পরিসর থাকে",
    bisLab: "BIS গবেষণাগার",
    cityList: "শহরের তালিকা। বুকিংয়ের আগে LIMS-এ নিশ্চিত করুন",
    isiShape: "নম্বরটি Scheme-I (ISI) CM/L আকারের।",
    isiLive: "লাইভ তালিকা MANAK-এ। এই নোট শুধু আকার দেখে।",
    crsShape: "নম্বরটি Scheme-II (CRS) R- আকারের।",
    huidShape: "কোডটি গহনার ৬ অক্ষরের HUID আকারের।",
    hit1: "এটি পাবলিক ক্যাটালগের মান। প্যাকে লাইসেন্স আছে বলা হয় না।",
    noLicence: "লাইসেন্স নম্বর দেওয়া হয়নি, তাই প্যাকের মার্ক দেখা হয়নি।",
    noPercent: "কমপ্লায়েন্স শতাংশ দেখানো হয় না।",
    official: "সরকারি পাতা",
    scheme: "স্কিম",
    marks: "ক্যাটালগ চিহ্ন",
    verifyStart: "শুরু করতে নম্বর বা পণ্যের নাম যথেষ্ট।",
    fileNeed: "ফাইল খুলতে পণ্যের নামই যথেষ্ট।",
    openManak: "MANAK-এ দেখুন",
    openCrs: "CRS খুলুন",
    openHuid: "হলমার্কিং খুলুন",
    openLims: "BIS LIMS",
  }),
  ta: pack({
    verifyH1: "பொருளைச் சரிபார்",
    labsH1: "ஆய்வகம் தேடு",
    fileH1: "பொருள் கோப்பு",
    pinNeed: "ஆய்வகங்களை வைக்க 6 இலக்க PIN வேண்டும்.",
    pinExample: "எடுத்துக்காட்டு: 492001 அருகில் ஆய்வகம்.",
    pinCity: "நகரப் பெயர் மட்டும் இடமாக எடுத்துக்கொள்ளப்படாது.",
    nearYes: "இதற்குள்",
    nearNo: "இந்தப் பட்டியலில் ஆய்வகம் இல்லை",
    scopeLine: "பெயரிட்ட தரத்தின் வரம்பு தூரத்தால் அல்ல, இங்கே உறுதி",
    limsLine: "பெயரிட்ட தரத்தின் சோதனை வரம்பு இங்கே",
    bisLab: "BIS ஆய்வகம்",
    cityList: "நகரப் பட்டியல். முன்பதிவுக்கு முன் LIMS-ல் உறுதி செய்யுங்கள்",
    isiShape: "எண் Scheme-I (ISI) CM/L வடிவம்.",
    isiLive: "நேரடி பட்டியல் MANAK-ல். இந்தக் குறிப்பு வடிவம் மட்டும்.",
    crsShape: "எண் Scheme-II (CRS) R- வடிவம்.",
    huidShape: "குறியீடு நகையின் 6 எழுத்து HUID வடிவம்.",
    hit1: "இது பொது அட்டவணையின் தரம். பொதிக்கு உரிமம் உண்டு என்று சொல்லாது.",
    noLicence: "உரிம எண் இல்லை, அதனால் பொதியின் குறி பார்க்கப்படவில்லை.",
    noPercent: "இணக்க சதவீதம் காட்டப்படாது.",
    official: "அதிகாரப்பூர்வ பக்கம்",
    scheme: "திட்டம்",
    marks: "அட்டவணை குறிகள்",
    verifyStart: "தொடங்க எண் அல்லது பொருள் பெயர் போதும்.",
    fileNeed: "கோப்புக்கு பொருள் பெயர் போதும்.",
    openManak: "MANAK-ல் பாருங்கள்",
    openCrs: "CRS திற",
    openHuid: "Hallmarking திற",
    openLims: "BIS LIMS",
  }),
  te: pack({
    verifyH1: "ఉత్పత్తి తనిఖీ",
    labsH1: "ప్రయోగశాల వెతకండి",
    fileH1: "ఉత్పత్తి ఫైలు",
    pinNeed: "ప్రయోగశాలలకు 6 అంకెల PIN కావాలి.",
    pinExample: "ఉదాహరణ: 492001 దగ్గర ల్యాబ్.",
    pinCity: "నగరం పేరు మాత్రమే స్థానం కాదు.",
    nearYes: "దీని లోపల",
    nearNo: "ఈ జాబితాలో ప్రయోగశాల లేదు",
    scopeLine: "పేరున్న ప్రమాణం పరిధి దూరం కాదు, ఇక్కడ నిర్ధారణ",
    limsLine: "పేరున్న ప్రమాణం పరీక్ష పరిధి ఇక్కడ",
    bisLab: "BIS ప్రయోగశాల",
    cityList: "నగర జాబితా. బుకింగ్ ముందు LIMSలో నిర్ధారించండి",
    isiShape: "సంఖ్య Scheme-I (ISI) CM/L ఆకారం.",
    isiLive: "లైవ్ జాబితా MANAKలో. ఈ నోటు ఆకారం మాత్రమే.",
    crsShape: "సంఖ్య Scheme-II (CRS) R- ఆకారం.",
    huidShape: "కోడ్ నగల 6 అక్షరాల HUID ఆకారం.",
    hit1: "ఇది పబ్లిక్ కేటలాగ్ ప్రమాణం. ప్యాక్‌కు లైసెన్స్ ఉందని చెప్పదు.",
    noLicence: "లైసెన్స్ నంబర్ లేదు, కాబట్టి ప్యాక్ మార్క్ చూడలేదు.",
    noPercent: "కంప్లయన్స్ శాతం చూపించం.",
    official: "అధికారిక పేజీ",
    scheme: "పథకం",
    marks: "కేటలాగ్ గుర్తులు",
    verifyStart: "మొదలుపెట్టేందుకు నంబర్ లేదా ఉత్పత్తి పేరు చాలు.",
    fileNeed: "ఫైలుకు ఉత్పత్తి పేరు చాలు.",
    openManak: "MANAKలో చూడండి",
    openCrs: "CRS తెరవండి",
    openHuid: "హాల్‌మార్కింగ్ తెరవండి",
    openLims: "BIS LIMS",
  }),
  mr: pack({
    verifyH1: "उत्पादन तपासा",
    labsH1: "प्रयोगशाळा शोधा",
    fileH1: "उत्पादन फाइल",
    pinNeed: "प्रयोगशाळांसाठी 6 अंकी पिन कोड हवा.",
    pinExample: "उदाहरण: 492001 जवळ प्रयोगशाळा.",
    pinCity: "फक्त शहराच्या नावावरून ठिकाण घेतले जात नाही.",
    nearYes: "याच्या",
    nearNo: "या यादीत प्रयोगशाळा नाही",
    scopeLine: "नावाच्या मानकाची व्याप्ती अंतरावरून नाही, इथे निश्चित",
    limsLine: "नावाच्या मानकाची चाचणी व्याप्ती इथे",
    bisLab: "BIS प्रयोगशाळा",
    cityList: "शहर यादी. बुकिंगपूर्वी LIMS वर खात्री करा",
    isiShape: "क्रमांक Scheme-I (ISI) CM/L आकाराचा आहे.",
    isiLive: "थेट यादी MANAK वर आहे. ही नोंद फक्त आकार पाहते.",
    crsShape: "क्रमांक Scheme-II (CRS) R- आकाराचा आहे.",
    huidShape: "कोड दागिन्यांच्या 6 अक्षरी HUID आकाराचा आहे.",
    hit1: "हे सार्वजनिक कॅटलॉगमधील मानक आहे. पॅकवर परवाना आहे असे म्हणत नाही.",
    noLicence: "परवाना क्रमांक दिला नाही, म्हणून पॅकवरील मार्क तपासला नाही.",
    noPercent: "अनुपालन टक्केवारी दाखवली जात नाही.",
    official: "अधिकृत पान",
    scheme: "योजना",
    marks: "कॅटलॉग चिन्हे",
    verifyStart: "सुरुवातीला क्रमांक किंवा उत्पादनाचे नाव पुरे.",
    fileNeed: "फाइलसाठी उत्पादनाचे नाव पुरे.",
    openManak: "MANAK वर पहा",
    openCrs: "CRS उघडा",
    openHuid: "हॉलमार्किंग उघडा",
    openLims: "BIS LIMS",
  }),
  gu: pack({
    verifyH1: "ઉત્પાદ તપાસો",
    labsH1: "પ્રયોગશાળા શોધો",
    fileH1: "ઉત્પાદ ફાઇલ",
    pinNeed: "પ્રયોગશાળા માટે 6 અંકનો પિન કોડ જોઈએ.",
    pinExample: "ઉદાહરણ: 492001 પાસે લેબ.",
    pinCity: "ફક્ત શહેરના નામથી સ્થાન નથી લેવાતું.",
    nearYes: "આની અંદર",
    nearNo: "આ યાદીમાં પ્રયોગશાળા નથી",
    scopeLine: "નામવાળા ધોરણની હદ અંતરથી નહીં, અહીં પુષ્ટિ",
    limsLine: "નામવાળા ધોરણની કસોટી હદ અહીં",
    bisLab: "BIS પ્રયોગશાળા",
    cityList: "શહેર યાદી. બુકિંગ પહેલાં LIMS પર ખાતરી કરો",
    isiShape: "નંબર Scheme-I (ISI) CM/L આકારનો છે.",
    isiLive: "લાઇવ યાદી MANAK પર છે. આ નોંધ ફક્ત આકાર જુએ છે.",
    crsShape: "નંબર Scheme-II (CRS) R- આકારનો છે.",
    huidShape: "કોડ ઘરેણાંના 6 અક્ષરના HUID આકારનો છે.",
    hit1: "આ જાહેર કેટલોગનું ધોરણ છે. પેક પર લાઇસન્સ છે એમ કહેતું નથી.",
    noLicence: "લાઇસન્સ નંબર નથી, એટલે પેકનું માર્ક તપાસ્યું નથી.",
    noPercent: "અનુપાલન ટકા બતાવાતા નથી.",
    official: "સત્તાવાર પાનું",
    scheme: "યોજના",
    marks: "કેટલોગ ચિહ્ન",
    verifyStart: "શરૂઆત માટે નંબર અથવા ઉત્પાદનું નામ બસ.",
    fileNeed: "ફાઇલ માટે ઉત્પાદનું નામ બસ.",
    openManak: "MANAK પર જુઓ",
    openCrs: "CRS ખોલો",
    openHuid: "હોલમાર્કિંગ ખોલો",
    openLims: "BIS LIMS",
  }),
  kn: pack({
    verifyH1: "ಉತ್ಪನ್ನ ಪರಿಶೀಲನೆ",
    labsH1: "ಪ್ರಯೋಗಾಲಯ ಹುಡುಕಿ",
    fileH1: "ಉತ್ಪನ್ನ ಕಡತ",
    pinNeed: "ಪ್ರಯೋಗಾಲಯಗಳಿಗೆ 6 ಅಂಕಿಯ PIN ಬೇಕು.",
    pinExample: "ಉದಾಹರಣೆ: 492001 ಹತ್ತಿರ ಪ್ರಯೋಗಾಲಯ.",
    pinCity: "ನಗರದ ಹೆಸರು ಮಾತ್ರ ಸ್ಥಳವಾಗುವುದಿಲ್ಲ.",
    nearYes: "ಇದರೊಳಗೆ",
    nearNo: "ಈ ಪಟ್ಟಿಯಲ್ಲಿ ಪ್ರಯೋಗಾಲಯ ಇಲ್ಲ",
    scopeLine: "ಹೆಸರಿನ ಮಾನದಂಡದ ವ್ಯಾಪ್ತಿ ದೂರದಿಂದಲ್ಲ, ಇಲ್ಲಿ ಖಚಿತ",
    limsLine: "ಹೆಸರಿನ ಮಾನದಂಡದ ಪರೀಕ್ಷಾ ವ್ಯಾಪ್ತಿ ಇಲ್ಲಿ",
    bisLab: "BIS ಪ್ರಯೋಗಾಲಯ",
    cityList: "ನಗರ ಪಟ್ಟಿ. ಬುಕಿಂಗ್ ಮೊದಲು LIMS ನಲ್ಲಿ ಖಚಿತಪಡಿಸಿ",
    isiShape: "ಸಂಖ್ಯೆ Scheme-I (ISI) CM/L ಆಕಾರ.",
    isiLive: "ಲೈವ್ ಪಟ್ಟಿ MANAK ನಲ್ಲಿ. ಈ ಟಿಪ್ಪಣಿ ಆಕಾರ ಮಾತ್ರ.",
    crsShape: "ಸಂಖ್ಯೆ Scheme-II (CRS) R- ಆಕಾರ.",
    huidShape: "ಕೋಡ್ ಆಭರಣದ 6 ಅಕ್ಷರ HUID ಆಕಾರ.",
    hit1: "ಇದು ಸಾರ್ವಜನಿಕ ಕ್ಯಾಟಲಾಗ್ ಮಾನದಂಡ. ಪ್ಯಾಕ್‌ಗೆ ಪರವಾನಗಿ ಇದೆ ಎನ್ನುವುದಿಲ್ಲ.",
    noLicence: "ಪರವಾನಗಿ ಸಂಖ್ಯೆ ಇಲ್ಲ, ಆದ್ದರಿಂದ ಪ್ಯಾಕ್ ಗುರುತು ನೋಡಲಿಲ್ಲ.",
    noPercent: "ಅನುಸರಣೆ ಶೇಕಡಾ ತೋರಿಸುವುದಿಲ್ಲ.",
    official: "ಅಧಿಕೃತ ಪುಟ",
    scheme: "ಯೋಜನೆ",
    marks: "ಕ್ಯಾಟಲಾಗ್ ಗುರುತುಗಳು",
    verifyStart: "ಆರಂಭಕ್ಕೆ ಸಂಖ್ಯೆ ಅಥವಾ ಉತ್ಪನ್ನದ ಹೆಸರು ಸಾಕು.",
    fileNeed: "ಕಡತಕ್ಕೆ ಉತ್ಪನ್ನದ ಹೆಸರು ಸಾಕು.",
    openManak: "MANAK ನಲ್ಲಿ ನೋಡಿ",
    openCrs: "CRS ತೆರೆಯಿರಿ",
    openHuid: "ಹಾಲ್‌ಮಾರ್ಕಿಂಗ್ ತೆರೆಯಿರಿ",
    openLims: "BIS LIMS",
  }),
  ml: pack({
    verifyH1: "ഉൽപ്പന്ന പരിശോധന",
    labsH1: "പരീക്ഷണശാല കണ്ടെത്തുക",
    fileH1: "ഉൽപ്പന്ന ഫയൽ",
    pinNeed: "പരീക്ഷണശാലകൾക്ക് 6 അക്ക PIN വേണം.",
    pinExample: "ഉദാഹരണം: 492001 ന് സമീപം ലാബ്.",
    pinCity: "നഗരത്തിന്റെ പേര് മാത്രം സ്ഥലമാകില്ല.",
    nearYes: "ഇതിനുള്ളിൽ",
    nearNo: "ഈ പട്ടികയിൽ പരീക്ഷണശാല ഇല്ല",
    scopeLine: "പേരുള്ള മാനദണ്ഡത്തിന്റെ പരിധി ദൂരമല്ല, ഇവിടെ ഉറപ്പ്",
    limsLine: "പേരുള്ള മാനദണ്ഡത്തിന്റെ പരിശോധനാ പരിധി ഇവിടെ",
    bisLab: "BIS പരീക്ഷണശാല",
    cityList: "നഗര പട്ടിക. ബുക്കിംഗിന് മുൻപ് LIMS-ൽ ഉറപ്പാക്കുക",
    isiShape: "നമ്പർ Scheme-I (ISI) CM/L രൂപം.",
    isiLive: "ലൈവ് പട്ടിക MANAK-ൽ. ഈ കുറിപ്പ് രൂപം മാത്രം.",
    crsShape: "നമ്പർ Scheme-II (CRS) R- രൂപം.",
    huidShape: "കോഡ് ആഭരണത്തിന്റെ 6 അക്ഷര HUID രൂപം.",
    hit1: "ഇത് പൊതു കാറ്റലോഗ് മാനദണ്ഡം. പാക്കിന് ലൈസൻസ് ഉണ്ടെന്ന് പറയില്ല.",
    noLicence: "ലൈസൻസ് നമ്പർ ഇല്ല, അതിനാൽ പാക്കിലെ മാർക്ക് നോക്കിയില്ല.",
    noPercent: "അനുസരണ ശതമാനം കാണിക്കില്ല.",
    official: "ഔദ്യോഗിക താൾ",
    scheme: "പദ്ധതി",
    marks: "കാറ്റലോഗ് അടയാളങ്ങൾ",
    verifyStart: "തുടങ്ങാൻ നമ്പറോ ഉൽപ്പന്ന നാമമോ മതി.",
    fileNeed: "ഫയലിന് ഉൽപ്പന്ന നാമം മതി.",
    openManak: "MANAK-ൽ നോക്കുക",
    openCrs: "CRS തുറക്കുക",
    openHuid: "ഹാൾമാർക്കിംഗ് തുറക്കുക",
    openLims: "BIS LIMS",
  }),
  pa: pack({
    verifyH1: "ਉਤਪਾਦ ਜਾਂਚ",
    labsH1: "ਪ੍ਰਯੋਗਸ਼ਾਲਾ ਲੱਭੋ",
    fileH1: "ਉਤਪਾਦ ਫਾਈਲ",
    pinNeed: "ਪ੍ਰਯੋਗਸ਼ਾਲਾਵਾਂ ਲਈ 6 ਅੰਕਾਂ ਦਾ ਪਿੰਨ ਕੋਡ ਚਾਹੀਦਾ ਹੈ।",
    pinExample: "ਉਦਾਹਰਨ: 492001 ਕੋਲ ਲੈਬ।",
    pinCity: "ਸਿਰਫ਼ ਸ਼ਹਿਰ ਦੇ ਨਾਮ ਤੋਂ ਥਾਂ ਨਹੀਂ ਲਈ ਜਾਂਦੀ।",
    nearYes: "ਇਸ ਦੇ",
    nearNo: "ਇਸ ਸੂਚੀ ਵਿੱਚ ਪ੍ਰਯੋਗਸ਼ਾਲਾ ਨਹੀਂ",
    scopeLine: "ਨਾਮ ਵਾਲੇ ਮਿਆਰ ਦੀ ਹੱਦ ਦੂਰੀ ਨਾਲ ਨਹੀਂ, ਇੱਥੇ ਪੱਕੀ",
    limsLine: "ਨਾਮ ਵਾਲੇ ਮਿਆਰ ਦੀ ਜਾਂਚ ਹੱਦ ਇੱਥੇ",
    bisLab: "BIS ਪ੍ਰਯੋਗਸ਼ਾਲਾ",
    cityList: "ਸ਼ਹਿਰ ਸੂਚੀ। ਬੁਕਿੰਗ ਤੋਂ ਪਹਿਲਾਂ LIMS ਤੇ ਪੱਕਾ ਕਰੋ",
    isiShape: "ਨੰਬਰ Scheme-I (ISI) CM/L ਆਕਾਰ ਦਾ ਹੈ।",
    isiLive: "ਲਾਈਵ ਸੂਚੀ MANAK ਤੇ ਹੈ। ਇਹ ਨੋਟ ਸਿਰਫ਼ ਆਕਾਰ ਦੇਖਦਾ ਹੈ।",
    crsShape: "ਨੰਬਰ Scheme-II (CRS) R- ਆਕਾਰ ਦਾ ਹੈ।",
    huidShape: "ਕੋਡ ਗਹਿਣਿਆਂ ਦੇ 6 ਅੱਖਰਾਂ ਵਾਲੇ HUID ਆਕਾਰ ਦਾ ਹੈ।",
    hit1: "ਇਹ ਜਨਤਕ ਕੈਟਾਲਾਗ ਦਾ ਮਿਆਰ ਹੈ। ਪੈਕ ਤੇ ਲਾਇਸੈਂਸ ਹੈ ਇਹ ਨਹੀਂ ਕਹਿੰਦਾ।",
    noLicence: "ਲਾਇਸੈਂਸ ਨੰਬਰ ਨਹੀਂ, ਇਸ ਲਈ ਪੈਕ ਦਾ ਮਾਰਕ ਨਹੀਂ ਦੇਖਿਆ।",
    noPercent: "ਅਨੁਪਾਲਨ ਪ੍ਰਤੀਸ਼ਤ ਨਹੀਂ ਦਿਖਾਇਆ ਜਾਂਦਾ।",
    official: "ਅਧਿਕਾਰਤ ਪੰਨਾ",
    scheme: "ਯੋਜਨਾ",
    marks: "ਕੈਟਾਲਾਗ ਚਿੰਨ੍ਹ",
    verifyStart: "ਸ਼ੁਰੂ ਲਈ ਨੰਬਰ ਜਾਂ ਉਤਪਾਦ ਦਾ ਨਾਮ ਕਾਫ਼ੀ ਹੈ।",
    fileNeed: "ਫਾਈਲ ਲਈ ਉਤਪਾਦ ਦਾ ਨਾਮ ਕਾਫ਼ੀ ਹੈ।",
    openManak: "MANAK ਤੇ ਦੇਖੋ",
    openCrs: "CRS ਖੋਲ੍ਹੋ",
    openHuid: "ਹਾਲਮਾਰਕਿੰਗ ਖੋਲ੍ਹੋ",
    openLims: "BIS LIMS",
  }),
  ur: pack({
    verifyH1: "مصنوع کی جانچ",
    labsH1: "تجربہ گاہ تلاش کریں",
    fileH1: "مصنوع فائل",
    pinNeed: "تجربہ گاہوں کے لیے 6 ہندسوں کا پن کوڈ چاہیے۔",
    pinExample: "مثال: 492001 کے قریب لیب۔",
    pinCity: "صرف شہر کے نام سے جگہ نہیں لی جاتی۔",
    nearYes: "اس کے",
    nearNo: "اس فہرست میں تجربہ گاہ نہیں",
    scopeLine: "نام والے معیار کی حد فاصلے سے نہیں، یہاں طے",
    limsLine: "نام والے معیار کی جانچ کی حد یہاں",
    bisLab: "BIS تجربہ گاہ",
    cityList: "شہر کی فہرست۔ بکنگ سے پہلے LIMS پر تصدیق کریں",
    isiShape: "نمبر Scheme-I (ISI) CM/L کی شکل کا ہے۔",
    isiLive: "لائیو فہرست MANAK پر ہے۔ یہ نوٹ صرف شکل دیکھتا ہے۔",
    crsShape: "نمبر Scheme-II (CRS) R- کی شکل کا ہے۔",
    huidShape: "کوڈ زیورات کے 6 حرفی HUID کی شکل کا ہے۔",
    hit1: "یہ عوامی کیٹلاگ کا معیار ہے۔ پیک پر لائسنس ہے یہ نہیں کہتا۔",
    noLicence: "لائسنس نمبر نہیں، اس لیے پیک کا مارک نہیں دیکھا گیا۔",
    noPercent: "تعمیل کا فیصد نہیں دکھایا جاتا۔",
    official: "سرکاری صفحہ",
    scheme: "اسکیم",
    marks: "کیٹلاگ نشانات",
    verifyStart: "شروع کے لیے نمبر یا مصنوع کا نام کافی ہے۔",
    fileNeed: "فائل کے لیے مصنوع کا نام کافی ہے۔",
    openManak: "MANAK پر دیکھیں",
    openCrs: "CRS کھولیں",
    openHuid: "ہال مارکنگ کھولیں",
    openLims: "BIS LIMS",
  }),
  or: pack({
    verifyH1: "ଉତ୍ପାଦ ଯାଞ୍ଚ",
    labsH1: "ପରୀକ୍ଷାଗାର ଖୋଜନ୍ତୁ",
    fileH1: "ଉତ୍ପାଦ ଫାଇଲ",
    pinNeed: "ପରୀକ୍ଷାଗାର ପାଇଁ 6 ଅଙ୍କର PIN ଦରକାର।",
    pinExample: "ଉଦାହରଣ: 492001 ପାଖରେ ଲ୍ୟାବ।",
    pinCity: "କେବଳ ସହର ନାମରୁ ସ୍ଥାନ ନିଆଯାଏ ନାହିଁ।",
    nearYes: "ଏହାର",
    nearNo: "ଏହି ତାଲିକାରେ ପରୀକ୍ଷାଗାର ନାହିଁ",
    scopeLine: "ନାମିତ ମାନକର ପରିସର ଦୂରତା ନୁହେଁ, ଏଠାରେ ନିଶ୍ଚିତ",
    limsLine: "ନାମିତ ମାନକର ପରୀକ୍ଷା ପରିସର ଏଠାରେ",
    bisLab: "BIS ପରୀକ୍ଷାଗାର",
    cityList: "ସହର ତାଲିକା। ବୁକିଂ ପୂର୍ବରୁ LIMS ରେ ନିଶ୍ଚିତ କରନ୍ତୁ",
    isiShape: "ସଂଖ୍ୟା Scheme-I (ISI) CM/L ଆକାର।",
    isiLive: "ଲାଇଭ ତାଲିକା MANAK ରେ। ଏହି ନୋଟ କେବଳ ଆକାର।",
    crsShape: "ସଂଖ୍ୟା Scheme-II (CRS) R- ଆକାର।",
    huidShape: "କୋଡ ଅଳଙ୍କାରର 6 ଅକ୍ଷର HUID ଆକାର।",
    hit1: "ଏହା ସାର୍ବଜନୀନ କାଟାଲଗ ମାନକ। ପ୍ୟାକରେ ଲାଇସେନ୍ସ ଅଛି ବୋଲି କହେ ନାହିଁ।",
    noLicence: "ଲାଇସେନ୍ସ ନମ୍ବର ନାହିଁ, ତେଣୁ ପ୍ୟାକ ମାର୍କ ଦେଖାଗଲା ନାହିଁ।",
    noPercent: "ଅନୁପାଳନ ପ୍ରତିଶତ ଦେଖାଯାଏ ନାହିଁ।",
    official: "ସରକାରୀ ପୃଷ୍ଠା",
    scheme: "ଯୋଜନା",
    marks: "କାଟାଲଗ ଚିହ୍ନ",
    verifyStart: "ଆରମ୍ଭ ପାଇଁ ନମ୍ବର କିମ୍ବା ଉତ୍ପାଦ ନାମ ଯଥେଷ୍ଟ।",
    fileNeed: "ଫାଇଲ ପାଇଁ ଉତ୍ପାଦ ନାମ ଯଥେଷ୍ଟ।",
    openManak: "MANAK ରେ ଦେଖନ୍ତୁ",
    openCrs: "CRS ଖୋଲନ୍ତୁ",
    openHuid: "ହଲମାର୍କିଂ ଖୋଲନ୍ତୁ",
    openLims: "BIS LIMS",
  }),
};

export function deskUi(lang: AppLang): DeskUi {
  return { ...(DESK_UI[lang] || EN), ...(pageOverlay(lang) as Partial<DeskUi>) };
}

export function localVerdictTitle(
  lang: AppLang,
  verdict: { status: string; scheme: string | null; marks: string[]; title: string },
): string {
  const ui = deskUi(lang);
  const mark = verdict.marks[0] || "";
  const photo = /^Read from the photo/i.test(verdict.title);
  let core = verdict.title;
  if (verdict.status === "format-ok" && verdict.scheme === "ISI · Scheme-I") core = `${mark} · ${ui.titleIsi}`;
  else if (verdict.status === "format-ok" && verdict.scheme === "CRS · Scheme-II") core = `${mark} · ${ui.titleCrs}`;
  else if (verdict.status === "format-ok" && verdict.scheme === "Hallmark · HUID") core = `${mark} · ${ui.titleHuid}`;
  else if (verdict.status === "invalid" && !mark) {
    core = /product|brand/i.test(verdict.title) ? ui.titleNeedProduct : ui.titleNeedNumber;
  } else if (verdict.status === "invalid") core = ui.titleBadNumber;
  else if (verdict.status === "unclear" && mark) core = `${mark} · ${ui.titleMissing}`;
  else if (verdict.status === "unclear") core = ui.titleFamilyOpen;
  else if (verdict.status === "not-found") core = ui.titleNoPin;
  else if (verdict.status === "brand-hit") core = `${mark} · ${ui.titleNamed}`;
  else if (verdict.status === "unreadable") core = ui.titleUnread;
  if (photo && verdict.status !== "unreadable") return `${ui.titlePhoto}: ${core}`;
  return core;
}

export function localFactLabel(lang: AppLang, label: string): string {
  const ui = deskUi(lang);
  if (label === "Power") return ui.factPower;
  if (label === "Voltage") return ui.factVoltage;
  if (label === "Frequency") return ui.factFrequency;
  if (label === "Cap") return ui.factCap;
  if (label === "Colour") return ui.factColour;
  return label;
}

export function localOfficial(lang: AppLang, label: string): string {
  const ui = deskUi(lang);
  if (/lims/i.test(label)) return ui.openLims;
  if (/crs/i.test(label)) return ui.openCrs;
  if (/hallmark/i.test(label)) return ui.openHuid;
  if (/know your/i.test(label)) return ui.openKys;
  if (/manak/i.test(label)) return ui.openManak;
  return label;
}
