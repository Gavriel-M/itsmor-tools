import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { findHexLiterals } from "./hex.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".html"]);
const HTML_ENTRIES = ["index.html", "convert/index.html"];

const sources = readdirSync(join(ROOT, "src"), { recursive: true })
  .filter((file) => SOURCE_EXTENSIONS.has(extname(file)))
  .map((file) => join("src", file));

const files = [...HTML_ENTRIES, ...sources];

const problems = files.flatMap((file) =>
  findHexLiterals(readFileSync(join(ROOT, file), "utf8")).map(
    ({ line, column, literal }) =>
      `${relative(".", join(ROOT, file))}:${line}:${column}  ${literal}`
  )
);

if (problems.length) {
  console.error("✗ token check failed\n");
  for (const p of problems) console.error("  " + p);
  console.error(
    "\n  Colours come from @itsmor/tokens: a Tailwind utility, var(--color-*), or PALETTE."
  );
  process.exit(1);
}

console.log("✓ tokens");
console.log(
  `  no hex colour literal in ${files.length} files under src/ or the HTML entries`
);
