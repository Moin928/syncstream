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
        // Unexpected indent without preceding colon block
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
        // Pop indent stack to find match
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

    // 2. Check for JavaScript comments in Python
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

    // 3. Check for Gibberish & Stray Characters on the line
    // e.g. A standalone operator like '/', '%', '?', '!', '^', '*', '@' without decorator
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
    }

    // Check invalid start tokens (e.g. line starts with illegal operator like '/', '*', '%')
    else if (/^[/*%^&|]=?/.test(trimmed) && !trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
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

    // 4. Character scan for strings, brackets, and quotes
    let j = 0;
    while (j < rawLine.length) {
      // Triple quotes check
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
      if (char === '#') break; // Comment rest of line

      // String literal
      if (char === '"' || char === "'") {
        const quote = char;
        const startCol = j + 1;
        j++;
        let closed = false;
        while (j < rawLine.length) {
          if (rawLine[j] === '\\') {
            j += 2;
            continue;
          }
          if (rawLine[j] === quote) {
            closed = true;
            j++;
            break;
          }
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

      // Brackets
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

/**
 * Validates Java source code for structure, scopes, missing semicolons, and gibberish.
 */
export function validateJava(code) {
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

    // Check gibberish on line
    if (/^[/?!^&~%*+<>=.,;\\|]+$/.test(trimmed) && trimmed !== ';' && trimmed !== '{' && trimmed !== '}') {
      markers.push({
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: rawLine.length + 1,
        message: `Syntax error: illegal character / token '${trimmed}'`,
        severity: SEVERITY.ERROR,
        source: 'Java'
      });
      continue;
    }

    let effectiveLine = '';
    let j = 0;
    while (j < rawLine.length) {
      if (inMultiComment) {
        if (rawLine.substring(j, j + 2) === '*/') {
          inMultiComment = false;
          j += 2;
          continue;
        }
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

      // String literal
      if (char === '"') {
        const startCol = j + 1;
        j++;
        let closed = false;
        while (j < rawLine.length) {
          if (rawLine[j] === '\\') {
            j += 2;
            continue;
          }
          if (rawLine[j] === '"') {
            closed = true;
            j++;
            break;
          }
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
            source: 'Java'
          });
        }
        continue;
      }

      // Char literal
      if (char === "'") {
        const startCol = j + 1;
        j++;
        let closed = false;
        while (j < rawLine.length) {
          if (rawLine[j] === '\\') {
            j += 2;
            continue;
          }
          if (rawLine[j] === "'") {
            closed = true;
            j++;
            break;
          }
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
            source: 'Java'
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
            source: 'Java'
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
              source: 'Java'
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
            source: 'Java'
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
              source: 'Java'
            });
          }
        }
      }

      j++;
    }

    const cleanTrimmed = effectiveLine.trim();
    if (!cleanTrimmed) continue;

    // Scope rule: Outside any class (currentBraceDepth === 0)
    if (currentBraceDepth === 0 && !cleanTrimmed.includes('{') && !cleanTrimmed.includes('}')) {
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
          source: 'Java'
        });
      }
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
      const isBlockKeyword = /^(if|else|for|while|switch|case|default|class|interface|enum|record|try|catch|finally|synchronized|public|private|protected)\b/.test(cleanTrimmed);
      if (!isBlockKeyword && (cleanTrimmed.startsWith('return') || cleanTrimmed.startsWith('package') || cleanTrimmed.startsWith('import') || cleanTrimmed.includes('=') || cleanTrimmed.endsWith(')'))) {
        markers.push({
          startLineNumber: lineNum,
          startColumn: rawLine.length,
          endLineNumber: lineNum,
          endColumn: rawLine.length + 1,
          message: "Syntax error: insert ';' to complete statement",
          severity: SEVERITY.ERROR,
          source: 'Java'
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
      source: 'Java'
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
      source: 'Java'
    });
  }

  return markers;
}

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

    // Check gibberish on line
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
        if (rawLine.substring(j, j + 2) === '*/') {
          inMultiComment = false;
          j += 2;
          continue;
        }
        j++;
        continue;
      }

      if (rawLine.substring(j, j + 2) === '/*') {
        inMultiComment = true;
        j += 2;
        continue;
      }

      if (rawLine.substring(j, j + 2) === '//') break;
      if (trimmed.startsWith('#')) break;

      const char = rawLine[j];

      if (char === '"' || char === "'") {
        const quote = char;
        const startCol = j + 1;
        j++;
        let closed = false;
        while (j < rawLine.length) {
          if (rawLine[j] === '\\') {
            j += 2;
            continue;
          }
          if (rawLine[j] === quote) {
            closed = true;
            j++;
            break;
          }
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

    // Top level statement check in C/C++ (outside functions)
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
      colNum = parseInt(matchLineCol[2], 10);
    } else if (matchPosition) {
      const pos = parseInt(matchPosition[1], 10);
      const sub = code.substring(0, pos);
      const split = sub.split('\n');
      lineNum = split.length;
      colNum = split[split.length - 1].length + 1;
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

/**
 * Main dispatcher to run diagnostics for any language.
 */
export function runDiagnostics(code, language) {
  switch (language) {
    case 'python':
      return validatePython(code);
    case 'java':
    case 'csharp':
      return validateJava(code);
    case 'cpp':
    case 'c':
    case 'go':
    case 'rust':
      return validateCpp(code, language);
    case 'json':
      return validateJSON(code);
    default:
      return [];
  }
}

/**
 * Parses compiler and interpreter output error messages into Monaco markers.
 */
export function parseCompilerOutput(output, language) {
  if (!output || typeof output !== 'string') return [];
  const markers = [];
  const lines = output.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Python Traceback: File "...", line 4, in <module>
    const pyMatch = line.match(/File\s+"[^"]+",\s+line\s+(\d+)(?:,\s+in\s+.+)?/i);
    if (pyMatch) {
      const lineNum = parseInt(pyMatch[1], 10);
      const errorMsgLine = lines[i + 2] || lines[i + 1] || 'Python runtime error';
      markers.push({
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: 80,
        message: errorMsgLine.trim(),
        severity: SEVERITY.ERROR,
        source: 'Python Runtime'
      });
    }

    // Java Compiler: Main.java:5: error: ';' expected
    const javaMatch = line.match(/(?:[A-Za-z0-9_]+\.java):(\d+):\s+(?:error|warning):\s+(.*)/i);
    if (javaMatch) {
      const lineNum = parseInt(javaMatch[1], 10);
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
    }

    // GCC / Clang C/C++: main.cpp:8:12: error: expected ';'
    const cppMatch = line.match(/(?:[A-Za-z0-9_.-]+):(\d+):(?:(\d+):)?\s+(?:fatal\s+)?(error|warning):\s+(.*)/i);
    if (cppMatch) {
      const lineNum = parseInt(cppMatch[1], 10);
      const colNum = cppMatch[2] ? parseInt(cppMatch[2], 10) : 1;
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
    }
  }

  return markers;
}

export const LANGUAGE_STARTERS = {
  javascript: `// JavaScript (Node.js)\nfunction main() {\n  console.log("Hello from SyncStream JavaScript!");\n}\n\nmain();\n`,
  typescript: `// TypeScript\nfunction greet(name: string): string {\n  return \`Hello, \${name} from SyncStream!\`;\n}\n\nconsole.log(greet("Developer"));\n`,
  python: `# Python 3\ndef main():\n    print("Hello from SyncStream Python!")\n\nif __name__ == "__main__":\n    main()\n`,
  java: `// Java 21\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from SyncStream Java!");\n    }\n}\n`,
  cpp: `// C++ (GCC)\n#include <iostream>\n\nint main() {\n    std::cout << "Hello from SyncStream C++!" << std::endl;\n    return 0;\n}\n`,
  c: `// C (GCC)\n#include <stdio.h>\n\nint main() {\n    printf("Hello from SyncStream C!\\n");\n    return 0;\n}\n`,
  go: `// Go\npackage main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from SyncStream Go!")\n}\n`,
  rust: `// Rust\nfn main() {\n    println!("Hello from SyncStream Rust!");\n}\n`,
  html: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>SyncStream Preview</title>\n</head>\n<body>\n  <h1>Hello, SyncStream!</h1>\n</body>\n</html>\n`,
  css: `/* CSS */\nbody {\n  background-color: #121212;\n  color: #ffffff;\n  font-family: sans-serif;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  height: 100vh;\n  margin: 0;\n}\n`,
  json: `{\n  "name": "SyncStream",\n  "version": "1.0.0"\n}\n`,
  sql: `-- SQL\nSELECT 'Hello from SyncStream SQL!' AS message;\n`
};
