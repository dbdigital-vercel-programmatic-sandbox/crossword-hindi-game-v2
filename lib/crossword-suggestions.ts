import { Output, gateway, generateText } from "ai"

import { MAX_GRID_SIZE } from "@/lib/crossword-editor"

export type Difficulty = "easy" | "medium" | "hard"

export type SuggestionSource =
  | "theme"
  | "title"
  | "difficulty"
  | "dictionary"
  | "ai"
  | "custom"

export type SuggestionWord = {
  answer: string
  source: SuggestionSource
}

export type SuggestionRequest = {
  theme?: string
  title?: string
  difficulty?: Difficulty
  selectedWords?: string[]
  guidance?: string
}

type SuggestionInput = {
  theme: string
  title: string
  difficulty: Difficulty
  selectedWords?: string[]
  aiSuggestions?: string[]
  guidance?: string
  includeDictionary?: boolean
  includeSeedSources?: boolean
}

const AI_GATEWAY_MODEL = "openai/gpt-4o-mini"
const AI_GATEWAY_ENV_NAME = "APP_BUILDER_VERCEL_AI_GATEWAY"
const AI_SYSTEM_PROMPT =
  "You are an expert crossword constructor. Suggest single-word answers that are tightly aligned to the exact theme, title, and submitted guidance. Prefer exact domain entities over broad theme words, especially organizations, missions, agencies, acronyms, vehicles, payloads, facilities, instruments, and named programs. Avoid generic crossword filler and broad category words unless only a small minority are needed."

const EXACT_THEME_BANK: Record<string, string[]> = {
  bollywood: [
    "SHOLAY",
    "LAGAAN",
    "DANGAL",
    "SWADES",
    "BARFI",
    "ROCKSTAR",
    "PATHAAN",
    "SULTAN",
    "KRRISH",
    "OMKARA",
    "DHOOM",
    "MUGHAL",
  ],
  isro: [
    "CHANDRAYAAN",
    "MANGALYAAN",
    "GAGANYAAN",
    "ADITYAL",
    "PSLV",
    "GSLV",
    "NAVIC",
    "SRIHARIKOTA",
    "SATISHDHAWAN",
    "VIKRAM",
    "PRAGYAN",
    "ORBITER",
    "LANDER",
  ],
  nasa: [
    "APOLLO",
    "ARTEMIS",
    "VOYAGER",
    "CASSINI",
    "HUBBLE",
    "JPL",
    "ORION",
    "KENNEDY",
    "CAPE",
    "ROVER",
  ],
  olympics: [
    "OLYMPIAD",
    "PARALYMPICS",
    "PODIUM",
    "HEPTATHLON",
    "DECATHLON",
    "TORCH",
    "LAUREL",
    "MEDAL",
    "IOC",
    "VELODROME",
  ],
  ipl: [
    "POWERPLAY",
    "SUPEROVER",
    "WANKHEDE",
    "EDEN",
    "CHEPAUK",
    "PLAYOFFS",
    "ORANGE",
    "PURPLE",
    "SIXER",
    "YORKER",
  ],
}

const EXACT_THEME_GENERIC_WORDS: Record<string, string[]> = {
  bollywood: ["FILM", "FILMS", "MOVIE", "MOVIES", "CINEMA", "INDIAN"],
  isro: ["PROJECT", "SPACE", "MISSION"],
}

const THEME_BANK: Record<string, string[]> = {
  animals: [
    "ALPACA",
    "ANTLER",
    "BADGER",
    "BEAVER",
    "BISON",
    "BUFFALO",
    "COBRA",
    "COYOTE",
    "DOLPHIN",
    "EAGLE",
    "FERRET",
    "FOX",
    "GAZELLE",
    "GECKO",
    "GORILLA",
    "HERON",
    "HYENA",
    "IGUANA",
    "JAGUAR",
    "KOALA",
    "LEMUR",
    "LIZARD",
    "MANATEE",
    "MONKEY",
    "MOOSE",
    "NARWHAL",
    "OCELOT",
    "OTTER",
    "PANDA",
    "PENGUIN",
    "RABBIT",
    "RACCOON",
    "SALMON",
    "SEAL",
    "SHARK",
    "SLOTH",
    "TIGER",
    "TORTOISE",
    "WALRUS",
    "WHALE",
    "WILDCAT",
    "WOLF",
    "ZEBRA",
  ],
  space: [
    "APOLLO",
    "ASTEROID",
    "AURORA",
    "COMET",
    "COSMOS",
    "CRATER",
    "ECLIPSE",
    "GALAXY",
    "GRAVITY",
    "LUNAR",
    "METEOR",
    "MILKYWAY",
    "NEBULA",
    "NOVA",
    "ORBIT",
    "PHOTON",
    "PLANET",
    "PULSAR",
    "QUASAR",
    "ROCKET",
    "SATURN",
    "SOLAR",
    "STAR",
    "STARSHIP",
    "TELESCOPE",
    "VACUUM",
    "VENUS",
  ],
  ocean: [
    "ANCHOR",
    "ATOLL",
    "BRINE",
    "COAST",
    "CORAL",
    "CURRENT",
    "DELTA",
    "ESTUARY",
    "FATHOM",
    "FJORD",
    "HARBOR",
    "ISLAND",
    "KELP",
    "LAGOON",
    "MARINA",
    "MARINE",
    "NAUTILUS",
    "OCEANIC",
    "PEARL",
    "REEF",
    "SALT",
    "SEABED",
    "SEASHELL",
    "SHOAL",
    "TIDAL",
    "TIDEPOOL",
    "WAVE",
    "WHARF",
  ],
  food: [
    "ALMOND",
    "APRICOT",
    "BAGEL",
    "BASIL",
    "BISCUIT",
    "BROTH",
    "CACAO",
    "CARAMEL",
    "CARDAMOM",
    "CHIVE",
    "CINNAMON",
    "CITRUS",
    "CLOVE",
    "COCOA",
    "COOKIE",
    "CROISSANT",
    "CUMIN",
    "GARLIC",
    "GINGER",
    "HONEY",
    "MANGO",
    "MINT",
    "NOODLE",
    "OLIVE",
    "PAPRIKA",
    "PEPPER",
    "PICKLE",
    "PLUM",
    "RADISH",
    "SAFFRON",
    "SESAME",
    "SPICE",
    "SYRUP",
    "TURMERIC",
    "VANILLA",
  ],
  travel: [
    "AIRPORT",
    "ATLAS",
    "BAGGAGE",
    "BOARDING",
    "CABIN",
    "COMPASS",
    "CRUISE",
    "CUSTOMS",
    "DETOUR",
    "HOSTEL",
    "HOTEL",
    "ITINERARY",
    "JOURNEY",
    "LUGGAGE",
    "MILEAGE",
    "PASSPORT",
    "RAIL",
    "RESORT",
    "ROUTE",
    "RUNWAY",
    "SCENIC",
    "SUITCASE",
    "TICKET",
    "TOURISM",
    "TRANSIT",
    "TRIPOD",
    "VOYAGE",
  ],
  sports: [
    "ARENA",
    "BADMINTON",
    "BATON",
    "BOXING",
    "COACH",
    "DERBY",
    "FIELDER",
    "GOAL",
    "GYMNAST",
    "JERSEY",
    "KICKOFF",
    "LAP",
    "MEDAL",
    "PADDLE",
    "RACKET",
    "REFEREE",
    "RELAY",
    "ROWING",
    "SKATER",
    "SPRINTER",
    "STADIUM",
    "SWIMMER",
    "TACKLE",
    "TEAMWORK",
    "TROPHY",
    "UMPIRE",
    "VAULT",
  ],
  festival: [
    "BALLOON",
    "BANNER",
    "BEACON",
    "CARNIVAL",
    "CHEER",
    "CONFETTI",
    "CROWD",
    "DANCER",
    "DRUMMER",
    "FANFARE",
    "FESTIVE",
    "FIREWORK",
    "JUBILEE",
    "LANTERN",
    "MELODY",
    "PARADE",
    "RIBBON",
    "RHYTHM",
    "SHOWTIME",
    "SPARKLER",
    "SPOTLIGHT",
    "STAGE",
    "STREAMER",
  ],
  nature: [
    "BREEZE",
    "BROOK",
    "CANYON",
    "CEDAR",
    "CLOUD",
    "DUNE",
    "FERN",
    "FOREST",
    "GLACIER",
    "GROVE",
    "HARBOR",
    "HORIZON",
    "IVY",
    "LILAC",
    "MEADOW",
    "MOSS",
    "PINE",
    "PRAIRIE",
    "RAVINE",
    "RIVER",
    "SEQUOIA",
    "SHADOW",
    "SUMMIT",
    "SUNSET",
    "THICKET",
    "VALLEY",
    "WILLOW",
  ],
  music: [
    "ALLEGRO",
    "ANTHEM",
    "ARIA",
    "BALLAD",
    "BASSLINE",
    "BEAT",
    "CHORUS",
    "CODA",
    "ENCORE",
    "FUGUE",
    "HARMONY",
    "LYRIC",
    "MELODY",
    "NOTATION",
    "OCTAVE",
    "OPERA",
    "OVERTURE",
    "RHYTHM",
    "SONATA",
    "TEMPO",
    "TREBLE",
    "VERSE",
  ],
  city: [
    "ALLEY",
    "AVENUE",
    "BOROUGH",
    "BRIDGE",
    "CROSSWALK",
    "DOWNTOWN",
    "FOUNTAIN",
    "MARKET",
    "METRO",
    "NEON",
    "PLAZA",
    "SKYLINE",
    "STATION",
    "STREET",
    "SUBWAY",
    "TOWER",
    "TRAFFIC",
    "TRAM",
  ],
}

const THEME_ALIASES: Record<string, string[]> = {
  animals: ["animal", "wildlife", "zoo", "creature", "beast", "pet"],
  space: ["planet", "astronomy", "star", "cosmic", "moon", "mars"],
  ocean: ["sea", "marine", "beach", "water", "coast", "nautical"],
  food: ["kitchen", "flavor", "recipe", "cooking", "dessert", "fruit"],
  travel: ["trip", "vacation", "journey", "flight", "tour", "adventure"],
  sports: ["game", "athlete", "stadium", "team", "fitness", "match"],
  festival: ["celebration", "party", "parade", "holiday", "event"],
  nature: ["forest", "garden", "outdoors", "landscape", "earth"],
  music: ["song", "concert", "orchestra", "band", "sound"],
  city: ["urban", "downtown", "street", "metro", "architecture"],
}

const DIFFICULTY_WORDS: Record<Difficulty, string[]> = {
  easy: [
    "BLOOM",
    "CLUE",
    "FLARE",
    "FUN",
    "GLOW",
    "MINT",
    "PLAY",
    "STAR",
    "TRAIL",
    "WAVE",
  ],
  medium: [
    "CANVAS",
    "POCKET",
    "PUZZLE",
    "RIDDLE",
    "ROAMER",
    "SECRET",
    "SPARK",
    "TANGLE",
    "THREAD",
    "VOYAGE",
  ],
  hard: [
    "AFTERMATH",
    "BLUEPRINT",
    "CRESCENDO",
    "JUNCTION",
    "LABYRINTH",
    "MIDNIGHT",
    "QUANTUM",
    "RADIANCE",
    "TWILIGHT",
    "WILDERNESS",
  ],
}

const DOMAIN_GENERIC_WORDS: Record<string, string[]> = {
  animals: ["ANIMAL", "BEAST", "CREATURE", "PET", "WILDLIFE"],
  space: [
    "ASTRO",
    "ASTRONAUT",
    "COSMOS",
    "GALAXY",
    "MOON",
    "ORBIT",
    "PLANET",
    "ROCKET",
    "SPACE",
    "STAR",
    "UNIVERSE",
  ],
  ocean: ["BEACH", "COAST", "OCEAN", "SEA", "SHORE", "WATER", "WAVE"],
  food: ["DISH", "FLAVOR", "FOOD", "MEAL", "RECIPE", "SNACK", "TASTE"],
  travel: [
    "ADVENTURE",
    "JOURNEY",
    "ROUTE",
    "TOUR",
    "TRANSIT",
    "TRAVEL",
    "TRIP",
    "VACATION",
  ],
  sports: ["ATHLETE", "GAME", "MATCH", "PLAYER", "SPORT", "TEAM"],
  festival: [
    "CELEBRATION",
    "EVENT",
    "FESTIVAL",
    "HOLIDAY",
    "MUSIC",
    "PARTY",
    "SHOW",
  ],
  nature: ["EARTH", "GREEN", "NATURE", "OUTDOOR", "PLANT", "TREE"],
  music: ["MUSIC", "NOTE", "RHYTHM", "SINGER", "SONG", "SOUND", "TUNE"],
  city: ["BLOCK", "BUILDING", "CITY", "ROAD", "STREET", "TOWN", "URBAN"],
}

const GENERIC_HINT_WORDS = new Set([
  "BASIC",
  "COMMON",
  "GENERAL",
  "GENERIC",
  "NORMAL",
  "STANDARD",
])

const GENERIC_CROSSWORD_WORDS = [
  "ACCENT",
  "AERIAL",
  "AMBER",
  "ARCHER",
  "BADGE",
  "BEACON",
  "BLOSSOM",
  "BREEZE",
  "BRIGHT",
  "CASCADE",
  "CHARM",
  "CINDER",
  "CIRCLE",
  "COMPASS",
  "CRIMSON",
  "CRYSTAL",
  "DAZZLE",
  "EMBER",
  "EPOCH",
  "FABLE",
  "FEATHER",
  "FLARE",
  "FLOURISH",
  "GLIMMER",
  "HARBOR",
  "HAVEN",
  "HUSH",
  "JASMINE",
  "JETTY",
  "JOURNAL",
  "KINDLE",
  "LAGOON",
  "LATTICE",
  "LEGEND",
  "LILAC",
  "LUMEN",
  "MARBLE",
  "MARIGOLD",
  "MINGLE",
  "MIRROR",
  "MOSAIC",
  "MURMUR",
  "NECTAR",
  "NICKEL",
  "NIMBLE",
  "ORCHARD",
  "ORIGIN",
  "PALETTE",
  "PARLOR",
  "PATTERN",
  "PEBBLE",
  "PENDULUM",
  "PETAL",
  "PHOENIX",
  "PILGRIM",
  "PILLOW",
  "PINNACLE",
  "POLARIS",
  "PORTAL",
  "PRISM",
  "QUEST",
  "QUILL",
  "RADIANT",
  "RAVEL",
  "RIBBON",
  "RIPPLE",
  "ROSETTE",
  "SABLE",
  "SAILOR",
  "SCARLET",
  "SERENE",
  "SHIMMER",
  "SIGNAL",
  "SILVER",
  "SOLACE",
  "SPANGLE",
  "SPARROW",
  "SPELL",
  "SPIRE",
  "SPRUCE",
  "STATIC",
  "STENCIL",
  "SUMMIT",
  "SUNLIT",
  "SWIRL",
  "SYMPHONY",
  "THIMBLE",
  "THRIVE",
  "TOPAZ",
  "TRINKET",
  "TUNDRA",
  "VELVET",
  "VERDANT",
  "VIOLET",
  "VISTA",
  "WANDER",
  "WHISPER",
  "WICKER",
  "WILLOW",
  "WINDOW",
  "WONDER",
]

export function buildSuggestions({
  theme,
  title,
  difficulty,
  selectedWords = [],
  aiSuggestions = [],
  guidance = "",
  includeDictionary = false,
  includeSeedSources = true,
}: SuggestionInput) {
  const difficultyRange = getDifficultyRange(difficulty)
  const context = `${theme} ${title} ${guidance}`.toLowerCase()
  const selectedSet = new Set(selectedWords.map(normalizeAnswer))
  const selectedLetters = new Set(
    selectedWords.flatMap((word) => normalizeAnswer(word).split(""))
  )
  const contextTokens = tokenizeContext(context)
  const contextStems = getContextStems(contextTokens)
  const themeKeys = resolveThemeKeys(context)
  const exactThemeKeys = resolveExactThemeKeys(contextTokens)
  const genericWords = getGenericWords(themeKeys, exactThemeKeys)
  const scored = new Map<
    string,
    { suggestion: SuggestionWord; score: number }
  >()

  const sources: Array<SuggestionWord & { score: number }> = [
    ...(includeSeedSources
      ? tokenizeToSuggestions(theme, "theme").map((item) => ({
          ...item,
          score: 120,
        }))
      : []),
    ...(includeSeedSources
      ? tokenizeToSuggestions(title, "title").map((item) => ({
          ...item,
          score: 105,
        }))
      : []),
    ...(includeSeedSources
      ? tokenizeToSuggestions(guidance, "custom").map((item) => ({
          ...item,
          score: 112,
        }))
      : []),
    ...(includeSeedSources
      ? exactThemeKeys.flatMap((key) =>
          (EXACT_THEME_BANK[key] ?? []).map((answer) => ({
            answer,
            source: "theme" as const,
            score: 148,
          }))
        )
      : []),
    ...(includeSeedSources
      ? themeKeys.flatMap((key) =>
          THEME_BANK[key].map((answer) => ({
            answer,
            source: "theme" as const,
            score: 96,
          }))
        )
      : []),
    ...(includeSeedSources
      ? DIFFICULTY_WORDS[difficulty].map((answer) => ({
          answer,
          source: "difficulty" as const,
          score: 60,
        }))
      : []),
    ...(includeDictionary
      ? GENERIC_CROSSWORD_WORDS.map((answer) => ({
          answer,
          source: "dictionary" as const,
          score: 38,
        }))
      : []),
    ...aiSuggestions.map((answer) => ({
      answer,
      source: "ai" as const,
      score: 180,
    })),
  ]

  sources.forEach((entry) => {
    const answer = normalizeAnswer(entry.answer)
    if (
      answer.length < difficultyRange.min ||
      answer.length > difficultyRange.max ||
      answer.length > MAX_GRID_SIZE ||
      selectedSet.has(answer)
    ) {
      return
    }

    const overlapScore = countLetterOverlap(answer, selectedLetters) * 4
    const closenessScore =
      10 - Math.abs(answer.length - getTargetLength(difficulty))
    const titleScore = context.includes(answer.toLowerCase()) ? 18 : 0
    const themeScore = themeKeys.some((key) => THEME_BANK[key].includes(answer))
      ? 20
      : 0
    const specificityScore = getSpecificityScore({
      answer,
      contextTokens,
      contextStems,
      themeKeys,
      exactThemeKeys,
      source: entry.source,
    })
    const genericPenalty = getGenericPenalty({
      answer,
      genericWords,
      themeKeys,
      exactThemeKeys,
      source: entry.source,
    })
    const total =
      entry.score +
      overlapScore +
      closenessScore +
      titleScore +
      themeScore +
      specificityScore -
      genericPenalty
    const existing = scored.get(answer)

    if (!existing || total > existing.score) {
      scored.set(answer, {
        suggestion: {
          answer,
          source: entry.source,
        },
        score: total,
      })
    }
  })

  return balanceTopSuggestions({
    entries: [...scored.values()].sort(
      (left, right) =>
        right.score - left.score ||
        left.suggestion.answer.localeCompare(right.suggestion.answer)
    ),
    genericWords,
    themeKeys,
    exactThemeKeys,
  }).map((entry) => entry.suggestion)
}

export async function getSuggestionResponse({
  theme,
  title,
  difficulty,
  selectedWords,
  guidance,
}: SuggestionRequest) {
  const normalizedTheme = theme?.trim() ?? ""
  const normalizedTitle = title?.trim() ?? ""
  const normalizedGuidance = guidance?.trim() ?? ""
  const normalizedDifficulty = normalizeDifficulty(difficulty)
  const normalizedSelectedWords = Array.isArray(selectedWords)
    ? selectedWords
    : []

  const aiInspirationPool = buildAiInspirationPool({
    theme: normalizedTheme,
    title: normalizedTitle,
    difficulty: normalizedDifficulty,
    selectedWords: normalizedSelectedWords,
    guidance: normalizedGuidance,
  })
  const aiSuggestions = await suggestWordsWithAi({
    theme: normalizedTheme,
    title: normalizedTitle,
    difficulty: normalizedDifficulty,
    selectedWords: normalizedSelectedWords,
    guidance: normalizedGuidance,
    candidateWords: aiInspirationPool,
  })

  if (aiSuggestions.length > 0) {
    return {
      suggestions: buildSuggestions({
        theme: normalizedTheme,
        title: normalizedTitle,
        difficulty: normalizedDifficulty,
        selectedWords: normalizedSelectedWords,
        guidance: normalizedGuidance,
        aiSuggestions,
        includeSeedSources: false,
      }),
      engine: "ai" as const,
      aiAvailable: isAiSuggestionAvailable(),
    }
  }

  return {
    suggestions: buildSuggestions({
      theme: normalizedTheme,
      title: normalizedTitle,
      difficulty: normalizedDifficulty,
      selectedWords: normalizedSelectedWords,
      guidance: normalizedGuidance,
      includeDictionary: true,
    }),
    engine: "dictionary" as const,
    aiAvailable: isAiSuggestionAvailable(),
  }
}

export function isAiSuggestionAvailable() {
  return Boolean(getAiGatewayApiKey())
}

export async function suggestWordsWithAi({
  theme,
  title,
  difficulty,
  selectedWords = [],
  candidateWords = [],
  guidance = "",
}: {
  theme: string
  title: string
  difficulty: Difficulty
  selectedWords?: string[]
  candidateWords?: string[]
  guidance?: string
}) {
  const apiKey = getAiGatewayApiKey()

  if (!apiKey) {
    return []
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    process.env.AI_GATEWAY_API_KEY = apiKey
  }

  const controller = new AbortController()

  try {
    const result = await generateText({
      model: gateway(AI_GATEWAY_MODEL),
      system: AI_SYSTEM_PROMPT,
      prompt: JSON.stringify({
        instructions:
          'Return a top-level JSON object with a "words" array. Follow the submitted guidance closely. Prefer exact domain entities over broad theme words. Favor organizations, missions, agencies, acronyms, vehicles, payloads, facilities, instruments, and named programs. For ISRO project, return Indian space mission and program vocabulary first, such as CHANDRAYAAN, MANGALYAAN, PSLV, GSLV, and SRIHARIKOTA. Generic words are acceptable only as a small minority, and only when more specific options are exhausted. Use uppercase-style answers after normalization, no punctuation, letters only, no repeats, and entries that are likely to cross well with the existing words.',
        theme,
        title,
        guidance,
        difficulty,
        maxLength: MAX_GRID_SIZE,
        minLength: getDifficultyRange(difficulty).min,
        maxSuggestedLength: getDifficultyRange(difficulty).max,
        selectedWords,
        inspirationPool: candidateWords.slice(0, 40),
        desiredCount: 30,
      }),
      output: Output.json({
        name: "crossword_word_suggestions",
        description:
          "A JSON object containing a words array of suggested answers.",
      }),
      temperature: 0.4,
      abortSignal: controller.signal,
      timeout: 10000,
    })

    return extractAiWords(result.output)
  } catch {
    return []
  }
}

function getAiGatewayApiKey() {
  const configuredKey = process.env[AI_GATEWAY_ENV_NAME]?.trim()

  if (configuredKey) {
    return configuredKey
  }

  return process.env.AI_GATEWAY_API_KEY?.trim() ?? ""
}

function extractAiWords(value: unknown) {
  if (!value || typeof value !== "object") {
    return []
  }

  const words = (value as { words?: unknown }).words

  if (!Array.isArray(words)) {
    return []
  }

  return words
    .filter((entry): entry is string => typeof entry === "string")
    .map(normalizeAnswer)
    .filter((word) => word.length >= 3 && word.length <= MAX_GRID_SIZE)
}

function tokenizeToSuggestions(value: string, source: SuggestionSource) {
  return value
    .split(/[^A-Za-z]+/)
    .map((part) => normalizeAnswer(part))
    .filter((part) => part.length >= 3)
    .map((answer) => ({ answer, source }))
}

function tokenizeContext(value: string) {
  return new Set(
    value
      .split(/[^A-Za-z]+/)
      .map((part) => normalizeAnswer(part))
      .filter((part) => part.length >= 3)
  )
}

function getGenericWords(themeKeys: string[], exactThemeKeys: string[]) {
  return new Set([
    ...themeKeys.flatMap((key) => DOMAIN_GENERIC_WORDS[key] ?? []),
    ...exactThemeKeys.flatMap((key) => EXACT_THEME_GENERIC_WORDS[key] ?? []),
  ])
}

function getSpecificityScore({
  answer,
  contextTokens,
  contextStems,
  themeKeys,
  exactThemeKeys,
  source,
}: {
  answer: string
  contextTokens: Set<string>
  contextStems: Set<string>
  themeKeys: string[]
  exactThemeKeys: string[]
  source: SuggestionSource
}) {
  const hasThemeContext =
    themeKeys.length > 0 || exactThemeKeys.length > 0 || contextTokens.size > 0
  const looksSpecific = isLikelySpecificAnswer(answer)
  const isAcronym = isAcronymLikeAnswer(answer)
  const exactThemeMatch = exactThemeKeys.some((key) =>
    (EXACT_THEME_BANK[key] ?? []).includes(answer)
  )
  const matchesContextToken = [...contextTokens].some(
    (token) =>
      token.length >= 4 && (answer.includes(token) || token.includes(answer))
  )
  const matchesContextStem = [...contextStems].some(
    (stem) => stem.length >= 4 && answer.includes(stem)
  )

  let score = 0

  if (
    (source === "ai" || source === "custom") &&
    hasThemeContext &&
    looksSpecific
  ) {
    score += 18
  }

  if (source === "ai" && answer.length >= 8) {
    score += 6
  }

  if (isAcronym) {
    score += exactThemeKeys.length > 0 ? 20 : 10
  }

  if (exactThemeMatch) {
    score += 30
  }

  if (source === "theme" && looksSpecific) {
    score += 6
  }

  if (source === "custom" && looksSpecific) {
    score += 8
  }

  if (matchesContextToken) {
    score += 8
  }

  if (matchesContextStem) {
    score += 12
  }

  if (looksSpecific) {
    score += 6
  }

  if (exactThemeKeys.length > 0 && isLikelyProgramWord(answer)) {
    score += 14
  }

  return score
}

function getGenericPenalty({
  answer,
  genericWords,
  themeKeys,
  exactThemeKeys,
  source,
}: {
  answer: string
  genericWords: Set<string>
  themeKeys: string[]
  exactThemeKeys: string[]
  source: SuggestionSource
}) {
  if (source === "custom") {
    return 0
  }

  let penalty = 0

  if (genericWords.has(answer)) {
    penalty +=
      source === "ai"
        ? exactThemeKeys.length > 0
          ? 42
          : themeKeys.length > 0
            ? 28
            : 14
        : exactThemeKeys.length > 0
          ? 20
          : themeKeys.length > 0
            ? 14
            : 6
  }

  if (GENERIC_HINT_WORDS.has(answer)) {
    penalty += source === "ai" ? 16 : 8
  }

  if (answer.length <= 5 && themeKeys.length > 0) {
    penalty += source === "ai" ? 4 : 2
  }

  if (exactThemeKeys.length > 0 && !isLikelySpecificAnswer(answer)) {
    penalty += source === "ai" ? 10 : 4
  }

  return penalty
}

function buildAiInspirationPool({
  theme,
  title,
  difficulty,
  selectedWords = [],
  guidance = "",
}: SuggestionInput) {
  const context = `${theme} ${title} ${guidance}`.toLowerCase()
  const contextTokens = tokenizeContext(context)
  const exactThemeKeys = resolveExactThemeKeys(contextTokens)
  const themeKeys = resolveThemeKeys(context)
  const selectedSet = new Set(selectedWords.map(normalizeAnswer))
  const seedAnswers = new Set<string>()

  tokenizeToSuggestions(theme, "theme").forEach((item) => {
    seedAnswers.add(item.answer)
  })

  tokenizeToSuggestions(title, "title").forEach((item) => {
    seedAnswers.add(item.answer)
  })

  tokenizeToSuggestions(guidance, "custom").forEach((item) => {
    seedAnswers.add(item.answer)
  })

  exactThemeKeys.forEach((key) => {
    ;(EXACT_THEME_BANK[key] ?? []).forEach((answer) => {
      seedAnswers.add(answer)
    })
  })

  themeKeys.forEach((key) => {
    THEME_BANK[key]
      .filter(
        (answer) =>
          isLikelySpecificAnswer(answer) || isLikelyProgramWord(answer)
      )
      .forEach((answer) => {
        seedAnswers.add(answer)
      })
  })

  return [...seedAnswers]
    .filter((answer) => answer.length >= getDifficultyRange(difficulty).min)
    .filter((answer) => answer.length <= MAX_GRID_SIZE)
    .filter((answer) => !selectedSet.has(answer))
    .sort((left, right) => {
      const leftSpecific = getAiSeedPriority(
        left,
        contextTokens,
        exactThemeKeys
      )
      const rightSpecific = getAiSeedPriority(
        right,
        contextTokens,
        exactThemeKeys
      )

      return rightSpecific - leftSpecific || left.localeCompare(right)
    })
}

function isLikelySpecificAnswer(answer: string) {
  const vowelCount = (answer.match(/[AEIOU]/g) ?? []).length

  return (
    answer.length >= 7 ||
    /(?:YAAN|GRAM|NAV|CRAFT|SHIP|PORT|BASE|LAB|SAT|SITE|STAN|METER)$/i.test(
      answer
    ) ||
    (answer.length >= 3 && answer.length <= 5 && vowelCount <= 1) ||
    /(?:IKOTA|DHAWAN|PRAGYAN|VIKRAM)$/i.test(answer)
  )
}

function isAcronymLikeAnswer(answer: string) {
  const vowelCount = (answer.match(/[AEIOU]/g) ?? []).length

  return answer.length >= 3 && answer.length <= 6 && vowelCount <= 1
}

function isLikelyProgramWord(answer: string) {
  return /(?:YAAN|SLV|NAVIC|GRAM|SAT|ORBITER|LANDER|ROVER|DHawan|IKOTA)$/i.test(
    answer
  )
}

function getAiSeedPriority(
  answer: string,
  contextTokens: Set<string>,
  exactThemeKeys: string[]
) {
  let score = 0

  if (isAcronymLikeAnswer(answer)) {
    score += 12
  }

  if (isLikelySpecificAnswer(answer)) {
    score += 10
  }

  if (isLikelyProgramWord(answer)) {
    score += 10
  }

  if (
    exactThemeKeys.some((key) => (EXACT_THEME_BANK[key] ?? []).includes(answer))
  ) {
    score += 24
  }

  if (
    [...contextTokens].some(
      (token) =>
        token.length >= 4 && (answer.includes(token) || token.includes(answer))
    )
  ) {
    score += 10
  }

  return score
}

function balanceTopSuggestions({
  entries,
  genericWords,
  themeKeys,
  exactThemeKeys,
}: {
  entries: Array<{ suggestion: SuggestionWord; score: number }>
  genericWords: Set<string>
  themeKeys: string[]
  exactThemeKeys: string[]
}) {
  const shouldBalance =
    exactThemeKeys.length > 0 ||
    (themeKeys.length > 0 &&
      entries.some(
        (entry) => !isBroadGenericAnswer(entry.suggestion.answer, genericWords)
      ))

  if (!shouldBalance) {
    return entries
  }

  const topWindow = exactThemeKeys.length > 0 ? 12 : 10
  const genericCap = exactThemeKeys.length > 0 ? 2 : 3
  const prioritized: Array<{ suggestion: SuggestionWord; score: number }> = []
  const deferred: Array<{ suggestion: SuggestionWord; score: number }> = []
  let genericCount = 0

  entries.forEach((entry, index) => {
    const isBroadGeneric = isBroadGenericAnswer(
      entry.suggestion.answer,
      genericWords
    )

    if (index < topWindow && isBroadGeneric && genericCount >= genericCap) {
      deferred.push(entry)
      return
    }

    prioritized.push(entry)

    if (index < topWindow && isBroadGeneric) {
      genericCount += 1
    }
  })

  return [...prioritized, ...deferred]
}

function isBroadGenericAnswer(answer: string, genericWords: Set<string>) {
  return genericWords.has(answer) || GENERIC_HINT_WORDS.has(answer)
}

function getContextStems(contextTokens: Set<string>) {
  const stems = new Set<string>()

  contextTokens.forEach((token) => {
    if (token.length >= 4) {
      stems.add(token.slice(0, Math.min(token.length, 6)))
    }

    if (token.length >= 5) {
      stems.add(token.slice(0, 4))
      stems.add(token.slice(-4))
    }
  })

  return stems
}

function resolveExactThemeKeys(contextTokens: Set<string>) {
  return Object.keys(EXACT_THEME_BANK).filter((key) =>
    [...contextTokens].some((token) => token.toLowerCase() === key)
  )
}

function resolveThemeKeys(context: string) {
  return Object.keys(THEME_BANK).filter((key) => {
    if (context.includes(key)) {
      return true
    }

    return (THEME_ALIASES[key] ?? []).some((alias) => context.includes(alias))
  })
}

function getDifficultyRange(difficulty: Difficulty) {
  if (difficulty === "easy") {
    return { min: 3, max: 6 }
  }

  if (difficulty === "hard") {
    return { min: 6, max: 11 }
  }

  return { min: 4, max: 8 }
}

function normalizeDifficulty(value?: string): Difficulty {
  return value === "easy" || value === "hard" ? value : "medium"
}

function getTargetLength(difficulty: Difficulty) {
  if (difficulty === "easy") {
    return 5
  }

  if (difficulty === "hard") {
    return 8
  }

  return 6
}

function countLetterOverlap(answer: string, selectedLetters: Set<string>) {
  return new Set(answer.split("")).size
    ? [...new Set(answer.split(""))].filter((letter) =>
        selectedLetters.has(letter)
      ).length
    : 0
}

export function normalizeAnswer(value: string) {
  return value.replace(/[^A-Za-z]/g, "").toUpperCase()
}
