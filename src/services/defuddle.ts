import { request } from "undici";
import { parseHTML } from "linkedom";
import { Defuddle } from "defuddle/node";

interface ParseResult {
  title: string;
  content: string;
  description: string;
  domain: string;
  favicon: string;
  image: string;
  language: string;
  author: string;
  site: string;
  published: string;
  wordCount: number;
  parseTime: number;
}

export async function fetchAndParse(url: string): Promise<ParseResult> {
  const { statusCode, body } = await request(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DefuddleProxy/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (statusCode >= 400) {
    throw new Error(`Failed to fetch URL: HTTP ${statusCode}`);
  }

  const html = await body.text();

  const { document } = parseHTML(html);
  const result = await Defuddle(document, url, { markdown: true });

  return {
    title: result.title ?? "",
    content: result.content ?? "",
    description: result.description ?? "",
    domain: result.domain ?? "",
    favicon: result.favicon ?? "",
    image: result.image ?? "",
    language: result.language ?? "",
    author: result.author ?? "",
    site: result.site ?? "",
    published: result.published ?? "",
    wordCount: result.wordCount ?? 0,
    parseTime: result.parseTime ?? 0,
  };
}
