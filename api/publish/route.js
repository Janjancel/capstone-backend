import { redis } from "@/lib/redis";

export async function POST(req) {
  const { message } = await req.json();
  
  await redis.publish("chat-channel", message);

  return Response.json({ status: "Message published" });
}
