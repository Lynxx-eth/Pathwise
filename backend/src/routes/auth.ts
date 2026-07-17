import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/auth.js";

const signupSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  timezone: z.string().optional(),
});

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Shape returned to the client — never includes the password hash.
function publicUser(u: {
  id: string;
  name: string;
  email: string;
  username: string | null;
  privacyAcceptedAt: Date | null;
  xp: number;
  streakCount: number;
  bestStreak: number;
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    privacyAccepted: u.privacyAcceptedAt !== null,
    xp: u.xp,
    streakCount: u.streakCount,
    bestStreak: u.bestStreak,
  };
}

export default async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/signup", async (req, reply) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input", details: parsed.error.flatten() });
    }
    const { name, email, password, timezone } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "An account with that email already exists." });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(password),
        timezone: timezone ?? "UTC",
        subscription: { create: {} }, // default free tier
      },
    });

    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return reply.code(201).send({ token, user: publicUser(user) });
  });

  app.post("/api/auth/signin", async (req, reply) => {
    const parsed = signinSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid input" });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt) {
      return reply.code(401).send({ error: "Invalid email or password." });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ error: "Invalid email or password." });
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return reply.send({ token, user: publicUser(user) });
  });

  app.get("/api/auth/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user || user.deletedAt) {
      return reply.code(404).send({ error: "User not found" });
    }
    return reply.send({ user: publicUser(user) });
  });

  // Records the one-time privacy statement acceptance shown right after signup.
  app.post(
    "/api/auth/accept-privacy",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const user = await prisma.user.update({
        where: { id: req.user.sub },
        data: { privacyAcceptedAt: new Date() },
      });
      return reply.send({ user: publicUser(user) });
    }
  );
}
