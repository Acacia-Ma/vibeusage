const fs = require("node:fs/promises");

async function isFile(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isFile();
  } catch (_err) {
    return false;
  }
}

async function isDir(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch (_err) {
    return false;
  }
}

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (String(left[i]) !== String(right[i])) return false;
  }
  return true;
}

function findIntegration(results, name) {
  return Array.isArray(results) ? results.find((entry) => entry?.name === name) || null : null;
}

module.exports = {
  isFile,
  isDir,
  arraysEqual,
  findIntegration,
};
