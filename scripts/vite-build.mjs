/**
 * Vite's Windows real-path probe shells out to `net use`. In a sandbox that
 * blocks child-process pipes this fails asynchronously after a successful
 * build and turns the process exit code into 1. The probe is only used to map
 * UNC drives; local paths are safe without it, so neutralize that one probe
 * before loading the Vite CLI.
 *
 * This keeps `vite build` working both in the Harness workspace sandbox and in
 * normal local/CI environments.
 */
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";

childProcess.exec = function sandboxSafeExec(_command, options, callback) {
  const done = typeof options === "function" ? options : callback;
  if (typeof done === "function") queueMicrotask(() => done(null, "", ""));
  return { on() {}, once() {}, kill() {} };
};
syncBuiltinESMExports();

const { build } = await import("vite");
await build();
