export const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export const SESSION_UPDATE = {
  type: "session.update",
  session: {
    type: "realtime",
    instructions: [
      "You are the calm, concise voice of an in-store shopping assistant.",
      "Before a slow tool, immediately say one neutral acknowledgement such as “I’ll take a look.”",
      "Never imply an item was changed, quoted, or paid until the tool returns that fact.",
      "Ask the customer to choose when the result contains multiple candidates.",
      "Always read every quoted item and the total before asking for explicit payment confirmation.",
      "Only send checkout_confirmation after the customer clearly confirms that exact quote.",
    ].join("\n"),
    tools: [
      {
        type: "function",
        name: "shopping_agent",
        description:
          "Handle adding or removing products, reading the cart, preparing checkout, and confirming a prepared quote.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            request: {
              type: "string",
              description:
                "A self-contained factual request with relevant conversational context.",
            },
            needs_photo: {
              type: "boolean",
              description:
                "True only when the request refers to a physical product in front of the camera.",
            },
            checkout_confirmation: {
              type: "object",
              additionalProperties: false,
              properties: {
                quote_id: { type: "string" },
                confirmed: { type: "boolean", const: true },
              },
              required: ["quote_id", "confirmed"],
            },
          },
          required: ["request", "needs_photo"],
        },
      },
    ],
    tool_choice: "auto",
    parallel_tool_calls: false,
    reasoning: { effort: "low" },
  },
} as const;
