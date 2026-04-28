"use client"

import { Noto_Sans } from "next/font/google"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
} from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"

import { crosswordLevels } from "@/data/crossword-levels"
import {
  DEFAULT_CROSSWORD_LOCALE,
  getCrosswordCopy,
  getPreferredCrosswordLocale,
  type CrosswordLocale,
  type CrosswordCopy,
} from "@/lib/i18n/crossword"
import {
  type ClueDefinition,
  type CrosswordPuzzle,
  type CrosswordPuzzleSummary,
  getLocalDateKey,
  getScheduledPuzzle,
  msUntilNextLocalMidnight,
} from "@/lib/crossword-schedule"
import { cn } from "@/lib/utils"

const gameFont = Noto_Sans({
  subsets: ["latin", "devanagari"],
  weight: ["400", "600", "700"],
})
const homeTitleFont = gameFont
const homeBodyFont = gameFont
const SCREEN_TRANSITION_FALLBACK_MS = 900
const topHeaderOffsetClass = "pt-[calc(env(safe-area-inset-top)+62px)]"

type LockSource = "given" | "revealed" | "solved"
type FeedbackType = "wrong" | "correct"
type Screen = "home" | "game" | "summary"
type CompactMode = "normal" | "compact" | "tight"

type StreakDay = {
  label: string
  state: "complete" | "missed" | "pending"
  isToday: boolean
}

type GridCell = {
  row: number
  col: number
  solution: string
  clueIds: string[]
  number?: number
}

type Clue = ClueDefinition & {
  cells: Array<{ row: number; col: number; key: string }>
}

type GameState = {
  entries: Record<string, string>
  lockSources: Partial<Record<string, LockSource>>
  solvedIds: string[]
  completedIds: string[]
  wrongGuessCounts: Record<string, number>
  elapsedSeconds: number
  activeClueId: string
  activeIndex: number
  feedback: FeedbackState | null
}

type FeedbackState = {
  clueId: string
  type: FeedbackType
  stamp: number
}

type CelebrationState = {
  clueId: string
  solvedCellKeys: string[]
  blastCellKeys: string[]
  stamp: number
}

type GameSettings = {
  isHintsTurnedOff: boolean
  isWordBlastTurnedOff: boolean
}

type ScreenTransitionState = {
  from: Screen
  to: Screen
  phase: "prepare" | "active"
}

type ScreenMotionState = "static" | "enter" | "exit"

type ScreenTransitionPair =
  | "idle"
  | "home-game"
  | "game-home"
  | "game-summary"
  | "summary-home"
  | "home-summary"
  | "summary-game"

type PuzzleModel = {
  GRID_ROWS: number
  GRID_COLS: number
  clues: Clue[]
  clueOrder: string[]
  clueById: Record<string, Clue>
  cellData: Record<string, GridCell>
  givenLocks: Partial<Record<string, LockSource>>
  initialEntries: Record<string, string>
  initialGame: GameState
}

const keyboardRows = [
  "QWERTYUIOP".split(""),
  "ASDFGHJKL".split(""),
  "ZXCVBNM".split(""),
]

const keyboardButtonClassName =
  "inline-flex w-full min-w-0 items-center justify-center bg-white font-semibold text-[#1B1B1D] shadow-[0px_1.7777777910232544px_0px_rgba(0,0,0,0.25)]"

const dlsAssets = {
  home: "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Home_Outline.svg",
  pause:
    "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Pause_Outline.svg",
  hint: "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Hint.svg",
  fire: "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Fire.svg",
  tick: "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/TIck.svg",
  cross:
    "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Cross.svg",
  emptyCell:
    "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Empty%20Cell.svg",
  ray: "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Ray.svg",
  backspace:
    "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Backspace_Outline.svg",
  timer:
    "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Timer_illustration.svg",
  trophy:
    "https://raw.githubusercontent.com/joefrancis-dot/DLS-assets/main/Trophy.svg",
} as const

type TopHeaderProps = {
  title: string
  onBack: () => void
}

function TopHeader({ title, onBack }: TopHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.15)]">
      <div className="mx-auto flex w-full max-w-[400px] items-center gap-[16px] px-[16px] pb-[16px] pt-[calc(env(safe-area-inset-top)+16px)]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="inline-flex h-[24px] w-[24px] shrink-0 items-center justify-center text-[#2B2B2B]"
        >
          <img
            src="/top-header-back.svg"
            alt=""
            aria-hidden="true"
            className="h-[24px] w-[24px]"
            width={24}
            height={24}
          />
        </button>
        <div
          className={cn(
            homeTitleFont.className,
            "text-left text-[20px] leading-[30px] font-semibold text-[#2B2B2B]"
          )}
        >
          {title}
        </div>
      </div>
    </header>
  )
}

export default function Page() {
  const [locale, setLocale] = useState<CrosswordLocale>(
    DEFAULT_CROSSWORD_LOCALE
  )
  const [dateKey, setDateKey] = useState(() => getLocalDateKey())
  const [scheduledPuzzle, setScheduledPuzzle] = useState<CrosswordPuzzle>(() =>
    getScheduledPuzzle(crosswordLevels, dateKey)
  )
  const [schedule, setSchedule] = useState<CrosswordPuzzleSummary[]>(() =>
    crosswordLevels.map((puzzle) => ({
      id: puzzle.id,
      date: puzzle.date,
      title: puzzle.title,
      clueCount: puzzle.clues.length,
    }))
  )
  const [isPuzzleLoading, setIsPuzzleLoading] = useState(true)
  const puzzleModel = useMemo(
    () => buildPuzzleModel(scheduledPuzzle),
    [scheduledPuzzle]
  )
  const { GRID_COLS, GRID_ROWS, cellData, clueById, clueOrder, clues } =
    puzzleModel

  const [game, setGame] = useState<GameState>(() => puzzleModel.initialGame)
  const [screen, setScreen] = useState<Screen>("home")
  const [isPauseOpen, setIsPauseOpen] = useState(false)
  const [isMeaningSheetOpen, setIsMeaningSheetOpen] = useState(false)
  const [isHomeSettingsOpen, setIsHomeSettingsOpen] = useState(false)
  const [isTestScheduleOpen, setIsTestScheduleOpen] = useState(false)
  const [isHintsTurnedOff, setIsHintsTurnedOff] = useState(false)
  const [isWordBlastTurnedOff, setIsWordBlastTurnedOff] = useState(false)
  const [hintNudgeVersion, setHintNudgeVersion] = useState(0)
  const [hintPromptClueId, setHintPromptClueId] = useState<string | null>(null)
  const [isHintButtonHighlighted, setIsHintButtonHighlighted] = useState(false)
  const [logoTapCount, setLogoTapCount] = useState(0)
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null)
  const [celebration, setCelebration] = useState<CelebrationState | null>(null)
  const [completionHistory, setCompletionHistory] = useState<
    Record<string, boolean>
  >({})
  const [compactMode, setCompactMode] = useState<CompactMode>("normal")
  const [settledScreen, setSettledScreen] = useState<Screen>("home")
  const [screenTransition, setScreenTransition] =
    useState<ScreenTransitionState | null>(null)
  const screenTransitionTimerRef = useRef<number | null>(null)
  const screenTransitionFrameRef = useRef<number | null>(null)
  const storageKey = useMemo(
    () => getPuzzleStorageKey(scheduledPuzzle.id),
    [scheduledPuzzle.id]
  )
  const copy = useMemo(() => getCrosswordCopy(locale), [locale])

  useEffect(() => {
    setLocale(getPreferredCrosswordLocale())
  }, [])

  useEffect(() => {
    document.documentElement.lang = copy.lang
  }, [copy.lang])

  useEffect(() => {
    let isCancelled = false
    setIsPuzzleLoading(true)

    const fallbackPuzzle = getScheduledPuzzle(crosswordLevels, dateKey)
    const fallbackSchedule = crosswordLevels.map((puzzle) => ({
      id: puzzle.id,
      date: puzzle.date,
      title: puzzle.title,
      clueCount: puzzle.clues.length,
    }))

    const loadPuzzle = async () => {
      try {
        const response = await fetch(`/api/puzzles?date=${dateKey}`, {
          cache: "no-store",
        })
        if (!response.ok) {
          if (isCancelled) {
            return
          }

          setScheduledPuzzle(fallbackPuzzle)
          setSchedule(fallbackSchedule)
          return
        }

        const data = (await response.json()) as {
          puzzle: CrosswordPuzzle
          schedule: CrosswordPuzzleSummary[]
        }

        if (isCancelled) {
          return
        }

        setScheduledPuzzle(data.puzzle)
        setSchedule(data.schedule)
      } catch {
        if (isCancelled) {
          return
        }

        setScheduledPuzzle(fallbackPuzzle)
        setSchedule(fallbackSchedule)
      } finally {
        if (isCancelled) {
          return
        }

        setIsPuzzleLoading(false)
      }
    }

    void loadPuzzle()

    return () => {
      isCancelled = true
    }
  }, [dateKey])

  useEffect(() => {
    const restoredGame = loadStoredGame(storageKey, puzzleModel)
    setGame(restoredGame ?? puzzleModel.initialGame)
    setCelebration(null)
    setLoadedStorageKey(storageKey)
  }, [puzzleModel, storageKey])

  useEffect(() => {
    if (loadedStorageKey !== storageKey) {
      return
    }

    window.localStorage.setItem(storageKey, serializeGame(game))
    setCompletionHistory(readCompletionHistory(schedule))
  }, [game, loadedStorageKey, schedule, storageKey])

  useEffect(() => {
    setCompletionHistory(readCompletionHistory(schedule))
  }, [schedule])

  useEffect(() => {
    const storedSettings = loadStoredSettings()
    setIsHintsTurnedOff(storedSettings.isHintsTurnedOff)
    setIsWordBlastTurnedOff(storedSettings.isWordBlastTurnedOff)
  }, [])

  useEffect(() => {
    const updateCompactMode = () => {
      const height = window.innerHeight
      setCompactMode(
        height <= 720 ? "tight" : height <= 780 ? "compact" : "normal"
      )
    }

    updateCompactMode()
    window.addEventListener("resize", updateCompactMode)

    return () => window.removeEventListener("resize", updateCompactMode)
  }, [])

  useEffect(() => {
    storeSettings({
      isHintsTurnedOff,
      isWordBlastTurnedOff,
    })
  }, [isHintsTurnedOff, isWordBlastTurnedOff])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDateKey(getLocalDateKey())
    }, msUntilNextLocalMidnight())

    return () => window.clearTimeout(timeout)
  }, [dateKey])

  const activeClue = clueById[game.activeClueId] ?? clues[0]
  const isGameStateReady =
    loadedStorageKey === storageKey && Boolean(activeClue)
  const solvedSet = useMemo(() => new Set(game.solvedIds), [game.solvedIds])
  const displayDate = useMemo(
    () => formatPuzzleDate(dateKey, copy.intlLocale),
    [copy.intlLocale, dateKey]
  )
  const displayLongDate = useMemo(
    () => formatPuzzleDateLong(dateKey, copy.intlLocale),
    [copy.intlLocale, dateKey]
  )
  const sortedSchedule = useMemo(
    () =>
      [...schedule].sort((left, right) => left.date.localeCompare(right.date)),
    [schedule]
  )
  const hasProgress = useMemo(
    () => hasStartedPuzzle(game, puzzleModel.initialEntries),
    [game, puzzleModel.initialEntries]
  )
  const isPuzzleComplete = game.solvedIds.length === clues.length
  const timerLabel = useMemo(
    () => formatElapsedTime(game.elapsedSeconds),
    [game.elapsedSeconds]
  )
  const weeklyStreakDays = useMemo(
    () =>
      buildWeeklyStreakDays(
        dateKey,
        completionHistory,
        isPuzzleComplete,
        copy.weekdayLabels
      ),
    [completionHistory, copy.weekdayLabels, dateKey, isPuzzleComplete]
  )
  const nextChallengeDate = useMemo(
    () =>
      formatNextChallengeDate(
        getNextChallengeDateKey(dateKey, schedule),
        copy.intlLocale
      ),
    [copy.intlLocale, dateKey, schedule]
  )
  const todaysWords = useMemo(
    () =>
      [...clues]
        .sort((left, right) => {
          if (left.number !== right.number) {
            return left.number - right.number
          }

          return left.direction.localeCompare(right.direction)
        })
        .map((clue) => ({
          id: clue.id,
          label: copy.formatClueLabel(clue.number, clue.direction),
          answer: clue.answer,
          meaning: normalizeMeaning(clue.meaning, clue.answer, copy),
        })),
    [clues, copy]
  )
  const handlePendingTopHeaderBack = useCallback(() => {
    // TODO: Wire the home/summary top-header back action once the destination is finalized.
  }, [])

  useEffect(() => {
    if (screen !== "summary") {
      setIsMeaningSheetOpen(false)
    }
  }, [screen])

  useEffect(() => {
    if (screen === settledScreen) {
      setScreenTransition(null)
      return
    }

    if (screenTransitionTimerRef.current !== null) {
      window.clearTimeout(screenTransitionTimerRef.current)
    }

    if (screenTransitionFrameRef.current !== null) {
      window.cancelAnimationFrame(screenTransitionFrameRef.current)
    }

    setScreenTransition({ from: settledScreen, to: screen, phase: "prepare" })

    screenTransitionFrameRef.current = window.requestAnimationFrame(() => {
      setScreenTransition((current) =>
        current && current.to === screen
          ? { ...current, phase: "active" }
          : current
      )
    })

    screenTransitionTimerRef.current = window.setTimeout(() => {
      setSettledScreen(screen)
      setScreenTransition(null)
      screenTransitionTimerRef.current = null
      screenTransitionFrameRef.current = null
    }, SCREEN_TRANSITION_FALLBACK_MS)

    return () => {
      if (screenTransitionTimerRef.current !== null) {
        window.clearTimeout(screenTransitionTimerRef.current)
        screenTransitionTimerRef.current = null
      }

      if (screenTransitionFrameRef.current !== null) {
        window.cancelAnimationFrame(screenTransitionFrameRef.current)
        screenTransitionFrameRef.current = null
      }
    }
  }, [screen, settledScreen])

  useEffect(() => {
    if (logoTapCount === 0) {
      return
    }

    const timeout = window.setTimeout(() => {
      setLogoTapCount(0)
    }, 1200)

    return () => window.clearTimeout(timeout)
  }, [logoTapCount])

  const resetPuzzleState = useCallback(
    (nextScreen: Screen) => {
      setGame(puzzleModel.initialGame)
      setCelebration(null)
      setHintPromptClueId(null)
      setHintNudgeVersion((current) => current + 1)
      setScreen(nextScreen)
    },
    [puzzleModel.initialGame]
  )

  const resetCurrentPuzzle = useCallback(() => {
    resetPuzzleState("game")
  }, [resetPuzzleState])

  const resetPuzzleFromHome = useCallback(() => {
    resetPuzzleState("home")
  }, [resetPuzzleState])

  const resetHintHighlightTimer = useCallback(() => {
    setIsHintButtonHighlighted(false)
    setHintPromptClueId(null)
    setHintNudgeVersion((current) => current + 1)
  }, [])

  const handleLogoTap = useCallback(() => {
    setLogoTapCount((current) => {
      const nextCount = current + 1

      if (nextCount < 5) {
        return nextCount
      }

      setIsTestScheduleOpen(true)
      return 0
    })
  }, [])

  const handlePlayScheduledPuzzle = useCallback((nextDateKey: string) => {
    setIsTestScheduleOpen(false)
    setDateKey(nextDateKey)
    setScreen("game")
  }, [])

  const handleTransitionAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLDivElement>) => {
      if (!screenTransition || event.animationName !== "screen-slot-enter") {
        return
      }

      const target = event.target
      if (
        !(target instanceof HTMLElement) ||
        target.dataset.screenAnchor !== "true"
      ) {
        return
      }

      if (screenTransitionTimerRef.current !== null) {
        window.clearTimeout(screenTransitionTimerRef.current)
        screenTransitionTimerRef.current = null
      }

      if (screenTransitionFrameRef.current !== null) {
        window.cancelAnimationFrame(screenTransitionFrameRef.current)
        screenTransitionFrameRef.current = null
      }

      setSettledScreen(screenTransition.to)
      setScreenTransition(null)
    },
    [screenTransition]
  )

  const selectClue = useCallback(
    (clueId: string, preferredIndex?: number) => {
      resetHintHighlightTimer()
      setGame((current) => {
        if (current.feedback?.type === "wrong") {
          return current
        }

        const nextClue = clueById[clueId]
        const nextIndex =
          preferredIndex !== undefined &&
          isEditableCell(nextClue, preferredIndex, current.lockSources)
            ? preferredIndex
            : firstEmptyIndex(nextClue, current.entries, current.lockSources)

        return {
          ...current,
          activeClueId: clueId,
          activeIndex: nextIndex,
          feedback:
            current.feedback?.clueId === current.activeClueId
              ? null
              : current.feedback,
        }
      })
    },
    [clueById, resetHintHighlightTimer]
  )

  const cycleClue = useCallback(
    (step: 1 | -1) => {
      const currentIndex = clueOrder.indexOf(game.activeClueId)
      const nextIndex =
        (currentIndex + step + clueOrder.length) % clueOrder.length
      selectClue(clueOrder[nextIndex])
    },
    [clueOrder, game.activeClueId, selectClue]
  )

  const handleLetter = useCallback(
    (letter: string) => {
      resetHintHighlightTimer()
      let nextCelebration: CelebrationState | null = null

      setGame((current) => {
        const clue = clueById[current.activeClueId]
        if (
          current.solvedIds.includes(clue.id) ||
          current.feedback?.type === "wrong"
        ) {
          return current
        }

        const targetIndex = findWritableIndex(
          clue,
          current.activeIndex,
          current.entries,
          current.lockSources
        )
        if (targetIndex === -1) {
          return current
        }

        const targetCell = clue.cells[targetIndex]
        const targetKey = targetCell.key
        const nextEntries = {
          ...current.entries,
          [targetKey]: letter,
        }

        let nextState: GameState = {
          ...current,
          entries: nextEntries,
          solvedIds: getSolvedClueIds(clues, cellData, nextEntries),
          feedback: null,
          activeIndex: nextCursorIndex(
            clue,
            targetIndex,
            nextEntries,
            current.lockSources
          ),
        }

        if (!isClueFilled(clue, nextEntries)) {
          return nextState
        }

        if (isClueSolved(clue, cellData, nextEntries)) {
          const nextCompletedIds = current.completedIds.includes(clue.id)
            ? current.completedIds
            : [...current.completedIds, clue.id]
          const frozenLocks = freezeSolvedClue(current.lockSources, clue)
          const revealOutcome = isWordBlastTurnedOff
            ? {
                entries: nextEntries,
                lockSources: frozenLocks,
                revealedCellKeys: [],
              }
            : revealLetters(
                clues,
                cellData,
                nextEntries,
                frozenLocks,
                nextState.solvedIds
              )
          const nextSolvedIds = getSolvedClueIds(
            clues,
            cellData,
            revealOutcome.entries
          )
          const nextClueId = findNextUnsolvedClueId(
            clueOrder,
            clue.id,
            nextSolvedIds
          )

          const nextFeedback: FeedbackState = {
            clueId: clue.id,
            type: "correct",
            stamp: Date.now(),
          }

          nextCelebration = {
            clueId: clue.id,
            solvedCellKeys: clue.cells.map((cell) => cell.key),
            blastCellKeys: revealOutcome.revealedCellKeys,
            stamp: nextFeedback.stamp,
          }

          nextState = {
            ...nextState,
            entries: revealOutcome.entries,
            lockSources: revealOutcome.lockSources,
            solvedIds: nextSolvedIds,
            completedIds: nextCompletedIds,
            wrongGuessCounts: {
              ...nextState.wrongGuessCounts,
              [clue.id]: 0,
            },
            feedback: nextFeedback,
          }

          if (nextClueId) {
            nextState = {
              ...nextState,
              activeClueId: nextClueId,
              activeIndex: firstEmptyIndex(
                clueById[nextClueId],
                revealOutcome.entries,
                revealOutcome.lockSources
              ),
            }
          }

          return nextState
        }

        const incorrectIndex = firstIncorrectEditableIndex(
          clue,
          cellData,
          nextEntries,
          current.lockSources
        )

        const nextFeedback: FeedbackState = {
          clueId: clue.id,
          type: "wrong",
          stamp: Date.now(),
        }

        return {
          ...nextState,
          wrongGuessCounts: {
            ...current.wrongGuessCounts,
            [clue.id]: (current.wrongGuessCounts[clue.id] ?? 0) + 1,
          },
          feedback: nextFeedback,
          activeIndex:
            incorrectIndex === -1
              ? firstEmptyIndex(clue, nextEntries, current.lockSources)
              : incorrectIndex,
        }
      })

      if (nextCelebration) {
        setCelebration(nextCelebration)
      }
    },
    [
      cellData,
      clueById,
      clueOrder,
      clues,
      isWordBlastTurnedOff,
      resetHintHighlightTimer,
    ]
  )

  const handleBackspace = useCallback(() => {
    resetHintHighlightTimer()
    setGame((current) => {
      const clue = clueById[current.activeClueId]
      if (
        current.solvedIds.includes(clue.id) ||
        current.feedback?.type === "wrong"
      ) {
        return current
      }

      const currentCell = clue.cells[current.activeIndex]
      if (currentCell) {
        const currentValue = current.entries[currentCell.key]
        if (
          currentValue &&
          isEditableCell(clue, current.activeIndex, current.lockSources)
        ) {
          const nextEntries = { ...current.entries }
          delete nextEntries[currentCell.key]

          return {
            ...current,
            entries: nextEntries,
            solvedIds: getSolvedClueIds(clues, cellData, nextEntries),
            feedback: null,
          }
        }
      }

      const previousIndex = previousFilledIndex(
        clue,
        current.activeIndex,
        current.entries,
        current.lockSources
      )
      if (previousIndex === -1) {
        return current
      }

      const previousKey = clue.cells[previousIndex].key
      const nextEntries = { ...current.entries }
      delete nextEntries[previousKey]

      return {
        ...current,
        entries: nextEntries,
        solvedIds: getSolvedClueIds(clues, cellData, nextEntries),
        activeIndex: previousIndex,
        feedback: null,
      }
    })
  }, [cellData, clueById, clues, resetHintHighlightTimer])

  const handleHintPowerUp = useCallback(() => {
    resetHintHighlightTimer()
    setGame((current) => {
      const clue = clueById[current.activeClueId]
      if (
        isHintsTurnedOff ||
        current.feedback?.type === "wrong" ||
        current.solvedIds.includes(clue.id)
      ) {
        return current
      }

      const candidateCells = clue.cells.filter(
        (cell) => !current.entries[cell.key] && !current.lockSources[cell.key]
      )
      if (candidateCells.length === 0) {
        return current
      }

      const chosenCell =
        candidateCells[Math.floor(Math.random() * candidateCells.length)]
      const nextEntries = {
        ...current.entries,
        [chosenCell.key]: cellData[chosenCell.key].solution,
      }
      const nextLockSources = {
        ...current.lockSources,
        [chosenCell.key]: "revealed" as const,
      }
      const nextSolvedIds = getSolvedClueIds(clues, cellData, nextEntries)
      let nextState: GameState = {
        ...current,
        entries: nextEntries,
        lockSources: nextLockSources,
        solvedIds: nextSolvedIds,
        activeIndex: firstEmptyIndex(clue, nextEntries, nextLockSources),
        feedback: null,
      }

      if (nextSolvedIds.includes(clue.id)) {
        const nextClueId = findNextUnsolvedClueId(
          clueOrder,
          clue.id,
          nextSolvedIds
        )

        if (nextClueId) {
          nextState = {
            ...nextState,
            activeClueId: nextClueId,
            activeIndex: firstEmptyIndex(
              clueById[nextClueId],
              nextEntries,
              nextLockSources
            ),
          }
        }
      }

      return nextState
    })
  }, [
    cellData,
    clueById,
    clueOrder,
    clues,
    isHintsTurnedOff,
    resetHintHighlightTimer,
  ])

  const canUseHint = useMemo(() => {
    const active = clueById[game.activeClueId]
    if (
      isHintsTurnedOff ||
      !active ||
      game.feedback?.type === "wrong" ||
      game.solvedIds.includes(active.id)
    ) {
      return false
    }

    return active.cells.some(
      (cell) => !game.entries[cell.key] && !game.lockSources[cell.key]
    )
  }, [
    clueById,
    game.activeClueId,
    game.entries,
    game.feedback,
    game.lockSources,
    game.solvedIds,
    isHintsTurnedOff,
  ])

  useEffect(() => {
    if (game.feedback?.type !== "correct") {
      return
    }

    const timeout = window.setTimeout(() => {
      setGame((current) =>
        current.feedback?.stamp === game.feedback?.stamp
          ? { ...current, feedback: null }
          : current
      )
    }, 520)

    return () => window.clearTimeout(timeout)
  }, [clueById, game.feedback])

  useEffect(() => {
    if (!celebration) {
      return
    }

    const timeout = window.setTimeout(() => {
      setCelebration((current) =>
        current?.stamp === celebration.stamp ? null : current
      )
    }, 820)

    return () => window.clearTimeout(timeout)
  }, [celebration])

  useEffect(() => {
    if (game.feedback?.type !== "wrong") {
      return
    }

    const feedbackClueId = game.feedback.clueId

    const timeout = window.setTimeout(() => {
      let shouldPromptHint = false

      setGame((current) => {
        if (
          current.feedback?.type !== "wrong" ||
          current.feedback.stamp !== game.feedback?.stamp
        ) {
          return current
        }

        const clue = clueById[current.feedback.clueId]
        shouldPromptHint = (current.wrongGuessCounts[clue.id] ?? 0) >= 2
        const clearedEntries = clearEditableClueEntries(
          current.entries,
          current.lockSources,
          clue
        )

        return {
          ...current,
          entries: clearedEntries,
          activeClueId: clue.id,
          activeIndex: firstEmptyIndex(
            clue,
            clearedEntries,
            current.lockSources
          ),
          feedback: null,
        }
      })

      if (shouldPromptHint) {
        setHintPromptClueId(feedbackClueId)
      }
    }, 360)

    return () => window.clearTimeout(timeout)
  }, [clueById, game.feedback])

  useEffect(() => {
    if (screen !== "game" || isPuzzleComplete || isPauseOpen) {
      return
    }

    const interval = window.setInterval(() => {
      setGame((current) => ({
        ...current,
        elapsedSeconds: current.elapsedSeconds + 1,
      }))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isPauseOpen, isPuzzleComplete, screen])

  useEffect(() => {
    if (
      screen !== "game" ||
      isPauseOpen ||
      isPuzzleComplete ||
      isHintsTurnedOff ||
      !canUseHint
    ) {
      setIsHintButtonHighlighted(false)
      return
    }

    if (hintPromptClueId === game.activeClueId) {
      setIsHintButtonHighlighted(true)
      return
    }

    setIsHintButtonHighlighted(false)

    const timeout = window.setTimeout(() => {
      setIsHintButtonHighlighted(true)
    }, 8000)

    return () => window.clearTimeout(timeout)
  }, [
    canUseHint,
    game.activeClueId,
    hintNudgeVersion,
    hintPromptClueId,
    isHintsTurnedOff,
    isPauseOpen,
    isPuzzleComplete,
    screen,
  ])

  useEffect(() => {
    if (screen !== "game") {
      setIsPauseOpen(false)
    }
  }, [screen])

  useEffect(() => {
    if (screen === "game" && isPuzzleComplete) {
      setScreen("summary")
    }
  }, [isPuzzleComplete, screen])

  useEffect(() => {
    if (screen === "game") {
      return
    }

    const onResetKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "r") {
        return
      }

      event.preventDefault()
      resetCurrentPuzzle()
    }

    window.addEventListener("keydown", onResetKeyDown)
    return () => window.removeEventListener("keydown", onResetKeyDown)
  }, [resetCurrentPuzzle, screen])

  useEffect(() => {
    if (screen !== "game") {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isPauseOpen) {
        if (event.key === "Escape") {
          event.preventDefault()
          setIsPauseOpen(false)
        }
        return
      }

      if (event.key.toLowerCase() === "k") {
        event.preventDefault()
        setScreen("summary")
        return
      }

      if (event.key === "Backspace") {
        event.preventDefault()
        handleBackspace()
        return
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        cycleClue(-1)
        return
      }

      if (event.key === "ArrowRight") {
        event.preventDefault()
        cycleClue(1)
        return
      }

      if (/^[a-z]$/i.test(event.key)) {
        event.preventDefault()
        handleLetter(event.key.toUpperCase())
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [cycleClue, handleBackspace, handleLetter, isPauseOpen, screen])

  if (isPuzzleLoading) {
    return (
      <main className="inline-flex h-svh w-full items-center justify-center bg-[#f6f0d7]">
        <div
          className={cn(
            homeBodyFont.className,
            "text-center text-[16px] leading-[24px] font-medium text-black/70"
          )}
        >
          {copy.loadingTodayPuzzle}
        </div>
      </main>
    )
  }

  const renderScreen = (
    screenToRender: Screen,
    motionState: ScreenMotionState = "static",
    transitionPair: ScreenTransitionPair = "idle"
  ) => {
    if (screenToRender === "home") {
      return (
        <main
          data-screen={screenToRender}
          data-screen-motion={motionState}
          data-transition-pair={transitionPair}
          className="relative h-svh w-full overflow-y-auto bg-[#f6f0d7]"
        >
          <TopHeader title={copy.appName} onBack={handlePendingTopHeaderBack} />

          <div
            className={cn(
              topHeaderOffsetClass,
              "flex min-h-full w-full items-center justify-center bg-[#f6f0d7] px-[30px] pb-[100px]"
            )}
          >
            <div className="inline-flex w-full max-w-[340px] flex-1 flex-col items-center justify-start gap-[20px] py-[24px]">
              <div
                data-screen-slot="hero"
                className="flex w-full flex-col items-center justify-start gap-[16px] self-stretch"
              >
                <div className="flex w-full flex-col items-center justify-start gap-[20px] self-stretch">
                  <HomeMascot onTap={handleLogoTap} label={copy.mascotLabel} />
                  <div
                    className={cn(
                      homeTitleFont.className,
                      "flex w-full flex-col justify-center self-stretch text-center text-[28px] font-extrabold text-black"
                    )}
                  >
                    {copy.appName}
                  </div>
                </div>

                <div
                  data-screen-slot="support"
                  className="flex w-full flex-col items-start justify-start gap-[10px] self-stretch"
                >
                  <div
                    className={cn(
                      homeBodyFont.className,
                      "flex w-full flex-col justify-center self-stretch text-center text-[18px] leading-[26px] font-normal text-black"
                    )}
                  >
                    {copy.tagline}
                  </div>
                  <div
                    className={cn(
                      homeBodyFont.className,
                      "flex w-full flex-col justify-center self-stretch text-center text-[14px] leading-[22px] font-semibold text-black"
                    )}
                  >
                    {displayLongDate}
                  </div>
                </div>
              </div>

              <div
                data-screen-slot="actions"
                className="flex w-full flex-col gap-[8px]"
              >
                <button
                  type="button"
                  onClick={() =>
                    setScreen(isPuzzleComplete ? "summary" : "game")
                  }
                  className="inline-flex h-[56px] w-full items-center justify-center gap-[10px] self-stretch rounded-[12px] bg-black px-[73px] py-[12px]"
                >
                  <span
                    className={cn(
                      homeBodyFont.className,
                      "flex flex-col justify-center text-center text-[19px] leading-[30px] font-semibold text-white"
                    )}
                  >
                    {isPuzzleComplete
                      ? copy.viewResults
                      : hasProgress
                        ? copy.continueGame
                        : copy.startGame}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsHomeSettingsOpen(true)}
                  className={cn(
                    homeBodyFont.className,
                    "inline-flex h-[44px] w-full items-center justify-center rounded-[12px] border border-black bg-transparent px-[14px] text-[16px] leading-[24px] font-semibold text-black"
                  )}
                >
                  {copy.settings}
                </button>

                {isPuzzleComplete && (
                  <button
                    type="button"
                    onClick={resetPuzzleFromHome}
                    className={cn(
                      homeBodyFont.className,
                      "inline-flex h-[44px] w-full items-center justify-center rounded-[12px] border border-[#F05C21] bg-[#FFF3ED] px-[14px] text-[16px] leading-[24px] font-semibold text-[#B84212]"
                    )}
                  >
                    {copy.resetGame}
                  </button>
                )}
              </div>

              {(hasProgress || isPuzzleComplete) && (
                <p
                  data-screen-slot="meta"
                  data-screen-anchor="true"
                  className={cn(
                    homeBodyFont.className,
                    "text-center text-[12px] leading-[18px] font-medium text-black/60"
                  )}
                >
                  {isPuzzleComplete
                    ? copy.formatTimeTaken(timerLabel)
                    : copy.formatWordsSolved(
                        game.solvedIds.length,
                        clues.length
                      )}
                </p>
              )}
            </div>
          </div>

          {isHomeSettingsOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-[2px]"
              onClick={() => setIsHomeSettingsOpen(false)}
            >
              <div
                className="flex w-full max-w-[320px] flex-col items-center rounded-[20px] bg-white px-[24px] py-[24px] shadow-[0_20px_60px_0_rgba(0,0,0,0.30)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex w-full items-center justify-between">
                  <h2 className="text-[22px] leading-[32px] font-semibold text-black">
                    {copy.settings}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsHomeSettingsOpen(false)}
                    className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-[8px] border border-black/20"
                    aria-label={copy.closeSettings}
                  >
                    <X
                      className="h-[18px] w-[18px] text-black"
                      strokeWidth={2.25}
                    />
                  </button>
                </div>
                <div className="mt-4 flex w-full flex-col gap-[10px]">
                  <PauseToggleRow
                    label={copy.hintToggle}
                    checked={isHintsTurnedOff}
                    onChange={setIsHintsTurnedOff}
                  />
                  <PauseToggleRow
                    label={copy.bonusWordsToggle}
                    description={copy.bonusWordsHint}
                    checked={isWordBlastTurnedOff}
                    onChange={setIsWordBlastTurnedOff}
                  />
                </div>
              </div>
            </div>
          )}

          {isTestScheduleOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-[2px]"
              onClick={() => setIsTestScheduleOpen(false)}
            >
              <div
                className="flex max-h-[80svh] w-full max-w-[360px] flex-col rounded-[20px] bg-white px-[20px] py-[20px] shadow-[0_20px_60px_0_rgba(0,0,0,0.30)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[20px] leading-[28px] font-semibold text-black">
                      {copy.scheduledPuzzles}
                    </h2>
                    <p className="mt-1 text-[13px] leading-[20px] text-black/60">
                      {copy.scheduledPuzzlesDescription}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTestScheduleOpen(false)}
                    className="inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[8px] border border-black/20"
                    aria-label={copy.closeScheduledPuzzles}
                  >
                    <X
                      className="h-[18px] w-[18px] text-black"
                      strokeWidth={2.25}
                    />
                  </button>
                </div>

                <div className="mt-4 flex max-h-[56svh] flex-col gap-[10px] overflow-y-auto pr-1">
                  {sortedSchedule.map((puzzle) => {
                    const isCurrentPuzzle = puzzle.date === dateKey

                    return (
                      <button
                        key={puzzle.id}
                        type="button"
                        onClick={() => handlePlayScheduledPuzzle(puzzle.date)}
                        className="flex w-full items-center justify-between rounded-[14px] border border-black/10 bg-[#F8F6EF] px-[14px] py-[12px] text-left"
                      >
                        <div>
                          <div className="text-[15px] leading-[22px] font-semibold text-black">
                            {puzzle.title}
                          </div>
                          <div className="text-[12px] leading-[18px] text-black/60">
                            {formatPuzzleDate(puzzle.date, copy.intlLocale)}
                          </div>
                        </div>
                        <div className="text-[12px] leading-[18px] font-semibold text-black/70">
                          {isCurrentPuzzle ? copy.openPuzzle : copy.playPuzzle}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      )
    }

    if (screenToRender === "summary") {
      return (
        <main
          data-screen={screenToRender}
          data-screen-motion={motionState}
          data-transition-pair={transitionPair}
          className="relative h-svh w-full overflow-y-auto bg-[#F6F0D7]"
        >
          <TopHeader title={copy.appName} onBack={handlePendingTopHeaderBack} />

          <div
            className={cn(
              topHeaderOffsetClass,
              "mx-auto flex min-h-full w-full max-w-[390px] items-center justify-center bg-[#F6F0D7] px-[16px] pb-[100px]"
            )}
          >
            <div className="inline-flex w-full flex-1 flex-col items-center justify-start gap-[18px] py-[24px]">
              <div
                data-screen-slot="hero"
                className="flex w-full flex-col items-center justify-start gap-[12px] self-stretch"
              >
                <SummaryCelebrationIcon alt={copy.trophyAlt} />
                <div className="flex w-full flex-col items-center justify-start gap-[4px] self-stretch">
                  <div
                    className={cn(
                      homeBodyFont.className,
                      "w-full text-center text-[24px] leading-[36px] font-extrabold text-black"
                    )}
                  >
                    {copy.summaryTitle}
                  </div>
                  <div
                    className={cn(
                      homeBodyFont.className,
                      "w-full text-center text-[16px] leading-[24px] font-normal text-black"
                    )}
                  >
                    {copy.summarySubtitle}
                  </div>
                </div>
              </div>

              <div
                data-screen-slot="board"
                className="flex w-full flex-col items-start justify-start gap-[14px] self-stretch"
              >
                <div className="inline-flex w-full items-center justify-between self-stretch rounded-[5px] bg-white p-[10px]">
                  <div
                    className={cn(
                      homeBodyFont.className,
                      "text-[18px] leading-[26px] font-extrabold text-black"
                    )}
                  >
                    {copy.totalTime}
                  </div>
                  <div className="flex items-center justify-start gap-[4px]">
                    <img
                      src={dlsAssets.timer}
                      alt={copy.totalTime}
                      className="h-[24px] w-[24px]"
                      width={24}
                      height={24}
                      loading="lazy"
                      decoding="async"
                    />
                    <div
                      className={cn(
                        homeBodyFont.className,
                        "text-right text-[20px] leading-[26px] font-extrabold text-[#F05C21]"
                      )}
                    >
                      {timerLabel.replace(/^0/, "")}
                    </div>
                  </div>
                </div>

                <div className="inline-flex w-full items-center justify-between self-stretch rounded-[5px] bg-white p-[10px]">
                  <div
                    className={cn(
                      homeBodyFont.className,
                      "text-[18px] leading-[26px] font-extrabold text-black"
                    )}
                  >
                    {copy.viewTodaysWords}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMeaningSheetOpen(true)}
                    className={cn(
                      homeBodyFont.className,
                      "inline-flex h-[36px] items-center justify-center rounded-[8px] border border-black px-[12px] text-[14px] leading-[20px] font-bold text-black"
                    )}
                  >
                    {copy.understandWordMeanings}
                  </button>
                </div>

                <div className="flex w-full flex-col items-center justify-start gap-[12px] self-stretch rounded-[12px] bg-white px-[10px] py-[12px]">
                  <div className="inline-flex w-full items-center justify-between self-stretch overflow-hidden">
                    <div
                      className={cn(
                        homeBodyFont.className,
                        "text-[18px] leading-[26px] font-extrabold text-black"
                      )}
                    >
                      {copy.weeklyStreak}
                    </div>
                    <FlameBadge alt={copy.streakAlt} />
                  </div>

                  <div className="inline-flex w-full items-center justify-between self-stretch">
                    {weeklyStreakDays.map((day: StreakDay) => (
                      <div
                        key={day.label}
                        className="inline-flex w-[32px] flex-col items-center justify-start"
                      >
                        <div className="relative flex h-[24px] w-[24px] items-center justify-center">
                          {day.isToday && day.state === "complete" ? (
                            <>
                              <img
                                src={dlsAssets.ray}
                                alt={copy.todayAlt}
                                className="absolute -inset-[8px] h-[40px] w-[40px]"
                                width={40}
                                height={40}
                                loading="lazy"
                                decoding="async"
                              />
                              <img
                                src={dlsAssets.tick}
                                alt={copy.completedAlt}
                                className="relative z-10 h-[20px] w-[20px]"
                                width={20}
                                height={20}
                                loading="lazy"
                                decoding="async"
                              />
                            </>
                          ) : (
                            <img
                              src={
                                day.state === "complete"
                                  ? dlsAssets.tick
                                  : day.state === "missed"
                                    ? dlsAssets.cross
                                    : dlsAssets.emptyCell
                              }
                              alt={copy.formatStreakStateAlt(
                                day.state,
                                day.isToday
                              )}
                              className="h-[20px] w-[20px]"
                              width={20}
                              height={20}
                              loading="lazy"
                              decoding="async"
                            />
                          )}
                        </div>
                        <div className="inline-flex items-center justify-center gap-[10px] self-stretch p-[4px]">
                          <div
                            className={cn(
                              homeTitleFont.className,
                              "text-center text-[10px] font-bold uppercase",
                              day.isToday
                                ? "text-[#F05C21]"
                                : day.state === "pending"
                                  ? "text-black/50"
                                  : "text-black"
                            )}
                          >
                            {day.label}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div
                data-screen-slot="meta"
                data-screen-anchor="true"
                className="flex h-[54px] w-full flex-col items-center justify-start self-stretch"
              >
                <div
                  className={cn(
                    homeBodyFont.className,
                    "flex-1 self-stretch text-center text-[16px] leading-[24px] font-normal text-black"
                  )}
                >
                  {copy.nextChallenge}
                </div>
                <div
                  className={cn(
                    homeBodyFont.className,
                    "flex-1 self-stretch text-center text-[20px] leading-[30px] font-semibold text-black"
                  )}
                >
                  {nextChallengeDate}
                </div>
              </div>

              <button
                data-screen-slot="actions"
                type="button"
                onClick={() => setScreen("home")}
                className="inline-flex h-[44px] w-full items-center justify-center gap-[8px] self-stretch rounded-[12px] border-2 border-black bg-black px-[73px] py-[14px]"
              >
                <img
                  src={dlsAssets.home}
                  alt={copy.homeIconAlt}
                  className="h-[24px] w-[24px]"
                  width={24}
                  height={24}
                  loading="lazy"
                  decoding="async"
                />
                <span
                  className={cn(
                    homeBodyFont.className,
                    "text-center text-[16px] leading-[24px] font-bold text-white"
                  )}
                >
                  {copy.homePage}
                </span>
              </button>
            </div>
          </div>

          {isMeaningSheetOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[2px]"
              onClick={() => setIsMeaningSheetOpen(false)}
            >
              <div
                className="w-full max-w-[390px] rounded-[16px] bg-white p-[14px] shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-[10px]">
                  <h2
                    className={cn(
                      homeBodyFont.className,
                      "text-[18px] leading-[26px] font-extrabold text-black"
                    )}
                  >
                    {copy.todaysWordsSheetTitle}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsMeaningSheetOpen(false)}
                    className="inline-flex h-[32px] w-[32px] items-center justify-center rounded-[8px] border border-black/20"
                    aria-label={copy.closeMeanings}
                  >
                    <X
                      className="h-[18px] w-[18px] text-black"
                      strokeWidth={2.25}
                    />
                  </button>
                </div>

                <div className="mt-[12px] max-h-[55svh] space-y-[8px] overflow-y-auto pr-[2px]">
                  {todaysWords.map((word) => (
                    <div
                      key={word.id}
                      className="rounded-[10px] border border-black/10 bg-[#FFF9E8] p-[10px]"
                    >
                      <div
                        className={cn(
                          homeBodyFont.className,
                          "text-[14px] leading-[20px] font-extrabold text-black"
                        )}
                      >
                        {word.label} - {word.answer}
                      </div>
                      <div
                        className={cn(
                          homeBodyFont.className,
                          "mt-[4px] text-[13px] leading-[20px] font-normal text-black/80"
                        )}
                      >
                        {word.meaning}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      )
    }

    if (!isGameStateReady) {
      return (
        <main className="inline-flex h-svh w-full items-center justify-center bg-[#f6f0d7]">
          <div
            className={cn(
              homeBodyFont.className,
              "text-center text-[16px] leading-[24px] font-medium text-black/70"
            )}
          >
            {copy.loadingPuzzle}
          </div>
        </main>
      )
    }

    return (
      <main
        data-screen={screenToRender}
        data-screen-motion={motionState}
        data-transition-pair={transitionPair}
        className={cn(
          gameFont.className,
          "relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[#F6F0D7]"
        )}
      >
        <header
          data-screen-slot="hero"
          className="z-30 w-full shrink-0 bg-transparent"
        >
          <div
            className={cn(
              "mx-auto w-full max-w-[430px] px-[12px] pt-[12px] pb-[10px]",
              compactMode === "compact" && "pt-[10px] pb-[8px]",
              compactMode === "tight" && "pt-[8px] pb-[6px]"
            )}
          >
            <div className="grid w-full grid-cols-[40px_1fr_40px] items-center gap-[8px]">
              <button
                type="button"
                onClick={() => setScreen("home")}
                aria-label={copy.backToHome}
                className="inline-flex h-[40px] w-[40px] items-center justify-center rounded-[12px] bg-black p-[8px]"
              >
                <img
                  src={dlsAssets.home}
                  alt={copy.homeIconAlt}
                  className="h-[24px] w-[24px]"
                  width={24}
                  height={24}
                  loading="lazy"
                  decoding="async"
                />
              </button>

              <div className="flex flex-1 flex-col justify-center text-center text-[18px] leading-[26px] font-semibold text-black">
                {displayDate}
              </div>

              {isHintsTurnedOff ? (
                <div className="h-[40px] w-[40px]" aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  onClick={handleHintPowerUp}
                  aria-label={copy.useHint}
                  disabled={!canUseHint}
                  className={cn(
                    "inline-flex h-[40px] w-[40px] items-center justify-center rounded-[12px] bg-black p-[8px] transition-[opacity,transform,box-shadow] duration-200",
                    isHintButtonHighlighted &&
                      "scale-105 animate-pulse ring-4 ring-[#FFB067] ring-offset-2 ring-offset-[#F6F0D7]",
                    !canUseHint && "cursor-not-allowed opacity-45"
                  )}
                >
                  <img
                    src={dlsAssets.hint}
                    alt={copy.hintIconAlt}
                    className="h-[24px] w-[24px]"
                    width={24}
                    height={24}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              )}
            </div>

            <div
              className={cn(
                "mt-[8px] flex w-full justify-center",
                compactMode === "compact" && "mt-[6px]",
                compactMode === "tight" && "mt-[4px]"
              )}
            >
              <div
                className={cn(
                  "inline-flex items-center justify-center gap-[6px] rounded-[32px] bg-black px-[8px] py-[2px]",
                  compactMode === "compact" && "gap-[5px] px-[7px]",
                  compactMode === "tight" && "gap-[4px] px-[6px] py-[1px]"
                )}
              >
                <div
                  className={cn(
                    "text-center text-[16px] leading-[24px] font-semibold text-white",
                    compactMode === "compact" && "text-[15px] leading-[22px]",
                    compactMode === "tight" && "text-[14px] leading-[20px]"
                  )}
                >
                  {timerLabel.replace(/^0/, "")}
                </div>
                <button
                  type="button"
                  onClick={() => setIsPauseOpen(true)}
                  aria-label={copy.pauseGame}
                  className={cn(
                    "inline-flex h-[20px] w-[20px] items-center justify-center",
                    compactMode === "compact" && "h-[18px] w-[18px]",
                    compactMode === "tight" && "h-[16px] w-[16px]"
                  )}
                >
                  <img
                    src={dlsAssets.pause}
                    alt={copy.pauseIconAlt}
                    className={cn(
                      "h-[20px] w-[20px]",
                      compactMode === "compact" && "h-[18px] w-[18px]",
                      compactMode === "tight" && "h-[16px] w-[16px]"
                    )}
                    width={20}
                    height={20}
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div
          className={cn(
            "mx-auto flex min-h-0 w-full max-w-[430px] flex-1 flex-col overflow-y-auto px-[12px] pb-[12px]",
            compactMode === "compact" && "pb-[10px]",
            compactMode === "tight" && "pb-[8px]"
          )}
        >
          <section
            data-screen-slot="board"
            className="flex min-h-0 w-full flex-1 flex-col items-center justify-center self-stretch"
          >
            <div
              className={cn(
                "mx-auto grid w-full max-w-[390px] gap-[3.92px] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                compactMode === "compact" && "max-w-[352px] gap-[3.2px]",
                compactMode === "tight" && "max-w-[320px] gap-[2.8px]",
                celebration && "animate-board-celebrate"
              )}
              style={{
                gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, index) => {
                const row = Math.floor(index / GRID_COLS)
                const col = index % GRID_COLS
                const key = keyFor(row, col)
                const cell = cellData[key]

                if (!cell) {
                  return (
                    <div
                      key={key}
                      className={cn(
                        "aspect-square rounded-[3.92px] bg-[#09292D]",
                        compactMode === "compact" && "rounded-[3.2px]",
                        compactMode === "tight" && "rounded-[2.8px]"
                      )}
                    />
                  )
                }

                const entry = game.entries[key]
                const isActive = activeClue.cells.some(
                  (clueCell) => clueCell.key === key
                )
                const isCursor = activeClue.cells[game.activeIndex]?.key === key
                const lockSource = game.lockSources[key]
                const completedCell = cell.clueIds.some((clueId) =>
                  solvedSet.has(clueId)
                )
                const feedbackMatch =
                  game.feedback && cell.clueIds.includes(game.feedback.clueId)
                    ? game.feedback
                    : null
                const solvedCelebrationIndex =
                  celebration?.solvedCellKeys.findIndex(
                    (cellKey) => cellKey === key
                  )
                const blastCelebrationIndex =
                  celebration?.blastCellKeys.findIndex(
                    (cellKey) => cellKey === key
                  )
                const isSolvedCelebration =
                  typeof solvedCelebrationIndex === "number" &&
                  solvedCelebrationIndex >= 0
                const isBlastCelebration =
                  typeof blastCelebrationIndex === "number" &&
                  blastCelebrationIndex >= 0
                const celebrationDelay = isSolvedCelebration
                  ? solvedCelebrationIndex * 45
                  : isBlastCelebration
                    ? blastCelebrationIndex * 70
                    : 0

                return (
                  <button
                    key={`${key}-${feedbackMatch?.stamp ?? 0}-${isSolvedCelebration || isBlastCelebration ? (celebration?.stamp ?? 0) : 0}`}
                    type="button"
                    onClick={() => {
                      const memberships = cell.clueIds
                      if (memberships.length === 0) {
                        return
                      }

                      const nextClueId =
                        memberships.includes(game.activeClueId) &&
                        memberships.length > 1
                          ? (memberships.find(
                              (clueId) => clueId !== game.activeClueId
                            ) ?? memberships[0])
                          : (memberships.find(
                              (clueId) =>
                                clueById[clueId].direction === "across"
                            ) ?? memberships[0])

                      const clue = clueById[nextClueId]
                      const preferredIndex = clue.cells.findIndex(
                        (clueCell) => clueCell.key === key
                      )
                      selectClue(nextClueId, preferredIndex)
                    }}
                    className={cn(
                      "group relative isolate flex aspect-square items-center justify-center overflow-hidden rounded-[3.92px] p-[7.85px] transition-[background-color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]",
                      compactMode === "compact" && "rounded-[3.2px] p-[6.2px]",
                      compactMode === "tight" && "rounded-[2.8px] p-[5.2px]",
                      feedbackMatch?.type === "wrong"
                        ? "animate-clue-shake bg-[#f5b5b5]"
                        : isCursor
                          ? "bg-[#B6E8EE]"
                          : completedCell
                            ? "bg-[#D9FFE6]"
                            : isActive
                              ? "bg-[#B6E8EE]"
                              : "bg-white",
                      isCursor &&
                        "shadow-[0_0_0_1px_rgba(121,179,186,0.18)] ring-2 ring-[#79B3BA] ring-inset",
                      feedbackMatch?.type === "correct" &&
                        !isSolvedCelebration &&
                        "animate-clue-pop",
                      isSolvedCelebration && "animate-cell-solved-settle",
                      isBlastCelebration && "animate-cell-blast-reveal"
                    )}
                    style={
                      isSolvedCelebration || isBlastCelebration
                        ? {
                            animationDelay: `${celebrationDelay}ms`,
                          }
                        : undefined
                    }
                  >
                    {(isSolvedCelebration || isBlastCelebration) && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "pointer-events-none absolute inset-0 rounded-[inherit]",
                          isSolvedCelebration
                            ? "animate-cell-solved-wash bg-[linear-gradient(135deg,rgba(255,156,85,0.22),rgba(120,208,145,0.28))]"
                            : "animate-cell-blast-glow bg-[radial-gradient(circle_at_center,rgba(255,156,85,0.38),rgba(255,156,85,0.14)_38%,rgba(120,208,145,0.18)_68%,transparent_100%)]"
                        )}
                        style={{ animationDelay: `${celebrationDelay}ms` }}
                      />
                    )}

                    {feedbackMatch?.type === "correct" && (
                      <span
                        aria-hidden="true"
                        className="animate-cell-correct-flash pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(135deg,rgba(255,156,85,0.28),rgba(120,208,145,0.34))]"
                      />
                    )}

                    {isBlastCelebration && (
                      <span
                        aria-hidden="true"
                        className="animate-cell-blast-ring pointer-events-none absolute inset-[-12%] rounded-[inherit] border border-[#FF9C55]/60"
                        style={{ animationDelay: `${celebrationDelay + 30}ms` }}
                      />
                    )}

                    {cell.number ? (
                      <span
                        className={cn(
                          "absolute top-0 left-[2.14px] text-[9px] font-semibold text-[#006BAE]",
                          compactMode === "compact" &&
                            "left-[1.8px] text-[7.8px]",
                          compactMode === "tight" && "left-[1.4px] text-[6.8px]"
                        )}
                      >
                        {cell.number}
                      </span>
                    ) : null}

                    <span
                      className={cn(
                        "relative z-10 text-center text-[16px] leading-none font-semibold transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        compactMode === "compact" && "text-[14px]",
                        compactMode === "tight" && "text-[12px]",
                        lockSource === "given"
                          ? "text-[#006BAE]"
                          : completedCell ||
                              lockSource === "solved" ||
                              lockSource === "revealed"
                            ? "text-[#166631]"
                            : "text-black",
                        !entry && "text-transparent",
                        (isSolvedCelebration || isBlastCelebration) &&
                          "animate-cell-letter-settle"
                      )}
                      style={
                        isSolvedCelebration || isBlastCelebration
                          ? {
                              animationDelay: `${celebrationDelay + 20}ms`,
                            }
                          : undefined
                      }
                    >
                      {entry ?? "_"}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <div
            data-screen-slot="tray"
            className={cn(
              "mt-auto flex w-full flex-col gap-[15px] self-stretch",
              compactMode === "compact" && "gap-[12px]",
              compactMode === "tight" && "gap-[10px]"
            )}
          >
            <section
              className={cn(
                homeTitleFont.className,
                "inline-flex min-h-[78px] w-full items-center justify-between self-stretch overflow-hidden rounded-[3px] bg-[#09292D] px-[5px] py-[8px]",
                compactMode === "compact" && "min-h-[70px] py-[7px]",
                compactMode === "tight" && "min-h-[62px] py-[6px]"
              )}
            >
              <button
                type="button"
                onClick={() => cycleClue(-1)}
                aria-label={copy.previousClue}
                className="inline-flex h-[28px] w-[28px] items-center justify-center overflow-hidden rounded-[20px] bg-[#B0EFF6] text-black"
              >
                <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={3} />
              </button>

              <div
                key={activeClue.id}
                className={cn(
                  "animate-clue-fade flex min-h-full flex-1 flex-col items-start justify-center gap-[5px] self-stretch px-[8px]",
                  compactMode === "compact" && "gap-[4px] px-[7px]",
                  compactMode === "tight" && "gap-[3px] px-[6px]"
                )}
              >
                <div
                  className={cn(
                    "font-semibold text-[#B0EFF6]",
                    locale === "hi"
                      ? "text-[18px] leading-[24px]"
                      : "text-[11px] tracking-[2.2px] uppercase",
                    compactMode === "compact" &&
                      (locale === "hi"
                        ? "text-[16px] leading-[22px]"
                        : "text-[10px] tracking-[2px]"),
                    compactMode === "tight" &&
                      (locale === "hi"
                        ? "text-[15px] leading-[20px]"
                        : "text-[9px] tracking-[1.6px]")
                  )}
                >
                  {copy.currentClue}
                </div>
                <div
                  className={cn(
                    "text-[16px] leading-[20px] font-semibold text-[#F6F0D7]",
                    compactMode === "compact" && "text-[15px] leading-[18px]",
                    compactMode === "tight" && "text-[14px] leading-[17px]"
                  )}
                >
                  {copy.formatClueLabel(
                    activeClue.number,
                    activeClue.direction
                  )}
                  . {activeClue.clue}
                </div>
              </div>

              <button
                type="button"
                onClick={() => cycleClue(1)}
                aria-label={copy.nextClue}
                className="inline-flex h-[28px] w-[28px] items-center justify-center overflow-hidden rounded-[20px] bg-[#B0EFF6] text-black"
              >
                <ChevronRight className="h-[18px] w-[18px]" strokeWidth={3} />
              </button>
            </section>
          </div>
        </div>

        <section
          data-screen-slot="keyboard"
          data-screen-anchor="true"
          className={cn(
            "z-20 w-full shrink-0 bg-black/25 px-[12px] pt-[12px] pb-[calc(env(safe-area-inset-bottom)+12px)]",
            compactMode === "compact" &&
              "pt-[10px] pb-[calc(env(safe-area-inset-bottom)+10px)]",
            compactMode === "tight" &&
              "pt-[8px] pb-[calc(env(safe-area-inset-bottom)+8px)]"
          )}
        >
          <div
            className={cn(
              "mx-auto flex w-full max-w-[430px] flex-col gap-[8px]",
              compactMode === "compact" && "gap-[6px]",
              compactMode === "tight" && "gap-[5px]"
            )}
          >
            <div
              className={cn(
                "grid w-full grid-cols-10 gap-[6px]",
                compactMode === "compact" && "gap-[5px]",
                compactMode === "tight" && "gap-[4px]"
              )}
            >
              {keyboardRows[0].map((key) => (
                <KeyButton
                  key={key}
                  value={key}
                  onPress={handleLetter}
                  compactMode={compactMode}
                />
              ))}
            </div>

            <div
              className={cn(
                "grid w-full grid-cols-9 gap-[6px] px-[6%]",
                compactMode === "compact" && "gap-[5px]",
                compactMode === "tight" && "gap-[4px]"
              )}
            >
              {keyboardRows[1].map((key) => (
                <KeyButton
                  key={key}
                  value={key}
                  onPress={handleLetter}
                  compactMode={compactMode}
                />
              ))}
            </div>

            <div
              className={cn(
                "grid w-full grid-cols-[repeat(7,minmax(0,1fr))_1.35fr] gap-[6px] px-[8.5%]",
                compactMode === "compact" && "gap-[5px]",
                compactMode === "tight" && "gap-[4px]"
              )}
            >
              {keyboardRows[2].map((key) => (
                <KeyButton
                  key={key}
                  value={key}
                  onPress={handleLetter}
                  compactMode={compactMode}
                />
              ))}
              <button
                type="button"
                onClick={handleBackspace}
                className={cn(
                  keyboardButtonClassName,
                  compactMode === "normal" &&
                    "h-[48px] rounded-[8px] text-[18px] leading-[26px]",
                  compactMode === "compact" &&
                    "h-[44px] rounded-[8px] text-[16px] leading-[22px]",
                  compactMode === "tight" &&
                    "h-[40px] rounded-[7px] text-[15px] leading-[20px]"
                )}
                aria-label={copy.backspace}
              >
                <img
                  src={dlsAssets.backspace}
                  alt={copy.backspace}
                  className={cn(
                    "h-[20px] w-[20px]",
                    compactMode === "compact" && "h-[18px] w-[18px]",
                    compactMode === "tight" && "h-[16px] w-[16px]"
                  )}
                  width={20}
                  height={20}
                  loading="lazy"
                  decoding="async"
                />
              </button>
            </div>
          </div>
        </section>

        {isPauseOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-[2px]">
            <div className="flex w-full max-w-[320px] flex-col items-center rounded-[20px] bg-white px-[24px] py-[32px] shadow-[0_20px_60px_0_rgba(0,0,0,0.30)]">
              <img
                src={dlsAssets.timer}
                alt={copy.pauseIllustrationAlt}
                className="h-[48px] w-[48px]"
                width={48}
                height={48}
                loading="lazy"
                decoding="async"
              />
              <h2 className="mt-4 text-center text-[24px] leading-[36px] font-semibold text-black">
                {copy.gamePausedTitle}
              </h2>
              <p className="mt-2 text-center text-[18px] leading-[28px] font-normal text-black/70">
                {copy.gamePausedDescription}
              </p>
              <div className="mt-6 flex w-full flex-col gap-[10px]">
                <PauseToggleRow
                  label={copy.hintToggle}
                  checked={isHintsTurnedOff}
                  onChange={setIsHintsTurnedOff}
                />
                <PauseToggleRow
                  label={copy.bonusWordsToggle}
                  description={copy.bonusWordsHint}
                  checked={isWordBlastTurnedOff}
                  onChange={setIsWordBlastTurnedOff}
                />
              </div>
              <button
                type="button"
                onClick={() => setIsPauseOpen(false)}
                className="mt-6 inline-flex h-[56px] w-full max-w-[240px] items-center justify-center rounded-[12px] bg-black px-4 py-[14px] text-[19px] leading-[30px] font-semibold text-white"
              >
                {copy.continueButton}
              </button>
            </div>
          </div>
        )}
      </main>
    )
  }

  const transitionPair: ScreenTransitionPair = screenTransition
    ? (`${screenTransition.from}-${screenTransition.to}` as ScreenTransitionPair)
    : "idle"
  const activeScreen = screenTransition?.to ?? settledScreen
  const activeMotionState: ScreenMotionState = screenTransition
    ? "enter"
    : "static"
  const activePair = screenTransition ? transitionPair : "idle"

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#F6F0D7]">
      {screenTransition ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-10",
            screenTransition.phase === "active" && "animate-screen-layer-exit"
          )}
          aria-hidden="true"
        >
          {renderScreen(screenTransition.from, "exit", transitionPair)}
        </div>
      ) : null}
      <div
        className={cn(
          "relative z-20",
          screenTransition
            ? screenTransition.phase === "prepare"
              ? "opacity-0"
              : "animate-screen-layer-enter"
            : "opacity-100"
        )}
        onAnimationEnd={handleTransitionAnimationEnd}
      >
        {renderScreen(activeScreen, activeMotionState, activePair)}
      </div>
    </div>
  )
}

function KeyButton({
  value,
  onPress,
  compactMode,
}: {
  value: string
  onPress: (value: string) => void
  compactMode: CompactMode
}) {
  return (
    <button
      type="button"
      onClick={() => onPress(value)}
      className={cn(
        homeBodyFont.className,
        keyboardButtonClassName,
        compactMode === "normal" &&
          "h-[48px] rounded-[8px] text-[18px] leading-[26px]",
        compactMode === "compact" &&
          "h-[44px] rounded-[8px] text-[16px] leading-[22px]",
        compactMode === "tight" &&
          "h-[40px] rounded-[7px] text-[15px] leading-[20px]"
      )}
    >
      {value}
    </button>
  )
}

function PauseToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-[12px] border border-black/10 bg-[#F8F6EF] px-[12px] py-[10px]">
      <div className="min-w-0 pr-3">
        <div className="text-[14px] leading-[20px] font-semibold text-black">
          {label}
        </div>
        {description ? (
          <div className="mt-1 text-[12px] leading-[18px] text-black/60">
            {description}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-[26px] w-[44px] items-center rounded-full transition-colors",
          checked ? "bg-black" : "bg-black/20"
        )}
      >
        <span
          className={cn(
            "h-[20px] w-[20px] rounded-full bg-white transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-[3px]"
          )}
        />
      </button>
    </div>
  )
}

function HomeMascot({ onTap, label }: { onTap: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="rounded-full"
      aria-label={label}
    >
      <img
        src="https://staging-images.bhaskarassets.com/web2images/521/2026/04/crossword-logo_1776932259.png"
        alt={label}
        className="h-[100px] w-[100px] shrink-0 object-contain"
        width={100}
        height={100}
        loading="eager"
        decoding="async"
      />
    </button>
  )
}

function SummaryCelebrationIcon({ alt }: { alt: string }) {
  return (
    <img
      src={dlsAssets.trophy}
      alt={alt}
      className="h-[72px] w-[72px] object-contain"
      width={72}
      height={72}
      loading="lazy"
      decoding="async"
    />
  )
}

function FlameBadge({ alt }: { alt: string }) {
  return (
    <img
      src={dlsAssets.fire}
      alt={alt}
      className="h-[24px] w-[24px] object-contain"
      width={24}
      height={24}
      loading="lazy"
      decoding="async"
    />
  )
}

function buildCellData(allClues: Clue[]) {
  const cells: Record<string, GridCell> = {}

  allClues.forEach((clue) => {
    clue.cells.forEach((cell, index) => {
      const key = cell.key
      const solution = clue.answer[index]
      const existing = cells[key]

      if (existing && existing.solution !== solution) {
        throw new Error(`Conflicting solution at ${key}`)
      }

      cells[key] = {
        row: cell.row,
        col: cell.col,
        solution,
        clueIds: existing ? [...existing.clueIds, clue.id] : [clue.id],
        number: existing?.number ?? (index === 0 ? clue.number : undefined),
      }
    })
  })

  return cells
}

function buildPuzzleModel(puzzle: {
  rows: number
  cols: number
  clues: ClueDefinition[]
  givenCells: string[]
}): PuzzleModel {
  const clues: Clue[] = puzzle.clues.map((clue) => ({
    ...clue,
    cells: clue.answer.split("").map((_, index) => {
      const row = clue.row + (clue.direction === "down" ? index : 0)
      const col = clue.col + (clue.direction === "across" ? index : 0)

      return { row, col, key: keyFor(row, col) }
    }),
  }))

  const clueOrder = clues.map((clue) => clue.id)
  const clueById = Object.fromEntries(
    clues.map((clue) => [clue.id, clue])
  ) as Record<string, Clue>
  const cellData = buildCellData(clues)
  const givenLocks = Object.fromEntries(
    puzzle.givenCells.map((key) => [key, "given"])
  ) as Partial<Record<string, LockSource>>
  const initialEntries = Object.fromEntries(
    Object.keys(givenLocks).map((key) => [key, cellData[key].solution])
  )
  const solvedIds = getSolvedClueIds(clues, cellData, initialEntries)
  const firstActiveClueId =
    clueOrder.find((clueId) => !solvedIds.includes(clueId)) ?? clueOrder[0]
  const initialGame: GameState = {
    entries: initialEntries,
    lockSources: givenLocks,
    solvedIds,
    completedIds: [],
    wrongGuessCounts: {},
    elapsedSeconds: 0,
    activeClueId: firstActiveClueId,
    activeIndex: firstEmptyIndex(
      clueById[firstActiveClueId],
      initialEntries,
      givenLocks
    ),
    feedback: null,
  }

  return {
    GRID_ROWS: puzzle.rows,
    GRID_COLS: puzzle.cols,
    clues,
    clueOrder,
    clueById,
    cellData,
    givenLocks,
    initialEntries,
    initialGame,
  }
}

function revealLetters(
  clues: Clue[],
  cellData: Record<string, GridCell>,
  entries: Record<string, string>,
  lockSources: Partial<Record<string, LockSource>>,
  solvedIds: string[]
) {
  const solvedSet = new Set(solvedIds)
  const eligibleClues = clues
    .filter((clue) => !solvedSet.has(clue.id))
    .map((clue) => {
      const emptyCells = clue.cells.filter(
        (cell) => !entries[cell.key] && !lockSources[cell.key]
      )
      return { clue, emptyCells }
    })
    .filter(({ emptyCells }) => emptyCells.length > 1)

  if (eligibleClues.length === 0) {
    return { entries, lockSources, revealedCellKeys: [] }
  }

  const shuffledClues = shuffle(eligibleClues)
  const revealCount = Math.min(
    Math.floor(Math.random() * 2) + 1,
    shuffledClues.length
  )
  const nextEntries = { ...entries }
  const nextLockSources = { ...lockSources }
  const revealedCellKeys: string[] = []

  shuffledClues.slice(0, revealCount).forEach(({ emptyCells }) => {
    const chosenCell = emptyCells[Math.floor(Math.random() * emptyCells.length)]
    nextEntries[chosenCell.key] = cellData[chosenCell.key].solution
    nextLockSources[chosenCell.key] = "revealed"
    revealedCellKeys.push(chosenCell.key)
  })

  return {
    entries: nextEntries,
    lockSources: nextLockSources,
    revealedCellKeys,
  }
}

function isClueSolved(
  clue: Clue,
  cellData: Record<string, GridCell>,
  entries: Record<string, string>
) {
  return clue.cells.every(
    (cell) => entries[cell.key] === cellData[cell.key].solution
  )
}

function isClueFilled(clue: Clue, entries: Record<string, string>) {
  return clue.cells.every((cell) => Boolean(entries[cell.key]))
}

function freezeSolvedClue(
  lockSources: Partial<Record<string, LockSource>>,
  clue: Clue
) {
  const nextLockSources = { ...lockSources }

  clue.cells.forEach((cell) => {
    nextLockSources[cell.key] = "solved"
  })

  return nextLockSources
}

function firstEmptyIndex(
  clue: Clue,
  entries: Record<string, string>,
  lockSources: Partial<Record<string, LockSource>>
) {
  const firstEmpty = clue.cells.findIndex(
    (cell) => !entries[cell.key] && !lockSources[cell.key]
  )
  if (firstEmpty !== -1) {
    return firstEmpty
  }

  const firstEditable = clue.cells.findIndex((_, index) =>
    isEditableCell(clue, index, lockSources)
  )
  return firstEditable === -1 ? 0 : firstEditable
}

function findWritableIndex(
  clue: Clue,
  activeIndex: number,
  _entries: Record<string, string>,
  lockSources: Partial<Record<string, LockSource>>
) {
  const preferredCell = clue.cells[activeIndex]
  if (preferredCell && !lockSources[preferredCell.key]) {
    return activeIndex
  }

  return clue.cells.findIndex((cell) => !lockSources[cell.key])
}

function nextCursorIndex(
  clue: Clue,
  currentIndex: number,
  entries: Record<string, string>,
  lockSources: Partial<Record<string, LockSource>>
) {
  for (let index = currentIndex + 1; index < clue.cells.length; index += 1) {
    const key = clue.cells[index].key
    if (!entries[key] && !lockSources[key]) {
      return index
    }
  }

  for (let index = currentIndex + 1; index < clue.cells.length; index += 1) {
    const key = clue.cells[index].key
    if (!lockSources[key]) {
      return index
    }
  }

  return currentIndex
}

function firstIncorrectEditableIndex(
  clue: Clue,
  cellData: Record<string, GridCell>,
  entries: Record<string, string>,
  lockSources: Partial<Record<string, LockSource>>
) {
  return clue.cells.findIndex((cell) => {
    if (lockSources[cell.key]) {
      return false
    }

    return entries[cell.key] !== cellData[cell.key].solution
  })
}

function findNextUnsolvedClueId(
  clueOrder: string[],
  currentClueId: string,
  solvedIds: string[]
) {
  const solvedSet = new Set(solvedIds)
  const currentIndex = clueOrder.indexOf(currentClueId)

  for (let offset = 1; offset < clueOrder.length; offset += 1) {
    const nextId = clueOrder[(currentIndex + offset) % clueOrder.length]
    if (!solvedSet.has(nextId)) {
      return nextId
    }
  }

  return null
}

function clearEditableClueEntries(
  entries: Record<string, string>,
  lockSources: Partial<Record<string, LockSource>>,
  clue: Clue
) {
  const nextEntries = { ...entries }

  clue.cells.forEach((cell) => {
    if (!lockSources[cell.key]) {
      delete nextEntries[cell.key]
    }
  })

  return nextEntries
}

function previousFilledIndex(
  clue: Clue,
  currentIndex: number,
  entries: Record<string, string>,
  lockSources: Partial<Record<string, LockSource>>
) {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const key = clue.cells[index].key
    if (entries[key] && !lockSources[key]) {
      return index
    }
  }

  return -1
}

function isEditableCell(
  clue: Clue,
  index: number,
  lockSources: Partial<Record<string, LockSource>>
) {
  const cell = clue.cells[index]
  return Boolean(cell) && !lockSources[cell.key]
}

function keyFor(row: number, col: number) {
  return `${row}-${col}`
}

function shuffle<T>(items: T[]) {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }

  return next
}

function hasStartedPuzzle(
  game: GameState,
  initialEntries: Record<string, string>
) {
  if (game.completedIds.length > 0 || game.elapsedSeconds > 0) {
    return true
  }

  return Object.keys(game.entries).some((key) => !initialEntries[key])
}

function getPuzzleStorageKey(puzzleId: string) {
  return `daily-crossword-progress:${puzzleId}`
}

const SETTINGS_STORAGE_KEY = "daily-crossword-settings"

function loadStoredSettings(): GameSettings {
  if (typeof window === "undefined") {
    return {
      isHintsTurnedOff: false,
      isWordBlastTurnedOff: false,
    }
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) {
      return {
        isHintsTurnedOff: false,
        isWordBlastTurnedOff: false,
      }
    }

    const parsed = JSON.parse(raw) as Partial<GameSettings>
    return {
      isHintsTurnedOff: Boolean(parsed.isHintsTurnedOff),
      isWordBlastTurnedOff: Boolean(parsed.isWordBlastTurnedOff),
    }
  } catch {
    return {
      isHintsTurnedOff: false,
      isWordBlastTurnedOff: false,
    }
  }
}

function storeSettings(settings: GameSettings) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

function serializeGame(game: GameState) {
  return JSON.stringify({
    ...game,
    feedback: null,
  })
}

function loadStoredGame(storageKey: string, puzzleModel: PuzzleModel) {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<GameState>
    const entries = Object.fromEntries(
      Object.entries(parsed.entries ?? {}).filter(([key, value]) => {
        return typeof value === "string" && Boolean(puzzleModel.cellData[key])
      })
    )
    const lockSources = Object.fromEntries(
      Object.entries(parsed.lockSources ?? {}).filter(([, value]) => {
        return value === "given" || value === "revealed" || value === "solved"
      })
    ) as Partial<Record<string, LockSource>>
    const completedIds = (parsed.completedIds ?? []).filter(
      (clueId): clueId is string => {
        return typeof clueId === "string" && clueId in puzzleModel.clueById
      }
    )
    const wrongGuessCounts = Object.fromEntries(
      Object.entries(parsed.wrongGuessCounts ?? {}).filter(
        ([clueId, value]) => {
          return (
            clueId in puzzleModel.clueById &&
            typeof value === "number" &&
            Number.isFinite(value) &&
            value >= 0
          )
        }
      )
    ) as Record<string, number>
    const activeClueId =
      typeof parsed.activeClueId === "string" &&
      parsed.activeClueId in puzzleModel.clueById
        ? parsed.activeClueId
        : puzzleModel.initialGame.activeClueId
    const activeIndex = clampIndex(
      typeof parsed.activeIndex === "number"
        ? parsed.activeIndex
        : puzzleModel.initialGame.activeIndex,
      puzzleModel.clueById[activeClueId].cells.length
    )
    const elapsedSeconds =
      typeof parsed.elapsedSeconds === "number" && parsed.elapsedSeconds >= 0
        ? Math.floor(parsed.elapsedSeconds)
        : 0
    const mergedEntries = {
      ...puzzleModel.initialGame.entries,
      ...entries,
    }
    const solvedIds = getSolvedClueIds(
      puzzleModel.clues,
      puzzleModel.cellData,
      mergedEntries
    )

    return {
      ...puzzleModel.initialGame,
      entries: mergedEntries,
      lockSources: {
        ...puzzleModel.initialGame.lockSources,
        ...lockSources,
      },
      solvedIds,
      completedIds,
      wrongGuessCounts,
      elapsedSeconds,
      activeClueId,
      activeIndex,
      feedback: null,
    }
  } catch {
    return null
  }
}

function clampIndex(index: number, length: number) {
  if (length <= 0) {
    return 0
  }

  return Math.max(0, Math.min(index, length - 1))
}

function readCompletionHistory(
  puzzles: CrosswordPuzzleSummary[]
): Record<string, boolean> {
  if (typeof window === "undefined") {
    return {}
  }

  return Object.fromEntries(
    puzzles.map((puzzle) => {
      try {
        const raw = window.localStorage.getItem(getPuzzleStorageKey(puzzle.id))
        if (!raw) {
          return [puzzle.date, false]
        }

        const parsed = JSON.parse(raw) as Partial<GameState>
        return [
          puzzle.date,
          (parsed.solvedIds?.length ?? 0) >= puzzle.clueCount,
        ]
      } catch {
        return [puzzle.date, false]
      }
    })
  )
}

function buildWeeklyStreakDays(
  dateKey: string,
  completionHistory: Record<string, boolean>,
  isTodayComplete: boolean,
  labels: readonly string[]
): StreakDay[] {
  const currentDate = new Date(`${dateKey}T00:00:00`)
  const day = currentDate.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(currentDate)
  monday.setDate(currentDate.getDate() + mondayOffset)

  return labels.map((label, index) => {
    const current = new Date(monday)
    current.setDate(monday.getDate() + index)
    const currentKey = getLocalDateKey(current)
    const isToday = currentKey === dateKey

    if (isToday) {
      return {
        label,
        state: isTodayComplete ? "complete" : "pending",
        isToday: true,
      }
    }

    if (currentKey > dateKey) {
      return { label, state: "pending", isToday: false }
    }

    return {
      label,
      state: completionHistory[currentKey] ? "complete" : "missed",
      isToday: false,
    }
  })
}

function getNextChallengeDateKey(
  dateKey: string,
  puzzles: CrosswordPuzzleSummary[]
) {
  const nextScheduled = [...puzzles]
    .sort((left, right) => left.date.localeCompare(right.date))
    .find((puzzle) => puzzle.date > dateKey)

  if (nextScheduled) {
    return nextScheduled.date
  }

  const current = new Date(`${dateKey}T00:00:00`)
  current.setDate(current.getDate() + 1)
  return getLocalDateKey(current)
}

function formatNextChallengeDate(dateKey: string, locale: string) {
  const date = new Date(`${dateKey}T00:00:00`)

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date)
}

function getSolvedClueIds(
  clues: Clue[],
  cellData: Record<string, GridCell>,
  entries: Record<string, string>
) {
  return clues
    .filter((clue) =>
      clue.cells.every(
        (cell) => entries[cell.key] === cellData[cell.key].solution
      )
    )
    .map((clue) => clue.id)
}

function formatElapsedTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function formatPuzzleDate(dateKey: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${dateKey}T00:00:00`))
}

function formatPuzzleDateLong(dateKey: string, locale: string) {
  const date = new Date(`${dateKey}T00:00:00`)

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date)
}

function normalizeMeaning(
  meaning: string | undefined,
  answer: string,
  copy: CrosswordCopy
) {
  const normalized = meaning?.trim() ?? ""

  if (normalized) {
    return normalized
  }

  return copy.formatMeaningFallback(answer)
}
