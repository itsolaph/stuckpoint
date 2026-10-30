import { defineAppConfig } from "@agent-native/core/server";

export default defineAppConfig({
  app: {
    // This name appears in transactional emails. Change it to your product name.
    name: "Deadbolt",
    // The source template keeps a renamed app from inheriting first-party email branding.
    sourceTemplate: "chat",
    // Sign-in lands on the room list.
    homePath: "/home",
    // Optional: use your own absolute HTTPS logo URL in transactional emails.
    // logoUrl: "https://example.com/logo.png",
  },
  agent: {
    // OpenRouter via @openrouter/ai-sdk-provider; the key is OPENROUTER_API_KEY in .env.
    // Both are overridable at runtime (AGENT_ENGINE / AGENT_MODEL, or app settings).
    engine: "ai-sdk:openrouter",
    model: "anthropic/claude-sonnet-4.5",
  },
});
