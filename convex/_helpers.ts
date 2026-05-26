import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

export async function getAuthUserId(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity.subject;
}
