import { NextResponse } from "next/server"

import {
  getFallbackPuzzleId,
  isDatabaseEnabled,
  listAllPuzzles,
  setFallbackPuzzleId,
} from "@/lib/crossword-puzzle-store"
import { getSession } from "@/lib/internal/auth-session"

export async function GET() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  return NextResponse.json({
    fallbackPuzzleId: await getFallbackPuzzleId(),
    databaseConnected: isDatabaseEnabled(),
  })
}

export async function POST(request: Request) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    if (!isDatabaseEnabled()) {
      return NextResponse.json(
        { error: "Connect the database before updating the fallback puzzle." },
        { status: 400 }
      )
    }

    const body = (await request.json()) as { puzzleId?: unknown }
    const puzzleId =
      typeof body.puzzleId === "string" && body.puzzleId.trim().length > 0
        ? body.puzzleId.trim()
        : null

    if (puzzleId) {
      const puzzles = await listAllPuzzles()
      const puzzleExists = puzzles.some((puzzle) => puzzle.id === puzzleId)

      if (!puzzleExists) {
        return NextResponse.json(
          { error: "Puzzle not found." },
          { status: 404 }
        )
      }
    }

    const fallbackPuzzleId = await setFallbackPuzzleId(puzzleId)

    return NextResponse.json({
      fallbackPuzzleId,
      databaseConnected: true,
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message === "DATABASE_NOT_CONFIGURED"
        ? "Connect the database before updating the fallback puzzle."
        : error instanceof Error
          ? error.message
          : "Unable to update the fallback puzzle right now."

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
