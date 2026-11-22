#!/usr/bin/env node
// Writes every Claude Code session for this repo into build-journal/convos/
// as a readable transcript: what the person typed and what the AI replied.
//
// Left out on purpose: tool calls and their output (they can hold file
// contents, env values and command output), the AI's private reasoning, and
// harness notes. Secrets, emails and machine paths are blanked before anything
// is written, because this repo is public.
//
// Usage: node scripts/export-convos.mjs          (all sessions)
//        node scripts/export-convos.mjs --check  (list what would change)

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const outDir = join(repoRoot, "build-journal", "convos");
const checkOnly = process.argv.includes("--check");

// Claude Code names a project's folder after its path, every non-alphanumeric
// character turned into "-".
const projectSlug = repoRoot.replace(/[^a-zA-Z0-9]/g, "-");
const sessionsDir =
  process.env.CLAUDE_SESSIONS_DIR ?? join(homedir(), ".claude", "projects", projectSlug);

const REDACTIONS = [
  // Machine paths: C:\Users\name\..., /Users/name/..., /home/name/...
  [/[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'`<>|]+/g, "~"],
  [/\/(?:Users|home)\/[^/\s"'`<>|]+/g, "~"],
  // Claude's project-folder spelling of the same path
  [/[A-Za-z]--Users-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*/g, "[project-folder]"],
  // Emails (noreply addresses are not personal)
  [/\b(?!noreply@)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email]"],
  // BSV/BTC private keys in WIF
  [/\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g, "[private-key]"],
  // Extended private keys
  [/\bxprv[1-9A-HJ-NP-Za-km-z]{80,}\b/g, "[private-key]"],
  // API keys and tokens by their well-known prefixes
  [/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{20,}\b/g, "[api-key]"],
  [/\bgsk_[A-Za-z0-9]{20,}\b/g, "[api-key]"],
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/g, "[api-key]"],
  [/\bgithub_pat_[A-Za-z0-9_]{30,}\b/g, "[api-key]"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, "[api-key]"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "[api-key]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "[token]"],
  // NAME=value for anything that reads like a secret
  [
    /\b([A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSPHRASE|WIF)[A-Z0-9_]*)\s*=\s*["']?[^\s"'`]{8,}/g,
    "$1=[redacted]",
  ],
];

export function redact(text) {
  let out = text;
  for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
  return out;
}

// Harness-injected blocks that are not something either side said.
const NOISE_BLOCKS =
  /<(system-reminder|local-command-stdout|local-command-stderr|local-command-caveat|command-message|command-args|task-notification|user-prompt-submit-hook)>[\s\S]*?<\/\1>/g;

function cleanUserText(text) {
  return text
    .replace(NOISE_BLOCKS, "")
    .replace(/<command-name>([\s\S]*?)<\/command-name>/g, "$1")
    .replace(/<\/?pasted_content[^>]*>/g, "")
    .trim();
}

function textParts(content) {
  if (typeof content === "string") return [content];
  if (!Array.isArray(content)) return [];
  return content.filter((p) => p?.type === "text" && typeof p.text === "string").map((p) => p.text);
}

export function sessionToTurns(lines) {
  const turns = [];
  let title = "";
  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.type === "ai-title" && typeof entry.aiTitle === "string") title = entry.aiTitle;
    if (entry.type === "summary" && typeof entry.summary === "string" && !title)
      title = entry.summary;
    if (entry.type !== "user" && entry.type !== "assistant") continue;
    if (entry.isSidechain || entry.isMeta || entry.isCompactSummary) continue;

    const raw = textParts(entry.message?.content).join("\n\n");
    const text = entry.type === "user" ? cleanUserText(raw) : raw.trim();
    if (!text) continue;

    const who = entry.type === "user" ? "Contributor" : "Claude";
    const last = turns.at(-1);
    if (last && last.who === who) last.text += `\n\n${text}`;
    else turns.push({ who, text, at: entry.timestamp ?? "" });
  }
  return { title, turns };
}

function render(sessionId, { title, turns }) {
  const date = (turns[0]?.at || "").slice(0, 10);
  const heading = title ? `${date}: ${title}` : `${date}: session ${sessionId.slice(0, 8)}`;
  const body = turns.map((t) => `### ${t.who}\n\n${t.text}`).join("\n\n---\n\n");
  return redact(
    `# ${heading}\n\nSession \`${sessionId.slice(0, 8)}\`. Transcript of what was typed and what was replied. Tool calls, their output and the AI's private reasoning are left out; keys, emails and machine paths are blanked.\n\n---\n\n${body}\n`
  );
}

function main() {
  if (!existsSync(sessionsDir)) {
    console.error(`No sessions folder at ${redact(sessionsDir)}`);
    process.exit(1);
  }
  if (!checkOnly) mkdirSync(outDir, { recursive: true });

  const written = [];
  for (const file of readdirSync(sessionsDir).filter((f) => f.endsWith(".jsonl"))) {
    const sessionId = file.replace(/\.jsonl$/, "");
    const lines = readFileSync(join(sessionsDir, file), "utf8").split("\n").filter(Boolean);
    const session = sessionToTurns(lines);
    if (session.turns.length === 0) continue;

    const date = (session.turns[0].at || "undated").slice(0, 10);
    const name = `${date}-${sessionId.slice(0, 8)}.md`;
    const target = join(outDir, name);
    const next = render(sessionId, session);
    const prev = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (prev === next) continue;
    if (!checkOnly) writeFileSync(target, next);
    written.push({ name, title: session.title, turns: session.turns.length });
  }

  if (!checkOnly) writeIndex();
  for (const w of written)
    console.log(`${checkOnly ? "would write" : "wrote"} ${w.name} (${w.turns} turns)`);
  if (written.length === 0) console.log("convos already up to date");
}

function writeIndex() {
  const files = readdirSync(outDir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort()
    .reverse();
  const rows = files.map((f) => {
    const first = readFileSync(join(outDir, f), "utf8").split("\n", 1)[0].replace(/^# /, "");
    return `- [${first}](${f})`;
  });
  writeFileSync(
    join(outDir, "README.md"),
    `# Conversations\n\nThe working sessions behind OpenCook, one file each, newest first. Written by \`scripts/export-convos.mjs\`: do not edit by hand, the next run overwrites them.\n\nEach file holds what the contributor typed and what the AI replied. Tool calls, their output and the AI's private reasoning are left out. Keys, emails and machine paths are blanked.\n\n${rows.join("\n")}\n`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main();
