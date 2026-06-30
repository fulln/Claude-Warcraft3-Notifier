import { runEventBridge } from "./ai-event-bridge.mjs";

const raw = await readStdin();
const afterAgent = raw ? JSON.parse(raw) : {};

await runEventBridge({
  source: "gemini",
  raw: {
    type: "done",
    hook_event_name: "AfterAgent",
    title: "Gemini finished the task",
    message: summarize(afterAgent.prompt_response),
  },
});

function summarize(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "Gemini finished the current task.";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 140
    ? `${normalized.slice(0, 137)}...`
    : normalized;
}

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input.trim();
}
