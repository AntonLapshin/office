import { z } from "zod";

export const moodSchema = z.enum([
  "neutral", "happy", "sad", "angry", "anxious",
  "excited", "bored", "confused", "focused", "relaxed",
]);
export type Mood = z.infer<typeof moodSchema>;

export const intentSchema = z.object({
  description: z.string(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  resolved: z.boolean().default(false),
});
export type Intent = z.infer<typeof intentSchema>;

export const characterStateSchema = z.object({
  name: z.string().min(1),
  location: z.string(),
  mood: moodSchema.default("neutral"),
  currentAction: z.string().default("standing"),
  intents: z.array(intentSchema).default([]),
  memory: z.array(z.string()).default([]),
  relationships: z.record(z.string(), z.string()).default({}),
  updatedAt: z.string().default(() => new Date().toISOString()),
});
export type CharacterState = z.infer<typeof characterStateSchema>;

export const stageManagerResponseSchema = z.object({
  narration: z.string(),
  characters: z.record(z.string(), characterStateSchema),
});
export type StageManagerResponse = z.infer<typeof stageManagerResponseSchema>;

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
