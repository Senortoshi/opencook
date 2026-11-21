/**
 * The first cooks, and which existing posts belong to each.
 *
 * These posts were written before cook tags existed, so they carry no
 * `OC<name>` prefix; this list files them by hand (the same grouping as the
 * "OpenCook Cooks" mock, 2026-11-20). It is applied once at start-up by
 * `seedCooks` (lib/cooks-db.ts): additive, idempotent, and only to posts that
 * exist and were created before `CURATED_BEFORE` — so a fresh local database
 * whose NEW posts happen to reuse a number from this list is never mis-filed.
 *
 * New posts are filed by their tag (lib/cooks.ts), not by this list.
 */

/** Posts created on or after this (UTC) are never touched by the hand-filed list. */
export const CURATED_BEFORE = "2026-11-21 00:00:00";

export interface CookSeed {
  id: string;
  name: string;
  kind: string;
  pitch?: string;
  liveUrl?: string;
  /** What was learned, for a cook that is "early" rather than shipped. */
  lesson?: string;
  /** Id of the cook this one forked from, if any. */
  parent?: string;
  postIds: number[];
}

export const COOK_SEEDS: CookSeed[] = [
  {
    id: "therealbitcoinfun",
    name: "therealbitcoin.fun",
    kind: "Spawn #1",
    pitch: "Swap 1,100+ assets into BSV, the chain running Bitcoin's original protocol.",
    liveUrl: "https://therealbitcoin.fun",
    postIds: [27, 28, 29, 101, 2196, 2197, 2216, 2217, 2221, 2234, 2235],
  },
  {
    id: "froge",
    name: "Froge",
    kind: "Cook",
    pitch: "Turn an NFT you hold into a physical steel card.",
    liveUrl: "https://www.frogeproof.fun/",
    postIds: [
      2121, 2122, 2126, 2132, 2133, 2137, 2140, 2141, 2142, 2143, 2144, 2145, 2147, 2148, 2149,
      2150, 2160, 2161, 2162, 2164, 2169, 2170, 2171, 2172, 2173, 2175, 2176, 2178, 2180, 2181,
      2182, 2186, 2192, 2198, 2204, 2208, 2210, 2212, 2219, 2220, 2238, 2240, 2243, 2244, 2245,
      2246, 2251, 2257, 2258, 2276,
    ],
  },
  {
    id: "pumpsv",
    name: "pumpsv",
    kind: "Cook",
    pitch: "Open a pack and see what is in it.",
    liveUrl: "https://pumpsv.fun",
    postIds: [1414, 1415, 1764, 2109, 2110, 2112, 2113, 2214, 2215],
  },
  {
    id: "openbook",
    name: "OpenBook",
    kind: "Fork of OpenCook",
    pitch: "A fork of OpenCook that adds tokens.",
    liveUrl: "https://openbook-jet.vercel.app/",
    postIds: [2023, 2025, 2026, 2028, 2029, 2037, 2038, 2040, 2041, 2058, 2063, 2078, 2082],
  },
  {
    id: "pokerlock",
    name: "pokerlock",
    kind: "Cook",
    lesson:
      'Its founder said a gambling app "will be trouble" and draws legal attention. The idea waits for the right framing.',
    postIds: [
      1327, 1328, 1329, 1331, 1333, 1336, 1337, 1339, 1343, 1347, 1352, 1356, 1849, 1857, 1863,
      1865, 1867,
    ],
  },
  {
    id: "bridge",
    name: "bridge",
    kind: "Cook",
    lesson:
      "The purpose was not clear yet to both people. Parked until someone can say why and what for.",
    postIds: [1321, 1322, 1323, 1438, 1439, 1441, 1443, 1448, 1458, 1467, 1469, 1470],
  },
  {
    id: "tbsvsandbox",
    name: "tbsv sandbox",
    kind: "Cook",
    postIds: [788, 790, 791, 792, 839, 841, 992, 998],
  },
  {
    id: "securitytool",
    name: "security-tool",
    kind: "Cook",
    postIds: [1005, 1008, 1012, 1013, 1015, 1016, 1017, 1018],
  },
  {
    id: "notary",
    name: "notary",
    kind: "Cook",
    lesson:
      'Its founder called it "a lack of experience": sprinting before learning to crawl. Kept so the next person starts simpler.',
    postIds: [1618, 1619, 1620, 1624, 1627, 1629, 1713],
  },
  { id: "tgbot", name: "tgbot", kind: "Cook", postIds: [716, 782, 794, 1463] },
  { id: "memerace", name: "memerace", kind: "Cook", postIds: [2093, 2094, 2095, 2096] },
  { id: "authorsmarketplace", name: "authors marketplace", kind: "Cook", postIds: [2114, 2115] },
  { id: "peepoo", name: "peepoo", kind: "Cook", postIds: [2187, 2189] },
];
