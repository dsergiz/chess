// Runs Ollama dev-review tasks against a local Ollama server and writes
// markdown reports.
//
// Modes:
//   node run.js                          full queue run (used by the nightly schedule)
//   node run.js --list                   show queued task ids/types
//   node run.js --task <id>               run one existing queued task right now
//   node run.js --target <path> --type <vulnerability-scan|dead-code|doc-drift> [--doc <file>] [--model <name>]
//                                         run an ad-hoc task, not saved to queue.json
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const QUEUE_PATH = path.join(__dirname, "queue.json");
const REPORTS_ROOT = path.join(ROOT, "reports", "ollama");

const SKIP_DIRS = new Set(["node_modules", ".next", "coverage", "playwright-report", "test-results", ".git"]);

const PROMPTS = {
  "vulnerability-scan": (filesBlock) => `You are a senior application security reviewer. Review the following source files from a Next.js chess analysis app for real security vulnerabilities: injection, unsafe eval/Function/child_process use, path traversal, XSS, SSRF, unsafe deserialization, exposed secrets or API keys, missing input validation on user-controlled data, insecure randomness, and prototype pollution.

For each finding: file path, function/line, severity (low/medium/high), one-sentence explanation. Skip style nits and anything not exploitable. If a file has no issues, do not mention it. If nothing in the batch has issues, reply exactly "No issues found." Be concise, no filler.

${filesBlock}`,

  "dead-code": (filesBlock) => `You are reviewing a TypeScript codebase for dead code. Identify exported functions, types, or files in this batch that look unused or unreachable based on what you can see (unusual names, exports never imported elsewhere in the batch, obvious leftovers).

List candidates as: file path — symbol — why it looks unused. Only list things you're reasonably confident about. If nothing stands out, reply exactly "No issues found." Be concise, no filler.

${filesBlock}`,

  "doc-drift": (filesBlock, docText) => `Compare the README below against the source files that follow. Flag claims in the README that no longer match the code (renamed features, removed scripts, wrong setup steps, described behavior that isn't implemented).

List each mismatch as: README claim — what the code actually does. If the README is accurate, reply exactly "No issues found." Be concise, no filler.

README:
${docText}

Source files:
${filesBlock}`,

  "improvement-suggestions": (filesBlock) => `You are a senior software engineer reviewing a Next.js chess analysis app for code health. Look past security (that's covered elsewhere) and focus on: error handling gaps, race conditions, performance issues (unnecessary re-renders, expensive work on the main thread, missing memoization/cleanup), maintainability (duplicated logic, overly complex functions, unclear state management), and missing test coverage for risky logic.

For each finding: file path, function/area, one-sentence description of the problem, one-sentence suggested improvement. Skip pure style nits. If a file has no issues, do not mention it. If nothing in the batch has issues, reply exactly "No issues found." Be concise, no filler.

${filesBlock}`,
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") args.list = true;
    else if (a === "--task") args.task = argv[++i];
    else if (a === "--target") args.target = argv[++i];
    else if (a === "--type") args.type = argv[++i];
    else if (a === "--doc") args.doc = argv[++i];
    else if (a === "--model") args.model = argv[++i];
  }
  return args;
}

function loadQueue() {
  return JSON.parse(fs.readFileSync(QUEUE_PATH, "utf8"));
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + "\n");
}

function walk(dirAbs, extensions, out) {
  let entries;
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = path.join(dirAbs, entry.name);
    if (entry.isDirectory()) {
      walk(abs, extensions, out);
    } else if (extensions.includes(path.extname(entry.name))) {
      out.push(abs);
    }
  }
  return out;
}

function batchFiles(files, maxChars) {
  const batches = [];
  let current = [];
  let currentSize = 0;
  for (const abs of files) {
    let content;
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
    const block = `\n// FILE: ${rel}\n${content}`;
    if (currentSize + block.length > maxChars && current.length > 0) {
      batches.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(block);
    currentSize += block.length;
  }
  if (current.length > 0) batches.push(current);
  return batches.map((blocks) => blocks.join("\n"));
}

async function callOllama(baseUrl, model, prompt, numCtx, numPredict) {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      think: false,
      options: { temperature: 0.1, num_ctx: numCtx, num_predict: numPredict },
    }),
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return (data.response || "").trim();
}

async function runTask(task, config, dateDir) {
  const targetAbs = path.join(ROOT, task.target);
  const files = walk(targetAbs, config.extensions, []);
  const batches = batchFiles(files, config.maxCharsPerBatch);

  const lines = [`# ${task.id}`, "", `Type: ${task.type}`, `Target: ${task.target}`, `Files: ${files.length}`, `Batches: ${batches.length}`, ""];

  if (files.length === 0) {
    lines.push("_No matching files found._");
  } else {
    let docText = "";
    if (task.type === "doc-drift" && task.docFile) {
      const docAbs = path.join(ROOT, task.docFile);
      docText = fs.existsSync(docAbs) ? fs.readFileSync(docAbs, "utf8") : "(doc file not found)";
    }

    for (let i = 0; i < batches.length; i++) {
      const promptFn = PROMPTS[task.type];
      if (!promptFn) throw new Error(`Unknown task type: ${task.type}`);
      const prompt = task.type === "doc-drift" ? promptFn(batches[i], docText) : promptFn(batches[i]);
      const model = task.model || config.defaultModel;
      const response = await callOllama(config.baseUrl, model, prompt, config.numCtx, config.numPredict);
      lines.push(`## Batch ${i + 1}/${batches.length}`, "", response, "");
    }
  }

  const reportPath = path.join(dateDir, `${task.id}.md`);
  fs.writeFileSync(reportPath, lines.join("\n") + "\n");
  return reportPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const queue = loadQueue();
  const { config } = queue;

  if (args.list) {
    console.log("Queued tasks:");
    for (const t of queue.tasks) {
      console.log(`  ${t.id}  [${t.type}]  target=${t.target}  priority=${t.priority}  enabled=${t.enabled !== false}`);
    }
    console.log(`\nAvailable types: ${Object.keys(PROMPTS).join(", ")}`);
    return;
  }

  try {
    const ping = await fetch(`${config.baseUrl.replace(/\/$/, "")}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!ping.ok) throw new Error(`HTTP ${ping.status}`);
  } catch (err) {
    console.error(`Ollama not reachable at ${config.baseUrl}: ${err.message}. Aborting run.`);
    process.exit(1);
  }

  let tasks;
  let singleMode = false;
  let mutateQueue = true;

  if (args.task) {
    const found = queue.tasks.find((t) => t.id === args.task);
    if (!found) {
      console.error(`No task with id "${args.task}" in queue.json. Use --list to see task ids.`);
      process.exit(1);
    }
    tasks = [found];
    singleMode = true;
  } else if (args.target) {
    if (!args.type || !PROMPTS[args.type]) {
      console.error(`--target requires --type <${Object.keys(PROMPTS).join("|")}>`);
      process.exit(1);
    }
    tasks = [
      {
        id: `adhoc-${args.type}-${Date.now()}`,
        type: args.type,
        target: args.target,
        docFile: args.doc,
        model: args.model,
        priority: 0,
      },
    ];
    singleMode = true;
    mutateQueue = false;
  } else {
    tasks = queue.tasks.filter((t) => t.enabled !== false).sort((a, b) => a.priority - b.priority);
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  const dateDir = path.join(REPORTS_ROOT, dateStamp);
  fs.mkdirSync(dateDir, { recursive: true });

  const budgetMs = singleMode ? Infinity : (config.budgetMinutes || 240) * 60 * 1000;
  const started = Date.now();
  const summary = [];

  for (const task of tasks) {
    if (Date.now() - started > budgetMs) {
      console.log(`Budget of ${config.budgetMinutes} min exhausted, skipping remaining tasks.`);
      summary.push(`- ${task.id}: skipped (budget exhausted)`);
      continue;
    }
    console.log(`Running ${task.id} (${task.type}, priority ${task.priority})...`);
    try {
      const reportPath = await runTask(task, config, dateDir);
      if (mutateQueue) task.lastRun = new Date().toISOString();
      summary.push(`- [${task.id}](./${path.basename(reportPath)})`);
      console.log(`  -> ${reportPath}`);
      if (singleMode) console.log(`\n${fs.readFileSync(reportPath, "utf8")}`);
    } catch (err) {
      console.error(`  Task ${task.id} failed: ${err.message}`);
      summary.push(`- ${task.id}: FAILED (${err.message})`);
    }
  }

  if (!singleMode) {
    fs.writeFileSync(
      path.join(dateDir, "SUMMARY.md"),
      [`# Ollama overnight run — ${dateStamp}`, "", ...summary, ""].join("\n")
    );
  }

  if (mutateQueue) saveQueue(queue);
  console.log(`Done. Reports in ${dateDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
