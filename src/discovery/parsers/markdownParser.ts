const MAX_DESCRIPTION_LENGTH = 150;
const HEADING_MARKER_REGEX = /^#+\s*/;

function truncate(text: string): string {
  if (text.length <= MAX_DESCRIPTION_LENGTH) {
    return text;
  }
  return `${text.substring(0, MAX_DESCRIPTION_LENGTH)}...`;
}

/**
 * Extracts a description from markdown content.
 * Uses the first heading or first paragraph, truncated to MAX_DESCRIPTION_LENGTH.
 */
export function extractDescription(content: string): string | undefined {
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      continue;
    }

    if (trimmed.startsWith("#")) {
      const heading = trimmed.replace(HEADING_MARKER_REGEX, "").trim();
      if (heading !== "") {
        return truncate(heading);
      }
      continue;
    }

    if (!trimmed.startsWith("```") && !trimmed.startsWith("---")) {
      return truncate(trimmed);
    }
  }

  return undefined;
}
