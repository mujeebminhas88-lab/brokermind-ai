import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outputRoot = join(root, ".vercel", "output");
const staticAssets = join(outputRoot, "static", "assets");
const serverEntry = join(outputRoot, "functions", "__server.func", "index.mjs");
const distRoot = join(root, "dist");
const distAssets = join(distRoot, "assets");

function copyDirectoryContents(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(source, target);
    } else {
      copyFileSync(source, target);
    }
  }
}

const serverModule = await import(serverEntry);
const handler = serverModule.default ?? serverModule;
const response = await handler.fetch(new Request("https://broker-mind-ai.vercel.app/"), {}, {});

if (!response.ok) {
  throw new Error(`Cannot create static fallback: SSR returned ${response.status}`);
}

const html = await response.text();

mkdirSync(distRoot, { recursive: true });
rmSync(distAssets, { recursive: true, force: true });
copyDirectoryContents(staticAssets, distAssets);
writeFileSync(join(distRoot, "index.html"), html);

console.log("Created dist/index.html fallback for static Vercel deployments.");