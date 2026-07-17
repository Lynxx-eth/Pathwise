// The AI provider interface. Every feature that needs AI goes through this,
// so we can swap "mock" <-> "openai" (or add Claude later) in one place.

export interface ExtractedTopic {
  name: string;
  summary: string;
  weight: number; // 0..1 emphasis
}

export interface QuizQuestion {
  topicName: string;
  question: string;
  options: string[]; // multiple choice
  correctIndex: number;
  explanation: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIProvider {
  readonly name: string;

  /** Step 2: pull weighted topics out of raw course material text. */
  extractTopics(courseName: string, materialText: string): Promise<ExtractedTopic[]>;

  /** Step 5: generate practice questions weighted toward emphasized topics. */
  generateQuiz(
    courseName: string,
    topics: { name: string; weight: number }[],
    count: number
  ): Promise<QuizQuestion[]>;

  /**
   * Step 7: Socratic tutor turn. MUST return a guiding question, never a
   * direct answer. The system prompt enforces this; providers must honor it.
   */
  socraticReply(
    courseName: string,
    topicName: string | null,
    history: ChatMessage[]
  ): Promise<string>;
}
