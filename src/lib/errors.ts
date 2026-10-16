import { ConvexError } from "convex/values";

export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: string } | string;
    return typeof data === "string" ? data : (data.message ?? "Something went wrong.");
  }
  return "Couldn't reach the server. Check your connection and try again.";
}

export function errorCode(error: unknown): string | null {
  if (error instanceof ConvexError && typeof error.data === "object" && error.data) {
    return (error.data as { code?: string }).code ?? null;
  }
  return null;
}
