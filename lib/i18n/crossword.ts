import type { Direction } from "@/lib/crossword-schedule"

export const supportedCrosswordLocales = ["hi", "en"] as const

export type CrosswordLocale = (typeof supportedCrosswordLocales)[number]

export type CrosswordCopy = {
  lang: CrosswordLocale
  intlLocale: string
  appName: string
  tagline: string
  loadingTodayPuzzle: string
  loadingPuzzle: string
  startGame: string
  continueGame: string
  viewResults: string
  settings: string
  resetGame: string
  hintToggle: string
  bonusWordsToggle: string
  bonusWordsHint: string
  closeSettings: string
  scheduledPuzzles: string
  scheduledPuzzlesDescription: string
  closeScheduledPuzzles: string
  openPuzzle: string
  playPuzzle: string
  summaryTitle: string
  summarySubtitle: string
  totalTime: string
  viewTodaysWords: string
  understandWordMeanings: string
  weeklyStreak: string
  nextChallenge: string
  homePage: string
  todaysWordsSheetTitle: string
  closeMeanings: string
  backToHome: string
  useHint: string
  pauseGame: string
  homeIconAlt: string
  hintIconAlt: string
  pauseIconAlt: string
  pauseIllustrationAlt: string
  gamePausedTitle: string
  gamePausedDescription: string
  continueButton: string
  previousClue: string
  nextClue: string
  currentClue: string
  backspace: string
  mascotLabel: string
  trophyAlt: string
  streakAlt: string
  todayAlt: string
  completedAlt: string
  directionLabels: Record<Direction, string>
  weekdayLabels: readonly string[]
  formatWordsSolved: (solved: number, total: number) => string
  formatTimeTaken: (time: string) => string
  formatClueLabel: (number: number, direction: Direction) => string
  formatMeaningFallback: (answer: string) => string
  formatStreakStateAlt: (
    state: "complete" | "missed" | "pending",
    isToday: boolean
  ) => string
}

export const DEFAULT_CROSSWORD_LOCALE: CrosswordLocale = "hi"
export const CROSSWORD_LOCALE_STORAGE_KEY = "daily-crossword-locale"

const crosswordCopyByLocale: Record<CrosswordLocale, CrosswordCopy> = {
  hi: {
    lang: "hi",
    intlLocale: "hi-IN",
    appName: "क्रॉसवर्ड",
    tagline: "दिमाग लगाएं, शब्दों की पहेलियां सुलझाएं",
    loadingTodayPuzzle: "आज की पहेली लोड हो रही है...",
    loadingPuzzle: "गेम लोड हो रहा है...",
    startGame: "गेम जारी रखें",
    continueGame: "गेम जारी रखें",
    viewResults: "रिजल्ट देखें",
    settings: "सेटिंग",
    resetGame: "गेम रीसेट करें",
    hintToggle: "हिंट बंद करें",
    bonusWordsToggle: "बोनस शब्द बंद करें",
    bonusWordsHint: "Word Blast के लिए बोनस",
    closeSettings: "सेटिंग बंद करें",
    scheduledPuzzles: "शेड्यूल्ड पहेलियां",
    scheduledPuzzlesDescription: "खोलने के लिए कोई भी तय पहेली चुनें।",
    closeScheduledPuzzles: "शेड्यूल्ड पहेलियां बंद करें",
    openPuzzle: "खोलें",
    playPuzzle: "खेलें",
    summaryTitle: "शानदार जीत!",
    summarySubtitle: "सभी शब्द मिल गए, आज का चैलेंज पूरा",
    totalTime: "समय",
    viewTodaysWords: "आज के शब्द देखें",
    understandWordMeanings: "शब्दों का मतलब समझें",
    weeklyStreak: "इस सप्ताह आपकी स्ट्रीक",
    nextChallenge: "अगला चैलेंज",
    homePage: "होम पेज",
    todaysWordsSheetTitle: "आज के शब्द देखें",
    closeMeanings: "शब्दों के मतलब बंद करें",
    backToHome: "होम पेज",
    useHint: "हिंट इस्तेमाल करें",
    pauseGame: "गेम पॉज करें",
    homeIconAlt: "होम",
    hintIconAlt: "हिंट",
    pauseIconAlt: "पॉज",
    pauseIllustrationAlt: "पॉज",
    gamePausedTitle: "गेम पॉज है",
    gamePausedDescription: "बचे हुए शब्द खोजें, क्रॉसवर्ड पूरा करें",
    continueButton: "गेम जारी रखें",
    previousClue: "पिछला शब्द संकेत",
    nextClue: "अगला शब्द संकेत",
    currentClue: "हिंट",
    backspace: "बैकस्पेस",
    mascotLabel: "क्रॉसवर्ड लोगो",
    trophyAlt: "जीत",
    streakAlt: "स्ट्रीक",
    todayAlt: "आज",
    completedAlt: "पूरा",
    directionLabels: {
      across: "A",
      down: "D",
    },
    weekdayLabels: ["सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "रवि"],
    formatWordsSolved: (solved, total) => `${solved}/${total} खोजे गए शब्द`,
    formatTimeTaken: (time) => `समय लगा ${time}`,
    formatClueLabel: (number, direction) =>
      `${number}${crosswordCopyByLocale.hi.directionLabels[direction]}`,
    formatMeaningFallback: (answer) => `${answer} का मतलब जल्द जोड़ा जाएगा।`,
    formatStreakStateAlt: (state, isToday) => {
      if (isToday && state === "complete") {
        return "आज का चैलेंज पूरा"
      }

      if (state === "complete") {
        return "पूरा"
      }

      if (state === "missed") {
        return "छूटा"
      }

      return isToday ? "आज बाकी" : "बाकी"
    },
  },
  en: {
    lang: "en",
    intlLocale: "en-US",
    appName: "Crossword",
    tagline: "Think sharp, solve word puzzles",
    loadingTodayPuzzle: "Loading today's puzzle...",
    loadingPuzzle: "Loading game...",
    startGame: "Start Game",
    continueGame: "Continue Game",
    viewResults: "View Results",
    settings: "Settings",
    resetGame: "Reset Game",
    hintToggle: "Turn off hints",
    bonusWordsToggle: "Turn off bonus words",
    bonusWordsHint: "Bonus words for Word Blast",
    closeSettings: "Close settings",
    scheduledPuzzles: "Scheduled Puzzles",
    scheduledPuzzlesDescription: "Choose any scheduled puzzle to open it.",
    closeScheduledPuzzles: "Close scheduled puzzles",
    openPuzzle: "Open",
    playPuzzle: "Play",
    summaryTitle: "Great win!",
    summarySubtitle: "You found every word and finished today's challenge",
    totalTime: "Time",
    viewTodaysWords: "View Today's Words",
    understandWordMeanings: "Understand Word Meanings",
    weeklyStreak: "Your Streak This Week",
    nextChallenge: "Next Challenge",
    homePage: "Home",
    todaysWordsSheetTitle: "Today's Words",
    closeMeanings: "Close word meanings",
    backToHome: "Home",
    useHint: "Use hint",
    pauseGame: "Pause game",
    homeIconAlt: "Home",
    hintIconAlt: "Hint",
    pauseIconAlt: "Pause",
    pauseIllustrationAlt: "Paused",
    gamePausedTitle: "Game Paused",
    gamePausedDescription: "Find the remaining words to complete the crossword",
    continueButton: "Continue Game",
    previousClue: "Previous clue",
    nextClue: "Next clue",
    currentClue: "Hint",
    backspace: "Backspace",
    mascotLabel: "Crossword logo",
    trophyAlt: "Win",
    streakAlt: "Streak",
    todayAlt: "Today",
    completedAlt: "Completed",
    directionLabels: {
      across: "A",
      down: "D",
    },
    weekdayLabels: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
    formatWordsSolved: (solved, total) => `${solved}/${total} words solved`,
    formatTimeTaken: (time) => `Time taken ${time}`,
    formatClueLabel: (number, direction) =>
      `${number}${crosswordCopyByLocale.en.directionLabels[direction]}`,
    formatMeaningFallback: (answer) =>
      `Meaning for ${answer} will be added soon.`,
    formatStreakStateAlt: (state, isToday) => {
      if (isToday && state === "complete") {
        return "Today's challenge completed"
      }

      if (state === "complete") {
        return "Completed"
      }

      if (state === "missed") {
        return "Missed"
      }

      return isToday ? "Pending today" : "Pending"
    },
  },
}

export function isCrosswordLocale(
  value: string | null | undefined
): value is CrosswordLocale {
  return supportedCrosswordLocales.includes(value as CrosswordLocale)
}

export function getCrosswordCopy(locale: CrosswordLocale) {
  return crosswordCopyByLocale[locale]
}

export function getPreferredCrosswordLocale() {
  if (typeof window === "undefined") {
    return DEFAULT_CROSSWORD_LOCALE
  }

  const searchLocale = new URLSearchParams(window.location.search).get("lang")
  if (isCrosswordLocale(searchLocale)) {
    window.localStorage.setItem(CROSSWORD_LOCALE_STORAGE_KEY, searchLocale)
    return searchLocale
  }

  window.localStorage.setItem(
    CROSSWORD_LOCALE_STORAGE_KEY,
    DEFAULT_CROSSWORD_LOCALE
  )
  return DEFAULT_CROSSWORD_LOCALE
}
