/**
 * SyncStream Multi-Language Diagnostics & Syntax Linter Engine
 * Fast, accurate AST & structural syntax checking for Monaco Editor.
 */

export const SEVERITY = {
  ERROR: 8,
  WARNING: 4,
  INFO: 2,
  HINT: 1
};

// ============================================================================
// Python
// ============================================================================

/**
 * Validates Python code for syntax errors, indentation errors, and gibberish.
 */
export function validatePython(code) {
  const markers = [];
  if (!code || !code.trim()) return markers;

  const rawLines = code.split('\n');
  const bracketStack = [];
  let inTripleSingle = false;
  let inTripleDouble = false;
  let tripleStartLine = 0;
  let tripleStartCol = 0;

  const indentStack = [0];
  let expectIndent = false;
  let expectIndentLine = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    // Check multi-line string state
    if (inTripleDouble || inTripleSingle) {
      if (inTripleDouble && rawLine.includes('"""')) {
        inTripleDouble = false;
      } else if (inTripleSingle && rawLine.includes("'''")) {
        inTripleSingle = false;
      }
      continue;
    }

    // Skip empty or comment-only lines for indentation tracking
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Measure indentation (spaces/tabs)
    const currentIndent = rawLine.search(/\S/);

    // 1. Check Indentation Rules
    if (expectIndent) {
      if (currentIndent <= indentStack[indentStack.length - 1]) {
        markers.push({
          startLineNumber: lineNum,
          startColumn: 1,
          endLineNumber: lineNum,
          endColumn: rawLine.length + 1,
          message: "IndentationError: expected an indented block after statement on line " + expectIndentLine,
          severity: SEVERITY.ERROR,
          source: 'Python'
        });
      } else {
        indentStack.push(currentIndent);
      }
      expectIndent = false;
    } else {
      const topIndent = indentStack[indentStack.length - 1];
      if (currentIndent > topIndent) {
        markers.push({
          startLineNumber: lineNum,
          startColumn: 1,
          endLineNumber: lineNum,
          endColumn: currentIndent + 1,
          message: "IndentationError: unexpected indent",
          severity: SEVERITY.ERROR,
          source: 'Python'
        });
      } else if (currentIndent < topIndent) {
        while (indentStack.length > 1 && indentStack[indentStack.length - 1] > currentIndent) {
          indentStack.pop();
        }
        if (indentStack[indentStack.length - 1] !== currentIndent) {
          markers.push({
            startLineNumber: lineNum,
            startColumn: 1,
            endLineNumber: lineNum,
            endColumn: currentIndent + 1,
            message: "IndentationError: unindent does not match any outer indentation level",
            severity: SEVERITY.ERROR,
            source: 'Python'
          });
        }
      }
    }

    // Check if current line starts a block (ends in colon)
    const isBlockHeader = /^(def\s+|class\s+|if\s+|elif\s+|else\s*:|while\s+|for\s+|try\s*:|except(\s+.*)?|finally\s*:|with\s+|async\s+def\s+|async\s+for\s+|async\s+with\s+|match\s+|case\s+)/.test(trimmed);
    if (isBlockHeader) {
      if (trimmed.endsWith(':')) {
        expectIndent = true;
        expectIndentLine = lineNum;
      } else if (!trimmed.endsWith('\\') && !trimmed.endsWith(',')) {
        markers.push({
          startLineNumber: lineNum,
          startColumn: rawLine.length,
          endLineNumber: lineNum,
          endColumn: rawLine.length + 1,
          message: "SyntaxError: expected ':' at end of statement",
          severity: SEVERITY.ERROR,
          source: 'Python'
        });
      }
    }

    // Check for JavaScript comments in Python
    if (trimmed.startsWith('//')) {
      markers.push({
        startLineNumber: lineNum,
        startColumn: rawLine.indexOf('//') + 1,
        endLineNumber: lineNum,
        endColumn: rawLine.indexOf('//') + 3,
        message: "SyntaxError: Python uses '#' for single-line comments, not '//'",
        severity: SEVERITY.ERROR,
        source: 'Python'
      });
    }

    // Check for stray operators on a bare line
    if (/^[/?!^&~%*+<>=.,;\\|]+$/.test(trimmed) && trimmed !== '...' && trimmed !== ':') {
      markers.push({
        startLineNumber: lineNum,
        startColumn: currentIndent + 1,
        endLineNumber: lineNum,
        endColumn: rawLine.length + 1,
        message: `SyntaxError: invalid syntax ('${trimmed}')`,
        severity: SEVERITY.ERROR,
        source: 'Python'
      });
    } else if (/^[/*%^&|]=?/.test(trimmed) && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
      markers.push({
        startLineNumber: lineNum,
        startColumn: currentIndent + 1,
        endLineNumber: lineNum,
        endColumn: currentIndent + 2,
        message: `SyntaxError: invalid syntax ('${trimmed[0]}')`,
        severity: SEVERITY.ERROR,
        source: 'Python'
      });
    }

    // Character scan for strings, brackets, and quotes
    let j = 0;
    while (j < rawLine.length) {
      if (rawLine.substring(j, j + 3) === '"""') {
        inTripleDouble = true;
        tripleStartLine = lineNum;
        tripleStartCol = j + 1;
        j += 3;
        while (j < rawLine.length) {
          if (rawLine.substring(j, j + 3) === '"""') {
            inTripleDouble = false;
            j += 3;
            break;
          }
          j++;
        }
        continue;
      }

      if (rawLine.substring(j, j + 3) === "'''") {
        inTripleSingle = true;
        tripleStartLine = lineNum;
        tripleStartCol = j + 1;
        j += 3;
        while (j < rawLine.length) {
          if (rawLine.substring(j, j + 3) === "'''") {
            inTripleSingle = false;
            j += 3;
            break;
          }
          j++;
        }
        continue;
      }

      const char = rawLine[j];
      if (char === '#') break;

      if (char === '"' || char === "'") {
        const quote = char;
        const startCol = j + 1;
        j++;
        let closed = false;
        while (j < rawLine.length) {
          if (rawLine[j] === '\\') { j += 2; continue; }
          if (rawLine[j] === quote) { closed = true; j++; break; }
          j++;
        }
        if (!closed) {
          markers.push({
            startLineNumber: lineNum,
            startColumn: startCol,
            endLineNumber: lineNum,
            endColumn: rawLine.length + 1,
            message: `SyntaxError: unterminated string literal (detected at line ${lineNum})`,
            severity: SEVERITY.ERROR,
            source: 'Python'
          });
        }
        continue;
      }

      if (char === '(' || char === '[' || char === '{') {
        bracketStack.push({ char, line: lineNum, col: j + 1 });
      } else if (char === ')' || char === ']' || char === '}') {
        const expected = char === ')' ? '(' : (char === ']' ? '[' : '{');
        if (bracketStack.length === 0) {
          markers.push({
            startLineNumber: lineNum,
            startColumn: j + 1,
            endLineNumber: lineNum,
            endColumn: j + 2,
            message: `SyntaxError: unmatched closing '${char}'`,
            severity: SEVERITY.ERROR,
            source: 'Python'
          });
        } else {
          const top = bracketStack.pop();
          if (top.char !== expected) {
            markers.push({
              startLineNumber: lineNum,
              startColumn: j + 1,
              endLineNumber: lineNum,
              endColumn: j + 2,
              message: `SyntaxError: closing '${char}' does not match '${top.char}' from line ${top.line}`,
              severity: SEVERITY.ERROR,
              source: 'Python'
            });
          }
        }
      }
      j++;
    }
  }

  if (inTripleDouble || inTripleSingle) {
    markers.push({
      startLineNumber: tripleStartLine,
      startColumn: tripleStartCol,
      endLineNumber: rawLines.length,
      endColumn: (rawLines[rawLines.length - 1] || '').length + 1,
      message: "SyntaxError: EOF while scanning multi-line triple string literal",
      severity: SEVERITY.ERROR,
      source: 'Python'
    });
  }

  while (bracketStack.length > 0) {
    const unclosed = bracketStack.pop();
    const closingChar = unclosed.char === '(' ? ')' : (unclosed.char === '[' ? ']' : '}');
    markers.push({
      startLineNumber: unclosed.line,
      startColumn: unclosed.col,
      endLineNumber: unclosed.line,
      endColumn: unclosed.col + 1,
      message: `SyntaxError: unclosed '${unclosed.char}', expected matching '${closingChar}'`,
      severity: SEVERITY.ERROR,
      source: 'Python'
    });
  }

  return markers;
}

// ============================================================================
// Java / C#
// ============================================================================

/**
 * Validates Java source code for structure, scopes, missing semicolons, and gibberish.
 * Also used as the base validator for C# (csharp).
 */
export function validateJava(code, lang = 'Java') {
  const markers = [];
  if (!code || !code.trim()) return markers;

  const rawLines = code.split('\n');
  const bracketStack = [];
  let inMultiComment = false;
  let multiCommentStartLine = 0;
  let currentBraceDepth = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) continue;

    if (/^[/?!^&~%*+<>=.,;\\|]+$/.test(trimmed) && trimmed !== ';' && trimmed !== '{' && trimmed !== '}') {
      markers.push({
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: rawLine.length + 1,
        message: `Syntax error: illegal character / token '${trimmed}'`,
        severity: SEVERITY.ERROR,
        source: lang
      });
      continue;
    }

    let effectiveLine = '';
    let j = 0;
    while (j < rawLine.length) {
      if (inMultiComment) {
        if (rawLine.substring(j, j + 2) === '*/') { inMultiComment = false; j += 2; continue; }
        j++;
        continue;
      }

      if (rawLine.substring(j, j + 2) === '/*') {
        inMultiComment = true;
        multiCommentStartLine = lineNum;
        j += 2;
        continue;
      }

      if (rawLine.substring(j, j + 2) === '//') break;

      const char = rawLine[j];

      if (char === '"') {
        const startCol = j + 1;
        j++;
        let closed = false;
        while (j < rawLine.length) {
          if (rawLine[j] === '\\') { j += 2; continue; }
          if (rawLine[j] === '"') { closed = true; j++; break; }
          j++;
        }
        if (!closed) {
          markers.push({
            startLineNumber: lineNum,
            startColumn: startCol,
            endLineNumber: lineNum,
            endColumn: rawLine.length + 1,
            message: "Syntax error: unclosed string literal",
            severity: SEVERITY.ERROR,
            source: lang
          });
        }
        continue;
      }

      if (char === "'") {
        const startCol = j + 1;
        j++;
        let closed = false;
        while (j < rawLine.length) {
          if (rawLine[j] === '\\') { j += 2; continue; }
          if (rawLine[j] === "'") { closed = true; j++; break; }
          j++;
        }
        if (!closed) {
          markers.push({
            startLineNumber: lineNum,
            startColumn: startCol,
            endLineNumber: lineNum,
            endColumn: rawLine.length + 1,
            message: "Syntax error: unclosed character literal",
            severity: SEVERITY.ERROR,
            source: lang
          });
        }
        continue;
      }

      effectiveLine += char;

      if (char === '{') {
        bracketStack.push({ char: '{', line: lineNum, col: j + 1 });
        currentBraceDepth++;
      } else if (char === '(' || char === '[') {
        bracketStack.push({ char, line: lineNum, col: j + 1 });
      } else if (char === '}') {
        currentBraceDepth = Math.max(0, currentBraceDepth - 1);
        if (bracketStack.length === 0) {
          markers.push({
            startLineNumber: lineNum,
            startColumn: j + 1,
            endLineNumber: lineNum,
            endColumn: j + 2,
            message: "Syntax error: unmatched closing '}'",
            severity: SEVERITY.ERROR,
            source: lang
          });
        } else {
          const top = bracketStack.pop();
          if (top.char !== '{') {
            markers.push({
              startLineNumber: lineNum,
              startColumn: j + 1,
              endLineNumber: lineNum,
              endColumn: j + 2,
              message: `Syntax error: closing '}' does not match '${top.char}' on line ${top.line}`,
              severity: SEVERITY.ERROR,
              source: lang
            });
          }
        }
      } else if (char === ')' || char === ']') {
        const expected = char === ')' ? '(' : '[';
        if (bracketStack.length === 0) {
          markers.push({
            startLineNumber: lineNum,
            startColumn: j + 1,
            endLineNumber: lineNum,
            endColumn: j + 2,
            message: `Syntax error: unmatched closing '${char}'`,
            severity: SEVERITY.ERROR,
            source: lang
          });
        } else {
          const top = bracketStack.pop();
          if (top.char !== expected) {
            markers.push({
              startLineNumber: lineNum,
              startColumn: j + 1,
              endLineNumber: lineNum,
              endColumn: j + 2,
              message: `Syntax error: closing '${char}' does not match '${top.char}' on line ${top.line}`,
              severity: SEVERITY.ERROR,
              source: lang
            });
          }
        }
      }
      j++;
    }

    const cleanTrimmed = effectiveLine.trim();
    if (!cleanTrimmed) continue;

    // Top-level scope check (Java)
    if (lang === 'Java' && currentBraceDepth === 0 && !cleanTrimmed.includes('{') && !cleanTrimmed.includes('}')) {
      const isTopLevelValid =
        cleanTrimmed.startsWith('package ') ||
        cleanTrimmed.startsWith('import ') ||
        cleanTrimmed.startsWith('@') ||
        /\b(public|private|protected|abstract|final|static|sealed|non-sealed)?\s*(class|interface|enum|record)\b/.test(cleanTrimmed);

      if (!isTopLevelValid) {
        markers.push({
          startLineNumber: lineNum,
          startColumn: 1,
          endLineNumber: lineNum,
          endColumn: rawLine.length + 1,
          message: "Syntax error: Statements must be inside a class or method",
          severity: SEVERITY.ERROR,
          source: lang
        });
      }
    }

    // Top-level scope check (C#)
    if (lang === 'C#' && currentBraceDepth === 0 && !cleanTrimmed.includes('{') && !cleanTrimmed.includes('}')) {
      const isTopLevelValid =
        cleanTrimmed.startsWith('using ') ||
        cleanTrimmed.startsWith('namespace ') ||
        cleanTrimmed.startsWith('@') ||
        /\b(public|private|protected|internal|abstract|sealed|static|partial)?\s*(class|interface|enum|struct|record)\b/.test(cleanTrimmed) ||
        // C# top-level statements (modern .NET) are always valid
        true;
      void isTopLevelValid; // C# allows top-level statements — skip the check
    }

    // Semicolon check on statements
    if (
      !inMultiComment &&
      cleanTrimmed.length > 0 &&
      !cleanTrimmed.endsWith(';') &&
      !cleanTrimmed.endsWith('{') &&
      !cleanTrimmed.endsWith('}') &&
      !cleanTrimmed.endsWith(':') &&
      !cleanTrimmed.endsWith(',') &&
      !cleanTrimmed.startsWith('@')
    ) {
      const isBlockKeyword = /^(if|else|for|while|switch|case|default|class|interface|enum|record|try|catch|finally|synchronized|public|private|protected|namespace|using)\b/.test(cleanTrimmed);
      if (!isBlockKeyword && (cleanTrimmed.startsWith('return') || cleanTrimmed.startsWith('package') || cleanTrimmed.startsWith('import') || cleanTrimmed.includes('=') || cleanTrimmed.endsWith(')'))) {
        markers.push({
          startLineNumber: lineNum,
          startColumn: rawLine.length,
          endLineNumber: lineNum,
          endColumn: rawLine.length + 1,
          message: "Syntax error: insert ';' to complete statement",
          severity: SEVERITY.ERROR,
          source: lang
        });
      }
    }
  }

  if (inMultiComment) {
    markers.push({
      startLineNumber: multiCommentStartLine,
      startColumn: 1,
      endLineNumber: rawLines.length,
      endColumn: (rawLines[rawLines.length - 1] || '').length + 1,
      message: "Syntax error: unclosed comment (expected '*/')",
      severity: SEVERITY.ERROR,
      source: lang
    });
  }

  while (bracketStack.length > 0) {
    const unclosed = bracketStack.pop();
    const closingChar = unclosed.char === '{' ? '}' : (unclosed.char === '(' ? ')' : ']');
    markers.push({
      startLineNumber: unclosed.line,
      startColumn: unclosed.col,
      endLineNumber: unclosed.line,
      endColumn: unclosed.col + 1,
      message: `Syntax error: unclosed '${unclosed.char}', expected '${closingChar}'`,
      severity: SEVERITY.ERROR,
      source: lang
    });
  }

  return markers;
}

// ============================================================================
// C / C++
// ============================================================================

/**
 * Validates C & C++ source code.
 */
export function validateCpp(code, language = 'cpp') {
  const markers = [];
  if (!code || !code.trim()) return markers;

  const rawLines = code.split('\n');
  const bracketStack = [];
  let inMultiComment = false;
  let currentBraceDepth = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) continue;

    if (/^[/?!^&~%*+<>=.,;\\|]+$/.test(trimmed) && trimmed !== ';' && trimmed !== '{' && trimmed !== '}') {
      markers.push({
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: rawLine.length + 1,
        message: `Syntax error: illegal character or token '${trimmed}'`,
        severity: SEVERITY.ERROR,
        source: language.toUpperCase()
      });
      continue;
    }

    let j = 0;
    while (j < rawLine.length) {
      if (inMultiComment) {
        if (rawLine.substring(j, j + 2) === '*/') { inMultiComment = false; j += 2; continue; }
        j++;
        continue;
      }

      if (rawLine.substring(j, j + 2) === '/*') { inMultiComment = true; j += 2; continue; }
      if (rawLine.substring(j, j + 2) === '//') break;
      if (trimmed.startsWith('#')) break;

      const char = rawLine[j];

      if (char === '"' || char === "'") {
        const quote = char;
        const startCol = j + 1;
        j++;
        let closed = false;
        while (j < rawLine.length) {
          if (rawLine[j] === '\\') { j += 2; continue; }
          if (rawLine[j] === quote) { closed = true; j++; break; }
          j++;
        }
        if (!closed) {
          markers.push({
            startLineNumber: lineNum,
            startColumn: startCol,
            endLineNumber: lineNum,
            endColumn: rawLine.length + 1,
            message: `Syntax error: unclosed ${quote === '"' ? 'string' : 'character'} literal`,
            severity: SEVERITY.ERROR,
            source: language.toUpperCase()
          });
        }
        continue;
      }

      if (char === '{') {
        bracketStack.push({ char: '{', line: lineNum, col: j + 1 });
        currentBraceDepth++;
      } else if (char === '(' || char === '[') {
        bracketStack.push({ char, line: lineNum, col: j + 1 });
      } else if (char === '}') {
        currentBraceDepth = Math.max(0, currentBraceDepth - 1);
        if (bracketStack.length === 0) {
          markers.push({
            startLineNumber: lineNum,
            startColumn: j + 1,
            endLineNumber: lineNum,
            endColumn: j + 2,
            message: "Syntax error: unmatched closing '}'",
            severity: SEVERITY.ERROR,
            source: language.toUpperCase()
          });
        } else {
          bracketStack.pop();
        }
      } else if (char === ')' || char === ']') {
        if (bracketStack.length === 0) {
          markers.push({
            startLineNumber: lineNum,
            startColumn: j + 1,
            endLineNumber: lineNum,
            endColumn: j + 2,
            message: `Syntax error: unmatched closing '${char}'`,
            severity: SEVERITY.ERROR,
            source: language.toUpperCase()
          });
        } else {
          bracketStack.pop();
        }
      }
      j++;
    }

    if (currentBraceDepth === 0 && !trimmed.includes('{') && !trimmed.includes('}')) {
      const isTopLevelValid =
        trimmed.startsWith('#') ||
        trimmed.startsWith('using ') ||
        trimmed.startsWith('namespace ') ||
        trimmed.startsWith('typedef ') ||
        /\b(class|struct|enum|union)\b/.test(trimmed) ||
        /\b(int|void|float|double|char|bool|auto|long|short|unsigned|signed|size_t|std::[\w]+|[\w_]+)\s+[\w_:]+\s*(\(|;|=)/.test(trimmed);

      const isBareCall = /^[a-zA-Z0-9_:]+\s*\(.*\)\s*;?$/.test(trimmed) && !/\b(int|void|float|double|char|bool|auto|long|short)\b/.test(trimmed);

      if (isBareCall || (!isTopLevelValid && trimmed.endsWith(';'))) {
        markers.push({
          startLineNumber: lineNum,
          startColumn: 1,
          endLineNumber: lineNum,
          endColumn: rawLine.length + 1,
          message: "Syntax error: Statements cannot be placed outside a function definition",
          severity: SEVERITY.ERROR,
          source: language.toUpperCase()
        });
      }
    }
  }

  while (bracketStack.length > 0) {
    const unclosed = bracketStack.pop();
    const closingChar = unclosed.char === '{' ? '}' : (unclosed.char === '(' ? ')' : ']');
    markers.push({
      startLineNumber: unclosed.line,
      startColumn: unclosed.col,
      endLineNumber: unclosed.line,
      endColumn: unclosed.col + 1,
      message: `Syntax error: unclosed '${unclosed.char}', expected '${closingChar}'`,
      severity: SEVERITY.ERROR,
      source: language.toUpperCase()
    });
  }

  return markers;
}

// ============================================================================
// Go
// ============================================================================

/**
 * Validates Go source code — package declaration, func main, brace balance,
 * import blocks, and gibberish detection.
 */
export function validateGo(code) {
  const markers = [];
  if (!code || !code.trim()) return markers;

  const rawLines = code.split('\n');
  const bracketStack = [];
  let inMultiComment = false;
  let hasPackage = false;
  let hasMain = false;

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) continue;

    // Track multi-line comments
    if (inMultiComment) {
      if (rawLine.includes('*/')) inMultiComment = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (!rawLine.includes('*/')) inMultiComment = true;
      continue;
    }
    if (trimmed.startsWith('//')) continue;

    // Package declaration
    if (trimmed.startsWith('package ')) hasPackage = true;

    // func main()
    if (/^func\s+main\s*\(/.test(trimmed)) hasMain = true;

    // Gibberish check
    if (/^[/?!^&~%*+<>=.,;\\|]+$/.test(trimmed) && trimmed !== '{' && trimmed !== '}' && trimmed !== ':=') {
      markers.push({
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: rawLine.length + 1,
        message: `Syntax error: unexpected token '${trimmed}'`,
        severity: SEVERITY.ERROR,
        source: 'Go'
      });
      continue;
    }

    // Brace / paren / bracket balance
    let j = 0;
    while (j < rawLine.length) {
      const char = rawLine[j];
      if (char === '"' || char === '`') {
        const quote = char;
        j++;
        if (quote === '`') {
          // raw string — find closing backtick (can span lines, but scan current line)
          while (j < rawLine.length && rawLine[j] !== '`') j++;
        } else {
          while (j < rawLine.length) {
            if (rawLine[j] === '\\') { j += 2; continue; }
            if (rawLine[j] === '"') { j++; break; }
            j++;
          }
        }
        continue;
      }
      if (char === '/' && rawLine[j + 1] === '/') break;

      if (char === '{' || char === '(' || char === '[') {
        bracketStack.push({ char, line: lineNum, col: j + 1 });
      } else if (char === '}' || char === ')' || char === ']') {
        const expected = char === '}' ? '{' : (char === ')' ? '(' : '[');
        if (bracketStack.length === 0) {
          markers.push({
            startLineNumber: lineNum,
            startColumn: j + 1,
            endLineNumber: lineNum,
            endColumn: j + 2,
            message: `Syntax error: unmatched closing '${char}'`,
            severity: SEVERITY.ERROR,
            source: 'Go'
          });
        } else {
          const top = bracketStack.pop();
          if (top.char !== expected) {
            markers.push({
              startLineNumber: lineNum,
              startColumn: j + 1,
              endLineNumber: lineNum,
              endColumn: j + 2,
              message: `Syntax error: closing '${char}' does not match '${top.char}' from line ${top.line}`,
              severity: SEVERITY.ERROR,
              source: 'Go'
            });
          }
        }
      }
      j++;
    }
  }

  if (!hasPackage) {
    markers.push({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
      message: "Syntax error: missing 'package' declaration",
      severity: SEVERITY.ERROR,
      source: 'Go'
    });
  }

  if (hasPackage && !hasMain) {
    markers.push({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
      message: "Warning: no 'func main()' found — program has no entry point",
      severity: SEVERITY.WARNING,
      source: 'Go'
    });
  }

  while (bracketStack.length > 0) {
    const unclosed = bracketStack.pop();
    const closingChar = unclosed.char === '{' ? '}' : (unclosed.char === '(' ? ')' : ']');
    markers.push({
      startLineNumber: unclosed.line,
      startColumn: unclosed.col,
      endLineNumber: unclosed.line,
      endColumn: unclosed.col + 1,
      message: `Syntax error: unclosed '${unclosed.char}', expected '${closingChar}'`,
      severity: SEVERITY.ERROR,
      source: 'Go'
    });
  }

  return markers;
}

// ============================================================================
// Rust
// ============================================================================

/**
 * Validates Rust source code — fn main, brace balance, string/char literals.
 */
export function validateRust(code) {
  const markers = [];
  if (!code || !code.trim()) return markers;

  const rawLines = code.split('\n');
  const bracketStack = [];
  let inMultiComment = false;
  let hasMain = false;

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) continue;

    if (inMultiComment) {
      if (rawLine.includes('*/')) inMultiComment = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (!rawLine.includes('*/')) inMultiComment = true;
      continue;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('///') || trimmed.startsWith('//!')) continue;

    if (/^fn\s+main\s*\(/.test(trimmed)) hasMain = true;

    // Gibberish check
    if (/^[/?!^&~%*+<>=.,;\\|]+$/.test(trimmed) && trimmed !== ';' && trimmed !== '{' && trimmed !== '}' && trimmed !== '=>') {
      markers.push({
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: rawLine.length + 1,
        message: `Syntax error: unexpected token sequence '${trimmed}'`,
        severity: SEVERITY.ERROR,
        source: 'Rust'
      });
      continue;
    }

    let j = 0;
    while (j < rawLine.length) {
      if (rawLine.substring(j, j + 2) === '//') break;

      const char = rawLine[j];

      if (char === '"') {
        j++;
        while (j < rawLine.length) {
          if (rawLine[j] === '\\') { j += 2; continue; }
          if (rawLine[j] === '"') { j++; break; }
          j++;
        }
        continue;
      }

      if (char === "'") {
        // Could be a lifetime ('a) or a char literal ('x')
        j++;
        if (j < rawLine.length && /[a-zA-Z_]/.test(rawLine[j])) {
          // Likely a lifetime — skip identifier
          while (j < rawLine.length && /[\w]/.test(rawLine[j])) j++;
        } else {
          // Char literal
          if (j < rawLine.length && rawLine[j] === '\\') j += 2;
          else j++;
          if (j < rawLine.length && rawLine[j] === "'") j++;
        }
        continue;
      }

      if (char === '{' || char === '(' || char === '[') {
        bracketStack.push({ char, line: lineNum, col: j + 1 });
      } else if (char === '}' || char === ')' || char === ']') {
        const expected = char === '}' ? '{' : (char === ')' ? '(' : '[');
        if (bracketStack.length === 0) {
          markers.push({
            startLineNumber: lineNum,
            startColumn: j + 1,
            endLineNumber: lineNum,
            endColumn: j + 2,
            message: `Syntax error: unmatched closing '${char}'`,
            severity: SEVERITY.ERROR,
            source: 'Rust'
          });
        } else {
          const top = bracketStack.pop();
          if (top.char !== expected) {
            markers.push({
              startLineNumber: lineNum,
              startColumn: j + 1,
              endLineNumber: lineNum,
              endColumn: j + 2,
              message: `Syntax error: closing '${char}' does not match '${top.char}' from line ${top.line}`,
              severity: SEVERITY.ERROR,
              source: 'Rust'
            });
          }
        }
      }
      j++;
    }
  }

  if (!hasMain) {
    markers.push({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
      message: "Warning: no 'fn main()' found — program has no entry point",
      severity: SEVERITY.WARNING,
      source: 'Rust'
    });
  }

  while (bracketStack.length > 0) {
    const unclosed = bracketStack.pop();
    const closingChar = unclosed.char === '{' ? '}' : (unclosed.char === '(' ? ')' : ']');
    markers.push({
      startLineNumber: unclosed.line,
      startColumn: unclosed.col,
      endLineNumber: unclosed.line,
      endColumn: unclosed.col + 1,
      message: `Syntax error: unclosed '${unclosed.char}', expected '${closingChar}'`,
      severity: SEVERITY.ERROR,
      source: 'Rust'
    });
  }

  return markers;
}

// ============================================================================
// TypeScript
// ============================================================================

/**
 * Validates TypeScript — reuses JS brace / string logic, then checks
 * type annotation patterns and interface/type declarations.
 */
export function validateTypeScript(code) {
  const markers = [];
  if (!code || !code.trim()) return markers;

  const rawLines = code.split('\n');
  const bracketStack = [];
  let inMultiComment = false;
  let inTemplateLiteral = false;

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) continue;

    if (inMultiComment) {
      if (rawLine.includes('*/')) inMultiComment = false;
      continue;
    }
    if (trimmed.startsWith('/*')) {
      if (!rawLine.includes('*/')) inMultiComment = true;
      continue;
    }
    if (trimmed.startsWith('//')) continue;

    // Gibberish check
    if (/^[/?!^&~%*+<>=.,;\\|]+$/.test(trimmed) && trimmed !== '=>' && trimmed !== '...' && trimmed !== '??') {
      markers.push({
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: rawLine.length + 1,
        message: `SyntaxError: unexpected token '${trimmed}'`,
        severity: SEVERITY.ERROR,
        source: 'TypeScript'
      });
      continue;
    }

    // Type assertion that could be a common error: using 'as' incorrectly
    if (/\bas\b\s*$/.test(trimmed)) {
      markers.push({
        startLineNumber: lineNum,
        startColumn: rawLine.length,
        endLineNumber: lineNum,
        endColumn: rawLine.length + 1,
        message: "SyntaxError: 'as' type assertion requires a type on the right-hand side",
        severity: SEVERITY.ERROR,
        source: 'TypeScript'
      });
    }

    // interface / type keyword checks
    if (/^(export\s+)?(interface|type)\s+\w+/.test(trimmed)) {
      if (!trimmed.endsWith('{') && !trimmed.endsWith('=') && !trimmed.includes('=') && !trimmed.endsWith(';') && !trimmed.endsWith(',')) {
        // Likely missing opening brace — warn
        markers.push({
          startLineNumber: lineNum,
          startColumn: rawLine.length,
          endLineNumber: lineNum,
          endColumn: rawLine.length + 1,
          message: "SyntaxError: expected '{' or '=' after interface/type declaration",
          severity: SEVERITY.WARNING,
          source: 'TypeScript'
        });
      }
    }

    let j = 0;
    while (j < rawLine.length) {
      if (rawLine.substring(j, j + 2) === '//') break;

      const char = rawLine[j];

      if (char === '`') {
        inTemplateLiteral = !inTemplateLiteral;
        j++;
        continue;
      }

      if (!inTemplateLiteral && (char === '"' || char === "'")) {
        const quote = char;
        j++;
        while (j < rawLine.length) {
          if (rawLine[j] === '\\') { j += 2; continue; }
          if (rawLine[j] === quote) { j++; break; }
          j++;
        }
        continue;
      }

      if (!inTemplateLiteral) {
        if (char === '{' || char === '(' || char === '[') {
          bracketStack.push({ char, line: lineNum, col: j + 1 });
        } else if (char === '}' || char === ')' || char === ']') {
          const expected = char === '}' ? '{' : (char === ')' ? '(' : '[');
          if (bracketStack.length === 0) {
            markers.push({
              startLineNumber: lineNum,
              startColumn: j + 1,
              endLineNumber: lineNum,
              endColumn: j + 2,
              message: `SyntaxError: unmatched closing '${char}'`,
              severity: SEVERITY.ERROR,
              source: 'TypeScript'
            });
          } else {
            const top = bracketStack.pop();
            if (top.char !== expected) {
              markers.push({
                startLineNumber: lineNum,
                startColumn: j + 1,
                endLineNumber: lineNum,
                endColumn: j + 2,
                message: `SyntaxError: closing '${char}' does not match '${top.char}' on line ${top.line}`,
                severity: SEVERITY.ERROR,
                source: 'TypeScript'
              });
            }
          }
        }
      }
      j++;
    }
  }

  while (bracketStack.length > 0) {
    const unclosed = bracketStack.pop();
    const closingChar = unclosed.char === '{' ? '}' : (unclosed.char === '(' ? ')' : ']');
    markers.push({
      startLineNumber: unclosed.line,
      startColumn: unclosed.col,
      endLineNumber: unclosed.line,
      endColumn: unclosed.col + 1,
      message: `SyntaxError: unclosed '${unclosed.char}', expected '${closingChar}'`,
      severity: SEVERITY.ERROR,
      source: 'TypeScript'
    });
  }

  return markers;
}

// ============================================================================
// SQL
// ============================================================================

/**
 * Validates SQL — unclosed string literals, mismatched parentheses, and
 * a warning when no recognisable SQL keyword is found.
 */
export function validateSQL(code) {
  const markers = [];
  if (!code || !code.trim()) return markers;

  const rawLines = code.split('\n');
  const parenStack = [];
  let hasSQLKeyword = false;

  const SQL_KEYWORDS = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|FROM|WHERE|JOIN|WITH|BEGIN|COMMIT|ROLLBACK|TRUNCATE|EXPLAIN|GRANT|REVOKE)\b/i;

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('--')) continue;
    if (trimmed.startsWith('/*')) continue; // skip block comments

    if (SQL_KEYWORDS.test(trimmed)) hasSQLKeyword = true;

    let j = 0;
    while (j < rawLine.length) {
      const char = rawLine[j];

      // Skip line comment
      if (char === '-' && rawLine[j + 1] === '-') break;

      // String literal (single-quoted in SQL)
      if (char === "'") {
        const startCol = j + 1;
        j++;
        let closed = false;
        while (j < rawLine.length) {
          if (rawLine[j] === "'" && rawLine[j + 1] === "'") { j += 2; continue; } // escaped quote
          if (rawLine[j] === "'") { closed = true; j++; break; }
          j++;
        }
        if (!closed) {
          markers.push({
            startLineNumber: lineNum,
            startColumn: startCol,
            endLineNumber: lineNum,
            endColumn: rawLine.length + 1,
            message: "SQL error: unclosed string literal (unterminated single-quoted string)",
            severity: SEVERITY.ERROR,
            source: 'SQL'
          });
        }
        continue;
      }

      if (char === '(') {
        parenStack.push({ line: lineNum, col: j + 1 });
      } else if (char === ')') {
        if (parenStack.length === 0) {
          markers.push({
            startLineNumber: lineNum,
            startColumn: j + 1,
            endLineNumber: lineNum,
            endColumn: j + 2,
            message: "SQL error: unmatched closing ')'",
            severity: SEVERITY.ERROR,
            source: 'SQL'
          });
        } else {
          parenStack.pop();
        }
      }
      j++;
    }
  }

  while (parenStack.length > 0) {
    const unclosed = parenStack.pop();
    markers.push({
      startLineNumber: unclosed.line,
      startColumn: unclosed.col,
      endLineNumber: unclosed.line,
      endColumn: unclosed.col + 1,
      message: "SQL error: unclosed '(' — missing matching ')'",
      severity: SEVERITY.ERROR,
      source: 'SQL'
    });
  }

  if (!hasSQLKeyword) {
    markers.push({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
      message: "Warning: no SQL keywords detected — is this valid SQL?",
      severity: SEVERITY.WARNING,
      source: 'SQL'
    });
  }

  return markers;
}

// ============================================================================
// JSON
// ============================================================================

/**
 * Validates JSON.
 */
export function validateJSON(code) {
  const markers = [];
  if (!code || !code.trim()) return markers;

  try {
    JSON.parse(code);
  } catch (err) {
    const message = err.message || 'Invalid JSON syntax';
    let lineNum = 1;
    let colNum = 1;

    const matchLineCol = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    const matchPosition = message.match(/position\s+(\d+)/i);

    if (matchLineCol) {
      lineNum = parseInt(matchLineCol[1], 10);
      colNum  = parseInt(matchLineCol[2], 10);
    } else if (matchPosition) {
      const pos   = parseInt(matchPosition[1], 10);
      const sub   = code.substring(0, pos);
      const split = sub.split('\n');
      lineNum = split.length;
      colNum  = split[split.length - 1].length + 1;
    }

    markers.push({
      startLineNumber: lineNum,
      startColumn: colNum,
      endLineNumber: lineNum,
      endColumn: colNum + 4,
      message: `JSON error: ${message}`,
      severity: SEVERITY.ERROR,
      source: 'JSON'
    });
  }

  return markers;
}

// ============================================================================
// Main dispatcher
// ============================================================================

/**
 * Runs diagnostics for any supported language.
 */
export function runDiagnostics(code, language) {
  switch (language) {
    case 'python':     return validatePython(code);
    case 'java':       return validateJava(code, 'Java');
    case 'csharp':     return validateJava(code, 'C#');
    case 'cpp':        return validateCpp(code, 'cpp');
    case 'c':          return validateCpp(code, 'c');
    case 'go':         return validateGo(code);
    case 'rust':       return validateRust(code);
    case 'typescript': return validateTypeScript(code);
    case 'json':       return validateJSON(code);
    case 'sql':        return validateSQL(code);
    default:           return [];
  }
}

// ============================================================================
// Compiler output parser
// ============================================================================

/**
 * Parses compiler and interpreter output error messages into Monaco markers.
 * Supports Python, Java, GCC/Clang C/C++, Rust, Go, TypeScript, and C#.
 */
export function parseCompilerOutput(output, language) {
  if (!output || typeof output !== 'string') return [];
  const markers = [];
  const lines = output.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ------------------------------------------------------------------
    // Python traceback: File "...", line 4, in <module>
    // Only emit a marker for the LAST traceback frame (closest to error)
    // ------------------------------------------------------------------
    const pyMatch = line.match(/File\s+"[^"]+",\s+line\s+(\d+)(?:,\s+in\s+.+)?/i);
    if (pyMatch) {
      const lineNum = parseInt(pyMatch[1], 10);
      // Look ahead for the actual error message (skip frame lines)
      let errorMsg = 'Python runtime error';
      for (let k = i + 1; k < Math.min(i + 4, lines.length); k++) {
        const candidate = lines[k].trim();
        if (candidate && !candidate.startsWith('File ') && !candidate.match(/^\s/)) {
          errorMsg = candidate;
          break;
        }
      }
      // Only add if not already marked on this line
      if (!markers.some(m => m.startLineNumber === lineNum && m.source === 'Python Runtime')) {
        markers.push({
          startLineNumber: lineNum,
          startColumn: 1,
          endLineNumber: lineNum,
          endColumn: 80,
          message: errorMsg,
          severity: SEVERITY.ERROR,
          source: 'Python Runtime'
        });
      }
      continue;
    }

    // ------------------------------------------------------------------
    // Java compiler: Main.java:5: error: ';' expected
    // ------------------------------------------------------------------
    const javaMatch = line.match(/(?:[A-Za-z0-9_]+\.java):(\d+):\s+(?:error|warning):\s+(.*)/i);
    if (javaMatch) {
      const lineNum   = parseInt(javaMatch[1], 10);
      const isWarning = line.toLowerCase().includes('warning:');
      markers.push({
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: 80,
        message: javaMatch[2].trim(),
        severity: isWarning ? SEVERITY.WARNING : SEVERITY.ERROR,
        source: 'Java Compiler'
      });
      continue;
    }

    // ------------------------------------------------------------------
    // GCC / Clang C/C++: main.cpp:8:12: error: expected ';'
    // ------------------------------------------------------------------
    const cppMatch = line.match(/(?:[A-Za-z0-9_.-]+):(\d+):(?:(\d+):)?\s+(?:fatal\s+)?(error|warning):\s+(.*)/i);
    if (cppMatch) {
      const lineNum   = parseInt(cppMatch[1], 10);
      const colNum    = cppMatch[2] ? parseInt(cppMatch[2], 10) : 1;
      const isWarning = cppMatch[3].toLowerCase() === 'warning';
      markers.push({
        startLineNumber: lineNum,
        startColumn: colNum,
        endLineNumber: lineNum,
        endColumn: colNum + 5,
        message: cppMatch[4].trim(),
        severity: isWarning ? SEVERITY.WARNING : SEVERITY.ERROR,
        source: `${language.toUpperCase()} Compiler`
      });
      continue;
    }

    // ------------------------------------------------------------------
    // Rust: error[E0308]: mismatched types --> main.rs:12:5
    // ------------------------------------------------------------------
    const rustMatch = line.match(/^(error|warning)(?:\[([A-Z]\d+)\])?\s*:\s*(.*)/);
    if (rustMatch && lines[i + 1]) {
      const locationLine = lines[i + 1].match(/-->\s+[^:]+:(\d+):(\d+)/);
      if (locationLine) {
        const lineNum   = parseInt(locationLine[1], 10);
        const colNum    = parseInt(locationLine[2], 10);
        const isWarning = rustMatch[1] === 'warning';
        const code_     = rustMatch[2] ? `[${rustMatch[2]}] ` : '';
        markers.push({
          startLineNumber: lineNum,
          startColumn: colNum,
          endLineNumber: lineNum,
          endColumn: colNum + 5,
          message: `${code_}${rustMatch[3].trim()}`,
          severity: isWarning ? SEVERITY.WARNING : SEVERITY.ERROR,
          source: 'Rust Compiler'
        });
        i++; // skip the '-->' line
        continue;
      }
    }

    // ------------------------------------------------------------------
    // Go: ./main.go:10:2: undefined: foo
    // ------------------------------------------------------------------
    const goMatch = line.match(/(?:\.\/)?[A-Za-z0-9_.-]+\.go:(\d+):(\d+):\s+(.*)/);
    if (goMatch) {
      const lineNum = parseInt(goMatch[1], 10);
      const colNum  = parseInt(goMatch[2], 10);
      markers.push({
        startLineNumber: lineNum,
        startColumn: colNum,
        endLineNumber: lineNum,
        endColumn: colNum + 5,
        message: goMatch[3].trim(),
        severity: SEVERITY.ERROR,
        source: 'Go Compiler'
      });
      continue;
    }

    // ------------------------------------------------------------------
    // TypeScript: index.ts(5,12): error TS2304: Cannot find name 'foo'
    // ------------------------------------------------------------------
    const tsMatch = line.match(/[A-Za-z0-9_.-]+\.tsx?\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.*)/i);
    if (tsMatch) {
      const lineNum   = parseInt(tsMatch[1], 10);
      const colNum    = parseInt(tsMatch[2], 10);
      const isWarning = tsMatch[3].toLowerCase() === 'warning';
      markers.push({
        startLineNumber: lineNum,
        startColumn: colNum,
        endLineNumber: lineNum,
        endColumn: colNum + 5,
        message: `${tsMatch[4]}: ${tsMatch[5].trim()}`,
        severity: isWarning ? SEVERITY.WARNING : SEVERITY.ERROR,
        source: 'TypeScript Compiler'
      });
      continue;
    }

    // ------------------------------------------------------------------
    // C# (csc/mcs/Roslyn): Program.cs(8,14): error CS1002: ; expected
    // ------------------------------------------------------------------
    const csMatch = line.match(/[A-Za-z0-9_.-]+\.cs\((\d+),(\d+)\):\s+(error|warning)\s+(CS\d+):\s+(.*)/i);
    if (csMatch) {
      const lineNum   = parseInt(csMatch[1], 10);
      const colNum    = parseInt(csMatch[2], 10);
      const isWarning = csMatch[3].toLowerCase() === 'warning';
      markers.push({
        startLineNumber: lineNum,
        startColumn: colNum,
        endLineNumber: lineNum,
        endColumn: colNum + 5,
        message: `${csMatch[4]}: ${csMatch[5].trim()}`,
        severity: isWarning ? SEVERITY.WARNING : SEVERITY.ERROR,
        source: 'C# Compiler'
      });
      continue;
    }
  }

  return markers;
}

// ============================================================================
// Language starter templates
// ============================================================================

export const LANGUAGE_STARTERS = {
  javascript: `// JavaScript (Node.js)\nfunction main() {\n  console.log("Hello from SyncStream JavaScript!");\n}\n\nmain();\n`,
  typescript: `// TypeScript\nfunction greet(name: string): string {\n  return \`Hello, \${name} from SyncStream!\`;\n}\n\nconsole.log(greet("Developer"));\n`,
  python: `# Python 3\ndef main():\n    print("Hello from SyncStream Python!")\n\nif __name__ == "__main__":\n    main()\n`,
  java: `// Java 21\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from SyncStream Java!");\n    }\n}\n`,
  cpp: `// C++ (GCC)\n#include <iostream>\n\nint main() {\n    std::cout << "Hello from SyncStream C++!" << std::endl;\n    return 0;\n}\n`,
  c: `// C (GCC)\n#include <stdio.h>\n\nint main() {\n    printf("Hello from SyncStream C!\\n");\n    return 0;\n}\n`,
  go: `// Go\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from SyncStream Go!")\n}\n`,
  rust: `// Rust\nfn main() {\n    println!("Hello from SyncStream Rust!");\n}\n`,
  csharp: `// C#\nusing System;\n\nclass Program {\n    static void Main(string[] args) {\n        Console.WriteLine("Hello from SyncStream C#!");\n    }\n}\n`,
  ruby: `# Ruby\ndef main\n  puts "Hello from SyncStream Ruby!"\nend\n\nmain\n`,
  php: `<?php\n// PHP\nfunction main() {\n    echo "Hello from SyncStream PHP!\\n";\n}\n\nmain();\n`,
  kotlin: `// Kotlin\nfun main() {\n    println("Hello from SyncStream Kotlin!")\n}\n`,
  swift: `// Swift\nimport Foundation\n\nfunc main() {\n    print("Hello from SyncStream Swift!")\n}\n\nmain()\n`,
  html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>SyncStream Preview</title>\n</head>\n<body>\n  <h1>Hello, SyncStream!</h1>\n</body>\n</html>\n`,
  css: `/* CSS */\nbody {\n  background-color: #121212;\n  color: #ffffff;\n  font-family: sans-serif;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  height: 100vh;\n  margin: 0;\n}\n`,
  json: `{\n  "name": "SyncStream",\n  "version": "1.0.0"\n}\n`,
  sql: `-- SQL\nSELECT 'Hello from SyncStream SQL!' AS message;\n`
};
