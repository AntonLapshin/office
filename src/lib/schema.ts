import { z } from "zod";

export const characterStateSchema = z.object({
  name: z.string().min(1),
  location: z.string(),
  mood: z.string().default("neutral"),
  currentAction: z.string().default("standing"),
  intent: z.string().default(""),
  memory: z.array(z.string()).default([]),
  relationships: z.record(z.string(), z.string()).default({}),
  updatedAt: z.string().default(() => new Date().toISOString()),
});
export type CharacterState = z.infer<typeof characterStateSchema>;

export const sessionStatusSchema = z.enum(["active", "paused", "ended"]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

export const turnPhaseSchema = z.enum([
  "character-turn",
  "stage-manager-update",
]);
export type TurnPhase = z.infer<typeof turnPhaseSchema>;

export const sessionSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  spaceName: z.string().min(1),
  characters: z.array(z.string()).min(1),
  userCharacter: z.string().nullable().default(null),
  status: sessionStatusSchema.default("active"),
  currentRound: z.number().int().default(0),
  currentTurnIndex: z.number().int().default(0),
  turnPhase: turnPhaseSchema.default("character-turn"),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().default(() => new Date().toISOString()),
});
export type Session = z.infer<typeof sessionSchema>;

export const diffOpSchema = z.enum(["set", "add", "delete"]);

export const diffEntrySchema = z.object({
  path: z.string().min(1),
  op: diffOpSchema,
  value: z.unknown().optional(),
});
export type DiffEntry = z.infer<typeof diffEntrySchema>;

export const stageManagerDiffResponseSchema = z.array(diffEntrySchema);

export const spaceObjectSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  label: z.string().min(1),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
});

export const spaceLayoutSchema = z.object({
  name: z.string().min(1),
  bounds: z.object({ width: z.number(), height: z.number() }),
  objects: z.array(spaceObjectSchema),
});
