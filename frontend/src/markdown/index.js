/**
 * SyncStream Lightweight GitHub-Flavored Markdown (GFM) Renderer
 * Converts Markdown text into clean, styled HTML for live documentation preview.
 */

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Parses inline Markdown formatting (bold, italic, code, links, images, strike).
 */
function parseInline(text) {
  let out = escapeHtml(text);

  // Images: ![alt](url)
  out = out.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" class="md-img" style="max-width:100%;border-radius:6px;margin:8px 0;" />'
  );

  // Links: [text](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link text-[#58a6ff] underline underline-offset-2 hover:text-[#79c0ff]">$1</a>'
  );

  // Inline code: `code`
  out = out.replace(
    /`([^`]+)`/g,
    '<code class="md-inline-code px-1.5 py-0.5 rounded bg-[#161b22] border border-[#30363d] text-[#e6edf3] font-mono text-[12px]">$1</code>'
  );

  // Bold + Italic: ***text*** or ___text___
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");

  // Bold: **text** or __text__
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong class='font-bold text-[#f0f6fc]'>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong class='font-bold text-[#f0f6fc]'>$1</strong>");

  // Italic: *text* or _text_
  out = out.replace(/\*([^*]+)\*/g, "<em class='italic text-[#c9d1d9]'>$1</em>");
  out = out.replace(/_([^_]+)_/g, "<em class='italic text-[#c9d1d9]'>$1</em>");

  // Strikethrough: ~~text~~
  out = out.replace(/~~([^~]+)~~/g, "<del class='line-through text-[#8b949e]'>$1</del>");

  return out;
}

/**
 * Main Markdown to HTML converter.
 * @param {string} markdown
 * @returns {string} HTML string
 */
export function renderMarkdown(markdown) {
  if (!markdown || typeof markdown !== "string") return "";

  const lines = markdown.split(/\r?\n/);
  const html = [];
  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockLines = [];
  let inList = false;
  let listType = ""; // 'ul' | 'ol'
  let inTable = false;
  let tableRows = [];
  let inBlockquote = false;
  let blockquoteLines = [];

  const flushList = () => {
    if (inList) {
      html.push(`</${listType}>`);
      inList = false;
      listType = "";
    }
  };

  const flushBlockquote = () => {
    if (inBlockquote) {
      html.push(
        `<blockquote class="md-blockquote border-l-4 border-[#388bfd] pl-4 py-1 my-3 text-[#8b949e] italic bg-[#161b22]/40 rounded-r">${blockquoteLines.join(
          "<br/>"
        )}</blockquote>`
      );
      inBlockquote = false;
      blockquoteLines = [];
    }
  };

  const flushTable = () => {
    if (inTable && tableRows.length > 0) {
      let tableHtml = '<div class="md-table-wrapper overflow-x-auto my-4"><table class="md-table min-w-full border border-[#30363d] text-left text-xs">';
      tableRows.forEach((row, rIdx) => {
        if (rIdx === 0) {
          tableHtml += '<thead class="bg-[#161b22] border-b border-[#30363d]"><tr>';
          row.forEach((cell) => {
            tableHtml += `<th class="px-3 py-2 font-semibold text-[#f0f6fc] border-r border-[#30363d] last:border-r-0">${parseInline(
              cell.trim()
            )}</th>`;
          });
          tableHtml += "</tr></thead><tbody>";
        } else {
          tableHtml += '<tr class="border-b border-[#21262d] hover:bg-[#161b22]/50">';
          row.forEach((cell) => {
            tableHtml += `<td class="px-3 py-2 text-[#c9d1d9] border-r border-[#21262d] last:border-r-0">${parseInline(
              cell.trim()
            )}</td>`;
          });
          tableHtml += "</tr>";
        }
      });
      tableHtml += "</tbody></table></div>";
      html.push(tableHtml);
      inTable = false;
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Fenced Code Blocks (```lang)
    if (trimmed.startsWith("```")) {
      flushList();
      flushBlockquote();
      flushTable();
      if (inCodeBlock) {
        // End code block
        const codeContent = escapeHtml(codeBlockLines.join("\n"));
        html.push(
          `<div class="md-code-block my-3 rounded-lg overflow-hidden border border-[#30363d] bg-[#0d1117]"><div class="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-[#30363d] text-[11px] font-mono text-[#8b949e]"><span>${
            codeBlockLang || "code"
          }</span></div><pre class="p-3 overflow-x-auto font-mono text-xs leading-relaxed text-[#c9d1d9]"><code>${codeContent}</code></pre></div>`
        );
        inCodeBlock = false;
        codeBlockLang = "";
        codeBlockLines = [];
      } else {
        // Start code block
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // 2. Table Rows (| col1 | col2 |)
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList();
      flushBlockquote();
      // Skip separator row (| --- | --- |)
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        continue;
      }
      const cols = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      inTable = true;
      tableRows.push(cols);
      continue;
    } else {
      flushTable();
    }

    // 3. Blockquotes (> quote)
    if (trimmed.startsWith(">")) {
      flushList();
      flushTable();
      inBlockquote = true;
      blockquoteLines.push(parseInline(trimmed.replace(/^>\s?/, "")));
      continue;
    } else {
      flushBlockquote();
    }

    // Empty lines
    if (!trimmed) {
      flushList();
      flushBlockquote();
      flushTable();
      continue;
    }

    // 4. Headings (# H1 to ###### H6)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const text = parseInline(headingMatch[2].trim());
      const sizes = [
        "text-2xl font-bold border-b border-[#21262d] pb-2 mt-6 mb-3 text-[#f0f6fc]",
        "text-xl font-bold border-b border-[#21262d] pb-1.5 mt-5 mb-2.5 text-[#f0f6fc]",
        "text-lg font-semibold mt-4 mb-2 text-[#f0f6fc]",
        "text-base font-semibold mt-3 mb-1.5 text-[#f0f6fc]",
        "text-sm font-semibold mt-2.5 mb-1 text-[#f0f6fc]",
        "text-xs font-semibold uppercase tracking-wider mt-2 mb-1 text-[#8b949e]"
      ];
      html.push(`<h${level} class="${sizes[level - 1]}">${text}</h${level}>`);
      continue;
    }

    // 5. Horizontal Rules (---, ***, ___)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(trimmed)) {
      flushList();
      html.push('<hr class="my-6 border-[#30363d]" />');
      continue;
    }

    // 6. Task Lists (- [ ] or - [x])
    const taskMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      if (!inList || listType !== "ul") {
        flushList();
        html.push('<ul class="md-task-list my-2 space-y-1 text-xs">');
        inList = true;
        listType = "ul";
      }
      const isChecked = taskMatch[1].toLowerCase() === "x";
      const itemText = parseInline(taskMatch[2]);
      html.push(
        `<li class="flex items-center gap-2 text-[#c9d1d9]"><input type="checkbox" disabled ${
          isChecked ? "checked" : ""
        } class="accent-[#1f6feb] rounded" /><span class="${isChecked ? "line-through text-[#8b949e]" : ""}">${itemText}</span></li>`
      );
      continue;
    }

    // 7. Unordered Lists (- or *)
    const ulMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (ulMatch) {
      if (!inList || listType !== "ul") {
        flushList();
        html.push('<ul class="md-list list-disc list-inside my-2 space-y-1 text-xs text-[#c9d1d9]">');
        inList = true;
        listType = "ul";
      }
      html.push(`<li>${parseInline(ulMatch[2])}</li>`);
      continue;
    }

    // 8. Ordered Lists (1. )
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        flushList();
        html.push('<ol class="md-list list-decimal list-inside my-2 space-y-1 text-xs text-[#c9d1d9]">');
        inList = true;
        listType = "ol";
      }
      html.push(`<li>${parseInline(olMatch[2])}</li>`);
      continue;
    }

    // Flush any open lists
    flushList();

    // 9. Standard Paragraph
    html.push(`<p class="my-2 leading-relaxed text-xs text-[#c9d1d9]">${parseInline(trimmed)}</p>`);
  }

  flushList();
  flushBlockquote();
  flushTable();

  return html.join("\n");
}
