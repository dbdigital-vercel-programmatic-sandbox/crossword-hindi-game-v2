import { NextResponse } from "next/server"

import {
  getSuggestionResponse,
  type SuggestionRequest,
} from "@/lib/crossword-suggestions"
import { getSession } from "@/lib/internal/auth-session"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const payload = (await request.json()) as SuggestionRequest
    return NextResponse.json(await getSuggestionResponse(payload))
  } catch {
    return NextResponse.json(
      { error: "Unable to generate suggestions right now." },
      { status: 500 }
    )
  }
}
