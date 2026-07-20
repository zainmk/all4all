const FLAGS: Record<string, string> = {
  // A
  "afghanistan": "af", "albania": "al", "algeria": "dz", "angola": "ao",
  "argentina": "ar", "armenia": "am", "australia": "au", "austria": "at",
  "azerbaijan": "az",
  // B
  "bahrain": "bh", "bangladesh": "bd", "belarus": "by", "belgium": "be",
  "benin": "bj", "bolivia": "bo", "bosnia and herzegovina": "ba", "bosnia": "ba",
  "botswana": "bw", "brazil": "br", "bulgaria": "bg", "burkina faso": "bf",
  "burundi": "bi",
  // C
  "cambodia": "kh", "cameroon": "cm", "canada": "ca", "cape verde": "cv",
  "central african republic": "cf", "chad": "td", "chile": "cl", "china": "cn",
  "china pr": "cn", "colombia": "co", "comoros": "km", "congo": "cg",
  "dr congo": "cd", "democratic republic of congo": "cd", "costa rica": "cr",
  "croatia": "hr", "cuba": "cu", "cyprus": "cy", "czech republic": "cz",
  "czechia": "cz",
  // D
  "denmark": "dk", "djibouti": "dj",
  // E
  "ecuador": "ec", "egypt": "eg", "el salvador": "sv", "england": "gb-eng",
  "equatorial guinea": "gq", "eritrea": "er", "estonia": "ee", "eswatini": "sz",
  "ethiopia": "et",
  // F
  "fiji": "fj", "finland": "fi", "france": "fr",
  // G
  "gabon": "ga", "gambia": "gm", "georgia": "ge", "germany": "de",
  "ghana": "gh", "greece": "gr", "guatemala": "gt", "guinea": "gn",
  "guinea-bissau": "gw", "guyana": "gy",
  // H
  "haiti": "ht", "honduras": "hn", "hong kong": "hk", "hungary": "hu",
  // I
  "iceland": "is", "india": "in", "indonesia": "id", "iran": "ir",
  "iraq": "iq", "ireland": "ie", "israel": "il", "italy": "it",
  "ivory coast": "ci", "côte d'ivoire": "ci", "cote d'ivoire": "ci",
  // J
  "jamaica": "jm", "japan": "jp", "jordan": "jo",
  // K
  "kazakhstan": "kz", "kenya": "ke", "kuwait": "kw", "kyrgyzstan": "kg",
  // L
  "laos": "la", "latvia": "lv", "lebanon": "lb", "lesotho": "ls",
  "liberia": "lr", "libya": "ly", "lithuania": "lt", "luxembourg": "lu",
  // M
  "madagascar": "mg", "malawi": "mw", "malaysia": "my", "maldives": "mv",
  "mali": "ml", "malta": "mt", "mauritania": "mr", "mauritius": "mu",
  "mexico": "mx", "moldova": "md", "mongolia": "mn", "montenegro": "me",
  "morocco": "ma", "mozambique": "mz", "myanmar": "mm",
  // N
  "namibia": "na", "nepal": "np", "netherlands": "nl", "new caledonia": "nc",
  "new zealand": "nz", "nicaragua": "ni", "niger": "ne", "nigeria": "ng",
  "north korea": "kp", "north macedonia": "mk", "northern ireland": "gb-nir",
  "norway": "no",
  // O
  "oman": "om",
  // P
  "pakistan": "pk", "panama": "pa", "papua new guinea": "pg", "paraguay": "py",
  "peru": "pe", "philippines": "ph", "poland": "pl", "portugal": "pt",
  // Q
  "qatar": "qa",
  // R
  "romania": "ro", "russia": "ru", "rwanda": "rw",
  // S
  "saudi arabia": "sa", "scotland": "gb-sct", "senegal": "sn", "serbia": "rs",
  "sierra leone": "sl", "singapore": "sg", "slovakia": "sk", "slovenia": "si",
  "solomon islands": "sb", "somalia": "so", "south africa": "za",
  "south korea": "kr", "korea republic": "kr", "korea": "kr",
  "spain": "es", "sri lanka": "lk", "sudan": "sd", "suriname": "sr",
  "sweden": "se", "switzerland": "ch", "syria": "sy",
  // T
  "tahiti": "pf", "taiwan": "tw", "tajikistan": "tj", "tanzania": "tz",
  "thailand": "th", "timor-leste": "tl", "togo": "tg",
  "trinidad and tobago": "tt", "tunisia": "tn", "turkey": "tr",
  "türkiye": "tr", "turkmenistan": "tm",
  // U
  "uganda": "ug", "ukraine": "ua", "united arab emirates": "ae", "uae": "ae",
  "united states": "us", "usa": "us", "uruguay": "uy", "uzbekistan": "uz",
  // V
  "venezuela": "ve", "vietnam": "vn",
  // W
  "wales": "gb-wls",
  // Y
  "yemen": "ye",
  // Z
  "zambia": "zm", "zimbabwe": "zw",
};

export function flagUrl(teamName: string): string | undefined {
  const key = teamName.toLowerCase().trim();
  // Race rounds identify their country by ISO code ("GB"), which is already the
  // form flagcdn wants — no team name in these leagues is two letters long.
  const code = FLAGS[key] ?? (/^[a-z]{2}$/.test(key) ? key : undefined);
  return code ? `https://flagcdn.com/w80/${code}.png` : undefined;
}
