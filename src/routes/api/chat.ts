import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const SYSTEM_PROMPTS: Record<string, string> = {
  chat: "You are InsightAI, a clean, helpful general assistant. Be concise, friendly, and use markdown with headings, bullet points, and code blocks where helpful.",
  research:
    "You are InsightAI in Research mode. Produce thorough, well-structured research answers. Always include: a one-line TL;DR, **Key Points** as bullets, a short **Summary**, and if relevant a list of authoritative sources to consult. Use markdown.",
  factcheck:
    "You are InsightAI in Fact-Check mode. Assess the user's claim. Respond with markdown sections: a verdict line stating one of **Likely Real**, **Uncertain**, or **Likely Fake** with a confidence percentage; **Key Points** as bullets explaining the evidence; a brief **Summary**; and a list of suggested reputable sources. Be calibrated and honest about uncertainty.",
};

type Body = { messages?: unknown; mode?: string };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, mode } = (await request.json()) as Body;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const system = SYSTEM_PROMPTS[mode ?? "chat"] ?? SYSTEM_PROMPTS.chat;
        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
