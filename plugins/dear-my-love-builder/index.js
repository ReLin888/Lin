/**
 * Dear My Love Builder
 * A local, Host-only Cordis plugin for the Dear, My Love website.
 *
 * Design rules:
 * - Only the configured project directory can be resolved.
 * - Every mutation is preview-first and requires both confirm:true and a live
 *   DSH approval request before a byte is written.
 * - No network access, no publishing, no package installation.
 * - The project stays a plain static site; no build output is generated.
 */
import vm from "node:vm";
import path from "node:path";

const TOOL_NAME = "dear_my_love_builder";
const DEFAULT_PROJECT_DIR = "D:/Lin/DeepSeek/ReLin";
const DSH_VERSION_VERIFIED = "44.7.0";
const CONFIG_PATH = "assets/js/config.js";
const PACKAGE_PATH = "package.json";
const MAX_TEXT_BYTES = 2_000_000;
const PROCESS_TIMEOUT_MS = 180_000;

const PAGE_FILES = Object.freeze({
  home: "index.html",
  about: "about.html",
  gallery: "gallery.html",
  days: "days.html",
  wishlist: "wishlist.html",
  quiz: "quiz.html",
  letter: "letter.html",
  notFound: "404.html",
  styles: "assets/css/styles.css",
  config: "assets/js/config.js",
  siteScript: "assets/js/site.js",
  musicScript: "assets/js/music.js",
  homeScript: "assets/js/home.js",
  aboutScript: "assets/js/about.js",
  galleryScript: "assets/js/gallery.js",
  daysScript: "assets/js/days.js",
  wishlistScript: "assets/js/wishlist.js",
  quizScript: "assets/js/quiz.js",
  letterScript: "assets/js/letter.js",
  readme: "README.md"
});

const REQUIRED_FILES = [
  "index.html",
  "about.html",
  "gallery.html",
  "days.html",
  "wishlist.html",
  "quiz.html",
  "letter.html",
  "404.html",
  "assets/css/styles.css",
  "assets/js/config.js",
  "assets/js/site.js",
  "assets/js/music.js",
  "assets/js/home.js",
  "assets/js/about.js",
  "assets/js/gallery.js",
  "assets/js/days.js",
  "assets/js/wishlist.js",
  "assets/js/quiz.js",
  "assets/js/letter.js",
  "assets/images/favicon.svg",
  "package.json",
  "vite.config.js",
  "scripts/vite-build.mjs",
  "vercel.json",
  "netlify.toml",
  ".github/workflows/deploy.yml",
  ".nojekyll",
  "README.md"
];

const REQUIRED_DIRS = [
  "assets/css",
  "assets/js",
  "assets/images",
  "scripts"
];

const VITE_ACTIONS = new Set(["vite_check", "theme_audit", "deploy_check"]);
const PROCESS_ACTIONS = new Set(["install_deps", "vite_build"]);
const ALLOWED_DEPENDENCIES = new Set(["vite"]);

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".svg", ".gif"]);
const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]);

const ACTIONS = [
  "status",
  "audit",
  "build_check",
  "mobile_audit",
  "vite_check",
  "theme_audit",
  "deploy_check",
  "install_deps",
  "vite_build",
  "read_config",
  "list_photos",
  "read_page",
  "update_site",
  "set_dates",
  "add_photo",
  "update_photo",
  "remove_photo",
  "move_photo",
  "update_music",
  "add_love_note",
  "remove_love_note",
  "set_easter_egg",
  "replace_text"
];

const READ_ACTIONS = new Set([
  "status",
  "audit",
  "build_check",
  "mobile_audit",
  "vite_check",
  "theme_audit",
  "deploy_check",
  "read_config",
  "list_photos",
  "read_page"
]);

const DEFAULT_EASTER_EGG = Object.freeze({
  enabled: true,
  threshold: 10,
  title: "被你发现了。",
  intro:
    "传说连续点击这颗心十次，会解锁一个秘密。其实秘密很简单——从我开始建造这个网站的第一天起，我就在等一个会无聊到点十次的人。如果你真的点到了这里，那大概就是你了。",
  coupons: [
    { text: "一次不计理由的拥抱", note: "No reason needed" },
    { text: "一顿你点菜、我洗碗的晚餐", note: "You choose, I wash" },
    { text: "一个永远站在你这边的我", note: "Always on your side" }
  ],
  signature: "—— 一个提前喜欢你的人"
});

/** @param {unknown} value */
function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

/** @param {string} value */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** @param {unknown} value */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {string} value @param {string} label @param {number} max @param {boolean} allowEmpty */
function cleanText(value, label, max, allowEmpty = false) {
  if (typeof value !== "string") throw new Error(`${label} 必须是字符串`);
  const text = value.trim();
  if (!allowEmpty && text.length === 0) throw new Error(`${label} 不能为空`);
  if (text.length > max) throw new Error(`${label} 最多 ${max} 个字符`);
  return text;
}

/** @param {unknown} value */
function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** @param {string} value */
function normalizeRelative(value) {
  if (typeof value !== "string" || value.trim() === "") throw new Error("文件路径不能为空");
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");
  if (normalized.includes("\0")) throw new Error("文件路径包含非法字符");
  if (normalized.startsWith("/") || path.isAbsolute(normalized)) throw new Error("只允许项目内的相对路径");
  if (normalized.split("/").includes("..")) throw new Error("路径不能离开项目目录");
  return normalized;
}

/** @param {string} relative */
function extensionOf(relative) {
  return path.extname(relative).toLowerCase();
}

/** @param {string} iso */
function nextOccurrence(iso) {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target = new Date(today.getFullYear(), month - 1, day);
  if (target < today) target = new Date(today.getFullYear() + 1, month - 1, day);
  const days = Math.round((target - today) / 86_400_000);
  return { iso, nextDate: `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`, days };
}

/** @param {string|null|undefined} iso */
function daysTogether(iso) {
  if (!iso || !isIsoDate(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(year, month - 1, day);
  return Math.floor((today - start) / 86_400_000) + 1;
}

/**
 * Evaluate assets/js/config.js in an isolated, timed VM. The file is the
 * project's own configuration, never remote input. No require/process is
 * exposed to it.
 * @param {string} source
 */
function evaluateConfig(source) {
  const sandbox = {
    window: {},
    console: { log() {}, warn() {}, error() {} }
  };
  try {
    vm.createContext(sandbox);
    new vm.Script(source, { filename: CONFIG_PATH }).runInContext(sandbox, { timeout: 1_000 });
  } catch (error) {
    throw new Error(`无法解析 ${CONFIG_PATH}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const config = sandbox.window.DML_CONFIG;
  if (!isPlainObject(config)) throw new Error(`${CONFIG_PATH} 没有导出 window.DML_CONFIG`);
  if (!isPlainObject(config.site)) throw new Error("window.DML_CONFIG.site 缺失或不是对象");
  if (!Array.isArray(config.photos)) throw new Error("window.DML_CONFIG.photos 必须是数组");
  return cloneJson(config);
}

/** @param {any} config */
function validateConfig(config) {
  validateSite(config.site);
  validateMusic(config.music);
  for (const [index, photo] of config.photos.entries()) {
    validatePhoto(photo, `photos[${index}]`);
  }
  if (config.site.anniversary !== null && config.site.anniversary !== undefined && !isIsoDate(config.site.anniversary)) {
    throw new Error("site.anniversary 必须是 YYYY-MM-DD 或 null");
  }
  if (config.site.birthday !== null && config.site.birthday !== undefined && !isIsoDate(config.site.birthday)) {
    throw new Error("site.birthday 必须是 YYYY-MM-DD 或 null");
  }
  if (config.site.loveNotes !== undefined && !Array.isArray(config.site.loveNotes)) {
    throw new Error("site.loveNotes 必须是数组");
  }
  if (config.site.easterEgg !== undefined) {
    validateEasterEgg(config.site.easterEgg);
  }
}

/** @param {any} site */
function validateSite(site) {
  if (!isPlainObject(site)) throw new Error("site 必须是对象");
  for (const key of ["name", "chineseName", "status"]) {
    if (typeof site[key] !== "string" || site[key].trim() === "") throw new Error(`site.${key} 不能为空`);
  }
}

/** @param {any} music */
function validateMusic(music) {
  if (music === undefined || music === null) return;
  if (!isPlainObject(music)) throw new Error("music 必须是对象");
  if (typeof music.title !== "string" || music.title.trim() === "") throw new Error("music.title 不能为空");
  if (music.volume !== undefined && (typeof music.volume !== "number" || music.volume < 0 || music.volume > 1)) {
    throw new Error("music.volume 必须在 0 和 1 之间");
  }
}

/** @param {any} photo @param {string} label */
function validatePhoto(photo, label) {
  if (!isPlainObject(photo)) throw new Error(`${label} 必须是对象`);
  if (typeof photo.src !== "string" || photo.src.trim() === "") throw new Error(`${label}.src 不能为空`);
  if (typeof photo.alt !== "string" || photo.alt.trim() === "") throw new Error(`${label}.alt 不能为空`);
  if (typeof photo.title !== "string" || photo.title.trim() === "") throw new Error(`${label}.title 不能为空`);
  if (photo.ratio !== undefined && !/^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(String(photo.ratio))) {
    throw new Error(`${label}.ratio 必须形如 "4 / 5"`);
  }
}

/** @param {any} egg */
function validateEasterEgg(egg) {
  if (!isPlainObject(egg)) throw new Error("site.easterEgg 必须是对象");
  if (egg.enabled !== undefined && typeof egg.enabled !== "boolean") throw new Error("easterEgg.enabled 必须是布尔值");
  if (egg.threshold !== undefined && (!Number.isInteger(egg.threshold) || egg.threshold < 3 || egg.threshold > 20)) {
    throw new Error("easterEgg.threshold 必须是 3 到 20 之间的整数");
  }
  if (egg.coupons !== undefined) {
    if (!Array.isArray(egg.coupons) || egg.coupons.length > 6) throw new Error("easterEgg.coupons 必须是不超过 6 项的数组");
    for (const [index, coupon] of egg.coupons.entries()) {
      if (!isPlainObject(coupon) || typeof coupon.text !== "string" || coupon.text.trim() === "") {
        throw new Error(`easterEgg.coupons[${index}].text 不能为空`);
      }
    }
  }
}

/**
 * Find a named object block such as `site: { ... }` at any indentation.
 * @param {string} source
 * @param {string} key
 */
function findObjectBlock(source, key) {
  const re = new RegExp(`(^|\\n)([ \\t]*)${escapeRegExp(key)}\\s*:\\s*\\{`, "g");
  let match;
  while ((match = re.exec(source)) !== null) {
    const lineStart = source.lastIndexOf("\n", match.index) + 1;
    const beforeOnLine = source.slice(lineStart, match.index);
    if (beforeOnLine.includes("//")) continue;
    const open = match.index + match[0].length - 1;
    const close = findMatchingPair(source, open, "{", "}");
    if (close === -1) throw new Error(`config 中的 ${key} 对象没有闭合`);
    return {
      key,
      open,
      close,
      indent: match[2] ?? ""
    };
  }
  return null;
}

/**
 * Find the closing character for a JS object/array, respecting strings and comments.
 * @param {string} source
 * @param {number} openIndex
 * @param {string} open
 * @param {string} close
 */
function findMatchingPair(source, openIndex, open, close) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * Find the end of an arbitrary JS value beginning at start.
 * @param {string} source
 * @param {number} start
 */
function scanValueEnd(source, start) {
  let index = start;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  const first = source[index];
  if (first === '"' || first === "'" || first === "`") {
    let escaped = false;
    for (let cursor = index + 1; cursor < source.length; cursor += 1) {
      const char = source[cursor];
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === first) return cursor + 1;
    }
    throw new Error("config 中的字符串没有闭合");
  }
  if (first === "[" || first === "{") {
    const close = first === "[" ? "]" : "}";
    const end = findMatchingPair(source, index, first, close);
    if (end === -1) throw new Error(`config 中的 ${first} 没有闭合`);
    return end + 1;
  }
  let cursor = index;
  while (cursor < source.length && !/[,\n\r}]/.test(source[cursor])) cursor += 1;
  while (cursor > start && /\s/.test(source[cursor - 1])) cursor -= 1;
  return cursor;
}

/** @param {unknown} value @param {number} continuationIndent */
function formatConfigValue(value, continuationIndent) {
  const json = JSON.stringify(value, null, 2);
  if (json === undefined) throw new Error("无法序列化配置值");
  return json.replace(/\n/g, `\n${" ".repeat(continuationIndent)}`);
}

/**
 * Set one field inside a named object block while preserving surrounding text.
 * @param {string} source
 * @param {string} blockKey
 * @param {string} field
 * @param {unknown} value
 */
function setField(source, blockKey, field, value) {
  const block = findObjectBlock(source, blockKey);
  if (!block) throw new Error(`config 中找不到 ${blockKey} 对象`);
  const innerStart = block.open + 1;
  const inner = source.slice(innerStart, block.close);
  const fieldRe = new RegExp(`(^|\\n)([ \\t]*)${escapeRegExp(field)}\\s*:\\s*`, "g");
  let match;
  while ((match = fieldRe.exec(inner)) !== null) {
    const absolute = innerStart + match.index;
    const lineStart = source.lastIndexOf("\n", absolute) + 1;
    const prefix = source.slice(lineStart, absolute);
    if (prefix.includes("//") || prefix.includes("/*")) continue;
    const valueStart = innerStart + match.index + match[0].length;
    const valueEnd = scanValueEnd(source, valueStart);
    const indent = (match[2] ?? "").length;
    return `${source.slice(0, valueStart)}${formatConfigValue(value, indent)}${source.slice(valueEnd)}`;
  }

  const propertyIndent = `${block.indent}  `;
  const insertion = `${propertyIndent}${field}: ${formatConfigValue(value, propertyIndent.length)},\n`;
  const beforeClose = source.slice(0, block.close);
  const trimmed = beforeClose.replace(/[ \t\r\n]+$/, "");
  const needsComma = !trimmed.endsWith(",") && !trimmed.endsWith("{");
  return `${trimmed}${needsComma ? "," : ""}\n${insertion}${source.slice(block.close)}`;
}

/**
 * Replace a top-level array field such as photos.
 * @param {string} source
 * @param {string} field
 * @param {unknown[]} value
 */
function setTopLevelArray(source, field, value) {
  const re = new RegExp(`(^|\\n)([ \\t]*)${escapeRegExp(field)}\\s*:\\s*\\[`);
  const match = re.exec(source);
  if (!match) throw new Error(`config 中找不到 ${field} 数组`);
  const lineStart = source.lastIndexOf("\n", match.index) + 1;
  const beforeOnLine = source.slice(lineStart, match.index);
  if (beforeOnLine.includes("//")) throw new Error(`无法安全定位 ${field} 数组`);
  const open = match.index + match[0].length - 1;
  const close = findMatchingPair(source, open, "[", "]");
  if (close === -1) throw new Error(`config 中的 ${field} 数组没有闭合`);
  const indent = (match[2] ?? "").length;
  return `${source.slice(0, open)}${formatConfigValue(value, indent)}${source.slice(close + 1)}`;
}

/** @param {string} iso */
function previewDate(iso) {
  if (!iso) return "待定";
  return iso.replaceAll("-", ".");
}

/**
 * @param {import("node:vm").Context} _
 * @returns {object}
 */
function toolSchema() {
  const string = (description) => ({ type: "string", description });
  const sitePatch = {
    type: "object",
    additionalProperties: false,
    description: "Only supplied site fields are changed.",
    properties: {
      name: string("网站英文名"),
      shortName: string("短名称"),
      chineseName: string("中文副标题"),
      tagline: string("英文标语"),
      herName: string("她的名字；传空字符串可恢复为“未来的你”"),
      signature: string("情书署名"),
      status: string("感情状态"),
      letterDate: string("信纸日期；空字符串保留留白")
    }
  };
  const photo = {
    type: "object",
    additionalProperties: false,
    properties: {
      src: string("项目内相对路径，例如 assets/images/memory-01.svg"),
      alt: string("无障碍替代文本"),
      title: string("照片标题"),
      note: string("照片说明"),
      meta: string("照片角标，例如 SOMEDAY · 春日"),
      ratio: string("宽高比，例如 4 / 5"),
      tag: string("筛选标签：风景 / 日常 / 我们")
    }
  };
  return {
    type: "object",
    additionalProperties: false,
    required: ["action"],
    properties: {
      action: {
        type: "string",
        enum: ACTIONS,
        description:
          "Read-only: status, audit, build_check, mobile_audit, vite_check, theme_audit, deploy_check, " +
          "read_config, list_photos, read_page. " +
          "Configuration mutations: update_site, set_dates, add_photo, update_photo, remove_photo, move_photo, " +
          "update_music, add_love_note, remove_love_note, set_easter_egg, replace_text. " +
          "Build operations (preview + confirm + native approval): install_deps, vite_build."
      },
      confirm: {
        type: "boolean",
        description:
          "Mutations only. Omit/false to receive a preview and write nothing. Only pass true after the user explicitly approves the exact write; the plugin then also requests native DSH approval."
      },
      site: sitePatch,
      dates: {
        type: "object",
        additionalProperties: false,
        properties: {
          anniversary: { oneOf: [string("纪念日 YYYY-MM-DD"), { type: "null" }] },
          birthday: { oneOf: [string("生日 YYYY-MM-DD"), { type: "null" }] }
        }
      },
      photo,
      photoIndex: { type: "integer", description: "从 0 开始的照片序号" },
      photoTitle: string("按标题定位照片（与 photoIndex 二选一）"),
      toIndex: { type: "integer", description: "移动照片的目标序号" },
      index: { type: "integer", description: "情话序号（remove_love_note）" },
      music: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: string("曲名"),
          subtitle: string("曲目说明"),
          audioFile: string("项目内音频路径；空字符串使用内置音乐盒"),
          volume: { type: "number", description: "0 到 1 之间的默认音量" }
        }
      },
      note: string("一条情话，最多 280 字"),
      easterEgg: {
        type: "object",
        additionalProperties: false,
        properties: {
          enabled: { type: "boolean" },
          threshold: { type: "integer", description: "连续点击次数，3 到 20" },
          title: string("彩蛋标题"),
          intro: string("彩蛋正文"),
          signature: string("彩蛋落款"),
          coupons: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: string("兑换券内容"),
                note: string("兑换券英文小字")
              },
              required: ["text"]
            }
          }
        }
      },
      file: {
        type: "string",
        enum: Object.keys(PAGE_FILES),
        description: "read_page / replace_text 的受控文件键"
      },
      find: string("replace_text 要查找的精确原文"),
      replace: string("replace_text 的替换文本"),
      replaceAll: { type: "boolean", description: "是否替换全部匹配；默认只允许唯一匹配" },
      page: string("read_page 的受控文件键（file 的别名）")
    }
  };
}

/**
 * @param {import("@deepseek-ai/cordis").Context} ctx
 * @param {{ projectDir?: string, packageManager?: string, nodePath?: string, pnpmScript?: string }} [config]
 */
export function apply(ctx, config = {}) {
  const projectDir = typeof config.projectDir === "string" && config.projectDir.trim() !== ""
    ? config.projectDir
    : DEFAULT_PROJECT_DIR;
  const packageManager = "pnpm";
  const nodePath = typeof config.nodePath === "string" ? config.nodePath : "";
  const pnpmScript = typeof config.pnpmScript === "string" ? config.pnpmScript : "";

  /** @param {AbortSignal|undefined} signal */
  async function rootTarget(signal) {
    let root;
    try {
      root = await ctx.fs.resolve(projectDir, { signal });
    } catch (error) {
      throw new Error(`无法访问项目目录 ${projectDir}: ${error instanceof Error ? error.message : String(error)}`);
    }
    const info = await ctx.fs.stat(root, signal);
    if (!info || info.type !== "directory") throw new Error(`项目目录不存在或不是目录: ${projectDir}`);
    return root;
  }

  /** @param {string} relative @param {AbortSignal|undefined} signal */
  async function inside(relative, signal) {
    const normalized = normalizeRelative(relative);
    const root = await rootTarget(signal);
    let target;
    try {
      target = await ctx.fs.resolve(normalized, { cwd: projectDir, signal });
    } catch (error) {
      throw new Error(`无法解析路径 ${normalized}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!ctx.fs.contains(root, target)) throw new Error(`拒绝访问项目目录之外的路径: ${normalized}`);
    return { relative: normalized, target, root };
  }

  /** @param {string} relative @param {AbortSignal|undefined} signal */
  async function readWithVersion(relative, signal) {
    const { target } = await inside(relative, signal);
    const info = await ctx.fs.stat(target, signal);
    if (!info || info.type !== "file") throw new Error(`文件不存在: ${relative}`);
    if (info.size !== undefined && info.size > MAX_TEXT_BYTES) throw new Error(`文件过大，拒绝读取: ${relative}`);
    const text = await ctx.fs.readText(target, signal);
    return { relative, target, text, version: info.version };
  }

  /** @param {string} relative @param {string} text @param {any} version @param {AbortSignal|undefined} signal */
  async function writeWithVersion(relative, text, version, signal) {
    const { target } = await inside(relative, signal);
    return ctx.fs.writeText(target, text, { kind: "replaceIfVersion", version }, signal);
  }

  /** @param {AbortSignal|undefined} signal */
  async function loadConfig(signal) {
    const file = await readWithVersion(CONFIG_PATH, signal);
    return { ...file, config: evaluateConfig(file.text) };
  }

  /** @param {AbortSignal|undefined} signal */
  async function listProjectFiles(signal) {
    const root = await rootTarget(signal);
    /** @type {string[]} */
    const files = [];
    /** @type {string[]} */
    const directories = [];
    const skip = new Set(["node_modules", ".git", ".dml-builder", "plugins", ".dsh", "coverage", "dist", ".pnpm-store"]);
    /**
     * @param {any} dir
     * @param {string} prefix
     * @param {number} depth
     */
    async function visit(dir, prefix, depth) {
      if (depth > 5 || files.length > 4_000) return;
      const entries = await ctx.fs.listDir(dir, signal);
      for (const entry of entries) {
        if (skip.has(entry.name)) continue;
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.type === "directory") {
          directories.push(relative);
          await visit(entry.target, relative, depth + 1);
        } else if (entry.type === "file") {
          files.push(relative);
        }
      }
    }
    await visit(root, "", 0);
    return { files, directories };
  }

  /**
   * Resolve the configured project directory and stat a project-relative file.
   * @param {string} relative @param {AbortSignal|undefined} signal
   */
  async function fileExists(relative, signal) {
    try {
      const { target } = await inside(relative, signal);
      const info = await ctx.fs.stat(target, signal);
      return Boolean(info && info.type === "file");
    } catch {
      return false;
    }
  }

  /** @param {AbortSignal|undefined} signal */
  async function readPackageJson(signal) {
    const file = await readWithVersion(PACKAGE_PATH, signal);
    let pkg;
    try {
      pkg = JSON.parse(file.text);
    } catch (error) {
      throw new Error(`package.json 不是合法 JSON：${error instanceof Error ? error.message : String(error)}`);
    }
    if (!isPlainObject(pkg)) throw new Error("package.json 必须是对象");
    return { ...file, pkg };
  }

  /** @param {any} pkg */
  function assertAllowedDependencies(pkg) {
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.optionalDependencies ?? {})
    ];
    const unknown = [...new Set(names)].filter((name) => !ALLOWED_DEPENDENCIES.has(name));
    if (unknown.length > 0) {
      throw new Error(
        `检测到未列入白名单的依赖：${unknown.join(", ")}。` +
        " Dear My Love Builder 只允许 Vite 相关构建依赖；请先用 Harness 的终端工具人工审查并安装。"
      );
    }
  }

  /**
   * Run one fixed package-manager operation through the Host subprocess
   * service. This is deliberately not a general shell: cwd is the project,
   * argv is fixed, and no user-supplied command string is accepted.
   * @param {string[]} packageArgs
   * @param {AbortSignal|undefined} signal
   */
  async function runPackageCommand(packageArgs, signal) {
    const subprocess = ctx.get("subprocess");
    if (!subprocess) {
      return {
        ok: false,
        status: "subprocess_unavailable",
        summary: "当前 Host 没有 subprocess 服务，无法执行 npm/pnpm 命令。",
        details: {}
      };
    }
    if (!nodePath || !pnpmScript) {
      return {
        ok: false,
        status: "package_manager_unavailable",
        summary: "尚未配置 nodePath / pnpmScript，无法执行安装或构建。",
        details: { packageManager }
      };
    }
    const env = {
      ...process.env,
      PATH: `${path.dirname(nodePath)}${path.delimiter}${process.env.PATH ?? ""}`
    };
    let nodeExecutable;
    try {
      nodeExecutable = await subprocess.resolveExecutable(nodePath, env, signal);
    } catch (error) {
      return {
        ok: false,
        status: "node_not_found",
        summary: `无法解析 Node 可执行文件：${error instanceof Error ? error.message : String(error)}`,
        details: { nodePath }
      };
    }
    const argv = [nodeExecutable, pnpmScript, ...packageArgs];
    const timeout = AbortSignal.timeout(PROCESS_TIMEOUT_MS);
    const processSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const cwd = ctx.fs.processPath(await rootTarget(signal));
    let handle;
    try {
      handle = subprocess.spawn({
        argv,
        cwd,
        stdio: {
          stdin: "ignore",
          stdout: { maxBytes: 200_000, spill: { maxBytes: 1_000_000 } },
          stderr: { maxBytes: 200_000, spill: { maxBytes: 1_000_000 } }
        },
        graceMs: 5_000,
        signal: processSignal,
        env
      });
    } catch (error) {
      return {
        ok: false,
        status: "spawn_failed",
        summary: `无法启动 ${packageManager}：${error instanceof Error ? error.message : String(error)}`,
        details: { argv: argv.slice(1) }
      };
    }
    let outcome;
    let thrown = null;
    try {
      outcome = await handle.done;
    } catch (error) {
      thrown = error;
    }
    const stdout = handle.collected?.stdout?.readFrom(0).text ?? "";
    const stderr = handle.collected?.stderr?.readFrom(0).text ?? "";
    const exitCode = outcome?.exitCode ?? null;
    if (thrown) {
      return {
        ok: false,
        status: "process_failed",
        summary: `命令执行失败：${thrown instanceof Error ? thrown.message : String(thrown)}`,
        details: { exitCode, stdout, stderr, timedOut: timeout.aborted }
      };
    }
    return {
      ok: exitCode === 0,
      status: exitCode === 0 ? "completed" : "failed",
      summary: exitCode === 0
        ? `${packageManager} ${packageArgs.join(" ")} 执行成功。`
        : `${packageManager} ${packageArgs.join(" ")} 失败，退出码 ${exitCode ?? "unknown"}。`,
      details: {
        exitCode,
        stdout,
        stderr,
        packageManager,
        command: argv.slice(1),
        cwd
      }
    };
  }

  /** @param {string} hex */
  function hexToRgb(hex) {
    const normalized = hex.replace("#", "").trim();
    if (![3, 6].includes(normalized.length)) return null;
    const expanded = normalized.length === 3
      ? normalized.split("").map((part) => part + part).join("")
      : normalized;
    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16)
    };
  }

  /** @param {{r:number,g:number,b:number}} rgb */
  function luminous(rgb) {
    const channel = (value) => {
      const normalized = value / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  }

  /** @param {string} foreground @param {string} background */
  function contrastRatio(foreground, background) {
    const fg = hexToRgb(foreground);
    const bg = hexToRgb(background);
    if (!fg || !bg) return null;
    const lighter = Math.max(luminous(fg), luminous(bg));
    const darker = Math.min(luminous(fg), luminous(bg));
    return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
  }

  /** @param {import("@deepseek-ai/dsh-tools").ToolRunContext} exec @param {string} action @param {string} summary */
  async function approveWrite(exec, action, summary) {
    if (!exec.agent) throw new Error("写入需要所属 Agent 会话，无法在无会话上下文中执行");
    const approval = ctx.get("approval");
    if (!approval) {
      return { allowed: false, status: "approval_unavailable", summary: "本环境没有可用的审批服务，未写入任何文件。" };
    }
    let outcome;
    try {
      outcome = await approval.request({
        agent: exec.agent,
        toolName: TOOL_NAME,
        callId: exec.callId,
        reason: `Dear My Love Builder · ${action}: ${summary}`,
        displayReason: `${action} · ${summary}`,
        signal: exec.signal
      });
    } catch (error) {
      return {
        allowed: false,
        status: "approval_failed",
        summary: `审批请求失败，未写入任何文件：${error instanceof Error ? error.message : String(error)}`
      };
    }
    if (outcome !== "allowed-once") {
      const labels = {
        rejected: "用户拒绝了这次修改",
        cancelled: "审批被取消",
        unavailable: "审批通道不可用"
      };
      return {
        allowed: false,
        status: `approval_${outcome}`,
        summary: `${labels[outcome] ?? "没有获得授权"}，未写入任何文件。`
      };
    }
    return { allowed: true };
  }

  /** @param {string} action @param {string} summary @param {object} preview */
  function pending(action, summary, preview) {
    return {
      ok: true,
      action,
      status: "confirmation_required",
      summary: `${summary}（尚未写入任何文件。请先向用户展示预览并取得明确同意，再以 confirm: true 重试。）`,
      details: {
        preview,
        requiresConfirmation: true,
        nativeApprovalWillBeRequested: true
      }
    };
  }

  /**
   * Common commit path for config/source edits.
   * @param {import("@deepseek-ai/dsh-tools").ToolRunContext} exec
   * @param {{ action: string, relative: string, before: string, after: string, version: any, summary: string, preview: object, details?: object }} change
   */
  async function commitChange(exec, change) {
    if (change.after === change.before) {
      return {
        ok: true,
        action: change.action,
        status: "no_change",
        summary: "内容没有变化，未写入文件。",
        details: change.details ?? {}
      };
    }
    if (exec.arguments.confirm !== true) {
      return pending(change.action, change.summary, {
        file: change.relative,
        ...change.preview
      });
    }
    const approval = await approveWrite(exec, change.action, change.summary);
    if (!approval.allowed) {
      return {
        ok: false,
        action: change.action,
        status: approval.status,
        summary: approval.summary,
        details: { file: change.relative }
      };
    }
    await writeWithVersion(change.relative, change.after, change.version, exec.signal);
    return {
      ok: true,
      action: change.action,
      status: "written",
      summary: change.summary,
      details: {
        file: change.relative,
        bytesBefore: Buffer.byteLength(change.before, "utf8"),
        bytesAfter: Buffer.byteLength(change.after, "utf8"),
        ...change.details
      }
    };
  }

  /** @param {AbortSignal|undefined} signal */
  async function runAudit(signal) {
    /** @type {{severity: "error"|"warning"|"info", code: string, message: string, file?: string}[]} */
    const issues = [];
    const add = (severity, code, message, file) => issues.push({ severity, code, message, ...(file ? { file } : {}) });

    let listing;
    try {
      listing = await listProjectFiles(signal);
    } catch (error) {
      add("error", "project_unreadable", error instanceof Error ? error.message : String(error));
      return { status: "fail", issues, stats: {} };
    }
    const fileSet = new Set(listing.files);
    for (const relative of REQUIRED_FILES) {
      if (!fileSet.has(relative)) add("error", "missing_file", `缺少必需文件：${relative}`, relative);
    }
    for (const relative of REQUIRED_DIRS) {
      if (!listing.directories.includes(relative)) add("error", "missing_directory", `缺少目录：${relative}`, relative);
    }

    let config = null;
    try {
      const loaded = await loadConfig(signal);
      config = loaded.config;
      validateConfig(config);
      for (const [index, photo] of config.photos.entries()) {
        const src = String(photo.src ?? "");
        if (!IMAGE_EXTENSIONS.has(extensionOf(src))) {
          add("warning", "photo_extension", `photos[${index}] 的图片扩展名不常见：${src}`, CONFIG_PATH);
        }
        if (!fileSet.has(normalizeRelative(src))) {
          add("error", "photo_missing", `照片不存在：${src}`, CONFIG_PATH);
        }
        if (!photo.alt || String(photo.alt).trim() === "") add("error", "photo_alt", `photos[${index}] 缺少 alt`, CONFIG_PATH);
      }
      if (config.site.anniversary && !isIsoDate(config.site.anniversary)) {
        add("error", "anniversary_invalid", "纪念日不是有效日期", CONFIG_PATH);
      }
      if (config.site.birthday && !isIsoDate(config.site.birthday)) {
        add("error", "birthday_invalid", "生日不是有效日期", CONFIG_PATH);
      }
      if (config.music?.audioFile && !fileSet.has(normalizeRelative(config.music.audioFile))) {
        add("error", "music_missing", `背景音乐不存在：${config.music.audioFile}`, CONFIG_PATH);
      }
    } catch (error) {
      add("error", "config_invalid", error instanceof Error ? error.message : String(error), CONFIG_PATH);
    }

    const htmlFiles = listing.files.filter((file) => file.endsWith(".html"));
    for (const relative of htmlFiles) {
      let text;
      try {
        text = (await readWithVersion(relative, signal)).text;
      } catch (error) {
        add("error", "html_unreadable", error instanceof Error ? error.message : String(error), relative);
        continue;
      }
      if (!/<!doctype\s+html/i.test(text)) add("warning", "html_doctype", "缺少 <!DOCTYPE html>", relative);
      if (!/<html[^>]+lang=/i.test(text)) add("warning", "html_lang", "缺少 html lang 属性", relative);
      if (!/<meta[^>]+name=["']viewport["']/i.test(text)) add("error", "viewport_missing", "缺少 viewport meta，移动端会缩放异常", relative);
      if (!/<title>[^<]+<\/title>/i.test(text)) add("error", "title_missing", "缺少页面 title", relative);
      if (!/<meta[^>]+name=["']description["']/i.test(text)) add("warning", "description_missing", "缺少 meta description", relative);
      const h1Count = (text.match(/<h1\b/gi) ?? []).length;
      if (h1Count === 0) add("warning", "h1_missing", "页面没有 h1", relative);
      if (h1Count > 1) add("warning", "h1_multiple", `页面有 ${h1Count} 个 h1`, relative);

      const ids = [...text.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
      const seen = new Set();
      for (const id of ids) {
        if (seen.has(id)) add("warning", "duplicate_id", `重复的 id="${id}"`, relative);
        seen.add(id);
      }

      const tags = text.match(/<img\b[^>]*>/gi) ?? [];
      for (const tag of tags) {
        if (!/\balt\s*=/i.test(tag)) add("warning", "img_alt_missing", "存在没有 alt 的 img", relative);
      }

      const linkRe = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
      for (const match of text.matchAll(linkRe)) {
        const raw = match[1].trim();
        if (!raw || raw.startsWith("#") || /^(?:[a-z]+:|\/\/)/i.test(raw)) continue;
        if (raw.startsWith("/")) {
          add("error", "absolute_path", `绝对路径在 GitHub Pages 子路径下会失效：${raw}`, relative);
          continue;
        }
        const clean = raw.split("#")[0].split("?")[0];
        if (!clean) continue;
        let decoded = clean;
        try {
          decoded = decodeURIComponent(clean);
        } catch {
          // Keep the raw link when decoding fails.
        }
        let target = path.posix.normalize(path.posix.join(path.posix.dirname(relative), decoded));
        if (target.endsWith("/")) target += "index.html";
        if (target.startsWith("../") || !fileSet.has(target)) {
          add("error", "broken_link", `本地引用不存在：${raw}`, relative);
        }
      }
    }

    const cssFiles = listing.files.filter((file) => file.endsWith(".css"));
    for (const relative of cssFiles) {
      let text;
      try {
        text = (await readWithVersion(relative, signal)).text;
      } catch (error) {
        add("error", "css_unreadable", error instanceof Error ? error.message : String(error), relative);
        continue;
      }
      const opens = (text.match(/\{/g) ?? []).length;
      const closes = (text.match(/\}/g) ?? []).length;
      if (opens !== closes) add("error", "css_braces", `CSS 花括号不平衡：{ ${opens} / } ${closes}`, relative);
      for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
        const raw = match[1].trim();
        if (!raw || /^(?:data:|https?:|\/\/|#)/i.test(raw)) continue;
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(relative), raw.split("#")[0].split("?")[0]));
        if (!fileSet.has(target)) add("error", "css_asset_missing", `CSS 引用的资源不存在：${raw}`, relative);
      }
    }

    const jsFiles = listing.files.filter((file) => file.endsWith(".js"));
    for (const relative of jsFiles) {
      // vite.config.js is ESM, so vm.Script (classic-script parser) would
      // report a false syntax error. Its structure is checked by vite_check and
      // its real syntax by the Vite build itself.
      if (relative === "vite.config.js") continue;
      let text;
      try {
        text = (await readWithVersion(relative, signal)).text;
        new vm.Script(text, { filename: relative });
      } catch (error) {
        add("error", "js_syntax", error instanceof Error ? error.message : String(error), relative);
      }
    }

    try {
      const vite = await runViteCheck(signal);
      for (const issue of vite.issues) issues.push(issue);
    } catch (error) {
      add("error", "vite_check_failed", error instanceof Error ? error.message : String(error));
    }
    try {
      const deploy = await runDeployCheck(signal);
      for (const issue of deploy.issues) issues.push(issue);
    } catch (error) {
      add("error", "deploy_check_failed", error instanceof Error ? error.message : String(error));
    }

    if (config) {
      if (config.photos.length < 6) add("warning", "photo_count", "照片少于 6 张，三列照片墙会显得空");
      if (!["风景", "日常", "我们"].every((tag) => config.photos.some((photo) => photo.tag === tag))) {
        add("info", "photo_tags", "照片标签未覆盖 风景 / 日常 / 我们");
      }
    }

    const styles = fileSet.has("assets/css/styles.css")
      ? await readWithVersion("assets/css/styles.css", signal).catch(() => null)
      : null;
    if (styles) {
      if (!/@media\s*\(max-width:\s*980px\)/.test(styles.text)) add("warning", "breakpoint_980", "缺少 980px 断点");
      if (!/@media\s*\(max-width:\s*760px\)/.test(styles.text)) add("warning", "breakpoint_760", "缺少 760px 断点");
      if (!/@media\s*\(max-width:\s*620px\)/.test(styles.text)) add("warning", "breakpoint_620", "缺少 620px 断点");
      if (!/column-count:\s*3/.test(styles.text)) add("error", "three_columns", "桌面照片墙没有三列布局");
      if (!/prefers-reduced-motion/.test(styles.text)) add("warning", "reduced_motion", "没有 prefers-reduced-motion 适配");
      if (!/overflow-x:\s*hidden/.test(styles.text)) add("warning", "overflow_guard", "缺少 overflow-x: hidden 防横向滚动保护");
      if (!/clamp\(/.test(styles.text)) add("warning", "fluid_type", "没有使用 clamp() 做流式排版");
      if (!/100svh/.test(styles.text)) add("info", "svh", "没有使用 100svh 适配移动浏览器地址栏");
    }

    for (const optional of [".nojekyll"]) {
      if (!fileSet.has(optional)) add("info", "deploy_file", `建议补充部署文件：${optional}`);
    }

    const errors = issues.filter((issue) => issue.severity === "error");
    const warnings = issues.filter((issue) => issue.severity === "warning");
    return {
      status: errors.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
      issues,
      stats: {
        files: listing.files.length,
        directories: listing.directories.length,
        html: htmlFiles.length,
        css: cssFiles.length,
        js: jsFiles.length,
        photos: config?.photos?.length ?? null,
        errors: errors.length,
        warnings: warnings.length,
        info: issues.filter((issue) => issue.severity === "info").length
      }
    };
  }

  /** @param {AbortSignal|undefined} signal */
  async function runMobileAudit(signal) {
    const listing = await listProjectFiles(signal);
    const fileSet = new Set(listing.files);
    const checks = [];
    const add = (name, ok, detail) => checks.push({ name, ok, detail });
    const htmlFiles = listing.files.filter((file) => file.endsWith(".html"));
    const missingViewport = [];
    for (const relative of htmlFiles) {
      const text = (await readWithVersion(relative, signal)).text;
      if (!/<meta[^>]+name=["']viewport["'][^>]*width=device-width/i.test(text)) missingViewport.push(relative);
    }
    add("全部页面声明 width=device-width viewport", missingViewport.length === 0, missingViewport.join(", ") || "OK");
    const css = fileSet.has("assets/css/styles.css") ? (await readWithVersion("assets/css/styles.css", signal)).text : "";
    const breakpoints = [...css.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)].map((match) => Number(match[1]));
    add("响应式断点数量 ≥ 4", breakpoints.length >= 4, `发现 ${breakpoints.length} 个：${breakpoints.join(", ")}`);
    add("桌面三列照片墙", /column-count:\s*3/.test(css), /column-count:\s*3/.test(css) ? "已声明" : "未找到 column-count: 3");
    add("移动端折叠为单列", /@media\s*\(max-width:\s*620px\)[\s\S]*?column-count:\s*1/.test(css), "检查 620px 断点");
    add("尊重减少动态效果偏好", /prefers-reduced-motion/.test(css), "prefers-reduced-motion");
    add("视口横向溢出保护", /overflow-x:\s*hidden/.test(css), "overflow-x: hidden");
    const smallTouch = [];
    if (css && !/\.menu-toggle\s*\{[\s\S]*?width:\s*44px/.test(css)) smallTouch.push(".menu-toggle");
    if (css && !/\.music-fab\s*\{[\s\S]*?height:\s*48px/.test(css)) smallTouch.push(".music-fab");
    if (css && !/\.btn\s*\{[\s\S]*?min-height:\s*52px/.test(css)) smallTouch.push(".btn");
    add("主要触控目标 ≥ 44px", smallTouch.length === 0, smallTouch.length ? `请检查：${smallTouch.join(", ")}` : "OK");
    return {
      status: checks.every((check) => check.ok) ? "pass" : "warn",
      checks,
      breakpoints,
      note: "这是静态检查；真实触摸、字体回退和浏览器地址栏变化仍需在手机或 DevTools 设备模式下人工确认。"
    };
  }

  /** @param {AbortSignal|undefined} signal */
  async function runViteCheck(signal) {
    const issues = [];
    const checks = [];
    const add = (name, ok, detail) => checks.push({ name, ok, detail });
    const addIssue = (severity, code, message, file) => issues.push({
      severity,
      code,
      message,
      ...(file ? { file } : {})
    });

    let pkg = null;
    try {
      pkg = (await readPackageJson(signal)).pkg;
      add("package.json 可读取", true, "OK");
    } catch (error) {
      add("package.json 可读取", false, error instanceof Error ? error.message : String(error));
      addIssue("error", "package_json", "package.json 缺失或不可解析", PACKAGE_PATH);
      return { status: "fail", issues, checks, installed: false };
    }

    const devDependencies = pkg.devDependencies ?? {};
    const hasVite = typeof devDependencies.vite === "string";
    add("Vite 在 devDependencies 中", hasVite, devDependencies.vite ?? "未找到");
    if (!hasVite) addIssue("error", "vite_dependency", "package.json 未声明 Vite 依赖", PACKAGE_PATH);

    const scripts = pkg.scripts ?? {};
    add("npm run dev 可用", typeof scripts.dev === "string", scripts.dev ?? "未配置");
    add("npm run build 可用", typeof scripts.build === "string", scripts.build ?? "未配置");
    if (typeof scripts.build !== "string") addIssue("error", "build_script", "package.json 缺少 build 脚本", PACKAGE_PATH);

    for (const page of ["index.html", "about.html", "gallery.html", "days.html", "wishlist.html", "quiz.html", "letter.html", "404.html"]) {
      const ok = await fileExists(page, signal);
      add(`页面存在：${page}`, ok, ok ? "OK" : "缺失");
      if (!ok) addIssue("error", "vite_page_missing", `Vite 多页入口缺少 ${page}`, page);
    }

    let viteConfig = "";
    try {
      viteConfig = (await readWithVersion("vite.config.js", signal)).text;
    } catch {
      addIssue("error", "vite_config_missing", "缺少 vite.config.js", "vite.config.js");
    }
    add("Vite 配置使用 defineConfig", /defineConfig\s*\(/.test(viteConfig), "vite.config.js");
    add("Vite base 为相对路径", /base:\s*["']\.\/["']/.test(viteConfig), "base: './'");
    add("Vite 输出目录为 dist", /outDir:\s*["']dist["']/.test(viteConfig), "outDir: 'dist'");
    add("Vite 多页入口完整", ["index.html", "about.html", "gallery.html", "days.html", "wishlist.html", "quiz.html", "letter.html", "404.html"].every((page) => viteConfig.includes(page)), "8 个 HTML 入口");
    add("保留静态资源/Pages 标记", /preserveClassicAssets|\.nojekyll/.test(viteConfig), "custom build plugin");
    if (!/base:\s*["']\.\/["']/.test(viteConfig)) addIssue("warning", "vite_base", "GitHub Pages 子路径部署建议 base: './'", "vite.config.js");

    const wrapper = await fileExists("scripts/vite-build.mjs", signal);
    add("沙箱安全的 Vite 构建包装器", wrapper, "scripts/vite-build.mjs");
    if (!wrapper) addIssue("error", "vite_wrapper", "缺少 scripts/vite-build.mjs", "scripts/vite-build.mjs");

    const installed = await fileExists("node_modules/vite/package.json", signal);
    add("Vite 依赖已安装", installed, installed ? "node_modules/vite" : "尚未安装，请先执行 install_deps");
    if (!installed) addIssue("warning", "vite_not_installed", "Vite 尚未安装；构建前需要安装依赖", "node_modules");

    const distIndex = await fileExists("dist/index.html", signal);
    const distScript = await fileExists("dist/assets/js/site.js", signal);
    const distMarker = await fileExists("dist/.nojekyll", signal);
    add("已有 dist/index.html", distIndex, distIndex ? "OK" : "尚未构建");
    add("dist 保留经典脚本", distScript, distScript ? "OK" : "尚未构建");
    add("dist 包含 .nojekyll", distMarker, distMarker ? "OK" : "尚未构建");
    if (!distIndex) addIssue("info", "dist_not_built", "还没有生产构建产物；可运行 vite_build（需确认）", "dist");

    const errors = issues.filter((issue) => issue.severity === "error");
    return {
      status: errors.length > 0 ? "fail" : issues.some((issue) => issue.severity === "warning") ? "warn" : "pass",
      issues,
      checks,
      installed,
      packageManager,
      nodePath: nodePath ? "configured" : "missing",
      pnpmScript: pnpmScript ? "configured" : "missing"
    };
  }

  /** @param {AbortSignal|undefined} signal */
  async function runThemeAudit(signal) {
    const css = (await readWithVersion("assets/css/styles.css", signal)).text;
    const checks = [];
    const add = (name, ok, detail) => checks.push({ name, ok, detail });
    const token = (name) => {
      const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`).exec(css);
      return match ? match[1] : null;
    };
    const cream = token("cream");
    const ink = token("ink");
    const muted = token("muted");
    const roseDeep = token("rose-deep");
    const blush = token("blush");
    const pink = token("pink");
    add("奶油白 --cream 已定义", Boolean(cream), cream ?? "missing");
    add("樱花粉 --blush / --pink 已定义", Boolean(blush && pink), `${blush ?? "missing"} / ${pink ?? "missing"}`);
    add("深色文字 --ink 已定义", Boolean(ink), ink ?? "missing");
    add("玫瑰强调色 --rose-deep 已定义", Boolean(roseDeep), roseDeep ?? "missing");
    add("中文显示字体栈", /Songti|STSong|Noto Serif SC|SimSun|宋体/.test(css), "serif fallback");
    add("中文正文字体栈", /PingFang SC|Microsoft YaHei|Hiragino Sans GB/.test(css), "sans fallback");
    add("没有外部字体请求", !/@import\s+url|fonts\.googleapis|fonts\.gstatic/.test(css), "local only");
    add("照片墙三列主题布局", /column-count:\s*3/.test(css), "3 columns");
    add("减少动态效果适配", /prefers-reduced-motion/.test(css), "present");
    add("移动端断点", (css.match(/@media\s*\(max-width:/g) ?? []).length >= 4, "4+ breakpoints");

    const contrasts = {};
    if (cream && ink) contrasts.ink_on_cream = contrastRatio(ink, cream);
    if (cream && roseDeep) contrasts.roseDeep_on_cream = contrastRatio(roseDeep, cream);
    if (cream && muted) contrasts.muted_on_cream = contrastRatio(muted, cream);
    const failures = Object.entries(contrasts).filter(([, ratio]) => typeof ratio === "number" && ratio < 4.5);
    add("正文/强调色对比度 ≥ 4.5", failures.length === 0, failures.length ? JSON.stringify(failures) : JSON.stringify(contrasts));

    const errors = checks.filter((check) => !check.ok);
    return {
      status: errors.length === 0 ? "pass" : "warn",
      checks,
      palette: {
        cream,
        blush,
        pink,
        ink,
        muted,
        roseDeep
      },
      contrast: contrasts,
      note: "对比度按 WCAG AA 普通文本 4.5:1 做静态估算；渐变、透明度和真实渲染仍需浏览器确认。"
    };
  }

  /** @param {AbortSignal|undefined} signal */
  async function runDeployCheck(signal) {
    const issues = [];
    const checks = [];
    const add = (name, ok, detail) => checks.push({ name, ok, detail });
    const addIssue = (severity, code, message, file) => issues.push({
      severity,
      code,
      message,
      ...(file ? { file } : {})
    });
    const readOptional = async (relative) => {
      try {
        return (await readWithVersion(relative, signal)).text;
      } catch {
        return "";
      }
    };

    const workflow = await readOptional(".github/workflows/deploy.yml");
    const netlify = await readOptional("netlify.toml");
    const vercel = await readOptional("vercel.json");
    const vercelIgnore = await readOptional(".vercelignore");

    const ghOk = Boolean(workflow) &&
      /actions\/upload-pages-artifact/.test(workflow) &&
      /path:\s*dist/.test(workflow) &&
      /npm run build/.test(workflow);
    add("GitHub Pages 使用 Vite dist 产物", ghOk, ghOk ? "deploy.yml" : "检查 path: dist / npm run build");
    if (!ghOk) addIssue("warning", "github_pages", "GitHub Pages 工作流没有明确上传 dist 或没有运行 npm run build", ".github/workflows/deploy.yml");

    const netlifyOk = /publish\s*=\s*["']dist["']/.test(netlify) && /npm run build/.test(netlify);
    add("Netlify 构建到 dist", netlifyOk, netlifyOk ? "netlify.toml" : "检查 publish = \"dist\"");
    if (!netlifyOk) addIssue("warning", "netlify_config", "Netlify 配置没有明确 publish = \"dist\" 或 npm run build", "netlify.toml");

    let vercelJson = null;
    try {
      vercelJson = vercel ? JSON.parse(vercel) : null;
    } catch {
      addIssue("warning", "vercel_json", "vercel.json 不是合法 JSON", "vercel.json");
    }
    const vercelOk = vercelJson?.buildCommand === "npm run build" && vercelJson?.outputDirectory === "dist";
    add("Vercel 构建命令与输出目录", vercelOk, vercelOk ? "vercel.json" : "缺省或字段不匹配");
    if (!vercelOk) addIssue("warning", "vercel_config", "Vercel 配置应使用 npm run build 和 dist", "vercel.json");

    const ignoreOk = /plugins/.test(vercelIgnore) && /node_modules/.test(vercelIgnore);
    add("部署忽略插件与 node_modules", ignoreOk, ignoreOk ? "vercelignore" : "检查 .vercelignore");
    if (!ignoreOk) addIssue("warning", "vercel_ignore", ".vercelignore 应排除 plugins 和 node_modules", ".vercelignore");

    add("未自动发布", true, "部署检查只读取配置，不调用任何发布 API");

    const warnings = issues.filter((issue) => issue.severity === "warning").length;
    return {
      status: warnings > 0 ? "warn" : "pass",
      issues,
      checks,
      note: "GitHub Pages / Netlify / Vercel 的远程构建和域名绑定仍需在对应平台完成；本插件不会上传或发布。"
    };
  }

  /** @param {any[]} photos */
  function photoSummary(photos) {
    return photos.map((photo, index) => ({
      index,
      title: photo.title,
      src: photo.src,
      tag: photo.tag ?? "",
      ratio: photo.ratio ?? ""
    }));
  }

  /** @param {any[]} photos @param {any} args */
  function findPhotoIndex(photos, args) {
    if (Number.isInteger(args.photoIndex)) {
      if (args.photoIndex < 0 || args.photoIndex >= photos.length) throw new Error("photoIndex 超出范围");
      return args.photoIndex;
    }
    if (typeof args.photoTitle === "string" && args.photoTitle.trim() !== "") {
      const title = args.photoTitle.trim();
      const index = photos.findIndex((photo) => photo.title === title);
      if (index === -1) throw new Error(`找不到标题为“${title}”的照片`);
      return index;
    }
    throw new Error("请提供 photoIndex 或 photoTitle");
  }

  /** @param {any} photoInput @param {AbortSignal|undefined} signal */
  async function normalizePhoto(photoInput, signal) {
    if (!isPlainObject(photoInput)) throw new Error("photo 必须是对象");
    const src = normalizeRelative(cleanText(photoInput.src, "photo.src", 300));
    if (!src.startsWith("assets/")) throw new Error("照片必须放在 assets/ 目录下");
    if (!IMAGE_EXTENSIONS.has(extensionOf(src))) throw new Error("照片必须是 png/jpg/jpeg/webp/avif/svg/gif");
    if (!(await fileExists(src, signal))) throw new Error(`照片文件不存在：${src}`);
    const ratio = photoInput.ratio === undefined ? "4 / 3" : String(photoInput.ratio).trim();
    if (!/^\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?$/.test(ratio)) throw new Error('photo.ratio 必须形如 "4 / 5"');
    return {
      src,
      alt: cleanText(photoInput.alt, "photo.alt", 200),
      title: cleanText(photoInput.title, "photo.title", 80),
      note: photoInput.note === undefined ? "" : cleanText(photoInput.note, "photo.note", 220, true),
      meta: photoInput.meta === undefined ? "SOMEDAY · 日常" : cleanText(photoInput.meta, "photo.meta", 60, true),
      ratio,
      tag: photoInput.tag === undefined ? "日常" : cleanText(photoInput.tag, "photo.tag", 20, true)
    };
  }

  /** @param {import("@deepseek-ai/dsh-tools").ToolRunContext} exec @param {any} args */
  async function handle(exec, args) {
    const action = args.action;
    if (!ACTIONS.includes(action)) throw new Error(`未知 action: ${action}`);

    if (action === "status") {
      let listing;
      try {
        listing = await listProjectFiles(exec.signal);
      } catch (error) {
        return {
          ok: false,
          action,
          status: "project_unreadable",
          summary: error instanceof Error ? error.message : String(error),
          details: { projectDir, dshVersion: DSH_VERSION_VERIFIED }
        };
      }
      const fileSet = new Set(listing.files);
      const missing = REQUIRED_FILES.filter((relative) => !fileSet.has(relative));
      let config = null;
      let configError = null;
      try {
        config = (await loadConfig(exec.signal)).config;
        validateConfig(config);
      } catch (error) {
        configError = error instanceof Error ? error.message : String(error);
      }
      return {
        ok: !configError && missing.length === 0,
        action,
        status: configError || missing.length > 0 ? "attention" : "ok",
        summary: configError
          ? "项目存在配置错误，请先运行 build_check。"
          : missing.length > 0
            ? `项目已找到，但还缺少 ${missing.length} 个必需文件。`
            : "项目结构完整，配置可读取。",
        details: {
          projectDir,
          dshVersion: DSH_VERSION_VERIFIED,
          files: listing.files.length,
          missing,
          configError,
          photos: config?.photos?.length ?? null,
          anniversary: config?.site?.anniversary ?? null,
          birthday: config?.site?.birthday ?? null,
          music: config?.music?.title ?? null,
          loveNotes: config?.site?.loveNotes?.length ?? 0,
          easterEggThreshold: config?.site?.easterEgg?.threshold ?? 10,
          vite: {
            configured: fileSet.has("vite.config.js"),
            dependencyInstalled: await fileExists("node_modules/vite/package.json", exec.signal),
            distBuilt: await fileExists("dist/index.html", exec.signal),
            packageManager,
            nodeConfigured: Boolean(nodePath),
            pnpmScriptConfigured: Boolean(pnpmScript)
          }
        }
      };
    }

    if (action === "audit" || action === "build_check") {
      const audit = await runAudit(exec.signal);
      return {
        ok: audit.status === "pass" || audit.status === "warn",
        action,
        status: audit.status,
        summary: audit.status === "fail"
          ? `检查发现 ${audit.stats.errors} 个错误、${audit.stats.warnings} 个警告。`
          : audit.status === "warn"
            ? `检查通过，但有 ${audit.stats.warnings} 个警告。`
            : "检查通过，没有发现错误或警告。",
        details: audit
      };
    }

    if (action === "mobile_audit") {
      const mobile = await runMobileAudit(exec.signal);
      return {
        ok: mobile.status === "pass" || mobile.status === "warn",
        action,
        status: mobile.status,
        summary: mobile.status === "pass" ? "移动端静态检查通过。" : "移动端静态检查发现需要留意的地方。",
        details: mobile
      };
    }

    if (action === "vite_check") {
      const vite = await runViteCheck(exec.signal);
      return {
        ok: vite.status !== "fail",
        action,
        status: vite.status,
        summary: vite.status === "pass"
          ? "Vite 项目配置检查通过。"
          : vite.status === "warn"
            ? "Vite 项目已配置，但有需要留意的地方。"
            : "Vite 项目配置存在错误。",
        details: vite
      };
    }

    if (action === "theme_audit") {
      const theme = await runThemeAudit(exec.signal);
      return {
        ok: theme.status === "pass" || theme.status === "warn",
        action,
        status: theme.status,
        summary: theme.status === "pass" ? "奶油白 / 樱花粉主题静态检查通过。" : "主题检查发现需要留意的地方。",
        details: theme
      };
    }

    if (action === "deploy_check") {
      const deploy = await runDeployCheck(exec.signal);
      return {
        ok: deploy.status === "pass" || deploy.status === "warn",
        action,
        status: deploy.status,
        summary: deploy.status === "pass" ? "部署配置检查通过。" : "部署配置有需要留意的地方。",
        details: deploy
      };
    }

    if (PROCESS_ACTIONS.has(action)) {
      const isInstall = action === "install_deps";
      const pkgFile = await readPackageJson(exec.signal);
      assertAllowedDependencies(pkgFile.pkg);
      if (!isInstall) {
        const buildScript = pkgFile.pkg.scripts?.build;
        if (typeof buildScript !== "string" || buildScript.trim() === "") {
          throw new Error("package.json 没有 build 脚本");
        }
        const installed = await fileExists("node_modules/vite/package.json", exec.signal);
        if (!installed) {
          return {
            ok: false,
            action,
            status: "dependencies_missing",
            summary: "Vite 尚未安装。请先执行 install_deps（需要确认）。",
            details: { nodeModulesVite: false }
          };
        }
      }
      const command = isInstall ? "pnpm install" : "pnpm run build";
      const summary = isInstall
        ? "安装 package.json 中已审查的 Vite 构建依赖，并更新锁文件。"
        : "运行 Vite 生产构建，生成 dist/。";
      if (args.confirm !== true) {
        return pending(action, summary, {
          command,
          cwd: projectDir,
          dependencies: {
            ...(pkgFile.pkg.dependencies ?? {}),
            ...(pkgFile.pkg.devDependencies ?? {})
          },
          writes: isInstall ? ["node_modules/", "pnpm-lock.yaml"] : ["dist/"],
          note: "该操作会修改生成目录/依赖目录，但不会修改页面或配置。"
        });
      }
      const approval = await approveWrite(exec, action, summary);
      if (!approval.allowed) {
        return {
          ok: false,
          action,
          status: approval.status,
          summary: approval.summary,
          details: {}
        };
      }
      const result = await runPackageCommand(isInstall ? ["install"] : ["run", "build"], exec.signal);
      if (isInstall) {
        result.details.viteInstalled = await fileExists("node_modules/vite/package.json", exec.signal);
      } else if (result.ok) {
        result.details.dist = {
          index: await fileExists("dist/index.html", exec.signal),
          classicScripts: await fileExists("dist/assets/js/site.js", exec.signal),
          nojekyll: await fileExists("dist/.nojekyll", exec.signal)
        };
      }
      return {
        ok: result.ok,
        action,
        status: result.status,
        summary: result.summary,
        details: result.details
      };
    }

    if (action === "read_config") {
      const loaded = await loadConfig(exec.signal);
      return {
        ok: true,
        action,
        status: "ok",
        summary: "已读取 assets/js/config.js。",
        details: { config: loaded.config }
      };
    }

    if (action === "list_photos") {
      const loaded = await loadConfig(exec.signal);
      return {
        ok: true,
        action,
        status: "ok",
        summary: `共有 ${loaded.config.photos.length} 张照片。`,
        details: {
          photos: photoSummary(loaded.config.photos),
          tags: [...new Set(loaded.config.photos.map((photo) => photo.tag).filter(Boolean))]
        }
      };
    }

    if (action === "read_page") {
      const key = args.file || args.page;
      if (typeof key !== "string" || !(key in PAGE_FILES)) {
        throw new Error(`file 必须是以下键之一：${Object.keys(PAGE_FILES).join(", ")}`);
      }
      const relative = PAGE_FILES[key];
      const file = await readWithVersion(relative, exec.signal);
      const limit = 16_000;
      const content = file.text.length > limit ? `${file.text.slice(0, limit)}\n\n…（已截断，共 ${file.text.length} 字符）` : file.text;
      return {
        ok: true,
        action,
        status: "ok",
        summary: `已读取 ${relative}。`,
        details: { key, file: relative, characters: file.text.length, truncated: file.text.length > limit, content }
      };
    }

    if (action === "update_site") {
      if (!isPlainObject(args.site) || Object.keys(args.site).length === 0) throw new Error("请提供要修改的 site 字段");
      const loaded = await loadConfig(exec.signal);
      const next = cloneJson(loaded.config);
      const allowed = ["name", "shortName", "chineseName", "tagline", "herName", "signature", "status", "letterDate"];
      const labels = {
        name: "站点名称",
        shortName: "短名称",
        chineseName: "中文副标题",
        tagline: "英文标语",
        herName: "她的名字",
        signature: "署名",
        status: "感情状态",
        letterDate: "信纸日期"
      };
      const changes = {};
      let source = loaded.text;
      for (const key of allowed) {
        if (!(key in args.site)) continue;
        const value = cleanText(args.site[key], labels[key] ?? key, key === "tagline" ? 120 : 80, key === "herName" || key === "letterDate");
        next.site[key] = value;
        changes[key] = value;
        source = setField(source, "site", key, value);
      }
      if (Object.keys(changes).length === 0) throw new Error("没有可识别的 site 字段");
      validateConfig(evaluateConfig(source));
      return commitChange(exec, {
        action,
        relative: CONFIG_PATH,
        before: loaded.text,
        after: source,
        version: loaded.version,
        summary: `更新站点资料：${Object.keys(changes).join(", ")}。`,
        preview: { changes },
        details: { configPath: CONFIG_PATH, changes }
      });
    }

    if (action === "set_dates") {
      if (!isPlainObject(args.dates) || Object.keys(args.dates).length === 0) throw new Error("请提供 anniversary 或 birthday");
      const loaded = await loadConfig(exec.signal);
      const next = cloneJson(loaded.config);
      const allowed = ["anniversary", "birthday"];
      const changes = {};
      let source = loaded.text;
      for (const key of allowed) {
        if (!(key in args.dates)) continue;
        const value = args.dates[key];
        if (value !== null && !isIsoDate(value)) throw new Error(`${key} 必须是 YYYY-MM-DD 或 null`);
        next.site[key] = value;
        changes[key] = value;
        source = setField(source, "site", key, value);
      }
      if (Object.keys(changes).length === 0) throw new Error("没有可识别的日期字段");
      validateConfig(evaluateConfig(source));
      const dates = {
        anniversary: previewDate(next.site.anniversary),
        birthday: previewDate(next.site.birthday)
      };
      return commitChange(exec, {
        action,
        relative: CONFIG_PATH,
        before: loaded.text,
        after: source,
        version: loaded.version,
        summary: `更新日期：纪念日 ${dates.anniversary}，生日 ${dates.birthday}。`,
        preview: { changes, formatted: dates },
        details: {
          configPath: CONFIG_PATH,
          dates,
          countdowns: {
            anniversary: nextOccurrence(next.site.anniversary),
            birthday: nextOccurrence(next.site.birthday)
          },
          daysTogether: daysTogether(next.site.anniversary)
        }
      });
    }

    if (action === "add_photo") {
      const loaded = await loadConfig(exec.signal);
      const next = cloneJson(loaded.config);
      if (next.photos.length >= 30) throw new Error("照片墙最多 30 张照片");
      const photo = await normalizePhoto(args.photo, exec.signal);
      const rawIndex = args.photoIndex;
      const position = rawIndex === undefined ? next.photos.length : rawIndex;
      if (!Number.isInteger(position) || position < 0 || position > next.photos.length) throw new Error("photoIndex 必须是 0 到照片数量之间的整数");
      next.photos.splice(position, 0, photo);
      validateConfig(next);
      const source = setTopLevelArray(loaded.text, "photos", next.photos);
      validateConfig(evaluateConfig(source));
      return commitChange(exec, {
        action,
        relative: CONFIG_PATH,
        before: loaded.text,
        after: source,
        version: loaded.version,
        summary: `新增照片「${photo.title}」到第 ${position + 1} 位。`,
        preview: { added: photo, position, total: next.photos.length },
        details: { photos: photoSummary(next.photos) }
      });
    }

    if (action === "update_photo") {
      if (!isPlainObject(args.photo)) throw new Error("请提供 photo 字段");
      const loaded = await loadConfig(exec.signal);
      const next = cloneJson(loaded.config);
      const index = findPhotoIndex(next.photos, args);
      const merged = { ...next.photos[index] };
      const allowed = ["src", "alt", "title", "note", "meta", "ratio", "tag"];
      for (const key of allowed) {
        if (args.photo[key] !== undefined) merged[key] = args.photo[key];
      }
      const normalized = await normalizePhoto(merged, exec.signal);
      next.photos[index] = normalized;
      validateConfig(next);
      const source = setTopLevelArray(loaded.text, "photos", next.photos);
      validateConfig(evaluateConfig(source));
      return commitChange(exec, {
        action,
        relative: CONFIG_PATH,
        before: loaded.text,
        after: source,
        version: loaded.version,
        summary: `更新第 ${index + 1} 张照片「${normalized.title}」。`,
        preview: { index, before: photoSummary([loaded.config.photos[index]])[0], after: photoSummary([normalized])[0] },
        details: { photos: photoSummary(next.photos) }
      });
    }

    if (action === "remove_photo") {
      const loaded = await loadConfig(exec.signal);
      const next = cloneJson(loaded.config);
      const index = findPhotoIndex(next.photos, args);
      const [removed] = next.photos.splice(index, 1);
      validateConfig(next);
      const source = setTopLevelArray(loaded.text, "photos", next.photos);
      validateConfig(evaluateConfig(source));
      return commitChange(exec, {
        action,
        relative: CONFIG_PATH,
        before: loaded.text,
        after: source,
        version: loaded.version,
        summary: `从照片墙移除「${removed.title}」（不会删除原始图片文件）。`,
        preview: { removed, index, total: next.photos.length },
        details: { photos: photoSummary(next.photos), note: "图片文件仍保留在 assets 目录中。" }
      });
    }

    if (action === "move_photo") {
      const loaded = await loadConfig(exec.signal);
      const next = cloneJson(loaded.config);
      const from = findPhotoIndex(next.photos, args);
      const to = args.toIndex;
      if (!Number.isInteger(to) || to < 0 || to >= next.photos.length) throw new Error("toIndex 超出范围");
      if (from === to) throw new Error("照片已经在这个位置");
      const [photo] = next.photos.splice(from, 1);
      next.photos.splice(to, 0, photo);
      validateConfig(next);
      const source = setTopLevelArray(loaded.text, "photos", next.photos);
      validateConfig(evaluateConfig(source));
      return commitChange(exec, {
        action,
        relative: CONFIG_PATH,
        before: loaded.text,
        after: source,
        version: loaded.version,
        summary: `把「${photo.title}」从第 ${from + 1} 位移到第 ${to + 1} 位。`,
        preview: { from, to, title: photo.title },
        details: { photos: photoSummary(next.photos) }
      });
    }

    if (action === "update_music") {
      if (!isPlainObject(args.music) || Object.keys(args.music).length === 0) throw new Error("请提供音乐字段");
      const loaded = await loadConfig(exec.signal);
      const next = cloneJson(loaded.config);
      next.music = next.music ?? {};
      const allowed = ["title", "subtitle", "audioFile", "volume"];
      const changes = {};
      let source = loaded.text;
      for (const key of allowed) {
        if (!(key in args.music)) continue;
        if (key === "volume") {
          const volume = args.music.volume;
          if (typeof volume !== "number" || !Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error("volume 必须在 0 和 1 之间");
          next.music.volume = volume;
          changes.volume = volume;
          source = setField(source, "music", "volume", volume);
          continue;
        }
        if (key === "audioFile") {
          const audioFile = args.music.audioFile;
          if (typeof audioFile !== "string") throw new Error("audioFile 必须是字符串");
          const normalized = audioFile.trim() === "" ? "" : normalizeRelative(audioFile);
          if (normalized !== "") {
            if (!normalized.startsWith("assets/audio/")) throw new Error("音频必须放在 assets/audio/ 目录");
            if (!AUDIO_EXTENSIONS.has(extensionOf(normalized))) throw new Error("音频必须是 mp3/wav/ogg/m4a/aac/flac");
            if (!(await fileExists(normalized, exec.signal))) throw new Error(`音频文件不存在：${normalized}`);
          }
          next.music.audioFile = normalized;
          changes.audioFile = normalized;
          source = setField(source, "music", "audioFile", normalized);
          continue;
        }
        const value = cleanText(args.music[key], key, key === "subtitle" ? 120 : 80, true);
        next.music[key] = value;
        changes[key] = value;
        source = setField(source, "music", key, value);
      }
      if (Object.keys(changes).length === 0) throw new Error("没有可识别的音乐字段");
      validateConfig(evaluateConfig(source));
      return commitChange(exec, {
        action,
        relative: CONFIG_PATH,
        before: loaded.text,
        after: source,
        version: loaded.version,
        summary: `更新背景音乐：${Object.keys(changes).join(", ")}。`,
        preview: { changes, engine: next.music.audioFile ? "自定义音频" : "内置生成音乐盒" },
        details: { configPath: CONFIG_PATH, changes, usesBuiltInFallback: !next.music.audioFile }
      });
    }

    if (action === "add_love_note") {
      const loaded = await loadConfig(exec.signal);
      const next = cloneJson(loaded.config);
      const note = cleanText(args.note, "note", 280);
      const notes = Array.isArray(next.site.loveNotes) ? next.site.loveNotes.slice() : [];
      if (notes.includes(note)) throw new Error("这条情话已经存在");
      if (notes.length >= 100) throw new Error("情话最多 100 条");
      notes.push(note);
      next.site.loveNotes = notes;
      validateConfig(next);
      const source = setField(loaded.text, "site", "loveNotes", notes);
      validateConfig(evaluateConfig(source));
      return commitChange(exec, {
        action,
        relative: CONFIG_PATH,
        before: loaded.text,
        after: source,
        version: loaded.version,
        summary: `新增第 ${notes.length} 条情话。`,
        preview: { added: note, total: notes.length },
        details: { loveNotes: notes }
      });
    }

    if (action === "remove_love_note") {
      const loaded = await loadConfig(exec.signal);
      const next = cloneJson(loaded.config);
      const notes = Array.isArray(next.site.loveNotes) ? next.site.loveNotes.slice() : [];
      const index = args.index;
      if (!Number.isInteger(index) || index < 0 || index >= notes.length) throw new Error("index 超出情话范围");
      const [removed] = notes.splice(index, 1);
      next.site.loveNotes = notes;
      validateConfig(next);
      const source = setField(loaded.text, "site", "loveNotes", notes);
      validateConfig(evaluateConfig(source));
      return commitChange(exec, {
        action,
        relative: CONFIG_PATH,
        before: loaded.text,
        after: source,
        version: loaded.version,
        summary: `移除第 ${index + 1} 条情话「${removed}」。`,
        preview: { removed, index, total: notes.length },
        details: { loveNotes: notes }
      });
    }

    if (action === "set_easter_egg") {
      if (!isPlainObject(args.easterEgg) || Object.keys(args.easterEgg).length === 0) throw new Error("请提供 easterEgg 字段");
      const loaded = await loadConfig(exec.signal);
      const next = cloneJson(loaded.config);
      const current = isPlainObject(next.site.easterEgg) ? next.site.easterEgg : cloneJson(DEFAULT_EASTER_EGG);
      const merged = { ...DEFAULT_EASTER_EGG, ...current };
      if ("enabled" in args.easterEgg) {
        if (typeof args.easterEgg.enabled !== "boolean") throw new Error("easterEgg.enabled 必须是布尔值");
        merged.enabled = args.easterEgg.enabled;
      }
      if ("threshold" in args.easterEgg) {
        if (!Number.isInteger(args.easterEgg.threshold) || args.easterEgg.threshold < 3 || args.easterEgg.threshold > 20) {
          throw new Error("easterEgg.threshold 必须是 3 到 20 之间的整数");
        }
        merged.threshold = args.easterEgg.threshold;
      }
      for (const key of ["title", "intro", "signature"]) {
        if (key in args.easterEgg) merged[key] = cleanText(args.easterEgg[key], `easterEgg.${key}`, key === "intro" ? 1_200 : 160);
      }
      if ("coupons" in args.easterEgg) {
        if (!Array.isArray(args.easterEgg.coupons) || args.easterEgg.coupons.length > 6) throw new Error("coupons 必须是不超过 6 项的数组");
        merged.coupons = args.easterEgg.coupons.map((coupon, index) => {
          if (!isPlainObject(coupon)) throw new Error(`coupons[${index}] 必须是对象`);
          return {
            text: cleanText(coupon.text, `coupons[${index}].text`, 120),
            note: coupon.note === undefined ? "" : cleanText(coupon.note, `coupons[${index}].note`, 80, true)
          };
        });
      }
      validateEasterEgg(merged);
      next.site.easterEgg = merged;
      validateConfig(next);
      const source = setField(loaded.text, "site", "easterEgg", merged);
      validateConfig(evaluateConfig(source));
      return commitChange(exec, {
        action,
        relative: CONFIG_PATH,
        before: loaded.text,
        after: source,
        version: loaded.version,
        summary: `更新隐藏彩蛋：${merged.threshold} 连击，${merged.coupons.length} 张兑换券。`,
        preview: { easterEgg: merged },
        details: { easterEgg: merged }
      });
    }

    if (action === "replace_text") {
      const key = args.file;
      if (typeof key !== "string" || !(key in PAGE_FILES)) {
        throw new Error(`file 必须是以下键之一：${Object.keys(PAGE_FILES).join(", ")}`);
      }
      const relative = PAGE_FILES[key];
      const find = args.find;
      const replace = args.replace;
      if (typeof find !== "string" || find.length === 0) throw new Error("find 不能为空");
      if (typeof replace !== "string") throw new Error("replace 必须是字符串");
      if (find.length > 20_000 || replace.length > 60_000) throw new Error("替换文本过长");
      const file = await readWithVersion(relative, exec.signal);
      const occurrences = file.text.split(find).length - 1;
      if (occurrences === 0) throw new Error(`在 ${relative} 中没有找到要替换的原文`);
      if (!args.replaceAll && occurrences !== 1) {
        throw new Error(`原文在 ${relative} 中出现 ${occurrences} 次；请提供更精确的 find，或显式设置 replaceAll: true`);
      }
      const after = args.replaceAll ? file.text.split(find).join(replace) : file.text.replace(find, replace);
      if (relative.endsWith(".js")) {
        try {
          new vm.Script(after, { filename: relative });
        } catch (error) {
          throw new Error(`替换后 JavaScript 语法不通过：${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (relative === CONFIG_PATH) {
        validateConfig(evaluateConfig(after));
      }
      const contextStart = Math.max(0, file.text.indexOf(find) - 100);
      const contextEnd = Math.min(file.text.length, file.text.indexOf(find) + find.length + 100);
      return commitChange(exec, {
        action,
        relative,
        before: file.text,
        after,
        version: file.version,
        summary: `在 ${relative} 中替换 ${occurrences} 处文本。`,
        preview: {
          occurrences,
          replacedAll: Boolean(args.replaceAll),
          contextBefore: file.text.slice(contextStart, contextEnd),
          contextAfter: after.slice(contextStart, contextStart + (contextEnd - contextStart) + (replace.length - find.length))
        },
        details: { key, file: relative, occurrences }
      });
    }

    throw new Error(`未实现的 action: ${action}`);
  }

  const definition = {
    name: TOOL_NAME,
    description:
      "Inspect and safely maintain ONLY the local Dear, My Love Vite project. Read-only actions: status, audit, build_check, " +
      "mobile_audit, vite_check, theme_audit, deploy_check, read_config, list_photos, read_page. Configuration actions: " +
      "update_site, set_dates, update_music, add_love_note, remove_love_note, set_easter_egg. Photo-wall actions: add_photo, " +
      "update_photo, remove_photo, move_photo. Page action: replace_text with a controlled file key. Build actions: install_deps " +
      "and vite_build. Every mutation is preview-first: omit confirm to get a preview and write nothing; only after the user " +
      "explicitly approves, call again with confirm:true, which also triggers native DSH approval. Install/build only accepts " +
      "the reviewed Vite dependency and fixed package-manager commands. The tool never uploads, never publishes, and rejects " +
      "paths outside projectDir.",
    parameters: toolSchema(),
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          action: { type: "string" },
          status: { type: "string" },
          summary: { type: "string" },
          details: { type: "object", additionalProperties: true }
        },
        required: ["ok", "action", "status", "summary"]
      },
      render(_args, value) {
        const details = value.details === undefined ? "" : `\n\n${JSON.stringify(value.details, null, 2)}`;
        return [{ type: "text", text: `${value.summary}${details}` }];
      }
    },
    timeoutMs: 200_000,
    isConcurrencySafe(args) {
      return isPlainObject(args) && READ_ACTIONS.has(args.action);
    },
    presentCall(args) {
      const action = isPlainObject(args) ? String(args.action ?? "") : "";
      return {
        card: "generic",
        title: action ? `Dear My Love Builder · ${action}` : "Dear My Love Builder",
        kind: READ_ACTIONS.has(action) ? "read" : "edit",
        rawInput: args
      };
    },
    async execute(args, exec) {
      if (!isPlainObject(args)) throw new Error("参数必须是对象");
      return handle(exec, args);
    }
  };

  ctx.tools.register(definition);
}

export const inject = ["tools", "fs"];
