export const metrics = {
  requestCount: (_method: string, _path: string, _statusCode: number) => {
    // Placeholder for metrics integration.
  },
  errorCount: (_code: string) => {
    // Placeholder for metrics integration.
  },
  latencyMs: (_method: string, _path: string, _durationMs: number) => {
    // Placeholder for histogram integration.
  }
}