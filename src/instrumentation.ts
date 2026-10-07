// Runs once when the Next.js server boots (also under the custom server.js on Hostinger).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
