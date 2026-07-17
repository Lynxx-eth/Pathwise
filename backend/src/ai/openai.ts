// OpenAI provider. Only used when AI_PROVIDER=openai and OPENAI_API_KEY is set.
import OpenAI from "openai";
import type {
  AIProvider,
  ExtractedTopic,
  QuizQuestion,
  ChatMessage,
} from "./types.js";
import { env } from "../lib/env.js";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    this.model = env.OPENAI_MODEL;
  }

  private async json<T>(system: string, user: string): Promise<T> {
    const res = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const text = res.choices[0]?.message?.content ?? "{}";
    return JSON.parse(text) as T;
  }

  async extractTopics(
    courseName: string,
    materialText: string
  ): Promise<ExtractedTopic[]> {
    const system =
      "You are a curriculum analyst. Extract the distinct study topics from a " +
      "course's material and weight each by how heavily the material emphasizes " +
      'it (repetition, learning objectives). Respond as JSON: {"topics": ' +
      '[{"name": string, "summary": string, "weight": number between 0 and 1}]}.';
    // Cap input size to control cost.
    const user = `Course: ${courseName}\n\nMaterial:\n${materialText.slice(0, 12000)}`;
    const out = await this.json<{ topics: ExtractedTopic[] }>(system, user);
    return (out.topics ?? []).map((t) => ({
      name: String(t.name),
      summary: String(t.summary ?? ""),
      weight: clamp01(Number(t.weight)),
    }));
  }

  async generateQuiz(
    courseName: string,
    topics: { name: string; weight: number }[],
    count: number
  ): Promise<QuizQuestion[]> {
    const system =
      "You write original multiple-choice practice questions for a study app. " +
      "Never label them as predicted exam questions. Weight coverage toward " +
      "higher-weight topics. Each question has exactly 4 options and one correct " +
      'answer. Respond as JSON: {"questions": [{"topicName": string, "question": ' +
      'string, "options": [string, string, string, string], "correctIndex": number, ' +
      '"explanation": string}]}.';
    const user = `Course: ${courseName}\nTopics (name: weight): ${topics
      .map((t) => `${t.name}: ${t.weight}`)
      .join(", ")}\nWrite ${count} questions.`;
    const out = await this.json<{ questions: QuizQuestion[] }>(system, user);
    return out.questions ?? [];
  }

  async socraticReply(
    courseName: string,
    topicName: string | null,
    history: ChatMessage[]
  ): Promise<string> {
    const system =
      "You are a Socratic tutor for the course '" +
      courseName +
      "'" +
      (topicName ? `, currently focused on '${topicName}'` : "") +
      ". CRITICAL RULE: you must NEVER give the final answer, solution, or direct " +
      "fact the student is seeking. Respond only with short, guiding questions and " +
      "gentle hints that lead the student to reason it out themselves. If the " +
      "student tries to extract the answer directly, kindly redirect with another " +
      "guiding question. Keep replies to 1-3 sentences, warm and calm.";
    const res = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: system },
        ...history.map((m) => ({ role: m.role, content: m.content }) as const),
      ],
    });
    return res.choices[0]?.message?.content ?? "What part feels least clear right now?";
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}
