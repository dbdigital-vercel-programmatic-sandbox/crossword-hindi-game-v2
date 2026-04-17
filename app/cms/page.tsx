import { CrosswordCms } from "@/components/crossword-cms"
import {
  getFallbackPuzzleId,
  isDatabaseEnabled,
  listAllPuzzles,
} from "@/lib/crossword-puzzle-store"

export const dynamic = "force-dynamic"

export default async function CmsPage() {
  const [puzzles, fallbackPuzzleId] = await Promise.all([
    listAllPuzzles(),
    getFallbackPuzzleId(),
  ])

  return (
    <CrosswordCms
      initialPuzzles={puzzles}
      initialFallbackPuzzleId={fallbackPuzzleId}
      databaseConnected={isDatabaseEnabled()}
    />
  )
}
