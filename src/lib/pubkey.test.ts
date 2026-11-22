import { describe, expect, it } from "vitest";
import { normalizePubkey } from "./pubkey";

const KEY = `02${"ab".repeat(32)}`;

describe("normalizePubkey", () => {
  it("lowercases and trims a compressed key", () => {
    expect(normalizePubkey(` ${KEY.toUpperCase()}\n`)).toBe(KEY);
    expect(normalizePubkey(`03${"0".repeat(64)}`)).toBe(`03${"0".repeat(64)}`);
  });

  it("refuses anything that is not a compressed key", () => {
    expect(normalizePubkey(`04${"a".repeat(128)}`)).toBeNull(); // uncompressed
    expect(normalizePubkey(KEY.slice(2))).toBeNull();
    expect(normalizePubkey("not-a-pubkey")).toBeNull();
    expect(normalizePubkey(undefined)).toBeNull();
    expect(normalizePubkey(42)).toBeNull();
  });
});
