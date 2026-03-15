import { env } from "../../config/env"

export function estimateChatCost(args: {
  inputChars: number
  maxOutputTokens: number
}) {
  const inputUnits = Math.ceil(args.inputChars / 1000)
  const outputUnits = Math.ceil(args.maxOutputTokens / 1000)

  const cost =
    env.COST_CHAT_REQUEST_BASE +
    inputUnits * env.COST_CHAT_PER_1K_INPUT_CHARS +
    outputUnits * env.COST_CHAT_PER_1K_OUTPUT_TOKENS

  return Math.max(0, Math.floor(cost))
}
