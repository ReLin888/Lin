import { createLogger, defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * The site is deliberately authored as classic, directly-openable HTML/CSS/JS.
 * Vite still owns the dev/build workflow; this small build-only plugin keeps
 * the original asset folder and Pages marker in dist so the classic scripts and
 * original image paths remain available after bundling.
 */
function preserveClassicAssets() {
  return {
    name: "dear-my-love-preserve-classic-assets",
    apply: "build",
    async closeBundle() {
      await mkdir(resolve(root, "dist/assets"), { recursive: true });
      await cp(resolve(root, "assets"), resolve(root, "dist/assets"), {
        recursive: true,
        force: true
      });
      await cp(resolve(root, ".nojekyll"), resolve(root, "dist/.nojekyll"), {
        force: true
      }).catch(() => {});
    }
  };
}

const logger = createLogger();
const baseWarn = logger.warn;
logger.warn = (message, options) => {
  // Classic scripts are intentionally preserved by preserveClassicAssets().
  // Vite's "can't be bundled without type=module" notice is expected here.
  if (typeof message === "string" && message.includes('can\'t be bundled without type="module"')) return;
  baseWarn(message, options);
};

export default defineConfig({
  base: "./",
  publicDir: false,
  customLogger: logger,
  plugins: [preserveClassicAssets()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        about: resolve(root, "about.html"),
        gallery: resolve(root, "gallery.html"),
        days: resolve(root, "days.html"),
        wishlist: resolve(root, "wishlist.html"),
        quiz: resolve(root, "quiz.html"),
        letter: resolve(root, "letter.html"),
        notFound: resolve(root, "404.html")
      }
    }
  }
});
