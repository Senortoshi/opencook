import { describe, expect, it } from "vitest";
import {
  checkCookName,
  cookIdFrom,
  cookTagFor,
  forkPostText,
  parseCookPost,
  spawnMessage,
} from "./cooks";

describe("cookIdFrom", () => {
  it("normalizes names and tags to lowercase letters and digits", () => {
    expect(cookIdFrom("Froge")).toBe("froge");
    expect(cookIdFrom("OCfroge")).toBe("froge");
    expect(cookIdFrom("therealbitcoin.fun")).toBe("therealbitcoinfun");
    expect(cookIdFrom("OCTheRealBitcoin.Fun.")).toBe("therealbitcoinfun");
    expect(cookIdFrom("security-tool")).toBe("securitytool");
  });

  it("refuses ids that are too short, too long or reserved", () => {
    expect(cookIdFrom("ab")).toBeNull();
    expect(cookIdFrom("a".repeat(33))).toBeNull();
    expect(cookIdFrom("OpenCook")).toBeNull();
    expect(cookIdFrom("...")).toBeNull();
  });
});

describe("parseCookPost", () => {
  it("reads a tag at the very start of a post", () => {
    expect(parseCookPost("OCfroge add a hat")).toEqual({ cookId: "froge", name: "froge" });
    expect(parseCookPost("OCtherealbitcoin.fun. ship it")).toEqual({
      cookId: "therealbitcoinfun",
      name: "therealbitcoin.fun",
    });
    expect(parseCookPost("OCfroge")).toEqual({ cookId: "froge", name: "froge" });
    expect(parseCookPost("OCfroge: with a colon")?.cookId).toBe("froge");
  });

  it("ignores posts that merely mention a tag or look a bit like one", () => {
    expect(parseCookPost("I like OCfroge a lot")).toBeNull();
    expect(parseCookPost("ocfroge lowercase prefix")).toBeNull();
    expect(parseCookPost("OC is short for OpenCook")).toBeNull();
    expect(parseCookPost("OCD is real")).toBeNull(); // too short to be a cook
    expect(parseCookPost("OCopencook reserved")).toBeNull();
    expect(parseCookPost(" OCfroge leading space")).toBeNull();
    expect(parseCookPost("")).toBeNull();
  });

  it("reads a fork, its parent and its pitch", () => {
    expect(parseCookPost("OCfrogrun fork of OCfroge\nan endless runner")).toEqual({
      cookId: "frogrun",
      name: "frogrun",
      forkOf: "froge",
      pitch: "an endless runner",
    });
    expect(parseCookPost("OCfrogrun fork of OCfroge")?.pitch).toBe("");
  });

  it("does not treat a self-fork or a broken parent as a fork", () => {
    // Falls back to an ordinary tagged post for `froge`.
    expect(parseCookPost("OCfroge fork of OCfroge")).toEqual({ cookId: "froge", name: "froge" });
    expect(parseCookPost("OCfrogrun fork of froge")).toEqual({
      cookId: "frogrun",
      name: "frogrun",
    });
  });
});

describe("checkCookName", () => {
  it("accepts a plain name and gives its id", () => {
    expect(checkCookName("FrogRun")).toEqual({ ok: true, id: "frogrun" });
    expect(checkCookName(" frog.run ")).toEqual({ ok: true, id: "frogrun" });
  });

  it("refuses empty, spaced, too long, too short and reserved names", () => {
    for (const bad of ["", "two words", "x".repeat(41), "ab", "opencook", "-lead", "émoji"]) {
      expect(checkCookName(bad).ok).toBe(false);
    }
  });
});

describe("forkPostText + cookTagFor + spawnMessage", () => {
  it("builds a first line that parses back to the same fork", () => {
    const text = forkPostText("FrogRun", "therealbitcoin.fun", "  a runner  ");
    expect(text).toBe("OCFrogRun fork of OCtherealbitcoin.fun\na runner");
    expect(parseCookPost(text)).toEqual({
      cookId: "frogrun",
      name: "FrogRun",
      forkOf: "therealbitcoinfun",
      pitch: "a runner",
    });
    // A parent whose display name has a space still round-trips.
    expect(parseCookPost(forkPostText("tbsv2", "tbsv sandbox", ""))?.forkOf).toBe("tbsvsandbox");
    expect(cookTagFor("tbsv sandbox")).toBe("OCtbsvsandbox");
  });

  it("pins the payment message", () => {
    expect(spawnMessage("frogrun", ` ${"AB".repeat(32)} `)).toBe(
      `spawn:frogrun:${"ab".repeat(32)}`
    );
  });
});
