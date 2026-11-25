import Module from "node:module";
import path from "node:path";

const srcRoot = path.resolve(__dirname, "..", "src");
const mod = Module as unknown as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean, options: unknown) => string;
};
const origResolveFilename = mod._resolveFilename;

mod._resolveFilename = function (request: string, parent: unknown, isMain: boolean, options: unknown): string {
  if (typeof request === "string" && request.startsWith("@/")) {
    const resolved = path.join(srcRoot, request.slice(2));
    return origResolveFilename.call(this, resolved, parent, isMain, options);
  }
  return origResolveFilename.call(this, request, parent, isMain, options);
};
