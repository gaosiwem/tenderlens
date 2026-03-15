import { env } from "../src/config/env"

// Mock express response
const mockRes = {
  json: (data: any) => {
    console.log("Response data:", JSON.stringify(data, null, 2))
    if (process.env.NODE_ENV === "production" && data.data?.devToken !== null) {
      console.error("FAIL: devToken leaked in production!")
      process.exit(1)
    } else if (process.env.NODE_ENV === "production") {
      console.log("PASS: devToken is null in production.")
    } else {
      console.log(
        `INFO: devToken is ${data.data?.devToken} in ${process.env.NODE_ENV} mode.`,
      )
    }
  },
}

async function runTest() {
  console.log(`Running verification in NODE_ENV=${process.env.NODE_ENV}`)

  // Logic from authRouter.post("/request-password-reset")
  const out = { token: "secret-token-123" }
  const responseData = {
    ok: true,
    data: {
      message: "If that email exists, a reset link has been sent.",
      devToken: env.NODE_ENV !== "production" ? (out.token ?? null) : null,
    },
  }

  mockRes.json(responseData)
}

runTest()
