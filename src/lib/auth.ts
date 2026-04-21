import { createHash, timingSafeEqual } from "node:crypto";
import { getPinHash } from "@/lib/env";

export function hashPin(pin: string) {
  return createHash("sha256").update(pin).digest("hex");
}

export function isPinValid(pin: string) {
  const expectedHash = Buffer.from(getPinHash(), "utf8");
  const candidateHash = Buffer.from(hashPin(pin), "utf8");

  if (expectedHash.length !== candidateHash.length) {
    return false;
  }

  return timingSafeEqual(expectedHash, candidateHash);
}
