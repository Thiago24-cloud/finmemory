import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  isScryptPasswordHash,
} from "../../lib/passwordAuth.js";

describe("passwordAuth (auth_local_users)", () => {
  it("roundtrip: hashPassword + verifyPassword", () => {
    const pwd = "FinMemory2024!";
    const h = hashPassword(pwd);
    expect(isScryptPasswordHash(h)).toBe(true);
    expect(verifyPassword(pwd, h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });

  it("rejeita hashes manuais fora do formato scrypt (causa raiz comum de login falho)", () => {
    expect(isScryptPasswordHash("FinMemory2024!")).toBe(false);
    expect(isScryptPasswordHash("$2b$10$abcdefghijklmnopqrstuv")).toBe(false);
    expect(verifyPassword("FinMemory2024!", "FinMemory2024!")).toBe(false);
  });
});
