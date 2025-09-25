import { Redis } from "@upstash/redis";

export const runtime = "edge"; // works on Vercel edge
const redis = Redis.fromEnv();

export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // subscribe to redis channel
      const sub = redis.subscribe("chat-channel", (msg) => {
        controller.enqueue(encoder.encode(`data: ${msg}\n\n`));
      });

      // keep alive ping (avoid timeout)
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(`:keep-alive\n\n`));
      }, 15000);

      return () => {
        clearInterval(interval);
        sub.unsubscribe();
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
