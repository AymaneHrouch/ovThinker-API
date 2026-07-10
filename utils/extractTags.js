const TAG_REGEX = /#([\p{L}\p{N}_]+)/gu;
const SANITIZE_REGEX = /[^\p{L}\p{N}_]/gu;

function extractTags(text) {
  const tags = new Set();
  for (const match of text.matchAll(TAG_REGEX)) tags.add(match[1].toLowerCase());
  return [...tags];
}

function sanitizeTags(rawTags) {
  const tags = new Set();
  for (const raw of rawTags) {
    const clean = String(raw).toLowerCase().replace(SANITIZE_REGEX, "");
    if (clean) tags.add(clean);
  }
  return [...tags];
}

module.exports = { extractTags, sanitizeTags };
