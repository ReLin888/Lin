import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";

// See scripts/vite-build.mjs: sandboxed Windows cannot spawn Vite's optional
// `net use` probe. The probe only maps UNC drives and is safe to skip locally.
childProcess.exec = function sandboxSafeExec(_command, options, callback) {
  const done = typeof options === "function" ? options : callback;
  if (typeof done === "function") queueMicrotask(() => done(null, "", ""));
  return { on() {}, once() {}, kill() {} };
};
syncBuiltinESMExports();

const { createServer } = await import("vite");
const server = await createServer({
  server: {
    host: "127.0.0.1",
    port: 5173
  }
});
await server.listen();
server.printUrls();
