/**
 * SyncStream Multi-Language Code Formatting Engine
 * Provides indentation-aware and syntax-aligned document formatting
 * for collaborative editing in Monaco and Yjs.
 */

/**
 * Formats JSON code with specified tab size indentation.
 */
export function formatJSON(code, tabSize = 2) {
  try {
    const parsed = JSON.parse(code)
    return JSON.stringify(parsed, null, tabSize) + "\n"
  } catch {
    return code
  }
}

/**
 * Formats HTML/XML code with proper tag nesting and indentation.
 */
export function formatHTML(code, tabSize = 2) {
  const indentStr = " ".repeat(tabSize)
  const lines = code.split("\n")
  const tokens = []

  const regex = /(<\/?[a-zA-Z0-9_\-:]+(?:\s+[^>]*?)?\/?>)|([^<]+)/g
  let match

  let singleLineCode = lines.map((l) => l.trim()).join(" ")

  while ((match = regex.exec(singleLineCode)) !== null) {
    if (match[1]) {
      const tag = match[1].trim()
      if (tag) tokens.push({ type: "tag", val: tag })
    } else if (match[2]) {
      const text = match[2].trim()
      if (text) tokens.push({ type: "text", val: text })
    }
  }

  if (tokens.length === 0) return code

  let formatted = []
  let depth = 0

  const voidTags = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr", "!doctype"
  ])

  for (const token of tokens) {
    if (token.type === "tag") {
      const tagLower = token.val.toLowerCase()
      const isClosing = token.val.startsWith("</")
      const isSelfClosing = token.val.endsWith("/>")
      const tagNameMatch = tagLower.match(/<\/?([a-zA-Z0-9_\-:]+)/)
      const tagName = tagNameMatch ? tagNameMatch[1] : ""
      const isVoid = voidTags.has(tagName) || isSelfClosing

      if (isClosing) {
        depth = Math.max(0, depth - 1)
        formatted.push(indentStr.repeat(depth) + token.val)
      } else if (isVoid) {
        formatted.push(indentStr.repeat(depth) + token.val)
      } else {
        formatted.push(indentStr.repeat(depth) + token.val)
        depth++
      }
    } else {
      formatted.push(indentStr.repeat(depth) + token.val)
    }
  }

  return formatted.join("\n") + "\n"
}

/**
 * Formats CSS / SCSS code blocks and properties.
 */
export function formatCSS(code, tabSize = 2) {
  const indent = " ".repeat(tabSize)
  const lines = code.split("\n")
  const formatted = []
  let depth = 0

  for (let rawLine of lines) {
    let line = rawLine.trim()
    if (!line) {
      if (formatted.length > 0 && formatted[formatted.length - 1] !== "") {
        formatted.push("")
      }
      continue
    }

    if (line.startsWith("}")) {
      depth = Math.max(0, depth - 1)
    }

    if (line.includes(":") && !line.includes("{") && depth > 0) {
      const colonIdx = line.indexOf(":")
      const prop = line.substring(0, colonIdx).trim()
      let val = line.substring(colonIdx + 1).trim()
      line = `${prop}: ${val}`
    }

    formatted.push(indent.repeat(depth) + line)

    if (line.endsWith("{") || (line.includes("{") && !line.includes("}"))) {
      depth++
    }
  }

  return formatted.join("\n") + "\n"
}

/**
 * Formats C-family languages (JS, TS, Java, C, C++, C#, PHP, Go, Rust, Swift).
 */
export function formatCStyle(code, tabSize = 2) {
  const indent = " ".repeat(tabSize)
  const lines = code.split("\n")
  const formatted = []
  let depth = 0

  for (let rawLine of lines) {
    let line = rawLine.trim()

    if (!line) {
      if (formatted.length > 0 && formatted[formatted.length - 1] !== "") {
        formatted.push("")
      }
      continue
    }

    let leadingCloses = 0
    for (let char of line) {
      if (char === "}" || char === ")" || char === "]") {
        leadingCloses++
      } else {
        break
      }
    }

    const currentDepth = Math.max(0, depth - leadingCloses)

    formatted.push(indent.repeat(currentDepth) + line)

    let openCount = (line.match(/[\{\(\[]/g) || []).length
    let closeCount = (line.match(/[\}\)\]]/g) || []).length

    depth = Math.max(0, depth + (openCount - closeCount))
  }

  return formatted.join("\n") + "\n"
}

/**
 * Formats Python code with consistent 4-space indentation and clean blank lines.
 */
export function formatPython(code, tabSize = 4) {
  const indent = " ".repeat(tabSize)
  const lines = code.split("\n")
  const formatted = []

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    if (!trimmed) {
      if (formatted.length > 0 && formatted[formatted.length - 1] !== "") {
        formatted.push("")
      }
      continue
    }

    const leadingSpaces = rawLine.match(/^(\s*)/)[0].length
    const originalLevel = Math.round(leadingSpaces / 4)

    const isDedentWord = /^(return|pass|break|continue|elif|else|except|finally)\b/.test(trimmed)
    const level = isDedentWord ? Math.max(0, originalLevel) : originalLevel

    formatted.push(indent.repeat(level) + trimmed)
  }

  return formatted.join("\n") + "\n"
}

/**
 * Master formatting dispatcher by language identifier.
 */
export function formatDocument(code, language = "javascript", options = { tabSize: 2 }) {
  if (!code || typeof code !== "string") return code
  const lang = (language || "").toLowerCase()
  const tabSize = options.tabSize || (lang === "python" ? 4 : 2)

  switch (lang) {
    case "json":
      return formatJSON(code, tabSize)
    case "html":
    case "xml":
    case "svg":
      return formatHTML(code, tabSize)
    case "css":
    case "scss":
    case "less":
      return formatCSS(code, tabSize)
    case "python":
      return formatPython(code, 4)
    case "javascript":
    case "typescript":
    case "java":
    case "cpp":
    case "c":
    case "csharp":
    case "go":
    case "rust":
    case "php":
    case "kotlin":
    case "swift":
    default:
      return formatCStyle(code, tabSize)
  }
}
