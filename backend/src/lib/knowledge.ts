// Course Intelligence pipeline (Step 2): a saved upload -> extracted text ->
// moderation screen -> weighted topics -> merged into the course's Knowledge Map.
//
// Runs synchronously per upload (no queue at MVP, per the blueprint). Adding
// more materials later reinforces existing topics and adds new ones — the map
// "expands" rather than being rebuilt from scratch.
import { prisma } from "./prisma.js";
import { extractText } from "./parse.js";
import { storage } from "./storage.js";
import { extractTopics } from "./aiMeter.js";
import { moderateMaterial } from "./moderation.js";
import { track } from "./analytics.js";
import { grantBadge } from "./gamification.js";
import type { Topic } from "@prisma/client";

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// A topic seen again in new material gets an emphasis bump (capped at 1).
function reinforce(existing: number, incoming: number): number {
  return Math.min(1, Math.max(existing, incoming) + 0.12);
}

export interface ProcessResult {
  status: "processed" | "failed" | "rejected";
  error?: string;
  topicCount: number;
  newTopicCount?: number;
}

export async function processUpload(
  uploadId: string,
  userId: string
): Promise<ProcessResult> {
  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
    include: { course: { include: { knowledgeMap: true } } },
  });
  if (!upload) throw new Error(`Upload ${uploadId} not found`);

  await prisma.upload.update({
    where: { id: uploadId },
    data: { status: "parsing" },
  });

  // --- Parse -------------------------------------------------------------
  let text: string;
  try {
    const buffer = await storage.read(upload.storagePath);
    text = await extractText(buffer, upload.filename, upload.mimeType);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse file";
    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: "failed", error: message },
    });
    await track(userId, "upload_failed", { uploadId, reason: "parse_error" });
    return { status: "failed", error: message, topicCount: 0 };
  }

  // --- Moderate (Step 15) ------------------------------------------------
  const verdict = await moderateMaterial(userId, upload.course.name, text);
  if (!verdict.allowed) {
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: "rejected",
        error: verdict.reason,
        moderation: verdict.verdict,
        moderationNote: verdict.reason,
      },
    });
    await track(userId, "upload_rejected", {
      uploadId,
      verdict: verdict.verdict,
    });
    return { status: "rejected", error: verdict.reason, topicCount: 0 };
  }

  // Ensure a knowledge map exists for the course.
  let mapId = upload.course.knowledgeMap?.id;
  if (!mapId) {
    const map = await prisma.knowledgeMap.create({
      data: { courseId: upload.courseId },
    });
    mapId = map.id;
  }

  // --- Extract topics ----------------------------------------------------
  let extracted;
  try {
    extracted = await extractTopics(userId, upload.course.name, text);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Topic extraction failed";
    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: "failed", error: message },
    });
    await track(userId, "upload_failed", { uploadId, reason: "ai_error" });
    return { status: "failed", error: message, topicCount: 0 };
  }

  // --- Merge into the existing map (reinforce or add) --------------------
  const existingTopics = await prisma.topic.findMany({
    where: { knowledgeMapId: mapId },
  });
  const byName = new Map(existingTopics.map((t: Topic) => [normalizeName(t.name), t]));

  let newTopicCount = 0;
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
      newTopicCount += 1;
    }
  }

  await prisma.knowledgeMap.update({
    where: { id: mapId },
    data: { updatedAt: new Date() },
  });

  await prisma.upload.update({
    where: { id: uploadId },
    data: {
      status: "processed",
      extractedText: text.slice(0, 20000),
      moderation: verdict.verdict,
      error: null,
    },
  });

  const topicCount = await prisma.topic.count({ where: { knowledgeMapId: mapId } });

  await track(userId, "upload_completed", {
    uploadId,
    courseId: upload.courseId,
    topicCount,
    newTopicCount,
  });
  await track(userId, "knowledge_map_built", {
    courseId: upload.courseId,
    topicCount,
  });
  await grantBadge(userId, "first_upload");

  return { status: "processed", topicCount, newTopicCount };
}
