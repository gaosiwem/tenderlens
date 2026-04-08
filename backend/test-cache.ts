import { CacheService } from "./src/utils/cache"
import { redis } from "./src/redis/client"

async function testCache() {
  const tenderId = "test-tender-123"
  const task = "summary"
  const key = CacheService.getAiKey(tenderId, task)
  const mockData = { content: "This is a cached summary", createdAt: new Date() }

  console.log("Setting cache...")
  await CacheService.set(key, mockData)

  console.log("Getting cache...")
  const cached = await CacheService.get(key)
  console.log("Cached data:", cached)

  if (cached && (cached as any).content === mockData.content) {
    console.log("✅ Cache verified successfully!")
  } else {
    console.log("❌ Cache verification failed!")
  }

  await redis.quit()
}

testCache().catch(console.error)
