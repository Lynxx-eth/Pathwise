import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { env } from "../lib/env.js";
import { saveUpload } from "../lib/storage.js";
import { kindFor } from "../lib/parse.js";
import { processUpload } from "../lib/knowledge.js";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  icon: z.string().max(40).optional(),
});

// Average of topic masteries -> course mastery %, for the course card.
function courseMastery(masteries: { mastery: number }[]): number {
  if (masteries.length === 0) return 0;
  const avg = masteries.reduce((s, m) => s + m.mastery, 0) / masteries.length;
  return Math.round(avg * 100);
}

export default async function courseRoutes(app: FastifyInstance) {
  // List the signed-in user's courses (for the Courses home grid).
  app.get("/api/courses", { preHandler: [app.authenticate] }, async (req, reply) => {
    const courses = await prisma.course.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: "asc" },
      include: {
        knowledgeMap: {
          include: { topics: { include: { masteries: { where: { userId: req.user.sub } } } } },
        },
      },
    });

    const shaped = courses.map((c) => {
      const masteries = (c.knowledgeMap?.topics ?? []).flatMap((t) => t.masteries);
      return {
        id: c.id,
        name: c.name,
        icon: c.icon,
        mastery: courseMastery(masteries),
        topicCount: c.knowledgeMap?.topics.length ?? 0,
        createdAt: c.createdAt,
      };
    });

    // Course-cap meta so the home screen can gate "add course" (Step 3).
    const sub = await prisma.subscription.findUnique({ where: { userId: req.user.sub } });
    const isPremium = sub?.tier === "premium";

    return reply.send({
      courses: shaped,
      meta: {
        count: shaped.length,
        cap: env.FREE_COURSE_CAP,
        isPremium,
        atCap: !isPremium && shaped.length >= env.FREE_COURSE_CAP,
      },
    });
  });

  // Create a course. Enforces the free-tier course cap (Step 3).
  app.post("/api/courses", { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input" });
    }

    const sub = await prisma.subscription.findUnique({ where: { userId: req.user.sub } });
    const isPremium = sub?.tier === "premium";
    if (!isPremium) {
      const count = await prisma.course.count({ where: { userId: req.user.sub } });
      if (count >= env.FREE_COURSE_CAP) {
        return reply.code(402).send({
          error: "course_cap_reached",
          message: `Free plan is limited to ${env.FREE_COURSE_CAP} courses.`,
          cap: env.FREE_COURSE_CAP,
        });
      }
    }

    const course = await prisma.course.create({
      data: {
        userId: req.user.sub,
        name: parsed.data.name,
        icon: parsed.data.icon ?? "book",
        knowledgeMap: { create: {} },
      },
    });

    return reply.code(201).send({
      course: { id: course.id, name: course.name, icon: course.icon, mastery: 0, topicCount: 0 },
    });
  });

  // Course detail: knowledge map (weighted topics) + uploaded materials.
  app.get("/api/courses/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const course = await prisma.course.findFirst({
      where: { id, userId: req.user.sub },
      include: {
        uploads: { orderBy: { createdAt: "desc" } },
        knowledgeMap: { include: { topics: true } },
      },
    });
    if (!course) return reply.code(404).send({ error: "Course not found" });

    const topics = (course.knowledgeMap?.topics ?? [])
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .map((t) => ({
        id: t.id,
        name: t.name,
        summary: t.summary,
        weight: Number(t.weight.toFixed(2)),
      }));

    return reply.send({
      course: {
        id: course.id,
        name: course.name,
        icon: course.icon,
        topics,
        uploads: course.uploads.map((u) => ({
          id: u.id,
          filename: u.filename,
          sizeBytes: u.sizeBytes,
          status: u.status,
          error: u.error,
          createdAt: u.createdAt,
        })),
      },
    });
  });

  // Upload a course material (one file per request). Parses + updates the map
  // synchronously, then returns the new topic count.
  app.post(
    "/api/courses/:id/uploads",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const course = await prisma.course.findFirst({
        where: { id, userId: req.user.sub },
      });
      if (!course) return reply.code(404).send({ error: "Course not found" });

      const data = await req.file();
      if (!data) return reply.code(400).send({ error: "No file uploaded" });

      // Accept only PDF/DOCX/PPTX (by mimetype or extension).
      if (!kindFor(data.filename, data.mimetype)) {
        return reply
          .code(415)
          .send({ error: "Only PDF, DOCX, and PPTX files are supported." });
      }

      const buffer = await data.toBuffer();
      const saved = await saveUpload(req.user.sub, data.filename, buffer);

      const upload = await prisma.upload.create({
        data: {
          courseId: id,
          filename: data.filename,
          storagePath: saved.storagePath,
          mimeType: data.mimetype,
          sizeBytes: saved.sizeBytes,
        },
      });

      const result = await processUpload(upload.id);

      return reply.code(201).send({
        upload: {
          id: upload.id,
          filename: upload.filename,
          sizeBytes: upload.sizeBytes,
          status: result.status,
          error: result.error ?? null,
        },
        topicCount: result.topicCount,
      });
    }
  );
}
