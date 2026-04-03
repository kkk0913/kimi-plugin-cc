import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

/**
 * Load a prompt template from the prompts/ directory and interpolate variables.
 * Variables use {{varName}} syntax.
 */
export async function loadPrompt(name, vars = {}) {
  const path = resolve(PROMPTS_DIR, `${name}.md`);
  let content = await readFile(path, "utf-8");
  for (const [key, value] of Object.entries(vars)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }
  return content;
}
