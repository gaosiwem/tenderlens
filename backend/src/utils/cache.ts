import { redis } from "../redis/client"
import { logger } from "./logger"

export class CacheService {
  /**
   * Get a value from cache
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key)
      if (!data) return null
      return JSON.parse(data) as T
    } catch (error) {
      logger.error({ err: error, key }, "[cache] Error getting key")
      return null
    }
  }

  /**
   * Set a value in cache with optional TTL (in seconds)
   * Default TTL is 24 hours (86400 seconds)
   */
  static async set(key: string, value: any, ttlSeconds: number = 86400): Promise<void> {
    try {
      const data = JSON.stringify(value)
      await redis.set(key, data, "EX", ttlSeconds)
    } catch (error) {
      logger.error({ err: error, key }, "[cache] Error setting key")
    }
  }

  /**
   * Delete a value from cache
   */
  static async del(key: string): Promise<void> {
    try {
      await redis.del(key)
    } catch (error) {
      logger.error({ err: error, key }, "[cache] Error deleting key")
    }
  }

  /**
   * Generate a standard cache key for AI responses
   */
  static getAiKey(tenderId: string, task: string): string {
    return `ai:cache:tender:${tenderId}:${task}`
  }
}
