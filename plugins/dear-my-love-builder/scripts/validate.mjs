/**
 * Local, dependency-free smoke validation for the Dear My Love Builder bundle.
 * Run:
 *   node scripts/validate.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(here, "..");
const failures = [];

async function mustExist(relative) {
  try {
    await fs.access(path.join(packageDir, relative));
    return true;
  } catch {
    failures.push(`missing ${relative}`);
    return false;
  }
}

for (const relative of [
  "package.json",
  "index.js",
  "cordis.patch.yml",
  "icon.svg",
  "locale/en.json",
  "locale/zh.json",
  "README.md"
]) {
  await mustExist(relative);
}

const manifest = JSON.parse(await fs.readFile(path.join(packageDir, "package.json"), "utf8"));
if (!manifest.dsh?.bundle?.patch) failures.push("package.json: dsh.bundle.patch missing");
if (manifest.dsh?.client) failures.push("package.json: this is a Host-only bundle and must not declare dsh.client");
if (manifest.name !== "@local/dear-my-love-builder") failures.push("package.json: unexpected package name");

for (const locale of ["en", "zh"]) {
  try {
    const text = await fs.readFile(path.join(packageDir, "locale", `${locale}.json`), "utf8");
    const data = JSON.parse(text);
    if (!data.meta?.title || !data.meta?.description) failures.push(`locale/${locale}.json: meta title/description missing`);
  } catch (error) {
    failures.push(`locale/${locale}.json: ${error.message}`);
  }
}

try {
  const icon = await fs.readFile(path.join(packageDir, "icon.svg"), "utf8");
  if (!icon.trimStart().startsWith("<svg")) failures.push("icon.svg: not an SVG document");
  if (!/viewBox=/.test(icon)) failures.push("icon.svg: missing viewBox");
} catch (error) {
  failures.push(`icon.svg: ${error.message}`);
}

try {
  const patch = await fs.readFile(path.join(packageDir, "cordis.patch.yml"), "utf8");
  if (!patch.includes("dear-my-love-builder")) failures.push("cordis.patch.yml: id missing");
  if (!patch.includes("@local/dear-my-love-builder")) failures.push("cordis.patch.yml: package name missing");
  if (!patch.includes("D:/Lin/DeepSeek/ReLin")) failures.push("cordis.patch.yml: projectDir missing");
} catch (error) {
  failures.push(`cordis.patch.yml: ${error.message}`);
}

const indexSource = await fs.readFile(path.join(packageDir, "index.js"), "utf8");
try {
  new vm.Script(indexSource, { filename: "index.js" });
} catch {
  // index.js is ESM; vm.Script intentionally cannot parse import syntax.
}

try {
  const module = await import(pathToFileURL(path.join(packageDir, "index.js")).href);
  if (typeof module.apply !== "function") failures.push("index.js: apply export missing");
  if (!Array.isArray(module.inject) || !module.inject.includes("tools") || !module.inject.includes("fs")) {
    failures.push("index.js: inject must include tools and fs");
  }
} catch (error) {
  failures.push(`index.js: ${error.message}`);
}

if (failures.length > 0) {
  console.error("FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("PASS");
  console.log(`Bundle: ${manifest.name}@${manifest.version}`);
  console.log(`Path:   ${packageDir}`);
  console.log("Host-only: yes");
  console.log("Exports: apply, inject");
}
