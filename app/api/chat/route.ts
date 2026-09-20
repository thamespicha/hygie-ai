// app/api/chat/route.ts
import { streamText, convertToModelMessages } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: google("gemini-3.6-flash"),
    system: "You are Hygie AI, a helpful and highly accurate medical fact-checking assistant.",
    messages: await convertToModelMessages(messages),
  });

  return result.toTextStreamResponse();
}