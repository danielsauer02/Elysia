import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { supabaseAdmin } from "../lib/supabase.js";

// ─── Type augmentation ────────────────────────────────────────────────────────

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export async function registerAuthPlugin(app: FastifyInstance): Promise<void> {
  /**
   * Verifies the Bearer token from the Authorization header using Supabase's
   * own auth.getUser() call — more reliable than manual JWT verification
   * because it handles token rotation and revocation automatically.
   */
  app.decorate(
    "authenticate",
    async function authenticate(request: FastifyRequest, reply: FastifyReply) {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return reply.code(401).send({ ok: false, error: "Missing authorization header" });
      }

      const token = authHeader.slice(7);
      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        return reply.code(401).send({ ok: false, error: "Invalid or expired token" });
      }

      request.userId = user.id;
    }
  );
}
