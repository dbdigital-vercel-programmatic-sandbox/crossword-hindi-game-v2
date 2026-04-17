import "server-only"

import { crosswordLevels } from "@/data/crossword-levels"
import { hasDatabaseConnection, sql } from "@/lib/db"
import {
  type CrosswordPuzzle,
  type CrosswordPuzzleSummary,
  getScheduledPuzzle,
} from "@/lib/crossword-schedule"

type PuzzleRow = {
  id: string
  date: string
  title: string
  rows: number
  cols: number
  puzzle: CrosswordPuzzle | string
}

type SettingRow = {
  value: string | null
}

const FALLBACK_PUZZLE_SETTING_KEY = "fallback_puzzle_id"

let databaseReady: Promise<void> | null = null

export function isDatabaseEnabled() {
  return hasDatabaseConnection
}

export async function listAllPuzzles() {
  if (!sql) {
    return sortPuzzles(crosswordLevels)
  }

  try {
    await ensureDatabaseReady()
    const rows = (await sql`
      SELECT id, scheduled_date::text AS date, title, rows, cols, puzzle
      FROM crossword_puzzles
      ORDER BY scheduled_date ASC
    `) as PuzzleRow[]

    return sortPuzzles(rows.map((row) => readPuzzle(row.puzzle)))
  } catch {
    return sortPuzzles(crosswordLevels)
  }
}

export async function listPuzzleSchedule(): Promise<CrosswordPuzzleSummary[]> {
  const puzzles = await listAllPuzzles()
  return puzzles.map((puzzle) => ({
    id: puzzle.id,
    date: puzzle.date,
    title: puzzle.title,
    clueCount: puzzle.clues.length,
  }))
}

export async function getPuzzleForDate(dateKey: string) {
  const puzzles = await listAllPuzzles()
  const exactMatch = puzzles.find((puzzle) => puzzle.date === dateKey)

  if (exactMatch) {
    return exactMatch
  }

  const fallbackPuzzle = await getConfiguredFallbackPuzzle(puzzles)
  return fallbackPuzzle ?? getScheduledPuzzle(puzzles, dateKey)
}

export async function getFallbackPuzzleId() {
  if (!sql) {
    return null
  }

  try {
    await ensureDatabaseReady()
    const rows = (await sql`
      SELECT setting_value AS value
      FROM crossword_settings
      WHERE setting_key = ${FALLBACK_PUZZLE_SETTING_KEY}
      LIMIT 1
    `) as SettingRow[]

    const value = rows[0]?.value?.trim()
    return value ? value : null
  } catch {
    return null
  }
}

export async function setFallbackPuzzleId(puzzleId: string | null) {
  if (!sql) {
    throw new Error("DATABASE_NOT_CONFIGURED")
  }

  await ensureDatabaseReady()

  if (!puzzleId) {
    await sql`
      DELETE FROM crossword_settings
      WHERE setting_key = ${FALLBACK_PUZZLE_SETTING_KEY}
    `

    return null
  }

  await sql`
    INSERT INTO crossword_settings (setting_key, setting_value)
    VALUES (${FALLBACK_PUZZLE_SETTING_KEY}, ${puzzleId})
    ON CONFLICT (setting_key)
    DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      updated_at = NOW()
  `

  return puzzleId
}

export async function getConfiguredFallbackPuzzle(puzzles?: CrosswordPuzzle[]) {
  const [fallbackPuzzleId, allPuzzles] = await Promise.all([
    getFallbackPuzzleId(),
    puzzles ? Promise.resolve(puzzles) : listAllPuzzles(),
  ])

  if (!fallbackPuzzleId) {
    return null
  }

  return allPuzzles.find((puzzle) => puzzle.id === fallbackPuzzleId) ?? null
}

export async function savePuzzle(puzzle: CrosswordPuzzle) {
  if (!sql) {
    throw new Error("DATABASE_NOT_CONFIGURED")
  }

  await ensureDatabaseReady()

  await sql`
    INSERT INTO crossword_puzzles (
      id,
      scheduled_date,
      title,
      rows,
      cols,
      puzzle
    )
    VALUES (
      ${puzzle.id},
      ${puzzle.date},
      ${puzzle.title},
      ${puzzle.rows},
      ${puzzle.cols},
      ${JSON.stringify(puzzle)}::jsonb
    )
    ON CONFLICT (scheduled_date)
    DO UPDATE SET
      id = EXCLUDED.id,
      title = EXCLUDED.title,
      rows = EXCLUDED.rows,
      cols = EXCLUDED.cols,
      puzzle = EXCLUDED.puzzle,
      updated_at = NOW()
  `

  return puzzle
}

async function ensureDatabaseReady() {
  if (databaseReady) {
    return databaseReady
  }

  databaseReady = (async () => {
    if (!sql) {
      return
    }

    await sql`
      CREATE TABLE IF NOT EXISTS crossword_puzzles (
        id TEXT PRIMARY KEY,
        scheduled_date DATE NOT NULL UNIQUE,
        title TEXT NOT NULL,
        rows INTEGER NOT NULL,
        cols INTEGER NOT NULL,
        puzzle JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS crossword_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    const [{ count }] = (await sql`
      SELECT COUNT(*)::text AS count FROM crossword_puzzles
    `) as Array<{ count: string }>

    if (Number(count) > 0) {
      return
    }

    for (const puzzle of crosswordLevels) {
      await saveSeedPuzzle(puzzle)
    }
  })().catch((error) => {
    databaseReady = null
    throw error
  })

  return databaseReady
}

async function saveSeedPuzzle(puzzle: CrosswordPuzzle) {
  if (!sql) {
    return
  }

  await sql`
    INSERT INTO crossword_puzzles (
      id,
      scheduled_date,
      title,
      rows,
      cols,
      puzzle
    )
    VALUES (
      ${puzzle.id},
      ${puzzle.date},
      ${puzzle.title},
      ${puzzle.rows},
      ${puzzle.cols},
      ${JSON.stringify(puzzle)}::jsonb
    )
    ON CONFLICT (scheduled_date)
    DO NOTHING
  `
}

function readPuzzle(puzzle: CrosswordPuzzle | string) {
  return typeof puzzle === "string"
    ? (JSON.parse(puzzle) as CrosswordPuzzle)
    : puzzle
}

function sortPuzzles(puzzles: CrosswordPuzzle[]) {
  return [...puzzles].sort((left, right) => left.date.localeCompare(right.date))
}
