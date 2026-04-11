const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_CONFIG_PATH = path.join(__dirname, "pr-risk-layer-gate.config.json");
const DEFAULT_CONFIG = loadConfig(DEFAULT_CONFIG_PATH);

function loadConfig(configPath) {
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function parseArgs(argv) {
  const args = { requireBody: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--body-file") {
      args.bodyFile = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--body") {
      args.body = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--config") {
      args.config = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--event-file") {
      args.eventFile = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--require-body") {
      args.requireBody = true;
    }
  }
  return args;
}

function normalizeLine(line) {
  return line.trim();
}

function stripListPrefix(line) {
  return line
    .replace(/^[-*+]\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/^\[(?: |x|X)\]\s*/, "")
    .trim();
}

function isPlaceholderLine(line, config) {
  const normalized = stripListPrefix(normalizeLine(line));
  if (!normalized) return true;
  return (config.placeholderValues || []).includes(normalized);
}

function parseMarkdown(body) {
  const root = { heading: "__root__", level: 0, contentLines: [], children: [] };
  const stack = [root];
  const lines = body.split(/\r\n|\r|\n/);

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (match) {
      const level = match[1].length;
      const heading = match[2].trim();
      const section = { heading, level, contentLines: [], children: [] };
      while (stack.length && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      stack[stack.length - 1].children.push(section);
      stack.push(section);
      continue;
    }
    stack[stack.length - 1].contentLines.push(line);
  }

  return root;
}

function findSection(node, heading) {
  if (node.heading === heading) return node;
  for (const child of node.children || []) {
    const match = findSection(child, heading);
    if (match) return match;
  }
  return null;
}

function getMeaningfulLines(section, config) {
  return (section?.contentLines || [])
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isPlaceholderLine(line, config));
}

function countListItems(section, config) {
  return (section?.contentLines || [])
    .map((line) => line.trim())
    .filter((line) => /^[-*+]\s+/.test(line))
    .filter((line) => !isPlaceholderLine(line, config)).length;
}

function getCheckedLabels(section) {
  return (section?.contentLines || [])
    .map((line) => line.trim())
    .map((line) => line.match(/^[-*+]\s+\[(x|X)\]\s+(.+)$/))
    .filter(Boolean)
    .map((match) => match[2].trim());
}

function countCheckedItems(section) {
  return getCheckedLabels(section).length;
}

function validateRequiredSection(tree, requirement, config, errors) {
  const section = findSection(tree, requirement.heading);
  if (!section) {
    errors.push(`Missing required section: ${requirement.heading}`);
    return;
  }

  if (requirement.requiredStrings) {
    const joined = section.contentLines.join("\n");
    for (const expected of requirement.requiredStrings) {
      if (!joined.includes(expected)) {
        errors.push(`Section "${requirement.heading}" must include: ${expected}`);
      }
    }
  }

  if (requirement.requiredChildHeadings) {
    const childHeadings = new Set((section.children || []).map((child) => child.heading));
    for (const expected of requirement.requiredChildHeadings) {
      if (!childHeadings.has(expected)) {
        errors.push(`Section "${requirement.heading}" must include subsection: ${expected}`);
      }
    }
  }

  if (requirement.minContentLines) {
    const meaningfulLines = getMeaningfulLines(section, config);
    if (meaningfulLines.length < requirement.minContentLines) {
      errors.push(
        `Section "${requirement.heading}" must include at least ${requirement.minContentLines} non-placeholder line(s).`,
      );
    }
  }

  if (requirement.minListItems) {
    const listItems = countListItems(section, config);
    if (listItems < requirement.minListItems) {
      errors.push(
        `Section "${requirement.heading}" must include at least ${requirement.minListItems} list item(s).`,
      );
    }
  }

  if (requirement.minCheckedItems) {
    const checkedItems = countCheckedItems(section);
    if (checkedItems < requirement.minCheckedItems) {
      errors.push(
        `Section "${requirement.heading}" must include at least ${requirement.minCheckedItems} checked item(s).`,
      );
    }
  }

  if (requirement.requiredChildSections) {
    for (const childRequirement of requirement.requiredChildSections) {
      const childSection = (section.children || []).find((child) => child.heading === childRequirement.heading);
      if (!childSection) {
        errors.push(`Section "${requirement.heading}" must include subsection: ${childRequirement.heading}`);
        continue;
      }
      const syntheticTree = { heading: section.heading, children: [childSection] };
      validateRequiredSection(syntheticTree, childRequirement, config, errors);
    }
  }
}

function evaluatePrBody(body, config = DEFAULT_CONFIG) {
  const errors = [];
  const tree = parseMarkdown(body);

  for (const requirement of config.requiredSections || []) {
    validateRequiredSection(tree, requirement, config, errors);
  }

  for (const rule of config.conditionalSections || []) {
    const triggerSection = findSection(tree, rule.triggerHeading);
    if (!triggerSection) continue;
    const checkedLabels = getCheckedLabels(triggerSection);
    const triggered = checkedLabels.some((label) => rule.triggerLabels.includes(label));
    if (!triggered) continue;
    for (const requirement of rule.requiredSections || []) {
      validateRequiredSection(tree, requirement, config, errors);
    }
  }

  return { ok: errors.length === 0, errors };
}

function loadBodyFromFile(bodyFile) {
  return fs.readFileSync(bodyFile, "utf8");
}

function loadBodyFromEvent(eventFile) {
  const raw = fs.readFileSync(eventFile, "utf8");
  const payload = JSON.parse(raw);
  if (
    payload.pull_request &&
    Object.prototype.hasOwnProperty.call(payload.pull_request, "body")
  ) {
    return payload.pull_request.body ?? "";
  }
  if (payload.issue && Object.prototype.hasOwnProperty.call(payload.issue, "body")) {
    return payload.issue.body ?? "";
  }
  return null;
}

function loadEventPayload(eventFile) {
  if (!eventFile || !fs.existsSync(eventFile)) return null;
  return JSON.parse(fs.readFileSync(eventFile, "utf8"));
}

function getPullRequestContext({ args = {}, env = process.env, eventPayload = null } = {}) {
  const payload = eventPayload || loadEventPayload(args.eventFile || env.GITHUB_EVENT_PATH);
  const repo = env.GITHUB_REPOSITORY || payload?.repository?.full_name || null;
  const prNumber = payload?.pull_request?.number || payload?.issue?.number || null;
  return { repo, prNumber, eventPayload: payload };
}

async function loadBodyFromGitHubApi({ repo, prNumber, token, fetchImpl = global.fetch } = {}) {
  if (!repo || !prNumber || !token || typeof fetchImpl !== "function") {
    return null;
  }

  const response = await fetchImpl(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "vibeusage-pr-risk-layer-gate",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return Object.prototype.hasOwnProperty.call(payload, "body") ? (payload.body ?? "") : null;
}

async function resolveBody(args, options = {}) {
  const env = options.env || process.env;
  if (Object.prototype.hasOwnProperty.call(args, "body")) {
    return args.body;
  }
  if (args.bodyFile) {
    return loadBodyFromFile(args.bodyFile);
  }

  const eventFile = args.eventFile || env.GITHUB_EVENT_PATH;
  const { repo, prNumber, eventPayload } = getPullRequestContext({ args: { eventFile }, env });
  const diagnostics = options.diagnostics || [];

  if (repo && prNumber && env.GITHUB_TOKEN) {
    try {
      const liveBody = await loadBodyFromGitHubApi({
        repo,
        prNumber,
        token: env.GITHUB_TOKEN,
        fetchImpl: options.fetchImpl || global.fetch,
      });
      if (liveBody !== null && liveBody !== undefined) {
        diagnostics.push(`body_source=github-api repo=${repo} pr=${prNumber}`);
        return liveBody;
      }
    } catch (error) {
      diagnostics.push(`body_source=github-api-failed repo=${repo} pr=${prNumber} error=${error.message}`);
    }
  }

  if (eventPayload) {
    const body = loadBodyFromEvent(eventFile);
    if (body !== null && body !== undefined) {
      diagnostics.push(`body_source=event-payload${repo && prNumber ? ` repo=${repo} pr=${prNumber}` : ""}`);
      return body;
    }
  }

  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = args.config ? loadConfig(path.resolve(args.config)) : DEFAULT_CONFIG;
  const diagnostics = [];
  const body = await resolveBody(args, { diagnostics });

  diagnostics.forEach((line) => console.log(`[pr-risk-layer] ${line}`));

  if (body === null || body === undefined) {
    if (args.requireBody) {
      console.error("PR risk layer gate failed: no PR body source provided.");
      process.exit(1);
    }
    console.log("PR risk layer gate skipped: no PR body source provided.");
    return;
  }

  const result = evaluatePrBody(body, config);
  if (!result.ok) {
    console.error("PR risk layer gate failed:");
    result.errors.forEach((error) => {
      console.error(`- ${error}`);
    });
    process.exit(1);
  }

  console.log("PR risk layer gate ok.");
}

module.exports = {
  DEFAULT_CONFIG,
  evaluatePrBody,
  getPullRequestContext,
  loadBodyFromEvent,
  loadBodyFromGitHubApi,
  parseMarkdown,
  resolveBody,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`PR risk layer gate failed: ${error.message}`);
    process.exit(1);
  });
}
