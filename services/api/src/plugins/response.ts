import type { FastifyReply, FastifyRequest } from "fastify";
import { createRequestId } from "../lib/request-id.js";

export const withResponseEnvelope = <T>(
  _request: FastifyRequest,
  reply: FastifyReply,
  data: T
): void => {
  reply.send({
    ok: true,
    data,
    requestId: createRequestId()
  });
};
