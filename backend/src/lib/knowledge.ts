// Course Intelligence pipeline (Step 2): a saved upload -> extracted text ->
// weighted topics -> merged into the course's Knowledge Map.
//
// Runs synchronously per upload (no queue at MVP, per the blueprint). Adding
// more materials later reinforces existing topics and adds new ones — the map
// "expands" rather than being rebuilt from scratch.
import { prisma } from "./prisma.js";
import { extractText } from "./parse.js";
import { ai } from "../ai/index.js";

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// A topic seen again in new material gets an emphasis bump (capped at 1).
function reinforce(existing: number, incoming: number): number {
  return Math.min(1, Math.max(existing, incoming) + 0.12);
}

export interface ProcessResult {
  status: "processed" | "failed";
  error?: string;
  topicCount: number;
}

export async function processUpload(uploadId: string): Promise<ProcessResult> {
  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
    include: { course: { include: { knowledgeMap: true } } },
  });
  if (!upload) throw new Error(`Upload ${uploadId} not found`);

  await prisma.upload.update({
    where: { id: uploadId },
    data: { status: "parsing" },
  });

  let text: string;
  try {
    text = await extractText(upload.storagePath, upload.filename, upload.mimeType);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse file";
    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: "failed", error: message },
    });
    return { status: "failed", error: message, topicCount: 0 };
  }

  // Ensure a knowledge map exists for the course.
  let mapId = upload.course.knowledgeMap?.id;
  if (!mapId) {
    const map = await prisma.knowledgeMap.create({
      data: { courseId: upload.courseId },
    });
    mapId = map.id;
  }

  // Extract topics from this material.
  const extracted = await ai.extractTopics(upload.course.name, text);

  // Merge into the existing map (reinforce or add).
  const existingTopics = await prisma.topic.findMany({
    where: { knowledgeMapId: mapId },
  });
  const byName = new Map(existingTopics.map((t) => [normalizeName(t.name), t]));

  for (const t of extracted) {
    const key = normalizeName(t.name);
    const match = byName.get(key);
    if (match) {
      await prisma.topic.update({
        where: { id: match.id },
        data: {
          weight: reinforce(match.weight, t.weight),
          summary: match.summary || t.summary,
        },
      });
    } else {
      const created = await prisma.topic.create({
        data: {
          knowledgeMapId: mapId,
          name: t.name,
          summary: t.summary,
          weight: t.weight,
        },
      });
      byName.set(key, created);
    }
  }

  await prisma.knowledgeMap.update({
    where: { id: mapId },
    data: { updatedAt: new Date() },
  });

  await prisma.upload.update({
    where: { id: uploadId },
    data: { status: "processed", extractedText: text.slice(0, 20000) },
  });

  const topicCount = await prisma.topic.count({ where: { knowledgeMapId: mapId } });
  return { status: "processed", topicCount };
}
