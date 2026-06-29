import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.cpSync(path.join(root, "src", "index.js"), path.join(root, "dist", "index.js"));
console.log("Build OK → dist/index.js");
