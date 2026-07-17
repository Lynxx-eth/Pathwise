// Mock AI provider — deterministic, free, no API key. Lets the whole app work
// end-to-end during development. Swap to OpenAI by setting AI_PROVIDER=openai.
import type {
  AIProvider,
  ExtractedTopic,
  QuizQuestion,
  ChatMessage,
} from "./types.js";

// Pull candidate topic phrases out of text using simple heuristics so the
// mock still produces course-specific output instead of fixed placeholders.
function candidatePhrases(text: string): string[] {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 3 && l.length < 80);

  // Prefer bullet/heading-ish lines; fall back to capitalized phrases.
  const headingish = lines.filter((l) =>
    /^(chapter|topic|unit|week|module|\d+[.)]|[-*•])/i.test(l)
  );
  const source = headingish.length >= 3 ? headingish : lines;

  const cleaned = source
    .map((l) =>
      l
        // Drop a leading structural label ("Chapter", "Week 3:", "1)", bullets…)
        .replace(/^(chapter|topic|unit|week|module|section|lecture)\b/i, "")
        .replace(/^[\s:.)\-*•\d]+/, "")
        // Drop a leading "objective/goal:" style lead-in.
        .replace(/^(learning objective|objective|goal)s?\s*:?\s*/i, "")
        .trim()
    )
    // Keep phrases that read like topics (a few words, not a full sentence).
    .filter((l) => l.length >= 3 && l.split(" ").length <= 7);

  return Array.from(new Set(cleaned)).slice(0, 12);
}

export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async extractTopics(
    courseName: string,
    materialText: string
  ): Promise<ExtractedTopic[]> {
    const phrases = candidatePhrases(materialText);
    const base =
      phrases.length > 0
        ? phrases
        : [
            "Core Concepts",
            "Key Definitions",
            "Fundamental Principles",
            "Applications",
            "Common Pitfalls",
          ];

    // Weight by (fake) repetition: earlier + more-frequent phrases weigh more.
    return base.map((name, i) => {
      const occurrences =
        (materialText.match(new RegExp(escapeRegExp(name), "gi")) || []).length ||
        1;
      const weight = Math.min(1, 0.35 + occurrences * 0.12 + (base.length - i) * 0.02);
      return {
        name,
        summary: `Key ideas around "${name}" as covered in ${courseName}.`,
        weight: Number(weight.toFixed(2)),
      };
    });
  }

  async generateQuiz(
    courseName: string,
    topics: { name: string; weight: number }[],
    count: number
  ): Promise<QuizQuestion[]> {
    const sorted = [...topics].sort((a, b) => b.weight - a.weight);
    const out: QuizQuestion[] = [];
    for (let i = 0; i < count; i++) {
      const t = sorted[i % Math.max(1, sorted.length)] ?? {
        name: "Core Concepts",
        weight: 0.5,
      };
      const correct = i % 4;
      const options = [0, 1, 2, 3].map((n) =>
        n === correct
          ? `The concept most central to ${t.name}`
          : `A plausible-but-incorrect idea about ${t.name} (${n + 1})`
      );
      out.push({
        topicName: t.name,
        question: `In ${courseName}, which of the following best describes ${t.name}?`,
        options,
        correctIndex: correct,
        explanation: `This checks understanding of ${t.name}. (Mock question — enable a real AI provider for authored questions.)`,
      });
    }
    return out;
  }

  async socraticReply(
    courseName: string,
    topicName: string | null,
    history: ChatMessage[]
  ): Promise<string> {
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    const focus = topicName ? ` about ${topicName}` : "";
    const probe = lastUser?.content
      ? `You said: "${lastUser.content.slice(0, 80)}". `
      : "";
    // Never a direct answer — always a guiding question.
    return `${probe}What do you already know${focus} that might point you toward the answer? What would happen if you tried the simplest case first?`;
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
