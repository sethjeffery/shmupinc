interface JsonParseError {
  column: number;
  line: number;
  message: string;
}

interface JsonParseResult {
  data?: unknown;
  error?: JsonParseError;
}

const getLineColumn = (
  text: string,
  position: number,
): { column: number; line: number } => {
  const slice = text.slice(0, position);
  const lastBreak = slice.lastIndexOf("\n");
  const column = position - (lastBreak >= 0 ? lastBreak : -1);
  const line = slice.split("\n").length;
  return { column, line };
};

import JSON5 from "json5";

export const parseJsonWithLocation = (text: string): JsonParseResult => {
  try {
    return { data: JSON5.parse(text) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    if (error && typeof error === "object") {
      const maybeLine = (error as { lineNumber?: number }).lineNumber;
      const maybeColumn = (error as { columnNumber?: number }).columnNumber;
      if (typeof maybeLine === "number" && typeof maybeColumn === "number") {
        return {
          error: {
            column: maybeColumn,
            line: maybeLine,
            message,
          },
        };
      }
    }
    const match = /position\s+(\d+)/i.exec(message);
    if (match) {
      const position = Number.parseInt(match[1], 10);
      const { column, line } = getLineColumn(text, position);
      return {
        error: {
          column,
          line,
          message,
        },
      };
    }
    return {
      error: {
        column: 0,
        line: 0,
        message,
      },
    };
  }
};
