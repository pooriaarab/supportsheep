import type {
  FreeToolExecutor,
  FreeToolInput,
  FreeToolResult,
  FreeToolTemplate,
} from "./types";

function textValue(input: FreeToolInput, key: string): string {
  const value = input[key];
  return typeof value === "string" ? value : "";
}

function numberValue(
  input: FreeToolInput,
  key: string,
  fallback: number,
): number {
  const value = input[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(input: FreeToolInput, key: string): boolean {
  return input[key] === true;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function percentage(part: number, total: number): number {
  return total === 0 ? 0 : round((part / total) * 100);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function wordStats(text: string) {
  const words = text.trim().match(/\b[\w'-]+\b/g) ?? [];
  const sentences = text.trim().match(/[^.!?]+[.!?]+/g) ?? [];
  return {
    words: words.length,
    characters: text.length,
    charactersNoSpaces: text.replace(/\s/g, "").length,
    sentences: sentences.length || (text.trim() ? 1 : 0),
    readingTimeMinutes: Math.max(1, Math.ceil(words.length / 200)),
  };
}

function nonEmptyLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .flatMap((line) => {
      const trimmedLine = line.trim();
      return trimmedLine ? [trimmedLine] : [];
    });
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed.replace(/^\/+/, "")}`);
    } catch {
      return null;
    }
  }
}

function normalizePath(value: string, fallback = "/"): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function simpleHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

const wordCounter: FreeToolExecutor = async (input) => {
  const stats = wordStats(textValue(input, "text"));
  return {
    kind: "stats",
    summary: `${stats.words} words, ${stats.characters} characters, ${stats.readingTimeMinutes} min read`,
    metrics: stats,
  };
};

const metaTitleChecker: FreeToolExecutor = async (input) => {
  const title = textValue(input, "title").trim();
  const length = title.length;
  const status =
    length >= 30 && length <= 60 ? "Good length" : "Needs adjustment";
  return {
    kind: "stats",
    summary: `${status}: ${length} characters`,
    metrics: { characters: length, recommendedMin: 30, recommendedMax: 60 },
  };
};

const metaDescriptionChecker: FreeToolExecutor = async (input) => {
  const description = textValue(input, "description").trim();
  const length = description.length;
  const status =
    length >= 120 && length <= 160 ? "Good length" : "Needs adjustment";
  return {
    kind: "stats",
    summary: `${status}: ${length} characters`,
    metrics: { characters: length, recommendedMin: 120, recommendedMax: 160 },
  };
};

const slugGenerator: FreeToolExecutor = async (input) => {
  const slug = slugify(textValue(input, "text"));
  return {
    kind: "text",
    summary: slug ? `Generated slug: ${slug}` : "Enter text to generate a slug",
    text: slug,
  };
};

const utmGenerator: FreeToolExecutor = async (input) => {
  const baseUrl = textValue(input, "url").trim();
  let url: URL;
  try {
    url = new URL(baseUrl || "https://example.com/");
  } catch {
    return {
      kind: "text",
      summary: "Enter a valid http or https URL",
      text: "",
    };
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    return {
      kind: "text",
      summary: "Enter a valid http or https URL",
      text: "",
    };
  }
  for (const key of ["source", "medium", "campaign", "content", "term"]) {
    const value = textValue(input, key).trim();
    if (value) {
      url.searchParams.set(`utm_${key}`, value);
    }
  }
  return {
    kind: "text",
    summary: "Generated UTM URL",
    text: url.toString(),
  };
};

const faqSchemaGenerator: FreeToolExecutor = async (input) => {
  const pairs = textValue(input, "faqs")
    .split(/\n{2,}/)
    .flatMap((block) => {
      const lines = block.split("\n").flatMap((line) => {
        const trimmedLine = line.trim();
        return trimmedLine ? [trimmedLine] : [];
      });
      if (lines.length < 2) return [];
      const question = lines[0]!;
      const answer = lines.slice(1);
      return [
        {
          "@type": "Question",
          name: question.replace(/^q:\s*/i, ""),
          acceptedAnswer: {
            "@type": "Answer",
            text: answer.join(" ").replace(/^a:\s*/i, ""),
          },
        },
      ];
    });
  const json = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pairs,
  };
  return {
    kind: "json",
    summary: `Generated FAQ schema with ${pairs.length} questions`,
    json,
  };
};

const caseConverter: FreeToolExecutor = async (input) => {
  const text = textValue(input, "text");
  return {
    kind: "json",
    summary: "Converted text cases",
    json: {
      upper: text.toUpperCase(),
      lower: text.toLowerCase(),
      title: text.replace(
        /\w\S*/g,
        (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      ),
      slug: slugify(text),
    },
  };
};

function secureRandomIndex(maxExclusive: number): number {
  const crypto = globalThis.crypto;
  if (!crypto?.getRandomValues) {
    throw new Error("Secure random source unavailable");
  }

  const limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive;
  const values = new Uint32Array(1);
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= limit);
  return values[0] % maxExclusive;
}

const passwordGenerator: FreeToolExecutor = async (input) => {
  const length = Math.max(8, Math.min(64, numberValue(input, "length", 16)));
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars[secureRandomIndex(chars.length)];
  }
  return {
    kind: "text",
    summary: `Generated a ${length}-character password`,
    text: password,
  };
};

const timestampGenerator: FreeToolExecutor = async () => {
  const now = new Date();
  return {
    kind: "json",
    summary: "Generated current timestamp values",
    json: {
      iso: now.toISOString(),
      unixSeconds: Math.floor(now.getTime() / 1000),
      unixMilliseconds: now.getTime(),
    },
  };
};

function characterCounter(limit: number, label: string): FreeToolExecutor {
  return async (input) => {
    const text = textValue(input, "text");
    const remaining = limit - text.length;
    return {
      kind: "stats",
      summary: `${text.length}/${limit} characters for ${label}`,
      metrics: { characters: text.length, limit, remaining },
    };
  };
}

const characterCountTool: FreeToolExecutor = async (input) => {
  const text = textValue(input, "text");
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  return {
    kind: "stats",
    summary: `${text.length} characters, ${charactersNoSpaces} without spaces`,
    metrics: {
      characters: text.length,
      charactersNoSpaces,
      lines: text.length === 0 ? 0 : text.split(/\r?\n/).length,
    },
  };
};

const htmlViewer: FreeToolExecutor = async (input) => {
  const html = textValue(input, "html");
  const sanitized = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
  const stats = wordStats(stripHtmlTags(sanitized));
  return {
    kind: "json",
    summary: `Prepared safe HTML preview with ${stats.words} visible words`,
    json: {
      sanitizedHtml: sanitized.trim(),
      visibleText: stripHtmlTags(sanitized),
      words: stats.words,
      characters: sanitized.length,
    },
  };
};

const htmlMinifier: FreeToolExecutor = async (input) => {
  const html = textValue(input, "html")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
  return {
    kind: "text",
    summary: `Minified HTML to ${html.length} characters`,
    text: html,
  };
};

const htmlToImageGenerator: FreeToolExecutor = async (input) => {
  const rawWidth = numberValue(input, "width", 1200);
  const rawHeight = numberValue(input, "height", 630);
  const width = rawWidth > 0 ? clamp(rawWidth, 320, 2400) : 1200;
  const height = rawHeight > 0 ? clamp(rawHeight, 240, 2400) : 630;
  const html = textValue(input, "html")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${html}</div></foreignObject></svg>`;
  return {
    kind: "text",
    summary: `Generated SVG image wrapper at ${width}x${height}`,
    text: `${svg}\n\nData URI:\ndata:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
  };
};

const htmlLinkGenerator: FreeToolExecutor = async (input) => {
  const url = textValue(input, "url").trim();
  const label = textValue(input, "label").trim() || url;
  const newTab = booleanValue(input, "newTab");
  const rel = newTab ? ' target="_blank" rel="noopener noreferrer"' : "";
  return {
    kind: "text",
    summary: "Generated HTML anchor tag",
    text: `<a href="${escapeHtmlAttribute(url)}"${rel}>${escapeHtmlAttribute(label)}</a>`,
  };
};

const htmlLineCounter: FreeToolExecutor = async (input) => {
  const html = textValue(input, "html");
  const lines = html.length === 0 ? 0 : html.split(/\r?\n/).length;
  const tags = html.match(/<\/?[a-z][^>]*>/gi)?.length ?? 0;
  return {
    kind: "stats",
    summary: `${lines} lines and ${tags} HTML tags`,
    metrics: { lines, tags, characters: html.length },
  };
};

const htmlFormTagGenerator: FreeToolExecutor = async (input) => {
  const action = textValue(input, "action").trim() || "/";
  const method = textValue(input, "method").trim().toLowerCase() || "post";
  const fields = nonEmptyLines(textValue(input, "fields"));
  const fieldMarkup = fields
    .map((field) => {
      const name = slugify(field) || "field";
      return `  <label>\n    ${escapeHtmlAttribute(field)}\n    <input name="${name}" type="text" />\n  </label>`;
    })
    .join("\n");
  return {
    kind: "text",
    summary: `Generated form with ${fields.length} fields`,
    text: `<form action="${escapeHtmlAttribute(action)}" method="${method === "get" ? "get" : "post"}">\n${fieldMarkup}\n  <button type="submit">Submit</button>\n</form>`,
  };
};

const cssValidator: FreeToolExecutor = async (input) => {
  const css = textValue(input, "css");
  const openBraces = (css.match(/{/g) ?? []).length;
  const closeBraces = (css.match(/}/g) ?? []).length;
  const declarations = css
    .split(/[{}]/)
    .flatMap((segment, index) => {
      if (index % 2 !== 1) return [];
      return segment.split(";").flatMap((declaration) => {
        const trimmedDeclaration = declaration.trim();
        return trimmedDeclaration ? [trimmedDeclaration] : [];
      });
    });
  const missingColon = declarations.filter(
    (declaration) => !declaration.includes(":"),
  ).length;
  const issues = [
    ...(openBraces === closeBraces
      ? []
      : [`Brace mismatch: ${openBraces} opening, ${closeBraces} closing`]),
    ...(missingColon > 0
      ? [
          `${missingColon} declaration${missingColon === 1 ? "" : "s"} missing a colon`,
        ]
      : []),
  ];
  return {
    kind: "json",
    summary:
      issues.length === 0
        ? "No basic CSS issues found"
        : `${issues.length} CSS issue${issues.length === 1 ? "" : "s"} found`,
    json: {
      valid: issues.length === 0,
      issues,
      declarations: declarations.length,
    },
  };
};

const cssMinifier: FreeToolExecutor = async (input) => {
  const css = textValue(input, "css")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>+~])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
  return {
    kind: "text",
    summary: `Minified CSS to ${css.length} characters`,
    text: css,
  };
};

const cssOnlineEditor: FreeToolExecutor = async (input) => {
  const formatted = textValue(input, "css")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s*{\s*/g, " {\n  ")
    .replace(/;\s*/g, ";\n  ")
    .replace(/\s*}\s*/g, "\n}\n")
    .replace(/\n\s*\n/g, "\n")
    .trim();
  return {
    kind: "text",
    summary: "Formatted CSS for editing",
    text: formatted,
  };
};

function minifyJavaScriptSnippet(code: string): string {
  const compactCharacters = new Set("{}()[];,:=+-*/<>");
  let output = "";
  let quote: "'" | '"' | "`" | null = null;
  let pendingSpace = false;

  for (let index = 0; index < code.length; index++) {
    const current = code[index];
    const next = code[index + 1];

    if (quote) {
      output += current;
      if (current === "\\") {
        output += next ?? "";
        index += 1;
        continue;
      }
      if (current === quote) {
        quote = null;
      }
      continue;
    }

    if (current === '"' || current === "'" || current === "`") {
      if (
        pendingSpace &&
        output &&
        !compactCharacters.has(output.at(-1) ?? "")
      ) {
        output += " ";
      }
      pendingSpace = false;
      quote = current;
      output += current;
      continue;
    }

    if (current === "/" && next === "/") {
      while (index < code.length && !/[\r\n]/.test(code[index])) {
        index += 1;
      }
      pendingSpace = true;
      continue;
    }

    if (current === "/" && next === "*") {
      index += 2;
      while (
        index < code.length &&
        !(code[index] === "*" && code[index + 1] === "/")
      ) {
        index += 1;
      }
      index += 1;
      pendingSpace = true;
      continue;
    }

    if (/\s/.test(current)) {
      pendingSpace = true;
      continue;
    }

    if (compactCharacters.has(current)) {
      output = output.replace(/\s+$/, "");
      output += current;
      pendingSpace = false;
      continue;
    }

    if (pendingSpace && output && !compactCharacters.has(output.at(-1) ?? "")) {
      output += " ";
    }
    pendingSpace = false;
    output += current;
  }

  return output.trim();
}

const javascriptMinifier: FreeToolExecutor = async (input) => {
  const code = minifyJavaScriptSnippet(textValue(input, "code"));
  return {
    kind: "text",
    summary: `Minified JavaScript to ${code.length} characters`,
    text: code,
  };
};

const textDiffTool: FreeToolExecutor = async (input) => {
  const original = textValue(input, "original").split(/\r?\n/);
  const revised = textValue(input, "revised").split(/\r?\n/);
  const originalSet = new Set(original);
  const revisedSet = new Set(revised);
  const removed = original.filter((line) => !revisedSet.has(line));
  const added = revised.filter((line) => !originalSet.has(line));
  return {
    kind: "json",
    summary: `${added.length} added, ${removed.length} removed`,
    json: {
      added,
      removed,
      originalLines: original.length,
      revisedLines: revised.length,
    },
  };
};

const robotsTxtGenerator: FreeToolExecutor = async (input) => {
  const domain = normalizeUrl(textValue(input, "domain"));
  const base = domain
    ? `${domain.protocol}//${domain.host}`
    : "https://example.com";
  const disallow = nonEmptyLines(textValue(input, "disallow"));
  const sitemapPath = normalizePath(
    textValue(input, "sitemapPath"),
    "/sitemap.xml",
  );
  const crawlDelay = numberValue(input, "crawlDelay", 0);
  const lines = [
    "User-agent: *",
    ...(disallow.length > 0
      ? disallow.map((path) => `Disallow: ${normalizePath(path)}`)
      : ["Allow: /"]),
    ...(crawlDelay > 0 ? [`Crawl-delay: ${round(crawlDelay, 0)}`] : []),
    `Sitemap: ${base}${sitemapPath}`,
  ];
  return {
    kind: "text",
    summary: "Generated robots.txt",
    text: lines.join("\n"),
  };
};

const textAnalyzer: FreeToolExecutor = async (input) => {
  const text = textValue(input, "text");
  const stats = wordStats(text);
  const uniqueWords = new Set(
    (text.toLowerCase().match(/\b[\w'-]+\b/g) ?? []).map((word) => word.trim()),
  ).size;
  return {
    kind: "stats",
    summary: `${stats.words} words, ${uniqueWords} unique words`,
    metrics: {
      ...stats,
      uniqueWords,
      averageWordsPerSentence: round(
        stats.words / Math.max(1, stats.sentences),
      ),
    },
  };
};

const textReverser: FreeToolExecutor = async (input) => {
  const reversed = Array.from(textValue(input, "text")).reverse().join("");
  return {
    kind: "text",
    summary: "Reversed text",
    text: reversed,
  };
};

const urlDecoder: FreeToolExecutor = async (input) => {
  const text = textValue(input, "text");
  try {
    return {
      kind: "text",
      summary: "Decoded URL text",
      text: decodeURIComponent(text),
    };
  } catch {
    return {
      kind: "text",
      summary: "Input is not valid percent-encoded text",
      text,
    };
  }
};

const urlEncoder: FreeToolExecutor = async (input) => {
  const text = textValue(input, "text");
  return {
    kind: "text",
    summary: "Encoded URL text",
    text: encodeURIComponent(text),
  };
};

const utmUrlParser: FreeToolExecutor = async (input) => {
  const url = normalizeUrl(textValue(input, "url"));
  if (!url) {
    return {
      kind: "json",
      summary: "Enter a valid URL",
      json: {},
    };
  }

  const params = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ].reduce<Record<string, string>>((result, key) => {
    result[key] = url.searchParams.get(key) ?? "";
    return result;
  }, {});

  return {
    kind: "json",
    summary: params.utm_campaign
      ? `Parsed campaign ${params.utm_campaign}`
      : "Parsed UTM parameters",
    json: {
      url: `${url.protocol}//${url.host}${url.pathname}`,
      ...params,
    },
  };
};

function unitConverter(
  inputKey: string,
  outputKey: string,
  factor: number,
  inputLabel: string,
  outputLabel: string,
): FreeToolExecutor {
  return async (input) => {
    const source = numberValue(input, inputKey, 0);
    const converted = round(source * factor, 4);
    return {
      kind: "stats",
      summary: `${source} ${inputLabel} = ${converted} ${outputLabel}`,
      metrics: { [inputKey]: source, [outputKey]: converted },
    };
  };
}

const vwToPxConverter: FreeToolExecutor = async (input) => {
  const viewportWidth = numberValue(input, "viewportWidth", 1440);
  const vw = numberValue(input, "vw", 1);
  const pixels = round((viewportWidth * vw) / 100, 2);
  return {
    kind: "stats",
    summary: `${vw}vw equals ${pixels}px at ${viewportWidth}px viewport width`,
    metrics: { vw, viewportWidth, pixels },
  };
};

const pxToVhConverter: FreeToolExecutor = async (input) => {
  const viewportHeight = numberValue(input, "viewportHeight", 900);
  const pixels = numberValue(input, "pixels", 0);
  const vh = round((pixels / Math.max(1, viewportHeight)) * 100, 4);
  return {
    kind: "stats",
    summary: `${pixels}px equals ${vh}vh at ${viewportHeight}px viewport height`,
    metrics: { pixels, viewportHeight, vh },
  };
};

const gridCalculator: FreeToolExecutor = async (input) => {
  const containerWidth = numberValue(input, "containerWidth", 1200);
  const columns = Math.max(1, Math.round(numberValue(input, "columns", 12)));
  const gap = numberValue(input, "gap", 24);
  const columnWidth = round(
    (containerWidth - gap * (columns - 1)) / columns,
    2,
  );
  return {
    kind: "stats",
    summary: `${columns} columns at ${columnWidth}px each`,
    metrics: { containerWidth, columns, gap, columnWidth },
  };
};

const aspectRatioCalculator: FreeToolExecutor = async (input) => {
  const width = numberValue(input, "width", 0);
  const heightInput = numberValue(input, "height", 0);
  const ratioWidth = Math.max(1, numberValue(input, "ratioWidth", 16));
  const ratioHeight = Math.max(1, numberValue(input, "ratioHeight", 9));
  const height =
    heightInput > 0
      ? heightInput
      : round((width * ratioHeight) / ratioWidth, 2);
  const computedWidth =
    width > 0 ? width : round((height * ratioWidth) / ratioHeight, 2);
  return {
    kind: "stats",
    summary: `${computedWidth} x ${height} at ${ratioWidth}:${ratioHeight}`,
    metrics: {
      width: computedWidth,
      height,
      ratio: `${ratioWidth}:${ratioHeight}`,
    },
  };
};

const wholesalePriceCalculator: FreeToolExecutor = async (input) => {
  const retailPrice = numberValue(input, "retailPrice", 0);
  const discountPercent = numberValue(input, "discountPercent", 50);
  const wholesalePrice = round(retailPrice * (1 - discountPercent / 100), 2);
  return {
    kind: "stats",
    summary: `Wholesale price: ${wholesalePrice}`,
    metrics: { retailPrice, discountPercent, wholesalePrice },
  };
};

const shippingCostCalculator: FreeToolExecutor = async (input) => {
  const baseRate = numberValue(input, "baseRate", 0);
  const weight = numberValue(input, "weight", 0);
  const ratePerUnit = numberValue(input, "ratePerUnit", 0);
  const handlingFee = numberValue(input, "handlingFee", 0);
  const shippingCost = round(baseRate + weight * ratePerUnit + handlingFee, 2);
  return {
    kind: "stats",
    summary: `Estimated shipping cost: ${shippingCost}`,
    metrics: { baseRate, weight, ratePerUnit, handlingFee, shippingCost },
  };
};

const shippingLabelTemplateGenerator: FreeToolExecutor = async (input) => {
  const from = textValue(input, "from").trim() || "Sender name\nSender address";
  const to =
    textValue(input, "to").trim() || "Recipient name\nRecipient address";
  const order = textValue(input, "order").trim();
  return {
    kind: "text",
    summary: "Generated shipping label template",
    text: [`FROM:\n${from}`, `TO:\n${to}`, order ? `ORDER:\n${order}` : ""]
      .filter(Boolean)
      .join("\n\n"),
  };
};

const savingsCalculator: FreeToolExecutor = async (input) => {
  const currentCost = numberValue(input, "currentCost", 0);
  const newCost = numberValue(input, "newCost", 0);
  const periods = numberValue(input, "periods", 12);
  const perPeriodSavings = round(currentCost - newCost, 2);
  const totalSavings = round(perPeriodSavings * periods, 2);
  return {
    kind: "stats",
    summary: `Estimated savings: ${totalSavings}`,
    metrics: { perPeriodSavings, periods, totalSavings },
  };
};

const brandAwarenessCalculator: FreeToolExecutor = async (input) => {
  const impressions = numberValue(input, "impressions", 0);
  const reach = numberValue(input, "reach", 0);
  const mentions = numberValue(input, "mentions", 0);
  const engagementRate = percentage(mentions, Math.max(1, reach));
  const frequency = round(impressions / Math.max(1, reach), 2);
  return {
    kind: "stats",
    summary: `Reach frequency ${frequency}, mention rate ${engagementRate}%`,
    metrics: { impressions, reach, mentions, frequency, engagementRate },
  };
};

const youtubeEngagementCalculator: FreeToolExecutor = async (input) => {
  const views = numberValue(input, "views", 0);
  const likes = numberValue(input, "likes", 0);
  const comments = numberValue(input, "comments", 0);
  const shares = numberValue(input, "shares", 0);
  const engagementRate = percentage(
    likes + comments + shares,
    Math.max(1, views),
  );
  return {
    kind: "stats",
    summary: `YouTube engagement rate: ${engagementRate}%`,
    metrics: { views, likes, comments, shares, engagementRate },
  };
};

const instagramEngagementCalculator: FreeToolExecutor = async (input) => {
  const followers = numberValue(input, "followers", 0);
  const likes = numberValue(input, "likes", 0);
  const comments = numberValue(input, "comments", 0);
  const saves = numberValue(input, "saves", 0);
  const shares = numberValue(input, "shares", 0);
  const interactions = likes + comments + saves + shares;
  const engagementRate = percentage(interactions, Math.max(1, followers));
  return {
    kind: "stats",
    summary: `Instagram engagement rate: ${engagementRate}%`,
    metrics: {
      followers,
      interactions,
      likes,
      comments,
      saves,
      shares,
      engagementRate,
    },
  };
};

const tiktokEngagementCalculator: FreeToolExecutor = async (input) => {
  const views = numberValue(input, "views", 0);
  const likes = numberValue(input, "likes", 0);
  const comments = numberValue(input, "comments", 0);
  const shares = numberValue(input, "shares", 0);
  const saves = numberValue(input, "saves", 0);
  const interactions = likes + comments + shares + saves;
  const engagementRate = percentage(interactions, Math.max(1, views));
  return {
    kind: "stats",
    summary: `TikTok engagement rate: ${engagementRate}%`,
    metrics: {
      views,
      interactions,
      likes,
      comments,
      shares,
      saves,
      engagementRate,
    },
  };
};

const marketingMixCalculator: FreeToolExecutor = async (input) => {
  const search = numberValue(input, "search", 0);
  const social = numberValue(input, "social", 0);
  const email = numberValue(input, "email", 0);
  const content = numberValue(input, "content", 0);
  const total = search + social + email + content;
  return {
    kind: "json",
    summary: `Allocated ${total} total budget`,
    json: {
      total,
      searchPercent: percentage(search, total),
      socialPercent: percentage(social, total),
      emailPercent: percentage(email, total),
      contentPercent: percentage(content, total),
    },
  };
};

const conversionRateCalculator: FreeToolExecutor = async (input) => {
  const visitors = numberValue(input, "visitors", 0);
  const conversions = numberValue(input, "conversions", 0);
  const conversionRate = percentage(conversions, Math.max(1, visitors));
  return {
    kind: "stats",
    summary: `Conversion rate: ${conversionRate}%`,
    metrics: { visitors, conversions, conversionRate },
  };
};

const clickThroughRateCalculator: FreeToolExecutor = async (input) => {
  const impressions = numberValue(input, "impressions", 0);
  const clicks = numberValue(input, "clicks", 0);
  const clickThroughRate = percentage(clicks, Math.max(1, impressions));
  return {
    kind: "stats",
    summary: `Click-through rate: ${clickThroughRate}%`,
    metrics: { impressions, clicks, clickThroughRate },
  };
};

const cpmCalculator: FreeToolExecutor = async (input) => {
  const cost = numberValue(input, "cost", 0);
  const impressions = numberValue(input, "impressions", 0);
  const cpm = round((cost / Math.max(1, impressions)) * 1000, 2);
  return {
    kind: "stats",
    summary: `CPM: ${cpm}`,
    metrics: { cost, impressions, cpm },
  };
};

const cpcCalculator: FreeToolExecutor = async (input) => {
  const cost = numberValue(input, "cost", 0);
  const clicks = numberValue(input, "clicks", 0);
  const cpc = round(cost / Math.max(1, clicks), 2);
  return {
    kind: "stats",
    summary: `CPC: ${cpc}`,
    metrics: { cost, clicks, cpc },
  };
};

const emailOpenRateCalculator: FreeToolExecutor = async (input) => {
  const delivered = numberValue(input, "delivered", 0);
  const opens = numberValue(input, "opens", 0);
  const openRate = percentage(opens, Math.max(1, delivered));
  return {
    kind: "stats",
    summary: `Email open rate: ${openRate}%`,
    metrics: { delivered, opens, openRate },
  };
};

const emailClickThroughRateCalculator: FreeToolExecutor = async (input) => {
  const delivered = numberValue(input, "delivered", 0);
  const clicks = numberValue(input, "clicks", 0);
  const clickThroughRate = percentage(clicks, Math.max(1, delivered));
  return {
    kind: "stats",
    summary: `Email click-through rate: ${clickThroughRate}%`,
    metrics: { delivered, clicks, clickThroughRate },
  };
};

const investmentCalculator: FreeToolExecutor = async (input) => {
  const principal = numberValue(input, "principal", 0);
  const monthlyContribution = numberValue(input, "monthlyContribution", 0);
  const annualReturnPercent = numberValue(input, "annualReturnPercent", 5);
  const years = numberValue(input, "years", 10);
  const months = Math.max(0, Math.round(years * 12));
  const monthlyRate = annualReturnPercent / 100 / 12;
  let balance = principal;
  for (let month = 0; month < months; month++) {
    balance = balance * (1 + monthlyRate) + monthlyContribution;
  }
  return {
    kind: "stats",
    summary: `Projected balance: ${round(balance, 2)}`,
    metrics: {
      principal,
      monthlyContribution,
      years,
      projectedBalance: round(balance, 2),
      totalContributions: round(principal + monthlyContribution * months, 2),
    },
  };
};

const churnImpactCalculator: FreeToolExecutor = async (input) => {
  const customers = numberValue(input, "customers", 0);
  const monthlyChurnPercent = numberValue(input, "monthlyChurnPercent", 0);
  const averageRevenue = numberValue(input, "averageRevenue", 0);
  const churnedCustomers = round(customers * (monthlyChurnPercent / 100), 2);
  const monthlyRevenueLost = round(churnedCustomers * averageRevenue, 2);
  return {
    kind: "stats",
    summary: `Estimated monthly revenue lost: ${monthlyRevenueLost}`,
    metrics: {
      customers,
      monthlyChurnPercent,
      churnedCustomers,
      monthlyRevenueLost,
    },
  };
};

const leadScoringCalculator: FreeToolExecutor = async (input) => {
  const fit = clamp(numberValue(input, "fit", 0), 0, 100);
  const intent = clamp(numberValue(input, "intent", 0), 0, 100);
  const engagement = clamp(numberValue(input, "engagement", 0), 0, 100);
  const score = round(fit * 0.4 + intent * 0.35 + engagement * 0.25, 0);
  return {
    kind: "stats",
    summary: `Lead score: ${score}/100`,
    metrics: { fit, intent, engagement, score },
  };
};

const npsCalculator: FreeToolExecutor = async (input) => {
  const promoters = numberValue(input, "promoters", 0);
  const passives = numberValue(input, "passives", 0);
  const detractors = numberValue(input, "detractors", 0);
  const totalResponses = promoters + passives + detractors;
  const promoterPercent = percentage(promoters, totalResponses);
  const detractorPercent = percentage(detractors, totalResponses);
  const nps = round(promoterPercent - detractorPercent, 0);
  return {
    kind: "stats",
    summary: `NPS: ${nps}`,
    metrics: {
      promoters,
      passives,
      detractors,
      totalResponses,
      promoterPercent,
      detractorPercent,
      nps,
    },
  };
};

const marketCapCalculator: FreeToolExecutor = async (input) => {
  const sharePrice = numberValue(input, "sharePrice", 0);
  const sharesOutstanding = numberValue(input, "sharesOutstanding", 0);
  const marketCapitalization = round(sharePrice * sharesOutstanding, 2);
  return {
    kind: "stats",
    summary: `Market capitalization: ${marketCapitalization}`,
    metrics: { sharePrice, sharesOutstanding, marketCapitalization },
  };
};

const facebookAdsAudienceCalculator: FreeToolExecutor = async (input) => {
  const population = numberValue(input, "population", 0);
  const agePercent = numberValue(input, "agePercent", 100);
  const interestPercent = numberValue(input, "interestPercent", 20);
  const audienceSize = round(
    population * (agePercent / 100) * (interestPercent / 100),
    0,
  );
  return {
    kind: "stats",
    summary: `Estimated audience size: ${audienceSize}`,
    metrics: { population, agePercent, interestPercent, audienceSize },
  };
};

const facebookAdsReachCalculator: FreeToolExecutor = async (input) => {
  const budget = numberValue(input, "budget", 0);
  const cpm = Math.max(0.01, numberValue(input, "cpm", 10));
  const frequency = Math.max(1, numberValue(input, "frequency", 2));
  const impressions = round((budget / cpm) * 1000, 0);
  const reach = round(impressions / frequency, 0);
  return {
    kind: "stats",
    summary: `Estimated reach: ${reach}`,
    metrics: { budget, cpm, frequency, impressions, reach },
  };
};

const ariaLabelGenerator: FreeToolExecutor = async (input) => {
  const element = textValue(input, "element").trim() || "button";
  const action = textValue(input, "action").trim();
  const context = textValue(input, "context").trim();
  const label = [action, context].filter(Boolean).join(" ").trim() || element;
  return {
    kind: "text",
    summary: "Generated aria-label attribute",
    text: `<${element} aria-label="${escapeHtmlAttribute(label)}"></${element}>`,
  };
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace(/^#/, "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;
  if (!/^[\da-f]{6}$/i.test(full)) {
    return null;
  }
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((channel) =>
      clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"),
    )
    .join("")}`;
}

function mixRgb(
  color: { r: number; g: number; b: number },
  target: { r: number; g: number; b: number },
  weight: number,
): string {
  return rgbToHex(
    color.r + (target.r - color.r) * weight,
    color.g + (target.g - color.g) * weight,
    color.b + (target.b - color.b) * weight,
  );
}

const brandColorPaletteGenerator: FreeToolExecutor = async (input) => {
  const base = hexToRgb(textValue(input, "hex")) ?? { r: 37, g: 99, b: 235 };
  return {
    kind: "json",
    summary: "Generated brand color palette",
    json: {
      base: rgbToHex(base.r, base.g, base.b),
      light: mixRgb(base, { r: 255, g: 255, b: 255 }, 0.72),
      muted: mixRgb(base, { r: 128, g: 128, b: 128 }, 0.45),
      dark: mixRgb(base, { r: 0, g: 0, b: 0 }, 0.45),
      contrastText:
        base.r * 0.299 + base.g * 0.587 + base.b * 0.114 > 150
          ? "#111111"
          : "#ffffff",
    },
  };
};

const tailwindColorPaletteGenerator: FreeToolExecutor = async (input) => {
  const base = hexToRgb(textValue(input, "hex")) ?? { r: 37, g: 99, b: 235 };
  return {
    kind: "json",
    summary: "Generated Tailwind-style color steps",
    json: {
      50: mixRgb(base, { r: 255, g: 255, b: 255 }, 0.92),
      100: mixRgb(base, { r: 255, g: 255, b: 255 }, 0.84),
      200: mixRgb(base, { r: 255, g: 255, b: 255 }, 0.68),
      300: mixRgb(base, { r: 255, g: 255, b: 255 }, 0.52),
      400: mixRgb(base, { r: 255, g: 255, b: 255 }, 0.28),
      500: rgbToHex(base.r, base.g, base.b),
      600: mixRgb(base, { r: 0, g: 0, b: 0 }, 0.14),
      700: mixRgb(base, { r: 0, g: 0, b: 0 }, 0.28),
      800: mixRgb(base, { r: 0, g: 0, b: 0 }, 0.42),
      900: mixRgb(base, { r: 0, g: 0, b: 0 }, 0.56),
    },
  };
};

const barcodeSvgGenerator: FreeToolExecutor = async (input) => {
  const value = textValue(input, "value").trim() || "BLOGBAT";
  const hash = simpleHash(value);
  const bars = Array.from({ length: 42 }, (_, index) => {
    const bit = (hash >> (index % 24)) & 1;
    const width = bit ? 3 : 1;
    const x = 10 + index * 4;
    return `<rect x="${x}" y="10" width="${width}" height="72" />`;
  }).join("");
  return {
    kind: "text",
    summary: "Generated SVG barcode-style asset",
    text: `<svg xmlns="http://www.w3.org/2000/svg" width="190" height="110" viewBox="0 0 190 110" role="img" aria-label="Barcode for ${escapeHtmlAttribute(value)}"><rect width="190" height="110" fill="white" />${bars}<text x="95" y="100" text-anchor="middle" font-family="monospace" font-size="12">${escapeHtmlAttribute(value)}</text></svg>`,
  };
};

const keywordDensityChecker: FreeToolExecutor = async (input) => {
  const text = textValue(input, "text").toLowerCase();
  const keyword = textValue(input, "keyword").trim().toLowerCase();
  const words = text.match(/\b[\w'-]+\b/g) ?? [];
  const keywordWords = keyword.match(/\b[\w'-]+\b/g) ?? [];
  const occurrences =
    keywordWords.length === 0 ? 0 : text.split(keyword).length - 1;
  return {
    kind: "stats",
    summary: `${occurrences} occurrences, ${percentage(occurrences * Math.max(1, keywordWords.length), words.length)}% density`,
    metrics: {
      words: words.length,
      occurrences,
      densityPercent: percentage(
        occurrences * Math.max(1, keywordWords.length),
        words.length,
      ),
    },
  };
};

const readabilityChecker: FreeToolExecutor = async (input) => {
  const text = textValue(input, "text");
  const stats = wordStats(text);
  const syllables =
    (text.toLowerCase().match(/[aeiouy]+/g) ?? []).length || stats.words;
  const score = round(
    206.835 -
      1.015 * (stats.words / Math.max(1, stats.sentences)) -
      84.6 * (syllables / Math.max(1, stats.words)),
    1,
  );
  return {
    kind: "stats",
    summary: `Estimated readability score: ${score}`,
    metrics: { ...stats, syllables, fleschReadingEase: score },
  };
};

const jsonFormatter: FreeToolExecutor = async (input) => {
  const rawJson = textValue(input, "json");
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    return {
      kind: "text",
      summary: "Formatted JSON",
      text: JSON.stringify(parsed, null, 2),
    };
  } catch {
    return {
      kind: "text",
      summary: "Input is not valid JSON",
      text: rawJson,
    };
  }
};

const wordDensityCounter: FreeToolExecutor = async (input) => {
  const words = (
    textValue(input, "text")
      .toLowerCase()
      .match(/\b[\w'-]+\b/g) ?? []
  ).filter((word) => word.length > 2);
  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const terms = [...counts.entries()]
    .map(([word, count]) => ({
      word,
      count,
      densityPercent: percentage(count, words.length),
    }))
    .sort((first, second) => second.count - first.count)
    .slice(0, 10);

  return {
    kind: "json",
    summary: `Found ${terms.length} repeated terms`,
    json: { totalWords: words.length, terms },
  };
};

const titleCapitalizationTool: FreeToolExecutor = async (input) => {
  const minorWords = new Set([
    "a",
    "an",
    "and",
    "as",
    "at",
    "but",
    "by",
    "for",
    "in",
    "nor",
    "of",
    "on",
    "or",
    "per",
    "the",
    "to",
    "vs",
    "via",
  ]);
  const words = textValue(input, "title")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const title = words
    .map((word, index) => {
      if (index > 0 && index < words.length - 1 && minorWords.has(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");

  return {
    kind: "text",
    summary: "Converted title to title case",
    text: title,
  };
};

const sitemapUrlGenerator: FreeToolExecutor = async (input) => {
  const domain = normalizeUrl(textValue(input, "domain"));
  const base = domain
    ? `${domain.protocol}//${domain.host}`
    : "https://example.com";
  const paths = nonEmptyLines(textValue(input, "paths"));
  const urls = paths.map((path) => `${base}${normalizePath(path)}`);
  return {
    kind: "text",
    summary: `Generated ${urls.length} sitemap URLs`,
    text: urls.join("\n"),
  };
};

const canonicalTagGenerator: FreeToolExecutor = async (input) => {
  const url = textValue(input, "url").trim();
  return {
    kind: "text",
    summary: "Generated canonical tag",
    text: `<link rel="canonical" href="${escapeHtmlAttribute(url)}" />`,
  };
};

const openGraphTagGenerator: FreeToolExecutor = async (input) => {
  const title = textValue(input, "title").trim();
  const description = textValue(input, "description").trim();
  const url = textValue(input, "url").trim();
  const image = textValue(input, "image").trim();
  return {
    kind: "text",
    summary: "Generated Open Graph tags",
    text: [
      `<meta property="og:title" content="${escapeHtmlAttribute(title)}" />`,
      `<meta property="og:description" content="${escapeHtmlAttribute(description)}" />`,
      `<meta property="og:url" content="${escapeHtmlAttribute(url)}" />`,
      image
        ? `<meta property="og:image" content="${escapeHtmlAttribute(image)}" />`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
};

const profitMarginCalculator: FreeToolExecutor = async (input) => {
  const revenue = numberValue(input, "revenue", 0);
  const cost = numberValue(input, "cost", 0);
  const profit = round(revenue - cost, 2);
  return {
    kind: "stats",
    summary: `Profit margin: ${percentage(profit, revenue)}%`,
    metrics: {
      revenue,
      cost,
      profit,
      marginPercent: percentage(profit, revenue),
      markupPercent: percentage(profit, cost),
    },
  };
};

const roasCalculator: FreeToolExecutor = async (input) => {
  const revenue = numberValue(input, "revenue", 0);
  const adSpend = numberValue(input, "adSpend", 0);
  const roas = round(revenue / Math.max(0.01, adSpend), 2);
  return {
    kind: "stats",
    summary: `ROAS: ${roas}x`,
    metrics: { revenue, adSpend, roas },
  };
};

const cacCalculator: FreeToolExecutor = async (input) => {
  const salesMarketingSpend = numberValue(input, "salesMarketingSpend", 0);
  const newCustomers = numberValue(input, "newCustomers", 1);
  const cac = round(salesMarketingSpend / Math.max(1, newCustomers), 2);
  return {
    kind: "stats",
    summary: `Customer acquisition cost: ${cac}`,
    metrics: { salesMarketingSpend, newCustomers, cac },
  };
};

const ltvCalculator: FreeToolExecutor = async (input) => {
  const averageRevenue = numberValue(input, "averageRevenue", 0);
  const grossMarginPercent = numberValue(input, "grossMarginPercent", 80);
  const monthlyChurnPercent = Math.max(
    0.01,
    numberValue(input, "monthlyChurnPercent", 5),
  );
  const ltv = round(
    (averageRevenue * (grossMarginPercent / 100)) / (monthlyChurnPercent / 100),
    2,
  );
  return {
    kind: "stats",
    summary: `Estimated LTV: ${ltv}`,
    metrics: { averageRevenue, grossMarginPercent, monthlyChurnPercent, ltv },
  };
};

const breakEvenCalculator: FreeToolExecutor = async (input) => {
  const fixedCosts = numberValue(input, "fixedCosts", 0);
  const pricePerUnit = numberValue(input, "pricePerUnit", 0);
  const variableCostPerUnit = numberValue(input, "variableCostPerUnit", 0);
  const contributionMargin = pricePerUnit - variableCostPerUnit;
  const units =
    contributionMargin <= 0 ? 0 : Math.ceil(fixedCosts / contributionMargin);
  return {
    kind: "stats",
    summary: `Break-even units: ${units}`,
    metrics: {
      fixedCosts,
      pricePerUnit,
      variableCostPerUnit,
      contributionMargin,
      units,
    },
  };
};

const invoiceTotalCalculator: FreeToolExecutor = async (input) => {
  const subtotal = numberValue(input, "subtotal", 0);
  const taxPercent = numberValue(input, "taxPercent", 0);
  const discountPercent = numberValue(input, "discountPercent", 0);
  const discount = round(subtotal * (discountPercent / 100), 2);
  const taxable = subtotal - discount;
  const tax = round(taxable * (taxPercent / 100), 2);
  return {
    kind: "stats",
    summary: `Invoice total: ${round(taxable + tax, 2)}`,
    metrics: { subtotal, discount, tax, total: round(taxable + tax, 2) },
  };
};

const textAreaInput = (id = "text", label = "Text", maxLength = 10000) => ({
  id,
  label,
  type: "textarea" as const,
  required: true,
  maxLength,
});

const textInput = (
  id: string,
  label: string,
  placeholder?: string,
  required = true,
  maxLength = 500,
) => ({
  id,
  label,
  type: "text" as const,
  required,
  placeholder,
  maxLength,
});

const numberInput = (id: string, label: string, required = true) => ({
  id,
  label,
  type: "number" as const,
  required,
});

const deterministicTemplates: FreeToolTemplate[] = [
  {
    id: "word-counter",
    slug: "word-counter",
    title: "Word Counter",
    description: "Count words, characters, and sentences in any draft.",
    category: "utility",
    executionMode: "deterministic",
    family: "text_stats",
    inputs: [textAreaInput()],
    seo: {
      metaTitle: "Free Word Counter",
      metaDescription:
        "Count words and characters for blog posts, pages, and social copy.",
    },
    deterministicExecutor: wordCounter,
  },
  {
    id: "meta-title-checker",
    slug: "meta-title-checker",
    title: "Meta Title Checker",
    description:
      "Check whether a title fits common search result length guidance.",
    category: "seo",
    executionMode: "deterministic",
    family: "seo_checker",
    inputs: [textInput("title", "Meta title")],
    seo: {
      metaTitle: "Free Meta Title Checker",
      metaDescription:
        "Check title tag length and get a quick SEO fit summary.",
    },
    deterministicExecutor: metaTitleChecker,
  },
  {
    id: "meta-description-checker",
    slug: "meta-description-checker",
    title: "Meta Description Checker",
    description:
      "Check whether a meta description is a practical search snippet length.",
    category: "seo",
    executionMode: "deterministic",
    family: "seo_checker",
    inputs: [textAreaInput("description", "Meta description", 1000)],
    seo: {
      metaTitle: "Free Meta Description Checker",
      metaDescription: "Check meta description length before publishing.",
    },
    deterministicExecutor: metaDescriptionChecker,
  },
  {
    id: "slug-generator",
    slug: "slug-generator",
    title: "Slug Generator",
    description: "Turn titles and phrases into clean URL slugs.",
    category: "seo",
    executionMode: "deterministic",
    family: "url_utility",
    inputs: [textInput("text", "Title or phrase")],
    seo: {
      metaTitle: "Free URL Slug Generator",
      metaDescription:
        "Generate clean lowercase URL slugs from titles and phrases.",
    },
    deterministicExecutor: slugGenerator,
  },
  {
    id: "utm-generator",
    slug: "utm-generator",
    title: "UTM Generator",
    description: "Build campaign URLs with standard UTM parameters.",
    category: "utility",
    executionMode: "deterministic",
    family: "url_utility",
    inputs: [
      textInput("url", "Destination URL", "https://example.com/"),
      textInput("source", "Source"),
      textInput("medium", "Medium"),
      textInput("campaign", "Campaign"),
    ],
    seo: {
      metaTitle: "Free UTM Generator",
      metaDescription:
        "Create tagged campaign links with UTM source, medium, and campaign.",
    },
    deterministicExecutor: utmGenerator,
  },
  {
    id: "faq-schema-generator",
    slug: "faq-schema-generator",
    title: "FAQ Schema Generator",
    description: "Generate FAQPage JSON-LD from question and answer pairs.",
    category: "schema",
    executionMode: "deterministic",
    family: "schema",
    inputs: [textAreaInput("faqs", "FAQ pairs", 12000)],
    seo: {
      metaTitle: "Free FAQ Schema Generator",
      metaDescription:
        "Create FAQPage JSON-LD for search-friendly FAQ sections.",
    },
    deterministicExecutor: faqSchemaGenerator,
  },
  {
    id: "case-converter",
    slug: "case-converter",
    title: "Case Converter",
    description:
      "Convert text to uppercase, lowercase, title case, and slug case.",
    category: "utility",
    executionMode: "deterministic",
    family: "text_utility",
    inputs: [textAreaInput()],
    seo: {
      metaTitle: "Free Case Converter",
      metaDescription:
        "Convert text between common cases for writing and publishing.",
    },
    deterministicExecutor: caseConverter,
  },
  {
    id: "password-generator",
    slug: "password-generator",
    title: "Password Generator",
    description: "Generate a strong password locally without AI.",
    category: "utility",
    executionMode: "deterministic",
    family: "security_utility",
    inputs: [
      { id: "length", label: "Length", type: "number", required: false },
    ],
    seo: {
      metaTitle: "Free Password Generator",
      metaDescription: "Generate a strong random password with safe defaults.",
    },
    deterministicExecutor: passwordGenerator,
  },
  {
    id: "timestamp-generator",
    slug: "timestamp-generator",
    title: "Timestamp Generator",
    description:
      "Get current ISO, Unix seconds, and Unix milliseconds timestamps.",
    category: "utility",
    executionMode: "deterministic",
    family: "developer_utility",
    inputs: [],
    seo: {
      metaTitle: "Free Timestamp Generator",
      metaDescription: "Generate current ISO and Unix timestamps.",
    },
    deterministicExecutor: timestampGenerator,
  },
  {
    id: "twitter-character-counter",
    slug: "twitter-character-counter",
    title: "X Character Counter",
    description: "Count characters against a short social post limit.",
    category: "social",
    executionMode: "deterministic",
    family: "social_counter",
    inputs: [textAreaInput()],
    seo: {
      metaTitle: "Free X Character Counter",
      metaDescription: "Count characters for short posts before publishing.",
    },
    deterministicExecutor: characterCounter(280, "X"),
  },
  {
    id: "linkedin-character-counter",
    slug: "linkedin-character-counter",
    title: "LinkedIn Character Counter",
    description: "Count characters for LinkedIn posts.",
    category: "social",
    executionMode: "deterministic",
    family: "social_counter",
    inputs: [textAreaInput()],
    seo: {
      metaTitle: "Free LinkedIn Character Counter",
      metaDescription: "Count LinkedIn post characters and remaining space.",
    },
    deterministicExecutor: characterCounter(3000, "LinkedIn"),
  },
];

function deterministicTool(input: {
  id: string;
  title: string;
  description: string;
  category: FreeToolTemplate["category"];
  family: string;
  inputs: FreeToolTemplate["inputs"];
  deterministicExecutor: FreeToolExecutor;
  metaTitle?: string;
  metaDescription?: string;
}): FreeToolTemplate {
  return {
    id: input.id,
    slug: input.id,
    title: input.title,
    description: input.description,
    category: input.category,
    executionMode: "deterministic",
    family: input.family,
    inputs: input.inputs,
    seo: {
      metaTitle: input.metaTitle ?? `Free ${input.title}`,
      metaDescription: input.metaDescription ?? input.description,
    },
    deterministicExecutor: input.deterministicExecutor,
  };
}

const expandedDeterministicTemplates: FreeToolTemplate[] = [
  deterministicTool({
    id: "html-viewer",
    title: "HTML Viewer",
    description: "Preview safe HTML structure and visible text statistics.",
    category: "utility",
    family: "developer_utility",
    inputs: [textAreaInput("html", "HTML", 20000)],
    deterministicExecutor: htmlViewer,
    metaTitle: "Free HTML Viewer",
    metaDescription:
      "Inspect HTML, remove unsafe script content, and view visible text stats.",
  }),
  deterministicTool({
    id: "html-to-image-generator",
    title: "HTML to Image Generator",
    description:
      "Wrap HTML in an SVG image shell for quick social previews and mockups.",
    category: "utility",
    family: "developer_utility",
    inputs: [
      textAreaInput("html", "HTML", 20000),
      numberInput("width", "Image width", false),
      numberInput("height", "Image height", false),
    ],
    deterministicExecutor: htmlToImageGenerator,
  }),
  deterministicTool({
    id: "html-minifier",
    title: "HTML Minifier",
    description: "Remove comments and excess whitespace from HTML.",
    category: "utility",
    family: "developer_utility",
    inputs: [textAreaInput("html", "HTML", 20000)],
    deterministicExecutor: htmlMinifier,
  }),
  deterministicTool({
    id: "html-link-generator",
    title: "HTML Link Generator",
    description: "Create an accessible HTML anchor tag from a URL and label.",
    category: "utility",
    family: "developer_utility",
    inputs: [
      textInput("url", "URL", "https://example.com/"),
      textInput("label", "Link text"),
      {
        id: "newTab",
        label: "Open in a new tab",
        type: "checkbox",
        required: false,
      },
    ],
    deterministicExecutor: htmlLinkGenerator,
  }),
  deterministicTool({
    id: "html-line-counter",
    title: "HTML Line Counter",
    description: "Count HTML lines, tags, and characters.",
    category: "utility",
    family: "developer_utility",
    inputs: [textAreaInput("html", "HTML", 20000)],
    deterministicExecutor: htmlLineCounter,
  }),
  deterministicTool({
    id: "html-form-tag-generator",
    title: "HTML Form Tag Generator",
    description: "Generate a simple HTML form from field names.",
    category: "utility",
    family: "developer_utility",
    inputs: [
      textInput("action", "Form action", "/contact", false),
      textInput("method", "Method", "post", false),
      textAreaInput("fields", "Field labels, one per line", 4000),
    ],
    deterministicExecutor: htmlFormTagGenerator,
  }),
  deterministicTool({
    id: "aria-label-generator",
    title: "ARIA Label Generator",
    description: "Generate concise aria-label markup for buttons and controls.",
    category: "utility",
    family: "accessibility",
    inputs: [
      textInput("element", "Element", "button", false),
      textInput("action", "Action", "Open"),
      textInput("context", "Context", "navigation menu", false),
    ],
    deterministicExecutor: ariaLabelGenerator,
  }),
  deterministicTool({
    id: "css-validator",
    title: "CSS Validator",
    description: "Check CSS for basic brace and declaration issues.",
    category: "utility",
    family: "developer_utility",
    inputs: [textAreaInput("css", "CSS", 20000)],
    deterministicExecutor: cssValidator,
  }),
  deterministicTool({
    id: "css-online-editor",
    title: "CSS Online Editor",
    description: "Format CSS into an easier-to-edit block.",
    category: "utility",
    family: "developer_utility",
    inputs: [textAreaInput("css", "CSS", 20000)],
    deterministicExecutor: cssOnlineEditor,
  }),
  deterministicTool({
    id: "css-minifier",
    title: "CSS Minifier",
    description: "Remove comments and excess whitespace from CSS.",
    category: "utility",
    family: "developer_utility",
    inputs: [textAreaInput("css", "CSS", 20000)],
    deterministicExecutor: cssMinifier,
  }),
  deterministicTool({
    id: "javascript-minifier",
    title: "JavaScript Minifier",
    description: "Minify small JavaScript snippets for quick publishing tasks.",
    category: "utility",
    family: "developer_utility",
    inputs: [textAreaInput("code", "JavaScript", 20000)],
    deterministicExecutor: javascriptMinifier,
  }),
  deterministicTool({
    id: "text-diff-tool",
    title: "Text Diff Tool",
    description: "Compare two text blocks and list added or removed lines.",
    category: "utility",
    family: "text_utility",
    inputs: [
      textAreaInput("original", "Original text", 10000),
      textAreaInput("revised", "Revised text", 10000),
    ],
    deterministicExecutor: textDiffTool,
  }),
  deterministicTool({
    id: "robots-txt-generator",
    title: "Robots.txt Generator",
    description:
      "Generate a robots.txt file with disallow rules and a sitemap URL.",
    category: "seo",
    family: "seo_technical",
    inputs: [
      textInput("domain", "Domain", "https://example.com"),
      textAreaInput("disallow", "Disallow paths, one per line", 4000),
      textInput("sitemapPath", "Sitemap path", "/sitemap.xml", false),
      numberInput("crawlDelay", "Crawl delay seconds", false),
    ],
    deterministicExecutor: robotsTxtGenerator,
  }),
  deterministicTool({
    id: "character-count-tool",
    title: "Character Count Tool",
    description: "Count characters with and without spaces.",
    category: "utility",
    family: "text_stats",
    inputs: [textAreaInput()],
    deterministicExecutor: characterCountTool,
  }),
  deterministicTool({
    id: "text-analyzer",
    title: "Text Analyzer",
    description:
      "Analyze word count, sentence count, reading time, and unique words.",
    category: "writing",
    family: "text_stats",
    inputs: [textAreaInput()],
    deterministicExecutor: textAnalyzer,
  }),
  deterministicTool({
    id: "text-reverser",
    title: "Text Reverser",
    description: "Reverse text characters for quick transformations.",
    category: "utility",
    family: "text_utility",
    inputs: [textAreaInput()],
    deterministicExecutor: textReverser,
  }),
  deterministicTool({
    id: "url-decoder",
    title: "URL Decoder",
    description: "Decode percent-encoded URLs and query strings.",
    category: "utility",
    family: "url_utility",
    inputs: [textAreaInput()],
    deterministicExecutor: urlDecoder,
  }),
  deterministicTool({
    id: "url-encoder",
    title: "URL Encoder",
    description: "Percent-encode text for URLs and query strings.",
    category: "utility",
    family: "url_utility",
    inputs: [textAreaInput()],
    deterministicExecutor: urlEncoder,
  }),
  deterministicTool({
    id: "utm-url-parser",
    title: "UTM URL Parser",
    description: "Extract campaign UTM parameters from a tracked URL.",
    category: "seo",
    family: "seo_technical",
    inputs: [textInput("url", "URL", "https://example.com/?utm_source=blogbat")],
    deterministicExecutor: utmUrlParser,
  }),
  deterministicTool({
    id: "inch-to-cm-converter",
    title: "Inch to CM Converter",
    description: "Convert inches to centimeters.",
    category: "utility",
    family: "converter",
    inputs: [numberInput("inches", "Inches")],
    deterministicExecutor: unitConverter(
      "inches",
      "centimeters",
      2.54,
      "in",
      "cm",
    ),
  }),
  deterministicTool({
    id: "px-to-cm-converter",
    title: "PX to CM Converter",
    description: "Convert pixels to centimeters at 96 CSS pixels per inch.",
    category: "utility",
    family: "converter",
    inputs: [numberInput("pixels", "Pixels")],
    deterministicExecutor: unitConverter(
      "pixels",
      "centimeters",
      2.54 / 96,
      "px",
      "cm",
    ),
  }),
  deterministicTool({
    id: "vw-to-px-converter",
    title: "VW to PX Converter",
    description: "Convert viewport-width units to pixels for a given viewport.",
    category: "utility",
    family: "converter",
    inputs: [
      numberInput("vw", "VW"),
      numberInput("viewportWidth", "Viewport width"),
    ],
    deterministicExecutor: vwToPxConverter,
  }),
  deterministicTool({
    id: "px-to-vh-converter",
    title: "PX to VH Converter",
    description:
      "Convert pixels to viewport-height units for a given viewport.",
    category: "utility",
    family: "converter",
    inputs: [
      numberInput("pixels", "Pixels"),
      numberInput("viewportHeight", "Viewport height"),
    ],
    deterministicExecutor: pxToVhConverter,
  }),
  deterministicTool({
    id: "grid-calculator",
    title: "Grid Calculator",
    description:
      "Calculate column width from container width, columns, and gap.",
    category: "utility",
    family: "design_utility",
    inputs: [
      numberInput("containerWidth", "Container width"),
      numberInput("columns", "Columns"),
      numberInput("gap", "Gap"),
    ],
    deterministicExecutor: gridCalculator,
  }),
  deterministicTool({
    id: "aspect-ratio-calculator",
    title: "Aspect Ratio Calculator",
    description: "Calculate missing width or height from an aspect ratio.",
    category: "utility",
    family: "design_utility",
    inputs: [
      numberInput("width", "Width", false),
      numberInput("height", "Height", false),
      numberInput("ratioWidth", "Ratio width"),
      numberInput("ratioHeight", "Ratio height"),
    ],
    deterministicExecutor: aspectRatioCalculator,
  }),
  deterministicTool({
    id: "brand-color-palette-generator",
    title: "Brand Color Palette Generator",
    description: "Generate a practical brand color palette from one hex color.",
    category: "business",
    family: "design_utility",
    inputs: [textInput("hex", "Base hex color", "#2563eb")],
    deterministicExecutor: brandColorPaletteGenerator,
  }),
  deterministicTool({
    id: "tailwind-color-palette-generator",
    title: "Tailwind Color Palette Generator",
    description: "Generate Tailwind-style color steps from one hex color.",
    category: "utility",
    family: "design_utility",
    inputs: [textInput("hex", "Base hex color", "#2563eb")],
    deterministicExecutor: tailwindColorPaletteGenerator,
  }),
  deterministicTool({
    id: "barcode-generator",
    title: "Barcode Generator",
    description: "Generate a simple SVG barcode-style asset from text.",
    category: "utility",
    family: "generator",
    inputs: [textInput("value", "Barcode value", "BLOGBAT-12345")],
    deterministicExecutor: barcodeSvgGenerator,
  }),
  deterministicTool({
    id: "shipping-label-template-generator",
    title: "Shipping Label Template Generator",
    description: "Generate a plain-text shipping label template.",
    category: "business",
    family: "ecommerce",
    inputs: [
      textAreaInput("from", "From", 1000),
      textAreaInput("to", "To", 1000),
      textInput("order", "Order reference", "Order #1001", false),
    ],
    deterministicExecutor: shippingLabelTemplateGenerator,
  }),
  deterministicTool({
    id: "wholesale-price-calculator",
    title: "Wholesale Price Calculator",
    description: "Calculate a wholesale price from retail price and discount.",
    category: "business",
    family: "calculator",
    inputs: [
      numberInput("retailPrice", "Retail price"),
      numberInput("discountPercent", "Wholesale discount percent"),
    ],
    deterministicExecutor: wholesalePriceCalculator,
  }),
  deterministicTool({
    id: "shipping-cost-calculator",
    title: "Shipping Cost Calculator",
    description:
      "Estimate shipping from base rate, weight rate, and handling fee.",
    category: "business",
    family: "ecommerce",
    inputs: [
      numberInput("baseRate", "Base rate"),
      numberInput("weight", "Weight"),
      numberInput("ratePerUnit", "Rate per weight unit"),
      numberInput("handlingFee", "Handling fee", false),
    ],
    deterministicExecutor: shippingCostCalculator,
  }),
  deterministicTool({
    id: "savings-calculator",
    title: "Savings Calculator",
    description: "Calculate recurring savings across a number of periods.",
    category: "business",
    family: "calculator",
    inputs: [
      numberInput("currentCost", "Current cost"),
      numberInput("newCost", "New cost"),
      numberInput("periods", "Number of periods"),
    ],
    deterministicExecutor: savingsCalculator,
  }),
  deterministicTool({
    id: "brand-awareness-calculator",
    title: "Brand Awareness Calculator",
    description: "Estimate reach frequency and mention rate.",
    category: "business",
    family: "marketing_calculator",
    inputs: [
      numberInput("impressions", "Impressions"),
      numberInput("reach", "Reach"),
      numberInput("mentions", "Mentions"),
    ],
    deterministicExecutor: brandAwarenessCalculator,
  }),
  deterministicTool({
    id: "youtube-engagement-calculator",
    title: "YouTube Engagement Calculator",
    description: "Calculate video engagement rate from views and interactions.",
    category: "social",
    family: "social_calculator",
    inputs: [
      numberInput("views", "Views"),
      numberInput("likes", "Likes"),
      numberInput("comments", "Comments"),
      numberInput("shares", "Shares", false),
    ],
    deterministicExecutor: youtubeEngagementCalculator,
  }),
  deterministicTool({
    id: "instagram-engagement-calculator",
    title: "Instagram Engagement Calculator",
    description:
      "Calculate Instagram engagement rate from followers and interactions.",
    category: "social",
    family: "social_calculator",
    inputs: [
      numberInput("followers", "Followers"),
      numberInput("likes", "Likes"),
      numberInput("comments", "Comments"),
      numberInput("saves", "Saves", false),
      numberInput("shares", "Shares", false),
    ],
    deterministicExecutor: instagramEngagementCalculator,
  }),
  deterministicTool({
    id: "tiktok-engagement-calculator",
    title: "TikTok Engagement Calculator",
    description:
      "Calculate TikTok engagement rate from views and interactions.",
    category: "social",
    family: "social_calculator",
    inputs: [
      numberInput("views", "Views"),
      numberInput("likes", "Likes"),
      numberInput("comments", "Comments"),
      numberInput("shares", "Shares", false),
      numberInput("saves", "Saves", false),
    ],
    deterministicExecutor: tiktokEngagementCalculator,
  }),
  deterministicTool({
    id: "marketing-mix-calculator",
    title: "Marketing Mix Calculator",
    description: "Break down marketing budget percentages by channel.",
    category: "business",
    family: "marketing_calculator",
    inputs: [
      numberInput("search", "Search budget"),
      numberInput("social", "Social budget"),
      numberInput("email", "Email budget"),
      numberInput("content", "Content budget"),
    ],
    deterministicExecutor: marketingMixCalculator,
  }),
  deterministicTool({
    id: "conversion-rate-calculator",
    title: "Conversion Rate Calculator",
    description: "Calculate conversion rate from visitors and conversions.",
    category: "business",
    family: "marketing_calculator",
    inputs: [
      numberInput("visitors", "Visitors"),
      numberInput("conversions", "Conversions"),
    ],
    deterministicExecutor: conversionRateCalculator,
  }),
  deterministicTool({
    id: "click-through-rate-calculator",
    title: "Click Through Rate Calculator",
    description: "Calculate CTR from impressions and clicks.",
    category: "business",
    family: "marketing_calculator",
    inputs: [
      numberInput("impressions", "Impressions"),
      numberInput("clicks", "Clicks"),
    ],
    deterministicExecutor: clickThroughRateCalculator,
  }),
  deterministicTool({
    id: "cpm-calculator",
    title: "CPM Calculator",
    description:
      "Calculate cost per thousand impressions from spend and impressions.",
    category: "business",
    family: "marketing_calculator",
    inputs: [
      numberInput("cost", "Cost"),
      numberInput("impressions", "Impressions"),
    ],
    deterministicExecutor: cpmCalculator,
  }),
  deterministicTool({
    id: "cpc-calculator",
    title: "CPC Calculator",
    description: "Calculate cost per click from spend and clicks.",
    category: "business",
    family: "marketing_calculator",
    inputs: [numberInput("cost", "Cost"), numberInput("clicks", "Clicks")],
    deterministicExecutor: cpcCalculator,
  }),
  deterministicTool({
    id: "email-open-rate-calculator",
    title: "Email Open Rate Calculator",
    description: "Calculate email open rate from delivered emails and opens.",
    category: "business",
    family: "marketing_calculator",
    inputs: [
      numberInput("delivered", "Delivered emails"),
      numberInput("opens", "Opens"),
    ],
    deterministicExecutor: emailOpenRateCalculator,
  }),
  deterministicTool({
    id: "email-click-through-rate-calculator",
    title: "Email Click Through Rate Calculator",
    description: "Calculate email CTR from delivered emails and clicks.",
    category: "business",
    family: "marketing_calculator",
    inputs: [
      numberInput("delivered", "Delivered emails"),
      numberInput("clicks", "Clicks"),
    ],
    deterministicExecutor: emailClickThroughRateCalculator,
  }),
  deterministicTool({
    id: "investment-calculator",
    title: "Investment Calculator",
    description: "Project an investment balance from contributions and return.",
    category: "business",
    family: "calculator",
    inputs: [
      numberInput("principal", "Initial principal"),
      numberInput("monthlyContribution", "Monthly contribution"),
      numberInput("annualReturnPercent", "Annual return percent"),
      numberInput("years", "Years"),
    ],
    deterministicExecutor: investmentCalculator,
  }),
  deterministicTool({
    id: "customer-churn-impact-calculator",
    title: "Customer Churn Impact Calculator",
    description: "Estimate customer churn and recurring revenue lost.",
    category: "business",
    family: "calculator",
    inputs: [
      numberInput("customers", "Current customers"),
      numberInput("monthlyChurnPercent", "Monthly churn percent"),
      numberInput("averageRevenue", "Average monthly revenue per customer"),
    ],
    deterministicExecutor: churnImpactCalculator,
  }),
  deterministicTool({
    id: "lead-scoring-calculator",
    title: "Lead Scoring Calculator",
    description: "Score a lead from fit, intent, and engagement.",
    category: "business",
    family: "marketing_calculator",
    inputs: [
      numberInput("fit", "Fit score 0-100"),
      numberInput("intent", "Intent score 0-100"),
      numberInput("engagement", "Engagement score 0-100"),
    ],
    deterministicExecutor: leadScoringCalculator,
  }),
  deterministicTool({
    id: "nps-calculator",
    title: "Net Promoter Score Calculator",
    description: "Calculate NPS from promoter, passive, and detractor counts.",
    category: "business",
    family: "calculator",
    inputs: [
      numberInput("promoters", "Promoters"),
      numberInput("passives", "Passives"),
      numberInput("detractors", "Detractors"),
    ],
    deterministicExecutor: npsCalculator,
  }),
  deterministicTool({
    id: "market-capitalization-calculator",
    title: "Market Capitalization Calculator",
    description:
      "Calculate market capitalization from share price and shares outstanding.",
    category: "business",
    family: "calculator",
    inputs: [
      numberInput("sharePrice", "Share price"),
      numberInput("sharesOutstanding", "Shares outstanding"),
    ],
    deterministicExecutor: marketCapCalculator,
  }),
  deterministicTool({
    id: "facebook-ads-audience-calculator",
    title: "Facebook Ads Audience Calculator",
    description:
      "Estimate an ad audience size from population and targeting percentages.",
    category: "social",
    family: "social_calculator",
    inputs: [
      numberInput("population", "Base population"),
      numberInput("agePercent", "Age or location match percent"),
      numberInput("interestPercent", "Interest match percent"),
    ],
    deterministicExecutor: facebookAdsAudienceCalculator,
  }),
  deterministicTool({
    id: "facebook-ads-reach-calculator",
    title: "Facebook Ads Reach Calculator",
    description:
      "Estimate impressions and reach from budget, CPM, and frequency.",
    category: "social",
    family: "social_calculator",
    inputs: [
      numberInput("budget", "Budget"),
      numberInput("cpm", "CPM"),
      numberInput("frequency", "Average frequency"),
    ],
    deterministicExecutor: facebookAdsReachCalculator,
  }),
  deterministicTool({
    id: "keyword-density-checker",
    title: "Keyword Density Checker",
    description: "Check keyword occurrences and density in a draft.",
    category: "seo",
    family: "seo_checker",
    inputs: [
      textInput("keyword", "Keyword"),
      textAreaInput("text", "Text", 20000),
    ],
    deterministicExecutor: keywordDensityChecker,
  }),
  deterministicTool({
    id: "readability-checker",
    title: "Readability Checker",
    description:
      "Estimate readability from sentence length and syllable density.",
    category: "writing",
    family: "text_stats",
    inputs: [textAreaInput("text", "Text", 20000)],
    deterministicExecutor: readabilityChecker,
  }),
  deterministicTool({
    id: "json-formatter",
    title: "JSON Formatter",
    description: "Format and validate JSON for readable debugging.",
    category: "utility",
    family: "developer_utility",
    inputs: [textAreaInput("json", "JSON", 20000)],
    deterministicExecutor: jsonFormatter,
  }),
  deterministicTool({
    id: "word-density-counter",
    title: "Word Density Counter",
    description:
      "Find the most repeated words and density percentages in a draft.",
    category: "writing",
    family: "text_stats",
    inputs: [textAreaInput("text", "Text", 20000)],
    deterministicExecutor: wordDensityCounter,
  }),
  deterministicTool({
    id: "title-capitalization-tool",
    title: "Title Capitalization Tool",
    description: "Convert headlines and page titles to title case.",
    category: "writing",
    family: "writing_utility",
    inputs: [textInput("title", "Title", "how to build a better homepage")],
    deterministicExecutor: titleCapitalizationTool,
  }),
  deterministicTool({
    id: "sitemap-url-generator",
    title: "Sitemap URL Generator",
    description: "Turn paths into absolute sitemap URLs.",
    category: "seo",
    family: "seo_technical",
    inputs: [
      textInput("domain", "Domain", "https://example.com"),
      textAreaInput("paths", "Paths, one per line", 10000),
    ],
    deterministicExecutor: sitemapUrlGenerator,
  }),
  deterministicTool({
    id: "canonical-tag-generator",
    title: "Canonical Tag Generator",
    description: "Generate an HTML canonical link tag.",
    category: "seo",
    family: "seo_technical",
    inputs: [textInput("url", "Canonical URL", "https://example.com/page")],
    deterministicExecutor: canonicalTagGenerator,
  }),
  deterministicTool({
    id: "open-graph-tag-generator",
    title: "Open Graph Tag Generator",
    description: "Generate Open Graph meta tags for social sharing.",
    category: "seo",
    family: "seo_technical",
    inputs: [
      textInput("title", "Title"),
      textAreaInput("description", "Description", 1000),
      textInput("url", "URL", "https://example.com/page"),
      textInput("image", "Image URL", "https://example.com/image.jpg", false),
    ],
    deterministicExecutor: openGraphTagGenerator,
  }),
  deterministicTool({
    id: "profit-margin-calculator",
    title: "Profit Margin Calculator",
    description: "Calculate profit, margin, and markup from revenue and cost.",
    category: "business",
    family: "calculator",
    inputs: [numberInput("revenue", "Revenue"), numberInput("cost", "Cost")],
    deterministicExecutor: profitMarginCalculator,
  }),
  deterministicTool({
    id: "roas-calculator",
    title: "ROAS Calculator",
    description: "Calculate return on ad spend from revenue and ad spend.",
    category: "business",
    family: "marketing_calculator",
    inputs: [
      numberInput("revenue", "Revenue"),
      numberInput("adSpend", "Ad spend"),
    ],
    deterministicExecutor: roasCalculator,
  }),
  deterministicTool({
    id: "cac-calculator",
    title: "CAC Calculator",
    description: "Calculate customer acquisition cost.",
    category: "business",
    family: "marketing_calculator",
    inputs: [
      numberInput("salesMarketingSpend", "Sales and marketing spend"),
      numberInput("newCustomers", "New customers"),
    ],
    deterministicExecutor: cacCalculator,
  }),
  deterministicTool({
    id: "ltv-calculator",
    title: "LTV Calculator",
    description:
      "Estimate customer lifetime value from revenue, margin, and churn.",
    category: "business",
    family: "calculator",
    inputs: [
      numberInput("averageRevenue", "Average monthly revenue"),
      numberInput("grossMarginPercent", "Gross margin percent"),
      numberInput("monthlyChurnPercent", "Monthly churn percent"),
    ],
    deterministicExecutor: ltvCalculator,
  }),
  deterministicTool({
    id: "break-even-calculator",
    title: "Break Even Calculator",
    description:
      "Calculate break-even unit volume from fixed and variable costs.",
    category: "business",
    family: "calculator",
    inputs: [
      numberInput("fixedCosts", "Fixed costs"),
      numberInput("pricePerUnit", "Price per unit"),
      numberInput("variableCostPerUnit", "Variable cost per unit"),
    ],
    deterministicExecutor: breakEvenCalculator,
  }),
  deterministicTool({
    id: "invoice-total-calculator",
    title: "Invoice Total Calculator",
    description: "Calculate invoice total after discount and tax.",
    category: "business",
    family: "calculator",
    inputs: [
      numberInput("subtotal", "Subtotal"),
      numberInput("discountPercent", "Discount percent", false),
      numberInput("taxPercent", "Tax percent", false),
    ],
    deterministicExecutor: invoiceTotalCalculator,
  }),
];

const aiCatalog = [
  [
    "blog-post-generator",
    "Blog Post Generator",
    "Draft a search-focused blog post from a topic.",
    "writing",
    "blog_post",
  ],
  [
    "blog-post-ideas-generator",
    "Blog Post Ideas Generator",
    "Generate blog post ideas from a business topic or keyword.",
    "writing",
    "ideation",
  ],
  [
    "blog-outline-generator",
    "Blog Outline Generator",
    "Create a practical blog outline from a keyword.",
    "writing",
    "outline",
  ],
  [
    "seo-title-generator",
    "SEO Title Generator",
    "Generate title tag ideas for a page or article.",
    "seo",
    "seo_copy",
  ],
  [
    "meta-description-generator",
    "Meta Description Generator",
    "Generate concise meta description options.",
    "seo",
    "seo_copy",
  ],
  [
    "faq-generator",
    "FAQ Generator",
    "Generate helpful FAQs for a topic or page.",
    "writing",
    "faq",
  ],
  [
    "summary-generator",
    "Summary Generator",
    "Summarize long content into a concise answer.",
    "writing",
    "summary",
  ],
  [
    "prompt-generator",
    "Prompt Generator",
    "Create a structured prompt for a content task.",
    "writing",
    "prompt",
  ],
  [
    "linkedin-post-generator",
    "LinkedIn Post Generator",
    "Turn an idea into a LinkedIn post.",
    "social",
    "social_post",
  ],
  [
    "twitter-post-generator",
    "X Post Generator",
    "Draft concise posts for X.",
    "social",
    "social_post",
  ],
  [
    "instagram-caption-generator",
    "Instagram Caption Generator",
    "Write caption options for Instagram.",
    "social",
    "caption",
  ],
  [
    "facebook-post-generator",
    "Facebook Post Generator",
    "Draft a Facebook post for a topic.",
    "social",
    "social_post",
  ],
  [
    "youtube-description-generator",
    "YouTube Description Generator",
    "Create a YouTube video description.",
    "social",
    "caption",
  ],
  [
    "tiktok-caption-generator",
    "TikTok Caption Generator",
    "Write short TikTok caption options.",
    "social",
    "caption",
  ],
  [
    "homepage-copy-generator",
    "Homepage Copy Generator",
    "Draft homepage copy for a business.",
    "business",
    "website_copy",
  ],
  [
    "landing-page-copy-generator",
    "Landing Page Copy Generator",
    "Draft conversion-focused landing page copy.",
    "business",
    "website_copy",
  ],
  [
    "about-us-generator",
    "About Us Generator",
    "Draft an about page for a small business.",
    "business",
    "business_copy",
  ],
  [
    "product-description-generator",
    "Product Description Generator",
    "Write product descriptions from key details.",
    "business",
    "business_copy",
  ],
  [
    "service-description-generator",
    "Service Description Generator",
    "Write service descriptions for a website.",
    "business",
    "business_copy",
  ],
  [
    "value-proposition-generator",
    "Value Proposition Generator",
    "Generate positioning statements for an offer.",
    "business",
    "business_copy",
  ],
  [
    "call-to-action-generator",
    "Call To Action Generator",
    "Generate CTA copy for pages and campaigns.",
    "business",
    "business_copy",
  ],
  [
    "email-subject-generator",
    "Email Subject Generator",
    "Generate subject line options.",
    "business",
    "business_copy",
  ],
  [
    "newsletter-generator",
    "Newsletter Generator",
    "Draft a short newsletter from notes.",
    "writing",
    "newsletter",
  ],
  [
    "press-release-generator",
    "Press Release Generator",
    "Draft a basic press release.",
    "business",
    "business_copy",
  ],
  [
    "ad-copy-generator",
    "Ad Copy Generator",
    "Generate ad copy variants.",
    "business",
    "business_copy",
  ],
  [
    "google-ads-headline-generator",
    "Google Ads Headline Generator",
    "Generate short search ad headlines.",
    "business",
    "business_copy",
  ],
  [
    "facebook-ad-copy-generator",
    "Facebook Ad Copy Generator",
    "Generate Facebook ad copy options.",
    "business",
    "business_copy",
  ],
  [
    "pain-point-generator",
    "Pain Point Generator",
    "Find audience pain points for positioning.",
    "business",
    "strategy",
  ],
  [
    "persona-generator",
    "Persona Generator",
    "Generate a lightweight buyer persona.",
    "business",
    "strategy",
  ],
  [
    "keyword-ideas-generator",
    "Keyword Ideas Generator",
    "Generate keyword ideas for a topic.",
    "seo",
    "seo_research",
  ],
  [
    "long-tail-keyword-generator",
    "Long-Tail Keyword Generator",
    "Generate long-tail keyword variations.",
    "seo",
    "seo_research",
  ],
  [
    "content-brief-generator",
    "Content Brief Generator",
    "Create a content brief from a keyword.",
    "seo",
    "content_brief",
  ],
  [
    "people-also-ask-generator",
    "People Also Ask Generator",
    "Generate likely PAA-style questions.",
    "seo",
    "aeo",
  ],
  [
    "answer-engine-optimizer",
    "Answer Engine Optimizer",
    "Rewrite content for direct answer extraction.",
    "aeo_geo",
    "aeo",
  ],
  [
    "ai-overview-snippet-generator",
    "AI Overview Snippet Generator",
    "Generate concise citation-friendly answer snippets.",
    "aeo_geo",
    "aeo",
  ],
  [
    "entity-extraction-helper",
    "Entity Extraction Helper",
    "Identify entities to strengthen topical coverage.",
    "aeo_geo",
    "geo",
  ],
  [
    "topical-map-generator",
    "Topical Map Generator",
    "Map related subtopics for a content cluster.",
    "seo",
    "seo_research",
  ],
  [
    "internal-link-anchor-generator",
    "Internal Link Anchor Generator",
    "Generate contextual internal link anchors.",
    "seo",
    "seo_copy",
  ],
  [
    "image-alt-text-generator",
    "Image Alt Text Generator",
    "Write descriptive image alt text.",
    "seo",
    "seo_copy",
  ],
  [
    "schema-markup-helper",
    "Schema Markup Helper",
    "Suggest structured data for a page.",
    "schema",
    "schema_ai",
  ],
  [
    "howto-schema-generator",
    "HowTo Schema Generator",
    "Generate HowTo schema from steps.",
    "schema",
    "schema_ai",
  ],
  [
    "article-schema-generator",
    "Article Schema Generator",
    "Generate Article schema fields.",
    "schema",
    "schema_ai",
  ],
  [
    "product-schema-generator",
    "Product Schema Generator",
    "Generate Product schema fields.",
    "schema",
    "schema_ai",
  ],
  [
    "review-schema-generator",
    "Review Schema Generator",
    "Generate Review schema fields.",
    "schema",
    "schema_ai",
  ],
  [
    "breadcrumb-schema-generator",
    "Breadcrumb Schema Generator",
    "Generate BreadcrumbList schema.",
    "schema",
    "schema_ai",
  ],
  [
    "local-business-schema-generator",
    "LocalBusiness Schema Generator",
    "Generate LocalBusiness schema fields.",
    "schema",
    "schema_ai",
  ],
  [
    "headline-generator",
    "Headline Generator",
    "Generate headline ideas for content.",
    "writing",
    "copy",
  ],
  [
    "subheading-generator",
    "Subheading Generator",
    "Generate section headings for a draft.",
    "writing",
    "copy",
  ],
  [
    "introduction-generator",
    "Introduction Generator",
    "Draft an introduction for an article.",
    "writing",
    "copy",
  ],
  [
    "conclusion-generator",
    "Conclusion Generator",
    "Draft a conclusion for an article.",
    "writing",
    "copy",
  ],
  [
    "paragraph-rewriter",
    "Paragraph Rewriter",
    "Rewrite a paragraph clearly.",
    "writing",
    "rewrite",
  ],
  [
    "sentence-rewriter",
    "Sentence Rewriter",
    "Rewrite a sentence clearly.",
    "writing",
    "rewrite",
  ],
  [
    "tone-changer",
    "Tone Changer",
    "Adjust copy to a requested tone.",
    "writing",
    "rewrite",
  ],
  [
    "grammar-improver",
    "Grammar Improver",
    "Improve grammar and clarity.",
    "writing",
    "rewrite",
  ],
  [
    "bullet-point-generator",
    "Bullet Point Generator",
    "Turn notes into bullet points.",
    "writing",
    "copy",
  ],
  [
    "listicle-ideas-generator",
    "Listicle Ideas Generator",
    "Generate listicle angles for a topic.",
    "writing",
    "ideation",
  ],
  [
    "comparison-outline-generator",
    "Comparison Outline Generator",
    "Outline a comparison article.",
    "writing",
    "outline",
  ],
  [
    "pros-cons-generator",
    "Pros and Cons Generator",
    "Generate balanced pros and cons.",
    "writing",
    "copy",
  ],
  [
    "feature-benefit-generator",
    "Feature Benefit Generator",
    "Translate features into benefits.",
    "business",
    "business_copy",
  ],
  [
    "testimonial-rewriter",
    "Testimonial Rewriter",
    "Polish testimonial copy.",
    "business",
    "rewrite",
  ],
  [
    "cold-email-generator",
    "Cold Email Generator",
    "Draft a concise outreach email.",
    "business",
    "business_copy",
  ],
  [
    "follow-up-email-generator",
    "Follow-Up Email Generator",
    "Draft a polite follow-up email.",
    "business",
    "business_copy",
  ],
] as const;

const aiTemplates: FreeToolTemplate[] = aiCatalog.map(
  ([slug, title, description, category, family]) => ({
    id: slug,
    slug,
    title,
    description,
    category,
    executionMode: "ai",
    family,
    inputs: [textAreaInput("brief", "Brief", 8000)],
    seo: {
      metaTitle: `Free ${title}`,
      metaDescription: description,
    },
    defaultPrompt:
      "Use the provided brief to produce useful, specific output. Do not invent private facts.",
  }),
);

export const FREE_TOOL_TEMPLATE_LIST = [
  ...deterministicTemplates,
  ...expandedDeterministicTemplates,
  ...aiTemplates,
] as const;

function buildTemplateRegistry(
  templateList: readonly FreeToolTemplate[],
): Record<string, FreeToolTemplate> {
  const templates: Record<string, FreeToolTemplate> = {};
  const slugs = new Set<string>();
  for (const template of templateList) {
    if (templates[template.id]) {
      throw new Error(`Duplicate free tool template ID: ${template.id}`);
    }
    if (slugs.has(template.slug)) {
      throw new Error(`Duplicate free tool template slug: ${template.slug}`);
    }
    templates[template.id] = template;
    slugs.add(template.slug);
  }
  return templates;
}

export const FREE_TOOL_TEMPLATES = buildTemplateRegistry(
  FREE_TOOL_TEMPLATE_LIST,
);

export function getFreeToolTemplate(
  templateId: string,
): FreeToolTemplate | null {
  return FREE_TOOL_TEMPLATES[templateId] ?? null;
}

export async function runDeterministicTool(
  templateId: string,
  input: FreeToolInput,
): Promise<FreeToolResult> {
  const template = getFreeToolTemplate(templateId);
  if (
    !template ||
    template.executionMode !== "deterministic" ||
    !template.deterministicExecutor
  ) {
    throw new Error(`No deterministic executor registered for ${templateId}`);
  }
  return template.deterministicExecutor(input);
}
