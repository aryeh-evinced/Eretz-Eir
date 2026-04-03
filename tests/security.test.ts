import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

/**
 * Static security verification tests.
 * These run as part of CI without needing a running server.
 */

function walkFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      // Skip directories we don't care about
      if (
        entry === "node_modules" ||
        entry === ".next" ||
        entry === ".git" ||
        entry === ".worktrees" ||
        entry === "pnpm-lock.yaml"
      ) {
        continue;
      }
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...walkFiles(fullPath, extensions));
      } else if (extensions.some((ext) => entry.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist — skip
  }
  return results;
}

describe("Secret Leak Prevention", () => {
  const projectRoot = join(__dirname, "..");
  // Files that might end up in the client bundle
  const clientFiles = walkFiles(join(projectRoot, "app"), [".ts", ".tsx"])
    .concat(walkFiles(join(projectRoot, "components"), [".ts", ".tsx"]))
    .concat(walkFiles(join(projectRoot, "stores"), [".ts", ".tsx"]));

  it("no SUPABASE_SERVICE_ROLE_KEY references in client code", () => {
    for (const file of clientFiles) {
      const content = readFileSync(file, "utf-8");
      expect(content).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });

  it("no ANTHROPIC_API_KEY references in client code", () => {
    for (const file of clientFiles) {
      const content = readFileSync(file, "utf-8");
      expect(content).not.toContain("ANTHROPIC_API_KEY");
    }
  });

  it("no OPENAI_API_KEY references in client code", () => {
    for (const file of clientFiles) {
      const content = readFileSync(file, "utf-8");
      expect(content).not.toContain("OPENAI_API_KEY");
    }
  });

  it("no hardcoded API key patterns in source files", () => {
    const allFiles = walkFiles(projectRoot, [".ts", ".tsx"]);
    const patterns = [
      /sk-ant-[a-zA-Z0-9]{20,}/, // Anthropic key
      /sk-[a-zA-Z0-9]{40,}/,     // OpenAI key
      /sbp_[a-zA-Z0-9]{20,}/,    // Supabase access token
    ];

    for (const file of allFiles) {
      // Skip test files and .env.example
      if (file.includes(".test.") || file.includes(".env")) continue;
      const content = readFileSync(file, "utf-8");
      for (const pattern of patterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });
});

describe("HTTP Security Headers Configuration", () => {
  it("next.config.ts includes CSP header", async () => {
    const configPath = join(__dirname, "..", "next.config.ts");
    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain("Content-Security-Policy");
    expect(content).toContain("frame-ancestors 'none'");
  });

  it("next.config.ts includes X-Frame-Options", async () => {
    const configPath = join(__dirname, "..", "next.config.ts");
    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain("X-Frame-Options");
    expect(content).toContain("DENY");
  });

  it("next.config.ts includes X-Content-Type-Options", async () => {
    const configPath = join(__dirname, "..", "next.config.ts");
    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain("X-Content-Type-Options");
    expect(content).toContain("nosniff");
  });

  it("vercel.json includes security headers", async () => {
    const vercelPath = join(__dirname, "..", "vercel.json");
    const content = readFileSync(vercelPath, "utf-8");
    const config = JSON.parse(content);
    const allHeaders = config.headers.flatMap(
      (h: { headers: { key: string }[] }) => h.headers.map((hh) => hh.key),
    );
    expect(allHeaders).toContain("X-Content-Type-Options");
    expect(allHeaders).toContain("X-Frame-Options");
    expect(allHeaders).toContain("Referrer-Policy");
  });
});
