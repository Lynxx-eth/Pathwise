import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "./lib/env.js";
import authPlugin from "./plugins/authenticate.js";
import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import { ai } from "./ai/index.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB
await app.register(authPlugin);

await app.register(authRoutes);
await app.register(courseRoutes);

app.get("/api/health", async () => ({
  status: "ok",
  aiProvider: ai.name,
}));

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  app.log.info(`Pathwise backend running on :${env.PORT} (AI provider: ${ai.name})`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
