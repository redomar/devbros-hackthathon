export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_SCORE: Record<Level, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
};

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const LEVEL_HINT: Record<Level, string> = {
  beginner: "New to building with AI",
  intermediate: "I've built a few things with AI tools",
  advanced: "I ship with AI regularly",
};
