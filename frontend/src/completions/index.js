/**
 * SyncStream Multi-Language Completion Providers
 *
 * Registers keyword, snippet, and standard-library completion providers for
 * languages that Monaco does not natively serve via a language-service worker.
 *
 * Monaco provides full IntelliSense (type inference, member completions) only
 * for: JavaScript, TypeScript, JSON, CSS, and HTML.
 *
 * For all other languages this module registers:
 *   - Keywords        (CompletionItemKind.Keyword)
 *   - Snippets        (CompletionItemKind.Snippet, InsertAsSnippet rule)
 *   - Builtin symbols (CompletionItemKind.Function / Class / Module)
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a keyword CompletionItem.
 * @param {string} word
 * @returns {object}
 */
function kw(word) {
  return {
    label: word,
    kind: 17, // CompletionItemKind.Keyword
    detail: 'keyword',
    insertText: word,
    sortText: '2_' + word,
  };
}

/**
 * Creates a snippet CompletionItem with tab-stop support.
 * @param {string} label     - Displayed in the completion list
 * @param {string} body      - Snippet body (use ${N:placeholder} syntax)
 * @param {string} detail    - Short description shown on the right
 * @param {string} [doc]     - Optional markdown documentation string
 * @returns {object}
 */
function snip(label, body, detail, doc) {
  const item = {
    label,
    kind: 27, // CompletionItemKind.Snippet
    detail,
    insertText: body,
    insertTextRules: 4, // InsertTextRule.InsertAsSnippet
    sortText: '1_' + label,
  };
  if (doc) item.documentation = { value: doc };
  return item;
}

/**
 * Creates a builtin function / method CompletionItem.
 * @param {string} label
 * @param {string} insertText  - Text to insert (may include snippet placeholders)
 * @param {string} detail
 * @param {string} [doc]
 * @param {boolean} [isSnippet]
 * @returns {object}
 */
function builtin(label, insertText, detail, doc, isSnippet = false) {
  const item = {
    label,
    kind: 1, // CompletionItemKind.Function
    detail,
    insertText,
    sortText: '3_' + label,
  };
  if (isSnippet) item.insertTextRules = 4;
  if (doc) item.documentation = { value: doc };
  return item;
}

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

const PYTHON_ITEMS = [
  // Keywords
  ...['False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
      'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
      'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
      'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
      'try', 'while', 'with', 'yield'].map(kw),

  // Snippets
  snip('def', 'def ${1:function_name}(${2:args}):\n    ${3:pass}', 'Define a function'),
  snip('class', 'class ${1:ClassName}(${2:object}):\n    def __init__(self${3:, args}):\n        ${4:pass}', 'Define a class'),
  snip('if', 'if ${1:condition}:\n    ${2:pass}', 'If statement'),
  snip('ifelse', 'if ${1:condition}:\n    ${2:pass}\nelse:\n    ${3:pass}', 'If/else statement'),
  snip('elif', 'elif ${1:condition}:\n    ${2:pass}', 'Elif branch'),
  snip('for', 'for ${1:item} in ${2:iterable}:\n    ${3:pass}', 'For loop'),
  snip('forrange', 'for ${1:i} in range(${2:10}):\n    ${3:pass}', 'For range loop'),
  snip('while', 'while ${1:condition}:\n    ${2:pass}', 'While loop'),
  snip('try', 'try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${4:pass}', 'Try/except block'),
  snip('tryfinally', 'try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${4:pass}\nfinally:\n    ${5:pass}', 'Try/except/finally'),
  snip('with', 'with ${1:open("file")} as ${2:f}:\n    ${3:pass}', 'With statement'),
  snip('lambda', 'lambda ${1:args}: ${2:expr}', 'Lambda expression'),
  snip('comprehension', '[${1:expr} for ${2:x} in ${3:iterable}]', 'List comprehension'),
  snip('dictcomp', '{${1:key}: ${2:value} for ${3:k}, ${4:v} in ${5:iterable}.items()}', 'Dict comprehension'),
  snip('main', 'def main():\n    ${1:pass}\n\nif __name__ == "__main__":\n    main()', 'Main guard'),
  snip('dataclass', 'from dataclasses import dataclass\n\n@dataclass\nclass ${1:MyClass}:\n    ${2:field}: ${3:str}', 'Dataclass'),
  snip('property', '@property\ndef ${1:name}(self):\n    return self._${1:name}\n\n@${1:name}.setter\ndef ${1:name}(self, value):\n    self._${1:name} = value', 'Property with setter'),

  // Builtins
  builtin('print', 'print(${1:value})', 'print(value, ...)', 'Print to stdout.', true),
  builtin('len', 'len(${1:obj})', 'len(s) -> int', 'Return the number of items in a container.', true),
  builtin('range', 'range(${1:stop})', 'range(stop) or range(start, stop[, step])', '', true),
  builtin('type', 'type(${1:obj})', 'type(object) -> type', '', true),
  builtin('isinstance', 'isinstance(${1:obj}, ${2:classinfo})', 'isinstance(object, classinfo) -> bool', '', true),
  builtin('enumerate', 'enumerate(${1:iterable})', 'enumerate(iterable, start=0)', '', true),
  builtin('zip', 'zip(${1:iter1}, ${2:iter2})', 'zip(*iterables)', '', true),
  builtin('map', 'map(${1:func}, ${2:iterable})', 'map(function, iterable)', '', true),
  builtin('filter', 'filter(${1:func}, ${2:iterable})', 'filter(function, iterable)', '', true),
  builtin('sorted', 'sorted(${1:iterable})', 'sorted(iterable, *, key=None, reverse=False)', '', true),
  builtin('reversed', 'reversed(${1:seq})', 'reversed(sequence)', '', true),
  builtin('list', 'list(${1:iterable})', 'list(iterable) -> list', '', true),
  builtin('dict', 'dict(${1:})', 'dict(**kwargs) -> dict', '', true),
  builtin('set', 'set(${1:iterable})', 'set(iterable) -> set', '', true),
  builtin('tuple', 'tuple(${1:iterable})', 'tuple(iterable) -> tuple', '', true),
  builtin('int', 'int(${1:x})', 'int(x) -> int', '', true),
  builtin('str', 'str(${1:obj})', 'str(object) -> str', '', true),
  builtin('float', 'float(${1:x})', 'float(x) -> float', '', true),
  builtin('bool', 'bool(${1:x})', 'bool(x) -> bool', '', true),
  builtin('input', 'input(${1:"prompt: "})', 'input(prompt) -> str', 'Read a string from stdin.', true),
  builtin('open', 'open(${1:"file"}, ${2:"r"})', 'open(file, mode) -> IO', '', true),
  builtin('super', 'super()', 'super() -> proxy', '', true),
  builtin('hasattr', 'hasattr(${1:obj}, ${2:"name"})', 'hasattr(object, name) -> bool', '', true),
  builtin('getattr', 'getattr(${1:obj}, ${2:"name"})', 'getattr(object, name[, default])', '', true),
  builtin('setattr', 'setattr(${1:obj}, ${2:"name"}, ${3:value})', 'setattr(object, name, value)', '', true),
  builtin('abs', 'abs(${1:x})', 'abs(number) -> number', '', true),
  builtin('max', 'max(${1:iterable})', 'max(iterable) -> value', '', true),
  builtin('min', 'min(${1:iterable})', 'min(iterable) -> value', '', true),
  builtin('sum', 'sum(${1:iterable})', 'sum(iterable, start=0) -> number', '', true),
  builtin('any', 'any(${1:iterable})', 'any(iterable) -> bool', '', true),
  builtin('all', 'all(${1:iterable})', 'all(iterable) -> bool', '', true),
];

// ---------------------------------------------------------------------------
// Java
// ---------------------------------------------------------------------------

const JAVA_ITEMS = [
  // Keywords
  ...['abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch',
      'char', 'class', 'continue', 'default', 'do', 'double', 'else',
      'enum', 'extends', 'final', 'finally', 'float', 'for', 'if',
      'implements', 'import', 'instanceof', 'int', 'interface', 'long',
      'native', 'new', 'null', 'package', 'private', 'protected', 'public',
      'record', 'return', 'sealed', 'short', 'static', 'strictfp', 'super',
      'switch', 'synchronized', 'this', 'throw', 'throws', 'transient',
      'try', 'var', 'void', 'volatile', 'while', 'yield'].map(kw),

  // Snippets
  snip('class', 'public class ${1:ClassName} {\n    ${2:// body}\n}', 'Public class'),
  snip('main', 'public static void main(String[] args) {\n    ${1:// body}\n}', 'Main method'),
  snip('sout', 'System.out.println(${1:value});', 'System.out.println'),
  snip('if', 'if (${1:condition}) {\n    ${2:// body}\n}', 'If statement'),
  snip('ifelse', 'if (${1:condition}) {\n    ${2:// body}\n} else {\n    ${3:// else}\n}', 'If/else'),
  snip('for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3:// body}\n}', 'For loop'),
  snip('foreach', 'for (${1:Type} ${2:item} : ${3:collection}) {\n    ${4:// body}\n}', 'Enhanced for loop'),
  snip('while', 'while (${1:condition}) {\n    ${2:// body}\n}', 'While loop'),
  snip('try', 'try {\n    ${1:// body}\n} catch (${2:Exception} ${3:e}) {\n    ${4:e.printStackTrace()}\n}', 'Try/catch'),
  snip('tryfinally', 'try {\n    ${1:// body}\n} catch (${2:Exception} ${3:e}) {\n    ${4:e.printStackTrace()}\n} finally {\n    ${5:// cleanup}\n}', 'Try/catch/finally'),
  snip('interface', 'public interface ${1:Name} {\n    ${2:// methods}\n}', 'Interface'),
  snip('enum', 'public enum ${1:Name} {\n    ${2:VALUE1}, ${3:VALUE2}\n}', 'Enum'),
  snip('record', 'public record ${1:Name}(${2:Type} ${3:field}) {}', 'Record'),
  snip('lambda', '(${1:args}) -> ${2:expr}', 'Lambda expression'),
  snip('switch', 'switch (${1:expr}) {\n    case ${2:value}:\n        ${3:// body}\n        break;\n    default:\n        ${4:// default}\n}', 'Switch statement'),

  // Builtins / common API
  builtin('System.out.println', 'System.out.println(${1:value})', 'Print line to stdout', '', true),
  builtin('System.out.print', 'System.out.print(${1:value})', 'Print to stdout (no newline)', '', true),
  builtin('System.err.println', 'System.err.println(${1:value})', 'Print line to stderr', '', true),
  builtin('String.format', 'String.format("${1:%s}", ${2:args})', 'Format a string', '', true),
  builtin('Arrays.asList', 'Arrays.asList(${1:elements})', 'Create a fixed-size list', '', true),
  builtin('Collections.sort', 'Collections.sort(${1:list})', 'Sort a list in-place', '', true),
  builtin('Math.max', 'Math.max(${1:a}, ${2:b})', 'Return the larger of two values', '', true),
  builtin('Math.min', 'Math.min(${1:a}, ${2:b})', 'Return the smaller of two values', '', true),
  builtin('Math.abs', 'Math.abs(${1:x})', 'Return the absolute value', '', true),
  builtin('Math.sqrt', 'Math.sqrt(${1:x})', 'Return the square root', '', true),
  builtin('Integer.parseInt', 'Integer.parseInt(${1:s})', 'Parse an int from a string', '', true),
  builtin('Double.parseDouble', 'Double.parseDouble(${1:s})', 'Parse a double from a string', '', true),
  builtin('new ArrayList', 'new ArrayList<>()', 'Create an ArrayList', '', false),
  builtin('new HashMap', 'new HashMap<>()', 'Create a HashMap', '', false),
  builtin('new HashSet', 'new HashSet<>()', 'Create a HashSet', '', false),
];

// ---------------------------------------------------------------------------
// C++
// ---------------------------------------------------------------------------

const CPP_ITEMS = [
  // Keywords
  ...['alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand',
      'bitor', 'bool', 'break', 'case', 'catch', 'char', 'char8_t',
      'char16_t', 'char32_t', 'class', 'compl', 'concept', 'const',
      'consteval', 'constexpr', 'constinit', 'const_cast', 'continue',
      'co_await', 'co_return', 'co_yield', 'decltype', 'default', 'delete',
      'do', 'double', 'dynamic_cast', 'else', 'enum', 'explicit', 'export',
      'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'inline',
      'int', 'long', 'mutable', 'namespace', 'new', 'noexcept', 'not',
      'not_eq', 'nullptr', 'operator', 'or', 'or_eq', 'private', 'protected',
      'public', 'register', 'reinterpret_cast', 'requires', 'return', 'short',
      'signed', 'sizeof', 'static', 'static_assert', 'static_cast', 'struct',
      'switch', 'template', 'this', 'thread_local', 'throw', 'true', 'try',
      'typedef', 'typeid', 'typename', 'union', 'unsigned', 'using',
      'virtual', 'void', 'volatile', 'wchar_t', 'while', 'xor', 'xor_eq'].map(kw),

  // Snippets
  snip('main', '#include <iostream>\n\nint main() {\n    ${1:// body}\n    return 0;\n}', 'Main function with iostream'),
  snip('class', 'class ${1:ClassName} {\npublic:\n    ${1:ClassName}() = default;\n    ~${1:ClassName}() = default;\n\n    ${2:// members}\n};', 'Class definition'),
  snip('struct', 'struct ${1:Name} {\n    ${2:// fields}\n};', 'Struct definition'),
  snip('if', 'if (${1:condition}) {\n    ${2:// body}\n}', 'If statement'),
  snip('ifelse', 'if (${1:condition}) {\n    ${2:// body}\n} else {\n    ${3:// else}\n}', 'If/else'),
  snip('for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n    ${3:// body}\n}', 'For loop'),
  snip('rangefor', 'for (const auto& ${1:item} : ${2:container}) {\n    ${3:// body}\n}', 'Range-based for loop'),
  snip('while', 'while (${1:condition}) {\n    ${2:// body}\n}', 'While loop'),
  snip('try', 'try {\n    ${1:// body}\n} catch (const std::exception& ${2:e}) {\n    std::cerr << ${2:e}.what() << "\\n";\n}', 'Try/catch'),
  snip('lambda', '[${1:capture}](${2:args}) {\n    ${3:// body}\n}', 'Lambda expression'),
  snip('template', 'template <typename ${1:T}>\n${2:void} ${3:function}(${1:T} ${4:arg}) {\n    ${5:// body}\n}', 'Template function'),
  snip('namespace', 'namespace ${1:name} {\n\n${2:// content}\n\n} // namespace ${1:name}', 'Namespace block'),
  snip('enum class', 'enum class ${1:Name} {\n    ${2:Value1},\n    ${3:Value2}\n};', 'Scoped enum'),
  snip('switch', 'switch (${1:expr}) {\n    case ${2:value}:\n        ${3:// body}\n        break;\n    default:\n        break;\n}', 'Switch statement'),
  snip('unique_ptr', 'std::unique_ptr<${1:Type}> ${2:ptr} = std::make_unique<${1:Type}>(${3:args});', 'unique_ptr'),
  snip('shared_ptr', 'std::shared_ptr<${1:Type}> ${2:ptr} = std::make_shared<${1:Type}>(${3:args});', 'shared_ptr'),

  // Builtins / common stdlib
  builtin('std::cout', 'std::cout << ${1:value} << "\\n"', 'Print to stdout', '', true),
  builtin('std::cin', 'std::cin >> ${1:variable}', 'Read from stdin', '', true),
  builtin('std::cerr', 'std::cerr << ${1:msg} << "\\n"', 'Print to stderr', '', true),
  builtin('std::string', 'std::string', 'Standard string type', ''),
  builtin('std::vector', 'std::vector<${1:T}>', 'Dynamic array', '', true),
  builtin('std::map', 'std::map<${1:Key}, ${2:Value}>', 'Ordered key-value map', '', true),
  builtin('std::unordered_map', 'std::unordered_map<${1:Key}, ${2:Value}>', 'Hash map', '', true),
  builtin('std::set', 'std::set<${1:T}>', 'Ordered set', '', true),
  builtin('std::array', 'std::array<${1:T}, ${2:N}>', 'Fixed-size array', '', true),
  builtin('std::pair', 'std::pair<${1:T1}, ${2:T2}>', 'Pair of values', '', true),
  builtin('std::optional', 'std::optional<${1:T}>', 'Optional value (C++17)', '', true),
  builtin('std::make_unique', 'std::make_unique<${1:T}>(${2:args})', 'Create unique_ptr', '', true),
  builtin('std::make_shared', 'std::make_shared<${1:T}>(${2:args})', 'Create shared_ptr', '', true),
  builtin('std::move', 'std::move(${1:value})', 'Cast to rvalue reference', '', true),
  builtin('std::sort', 'std::sort(${1:begin}, ${2:end})', 'Sort a range', '', true),
  builtin('std::find', 'std::find(${1:begin}, ${2:end}, ${3:value})', 'Find value in range', '', true),
  builtin('std::endl', 'std::endl', 'Output newline and flush stream', ''),
];

// ---------------------------------------------------------------------------
// C  (subset of C++)
// ---------------------------------------------------------------------------

const C_ITEMS = [
  ...['auto', 'break', 'case', 'char', 'const', 'continue', 'default',
      'do', 'double', 'else', 'enum', 'extern', 'float', 'for', 'goto',
      'if', 'inline', 'int', 'long', 'register', 'restrict', 'return',
      'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef',
      'union', 'unsigned', 'void', 'volatile', 'while'].map(kw),

  snip('main', '#include <stdio.h>\n\nint main(void) {\n    ${1:// body}\n    return 0;\n}', 'Main function'),
  snip('struct', 'typedef struct ${1:Name} {\n    ${2:// fields}\n} ${1:Name};', 'Typedef struct'),
  snip('if', 'if (${1:condition}) {\n    ${2:// body}\n}', 'If statement'),
  snip('ifelse', 'if (${1:condition}) {\n    ${2:// body}\n} else {\n    ${3:// else}\n}', 'If/else'),
  snip('for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n    ${3:// body}\n}', 'For loop'),
  snip('while', 'while (${1:condition}) {\n    ${2:// body}\n}', 'While loop'),
  snip('switch', 'switch (${1:expr}) {\n    case ${2:value}:\n        ${3:// body}\n        break;\n    default:\n        break;\n}', 'Switch statement'),
  snip('printf', 'printf("${1:%s}\\n", ${2:args})', 'printf'),
  snip('#include', '#include <${1:header}.h>', 'Include header'),
  snip('#define', '#define ${1:NAME} ${2:value}', 'Preprocessor define'),

  builtin('printf', 'printf("${1:format}", ${2:args})', 'Print formatted output', '', true),
  builtin('scanf', 'scanf("${1:format}", ${2:&var})', 'Read formatted input', '', true),
  builtin('fprintf', 'fprintf(${1:stderr}, "${2:format}", ${3:args})', 'Print to file stream', '', true),
  builtin('malloc', 'malloc(${1:size})', 'Allocate memory', '', true),
  builtin('calloc', 'calloc(${1:count}, ${2:size})', 'Allocate and zero memory', '', true),
  builtin('realloc', 'realloc(${1:ptr}, ${2:size})', 'Resize allocated memory', '', true),
  builtin('free', 'free(${1:ptr})', 'Free allocated memory', '', true),
  builtin('strlen', 'strlen(${1:str})', 'String length', '', true),
  builtin('strcpy', 'strcpy(${1:dest}, ${2:src})', 'Copy string', '', true),
  builtin('strncpy', 'strncpy(${1:dest}, ${2:src}, ${3:n})', 'Copy n chars of string', '', true),
  builtin('strcmp', 'strcmp(${1:s1}, ${2:s2})', 'Compare strings', '', true),
  builtin('strcat', 'strcat(${1:dest}, ${2:src})', 'Concatenate strings', '', true),
  builtin('memset', 'memset(${1:ptr}, ${2:0}, ${3:size})', 'Fill memory with byte', '', true),
  builtin('memcpy', 'memcpy(${1:dest}, ${2:src}, ${3:size})', 'Copy memory block', '', true),
];

// ---------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------

const GO_ITEMS = [
  // Keywords
  ...['break', 'case', 'chan', 'const', 'continue', 'default', 'defer',
      'else', 'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import',
      'interface', 'map', 'package', 'range', 'return', 'select', 'struct',
      'switch', 'type', 'var'].map(kw),

  // Snippets
  snip('main', 'package main\n\nimport "fmt"\n\nfunc main() {\n    ${1:// body}\n}', 'Main package'),
  snip('func', 'func ${1:name}(${2:args}) ${3:returnType} {\n    ${4:// body}\n}', 'Function definition'),
  snip('method', 'func (${1:r} ${2:Receiver}) ${3:Name}(${4:args}) ${5:returnType} {\n    ${6:// body}\n}', 'Method definition'),
  snip('struct', 'type ${1:Name} struct {\n    ${2:Field} ${3:Type}\n}', 'Struct definition'),
  snip('interface', 'type ${1:Name} interface {\n    ${2:Method}(${3:args}) ${4:returnType}\n}', 'Interface definition'),
  snip('if', 'if ${1:condition} {\n    ${2:// body}\n}', 'If statement'),
  snip('iferr', 'if err != nil {\n    ${1:return err}\n}', 'Error check'),
  snip('iferrassign', '${1:result}, err := ${2:func}(${3:args})\nif err != nil {\n    ${4:return err}\n}', 'Assign and check error'),
  snip('for', 'for ${1:i} := 0; ${1:i} < ${2:n}; ${1:i}++ {\n    ${3:// body}\n}', 'For loop'),
  snip('forrange', 'for ${1:i}, ${2:v} := range ${3:collection} {\n    ${4:// body}\n}', 'For range loop'),
  snip('switch', 'switch ${1:expr} {\ncase ${2:value}:\n    ${3:// body}\ndefault:\n    ${4:// default}\n}', 'Switch statement'),
  snip('goroutine', 'go func() {\n    ${1:// body}\n}()', 'Goroutine (IIFE)'),
  snip('channel', '${1:ch} := make(chan ${2:int}, ${3:1})', 'Make a channel'),
  snip('select', 'select {\ncase ${1:v} := <-${2:ch}:\n    ${3:// body}\ndefault:\n    ${4:// default}\n}', 'Select statement'),
  snip('test', 'func Test${1:Name}(t *testing.T) {\n    ${2:// test body}\n}', 'Test function'),
  snip('goroutinewg', 'var wg sync.WaitGroup\nwg.Add(${1:1})\ngo func() {\n    defer wg.Done()\n    ${2:// body}\n}()\nwg.Wait()', 'Goroutine with WaitGroup'),

  // Builtins / fmt package
  builtin('fmt.Println', 'fmt.Println(${1:args})', 'fmt.Println — print with newline', '', true),
  builtin('fmt.Printf', 'fmt.Printf("${1:%v}", ${2:args})', 'fmt.Printf — formatted print', '', true),
  builtin('fmt.Sprintf', 'fmt.Sprintf("${1:%v}", ${2:args})', 'fmt.Sprintf — format to string', '', true),
  builtin('fmt.Errorf', 'fmt.Errorf("${1:message}: %w", ${2:err})', 'fmt.Errorf — wrap an error', '', true),
  builtin('fmt.Fprintf', 'fmt.Fprintf(${1:w}, "${2:%s}", ${3:args})', 'fmt.Fprintf — write to writer', '', true),
  builtin('make', 'make(${1:[]int}, ${2:len})', 'make — allocate slice/map/chan', '', true),
  builtin('new', 'new(${1:Type})', 'new — allocate pointer', '', true),
  builtin('append', 'append(${1:slice}, ${2:elems})', 'append — add to slice', '', true),
  builtin('len', 'len(${1:v})', 'len — length of collection', '', true),
  builtin('cap', 'cap(${1:v})', 'cap — capacity of slice', '', true),
  builtin('copy', 'copy(${1:dst}, ${2:src})', 'copy — copy slice elements', '', true),
  builtin('delete', 'delete(${1:m}, ${2:key})', 'delete — remove map entry', '', true),
  builtin('close', 'close(${1:ch})', 'close — close a channel', '', true),
  builtin('panic', 'panic(${1:"message"})', 'panic — trigger a runtime panic', '', true),
  builtin('recover', 'recover()', 'recover — stop a panicking goroutine', '', false),
  builtin('errors.New', 'errors.New("${1:message}")', 'errors.New — create an error', '', true),
];

// ---------------------------------------------------------------------------
// Rust
// ---------------------------------------------------------------------------

const RUST_ITEMS = [
  // Keywords
  ...['as', 'async', 'await', 'break', 'const', 'continue', 'crate',
      'dyn', 'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl',
      'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref',
      'return', 'self', 'Self', 'static', 'struct', 'super', 'trait',
      'true', 'type', 'union', 'unsafe', 'use', 'where', 'while'].map(kw),

  // Snippets
  snip('main', 'fn main() {\n    ${1:// body}\n}', 'Main function'),
  snip('fn', 'fn ${1:name}(${2:args}) ${3:-> ReturnType} {\n    ${4:// body}\n}', 'Function definition'),
  snip('struct', 'struct ${1:Name} {\n    ${2:field}: ${3:Type},\n}', 'Struct definition'),
  snip('enum', 'enum ${1:Name} {\n    ${2:Variant1},\n    ${3:Variant2}(${4:Type}),\n}', 'Enum definition'),
  snip('impl', 'impl ${1:Type} {\n    pub fn ${2:new}(${3:args}) -> Self {\n        ${4:// body}\n    }\n}', 'Impl block'),
  snip('trait', 'trait ${1:Name} {\n    fn ${2:method}(${3:&self}) ${4:-> ReturnType};\n}', 'Trait definition'),
  snip('if', 'if ${1:condition} {\n    ${2:// body}\n}', 'If expression'),
  snip('iflet', 'if let ${1:Some(val)} = ${2:expr} {\n    ${3:// body}\n}', 'If let'),
  snip('whilelet', 'while let ${1:Some(val)} = ${2:iter}.next() {\n    ${3:// body}\n}', 'While let'),
  snip('match', 'match ${1:expr} {\n    ${2:pattern} => ${3:// body},\n    _ => ${4:// default},\n}', 'Match expression'),
  snip('for', 'for ${1:item} in ${2:iter} {\n    ${3:// body}\n}', 'For loop'),
  snip('loop', 'loop {\n    ${1:// body}\n    break;\n}', 'Loop'),
  snip('closure', '|${1:args}| {\n    ${2:// body}\n}', 'Closure'),
  snip('vec', 'vec![${1:elements}]', 'Vec macro'),
  snip('use', 'use ${1:std::collections::HashMap};', 'Use statement'),
  snip('mod', 'mod ${1:name} {\n    ${2:// content}\n}', 'Module block'),
  snip('test', '#[cfg(test)]\nmod tests {\n    use super::*;\n\n    #[test]\n    fn ${1:test_name}() {\n        ${2:// assertions}\n    }\n}', 'Test module'),
  snip('testfn', '#[test]\nfn ${1:test_name}() {\n    ${2:// assertions}\n}', 'Test function'),

  // Builtins / macros
  builtin('println!', 'println!("${1:{:?}}", ${2:val})', 'println! — print with newline', '', true),
  builtin('print!', 'print!("${1:{}}", ${2:val})', 'print! — print without newline', '', true),
  builtin('eprintln!', 'eprintln!("${1:{}}", ${2:val})', 'eprintln! — print to stderr', '', true),
  builtin('format!', 'format!("${1:{}}", ${2:val})', 'format! — format to String', '', true),
  builtin('panic!', 'panic!("${1:message}")', 'panic! — halt with message', '', true),
  builtin('assert!', 'assert!(${1:condition})', 'assert! — check condition', '', true),
  builtin('assert_eq!', 'assert_eq!(${1:left}, ${2:right})', 'assert_eq! — check equality', '', true),
  builtin('assert_ne!', 'assert_ne!(${1:left}, ${2:right})', 'assert_ne! — check inequality', '', true),
  builtin('dbg!', 'dbg!(${1:expr})', 'dbg! — debug print and return value', '', true),
  builtin('vec!', 'vec![${1:elements}]', 'vec! — create a Vec', '', true),
  builtin('Box::new', 'Box::new(${1:value})', 'Box::new — heap allocation', '', true),
  builtin('Rc::new', 'Rc::new(${1:value})', 'Rc::new — reference counted', '', true),
  builtin('Arc::new', 'Arc::new(${1:value})', 'Arc::new — thread-safe reference counted', '', true),
  builtin('Some', 'Some(${1:value})', 'Some — wrap in Option', '', true),
  builtin('Ok', 'Ok(${1:value})', 'Ok — success Result variant', '', true),
  builtin('Err', 'Err(${1:error})', 'Err — error Result variant', '', true),
  builtin('unwrap', '.unwrap()', 'unwrap — extract value or panic', ''),
  builtin('expect', '.expect("${1:message}")', 'expect — unwrap with message', '', true),
  builtin('map', '.map(|${1:x}| ${2:x})', '.map — transform Option/Result/Iterator', '', true),
  builtin('and_then', '.and_then(|${1:x}| ${2:Ok(x)})', '.and_then — chain Result/Option', '', true),
];

// ---------------------------------------------------------------------------
// C#
// ---------------------------------------------------------------------------

const CSHARP_ITEMS = [
  // Keywords
  ...['abstract', 'as', 'async', 'await', 'base', 'bool', 'break', 'byte',
      'case', 'catch', 'char', 'checked', 'class', 'const', 'continue',
      'decimal', 'default', 'delegate', 'do', 'double', 'else', 'enum',
      'event', 'explicit', 'extern', 'false', 'finally', 'fixed', 'float',
      'for', 'foreach', 'goto', 'if', 'implicit', 'in', 'int', 'interface',
      'internal', 'is', 'lock', 'long', 'namespace', 'new', 'not', 'null',
      'object', 'operator', 'out', 'override', 'params', 'partial',
      'private', 'protected', 'public', 'readonly', 'record', 'ref',
      'return', 'sbyte', 'sealed', 'short', 'sizeof', 'stackalloc', 'static',
      'string', 'struct', 'switch', 'this', 'throw', 'true', 'try', 'typeof',
      'uint', 'ulong', 'unchecked', 'unsafe', 'ushort', 'using', 'var',
      'virtual', 'void', 'volatile', 'while', 'with', 'yield'].map(kw),

  // Snippets
  snip('class', 'public class ${1:ClassName}\n{\n    ${2:// body}\n}', 'Public class'),
  snip('main', 'static void Main(string[] args)\n{\n    ${1:// body}\n}', 'Main method'),
  snip('cw', 'Console.WriteLine(${1:value});', 'Console.WriteLine'),
  snip('prop', 'public ${1:int} ${2:Name} { get; set; }', 'Auto property'),
  snip('if', 'if (${1:condition})\n{\n    ${2:// body}\n}', 'If statement'),
  snip('ifelse', 'if (${1:condition})\n{\n    ${2:// body}\n}\nelse\n{\n    ${3:// else}\n}', 'If/else'),
  snip('for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++)\n{\n    ${3:// body}\n}', 'For loop'),
  snip('foreach', 'foreach (var ${1:item} in ${2:collection})\n{\n    ${3:// body}\n}', 'Foreach loop'),
  snip('while', 'while (${1:condition})\n{\n    ${2:// body}\n}', 'While loop'),
  snip('try', 'try\n{\n    ${1:// body}\n}\ncatch (${2:Exception} ${3:ex})\n{\n    ${4:// handle}\n}', 'Try/catch'),
  snip('switch', 'switch (${1:expr})\n{\n    case ${2:value}:\n        ${3:// body}\n        break;\n    default:\n        break;\n}', 'Switch statement'),
  snip('interface', 'public interface ${1:IName}\n{\n    ${2:// methods}\n}', 'Interface'),
  snip('record', 'public record ${1:Name}(${2:string} ${3:Field});', 'Record type'),
  snip('lambda', '(${1:args}) => ${2:expr}', 'Lambda expression'),
  snip('ctor', 'public ${1:ClassName}(${2:args})\n{\n    ${3:// body}\n}', 'Constructor'),
  snip('using', 'using (var ${1:resource} = ${2:new Resource()})\n{\n    ${3:// body}\n}', 'Using statement'),

  // Builtins
  builtin('Console.WriteLine', 'Console.WriteLine(${1:value})', 'Print line to console', '', true),
  builtin('Console.Write', 'Console.Write(${1:value})', 'Print to console (no newline)', '', true),
  builtin('Console.ReadLine', 'Console.ReadLine()', 'Read line from console', '', false),
  builtin('string.Format', 'string.Format("${1:{0}}", ${2:args})', 'Format a string', '', true),
  builtin('String.IsNullOrEmpty', 'String.IsNullOrEmpty(${1:s})', 'Check if string is null or empty', '', true),
  builtin('int.Parse', 'int.Parse(${1:s})', 'Parse int from string', '', true),
  builtin('Convert.ToInt32', 'Convert.ToInt32(${1:value})', 'Convert to int', '', true),
  builtin('Math.Max', 'Math.Max(${1:a}, ${2:b})', 'Return larger of two values', '', true),
  builtin('Math.Min', 'Math.Min(${1:a}, ${2:b})', 'Return smaller of two values', '', true),
  builtin('new List', 'new List<${1:T}>()', 'Create List<T>', '', true),
  builtin('new Dictionary', 'new Dictionary<${1:TKey}, ${2:TValue}>()', 'Create Dictionary<K,V>', '', true),
];

// ---------------------------------------------------------------------------
// Ruby
// ---------------------------------------------------------------------------

const RUBY_ITEMS = [
  // Keywords
  ...['__ENCODING__', '__LINE__', '__FILE__', 'BEGIN', 'END', 'alias',
      'and', 'begin', 'break', 'case', 'class', 'def', 'defined?', 'do',
      'else', 'elsif', 'end', 'ensure', 'false', 'for', 'if', 'in',
      'module', 'next', 'nil', 'not', 'or', 'redo', 'rescue', 'retry',
      'return', 'self', 'super', 'then', 'true', 'undef', 'unless',
      'until', 'when', 'while', 'yield'].map(kw),

  // Snippets
  snip('def', 'def ${1:method_name}(${2:args})\n  ${3:# body}\nend', 'Define a method'),
  snip('class', 'class ${1:ClassName}\n  def initialize(${2:args})\n    ${3:# body}\n  end\nend', 'Class definition'),
  snip('module', 'module ${1:ModuleName}\n  ${2:# body}\nend', 'Module definition'),
  snip('if', 'if ${1:condition}\n  ${2:# body}\nend', 'If statement'),
  snip('ifelse', 'if ${1:condition}\n  ${2:# body}\nelse\n  ${3:# else}\nend', 'If/else'),
  snip('unless', 'unless ${1:condition}\n  ${2:# body}\nend', 'Unless statement'),
  snip('while', 'while ${1:condition}\n  ${2:# body}\nend', 'While loop'),
  snip('for', 'for ${1:item} in ${2:collection}\n  ${3:# body}\nend', 'For loop'),
  snip('each', '${1:collection}.each do |${2:item}|\n  ${3:# body}\nend', 'Each iterator'),
  snip('times', '${1:n}.times do |${2:i}|\n  ${3:# body}\nend', 'Times iterator'),
  snip('map', '${1:collection}.map do |${2:item}|\n  ${3:# transform}\nend', 'Map iterator'),
  snip('begin', 'begin\n  ${1:# body}\nrescue ${2:StandardError} => ${3:e}\n  ${4:# handle}\nend', 'Begin/rescue'),
  snip('lambda', '${1:my_lambda} = lambda { |${2:args}| ${3:# body} }', 'Lambda'),
  snip('proc', '${1:my_proc} = proc { |${2:args}| ${3:# body} }', 'Proc'),
  snip('attr', 'attr_accessor :${1:name}', 'attr_accessor'),

  // Builtins
  builtin('puts', 'puts ${1:value}', 'Print with newline', '', true),
  builtin('print', 'print ${1:value}', 'Print without newline', '', true),
  builtin('p', 'p ${1:value}', 'Inspect and print', '', true),
  builtin('pp', 'pp ${1:value}', 'Pretty print', '', true),
  builtin('gets', 'gets.chomp', 'Read line from stdin', '', false),
  builtin('require', 'require "${1:library}"', 'Require a library', '', true),
  builtin('require_relative', 'require_relative "${1:file}"', 'Require a relative file', '', true),
  builtin('raise', 'raise ${1:StandardError}, "${2:message}"', 'Raise an exception', '', true),
];

// ---------------------------------------------------------------------------
// PHP
// ---------------------------------------------------------------------------

const PHP_ITEMS = [
  // Keywords
  ...['abstract', 'and', 'array', 'as', 'break', 'callable', 'case',
      'catch', 'class', 'clone', 'const', 'continue', 'declare', 'default',
      'do', 'echo', 'else', 'elseif', 'empty', 'enddeclare', 'endfor',
      'endforeach', 'endif', 'endswitch', 'endwhile', 'enum', 'extends',
      'false', 'final', 'finally', 'fn', 'for', 'foreach', 'function',
      'global', 'goto', 'if', 'implements', 'include', 'include_once',
      'instanceof', 'insteadof', 'interface', 'isset', 'list', 'match',
      'namespace', 'new', 'null', 'or', 'print', 'private', 'protected',
      'public', 'readonly', 'require', 'require_once', 'return', 'static',
      'switch', 'throw', 'trait', 'true', 'try', 'unset', 'use',
      'var', 'while', 'xor', 'yield'].map(kw),

  // Snippets
  snip('class', 'class ${1:ClassName} {\n    public function __construct(${2:args}) {\n        ${3:// body}\n    }\n}', 'Class definition'),
  snip('function', 'function ${1:name}(${2:args}): ${3:void} {\n    ${4:// body}\n}', 'Function definition'),
  snip('if', 'if (${1:condition}) {\n    ${2:// body}\n}', 'If statement'),
  snip('ifelse', 'if (${1:condition}) {\n    ${2:// body}\n} else {\n    ${3:// else}\n}', 'If/else'),
  snip('foreach', 'foreach (${1:$array} as ${2:$key} => ${3:$value}) {\n    ${4:// body}\n}', 'Foreach loop'),
  snip('for', 'for (${1:$i} = 0; ${1:$i} < ${2:$n}; ${1:$i}++) {\n    ${3:// body}\n}', 'For loop'),
  snip('while', 'while (${1:condition}) {\n    ${2:// body}\n}', 'While loop'),
  snip('try', 'try {\n    ${1:// body}\n} catch (${2:Exception} $${3:e}) {\n    ${4:// handle}\n}', 'Try/catch'),
  snip('switch', 'switch (${1:$var}) {\n    case ${2:value}:\n        ${3:// body}\n        break;\n    default:\n        break;\n}', 'Switch statement'),
  snip('match', 'match (${1:$var}) {\n    ${2:value} => ${3:result},\n    default => ${4:default},\n}', 'Match expression (PHP 8)'),

  // Builtins
  builtin('echo', 'echo ${1:$value};', 'Output a value', '', true),
  builtin('print_r', 'print_r(${1:$value});', 'Print human-readable info', '', true),
  builtin('var_dump', 'var_dump(${1:$value});', 'Dump variable info', '', true),
  builtin('var_export', 'var_export(${1:$value});', 'Export variable representation', '', true),
  builtin('isset', 'isset(${1:$var})', 'Check if variable is set', '', true),
  builtin('empty', 'empty(${1:$var})', 'Check if variable is empty', '', true),
  builtin('count', 'count(${1:$array})', 'Count array elements', '', true),
  builtin('array_push', 'array_push(${1:$array}, ${2:$value})', 'Push to array', '', true),
  builtin('array_map', 'array_map(${1:fn}, ${2:$array})', 'Map over array', '', true),
  builtin('array_filter', 'array_filter(${1:$array}, ${2:fn})', 'Filter array', '', true),
  builtin('array_merge', 'array_merge(${1:$a}, ${2:$b})', 'Merge arrays', '', true),
  builtin('str_replace', 'str_replace(${1:$search}, ${2:$replace}, ${3:$subject})', 'Replace substring', '', true),
  builtin('strlen', 'strlen(${1:$string})', 'String length', '', true),
  builtin('explode', 'explode(${1:"delimiter"}, ${2:$string})', 'Split string', '', true),
  builtin('implode', 'implode(${1:"glue"}, ${2:$array})', 'Join array to string', '', true),
  builtin('json_encode', 'json_encode(${1:$value})', 'JSON encode', '', true),
  builtin('json_decode', 'json_decode(${1:$json}, true)', 'JSON decode', '', true),
  builtin('intval', 'intval(${1:$value})', 'Convert to int', '', true),
  builtin('strval', 'strval(${1:$value})', 'Convert to string', '', true),
];

// ---------------------------------------------------------------------------
// Kotlin
// ---------------------------------------------------------------------------

const KOTLIN_ITEMS = [
  // Keywords
  ...['abstract', 'actual', 'annotation', 'as', 'break', 'by', 'catch',
      'class', 'companion', 'const', 'constructor', 'continue', 'crossinline',
      'data', 'delegate', 'do', 'dynamic', 'else', 'enum', 'expect',
      'external', 'false', 'field', 'file', 'final', 'finally', 'for',
      'fun', 'get', 'if', 'import', 'in', 'infix', 'init', 'inline',
      'inner', 'interface', 'internal', 'is', 'it', 'lateinit', 'noinline',
      'null', 'object', 'open', 'operator', 'out', 'override', 'package',
      'param', 'private', 'property', 'protected', 'public', 'receiver',
      'reified', 'return', 'sealed', 'set', 'setparam', 'super', 'suspend',
      'tailrec', 'this', 'throw', 'true', 'try', 'typealias', 'val',
      'var', 'vararg', 'when', 'where', 'while'].map(kw),

  // Snippets
  snip('fun', 'fun ${1:name}(${2:args}): ${3:Unit} {\n    ${4:// body}\n}', 'Function definition'),
  snip('main', 'fun main() {\n    ${1:// body}\n}', 'Main function'),
  snip('class', 'class ${1:Name}(${2:val field: Type}) {\n    ${3:// body}\n}', 'Class definition'),
  snip('dataclass', 'data class ${1:Name}(\n    val ${2:field}: ${3:Type}\n)', 'Data class'),
  snip('sealedclass', 'sealed class ${1:Name}\nclass ${2:SubType}(val ${3:value}: ${4:Type}) : ${1:Name}()', 'Sealed class'),
  snip('object', 'object ${1:Name} {\n    ${2:// body}\n}', 'Singleton object'),
  snip('companion', 'companion object {\n    ${1:// body}\n}', 'Companion object'),
  snip('if', 'if (${1:condition}) {\n    ${2:// body}\n}', 'If statement'),
  snip('when', 'when (${1:expr}) {\n    ${2:value} -> ${3:// body}\n    else -> ${4:// default}\n}', 'When expression'),
  snip('for', 'for (${1:item} in ${2:collection}) {\n    ${3:// body}\n}', 'For loop'),
  snip('forrange', 'for (${1:i} in 0 until ${2:n}) {\n    ${3:// body}\n}', 'For range loop'),
  snip('while', 'while (${1:condition}) {\n    ${2:// body}\n}', 'While loop'),
  snip('try', 'try {\n    ${1:// body}\n} catch (${2:e}: ${3:Exception}) {\n    ${4:// handle}\n}', 'Try/catch'),
  snip('lambda', '{ ${1:args} ->\n    ${2:// body}\n}', 'Lambda block'),
  snip('let', '${1:value}.let {\n    ${2:// use it}\n}', 'Let scope function'),
  snip('run', '${1:obj}.run {\n    ${2:// body}\n}', 'Run scope function'),
  snip('apply', '${1:obj}.apply {\n    ${2:// configure}\n}', 'Apply scope function'),

  // Builtins
  builtin('println', 'println(${1:value})', 'Print with newline', '', true),
  builtin('print', 'print(${1:value})', 'Print without newline', '', true),
  builtin('readLine', 'readLine()', 'Read line from stdin', ''),
  builtin('listOf', 'listOf(${1:elements})', 'Create an immutable List', '', true),
  builtin('mutableListOf', 'mutableListOf(${1:elements})', 'Create a mutable List', '', true),
  builtin('mapOf', 'mapOf(${1:key} to ${2:value})', 'Create an immutable Map', '', true),
  builtin('mutableMapOf', 'mutableMapOf(${1:key} to ${2:value})', 'Create a mutable Map', '', true),
  builtin('setOf', 'setOf(${1:elements})', 'Create an immutable Set', '', true),
  builtin('arrayOf', 'arrayOf(${1:elements})', 'Create an Array', '', true),
  builtin('toString', '.toString()', 'Convert to String', ''),
  builtin('toInt', '.toInt()', 'Convert to Int', ''),
  builtin('toDouble', '.toDouble()', 'Convert to Double', ''),
];

// ---------------------------------------------------------------------------
// Swift
// ---------------------------------------------------------------------------

const SWIFT_ITEMS = [
  // Keywords
  ...['associatedtype', 'class', 'deinit', 'enum', 'extension', 'fileprivate',
      'func', 'import', 'init', 'inout', 'internal', 'let', 'open',
      'operator', 'private', 'precedencegroup', 'protocol', 'public',
      'rethrows', 'static', 'struct', 'subscript', 'typealias', 'var',
      'break', 'case', 'catch', 'continue', 'default', 'defer', 'do',
      'else', 'fallthrough', 'for', 'guard', 'if', 'in', 'repeat',
      'return', 'throw', 'switch', 'where', 'while',
      'Any', 'as', 'await', 'false', 'is', 'nil', 'self', 'Self',
      'super', 'throws', 'true', 'try'].map(kw),

  // Snippets
  snip('func', 'func ${1:name}(${2:args}) ${3:-> ReturnType} {\n    ${4:// body}\n}', 'Function definition'),
  snip('main', 'import Foundation\n\nfunc main() {\n    ${1:// body}\n}\n\nmain()', 'Main function'),
  snip('struct', 'struct ${1:Name} {\n    ${2:var field}: ${3:Type}\n}', 'Struct definition'),
  snip('class', 'class ${1:Name}: ${2:NSObject} {\n    ${3:// body}\n}', 'Class definition'),
  snip('enum', 'enum ${1:Name} {\n    case ${2:value1}\n    case ${3:value2}\n}', 'Enum definition'),
  snip('protocol', 'protocol ${1:Name} {\n    func ${2:method}(${3:args}) ${4:-> ReturnType}\n}', 'Protocol definition'),
  snip('extension', 'extension ${1:TypeName} {\n    ${2:// body}\n}', 'Extension'),
  snip('if', 'if ${1:condition} {\n    ${2:// body}\n}', 'If statement'),
  snip('iflet', 'if let ${1:value} = ${2:optional} {\n    ${3:// body}\n}', 'If let (optional binding)'),
  snip('guard', 'guard let ${1:value} = ${2:optional} else {\n    ${3:return}\n}', 'Guard statement'),
  snip('for', 'for ${1:item} in ${2:collection} {\n    ${3:// body}\n}', 'For loop'),
  snip('forrange', 'for ${1:i} in 0..<${2:n} {\n    ${3:// body}\n}', 'For range loop'),
  snip('switch', 'switch ${1:value} {\ncase ${2:pattern}:\n    ${3:// body}\ndefault:\n    break\n}', 'Switch statement'),
  snip('closure', '{ (${1:args}) -> ${2:ReturnType} in\n    ${3:// body}\n}', 'Closure expression'),
  snip('do', 'do {\n    ${1:try // body}\n} catch {\n    print(error)\n}', 'Do/catch'),

  // Builtins
  builtin('print', 'print(${1:value})', 'Print to stdout', '', true),
  builtin('print terminator', 'print(${1:value}, terminator: "")', 'Print without newline', '', true),
  builtin('readLine', 'readLine()', 'Read line from stdin', ''),
  builtin('Array', 'Array<${1:Element}>()', 'Create Array', '', true),
  builtin('Dictionary', 'Dictionary<${1:Key}, ${2:Value}>()', 'Create Dictionary', '', true),
  builtin('Set', 'Set<${1:Element}>()', 'Create Set', '', true),
  builtin('Optional', 'Optional<${1:T}>', 'Optional type', '', true),
  builtin('String(describing:', 'String(describing: ${1:value})', 'Convert to String', '', true),
  builtin('Int(', 'Int(${1:value})', 'Convert to Int', '', true),
  builtin('Double(', 'Double(${1:value})', 'Convert to Double', '', true),
];

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const SQL_ITEMS = [
  // Keywords
  ...['ADD', 'ALL', 'ALTER', 'AND', 'ANY', 'AS', 'ASC', 'AUTOINCREMENT',
      'AVG', 'BETWEEN', 'BY', 'CASE', 'CAST', 'COLUMN', 'CONSTRAINT',
      'COUNT', 'CREATE', 'CROSS', 'DATABASE', 'DEFAULT', 'DELETE', 'DESC',
      'DISTINCT', 'DROP', 'ELSE', 'END', 'EXCEPT', 'EXISTS', 'EXPLAIN',
      'FOREIGN', 'FROM', 'FULL', 'GRANT', 'GROUP', 'HAVING', 'IN',
      'INDEX', 'INNER', 'INSERT', 'INTERSECT', 'INTO', 'IS', 'JOIN',
      'KEY', 'LEFT', 'LIKE', 'LIMIT', 'MAX', 'MIN', 'NOT', 'NULL',
      'OFFSET', 'ON', 'OR', 'ORDER', 'OUTER', 'PRIMARY', 'REFERENCES',
      'REVOKE', 'RIGHT', 'ROLLBACK', 'ROWNUM', 'SELECT', 'SET', 'SOME',
      'SUM', 'TABLE', 'THEN', 'TOP', 'TRANSACTION', 'TRUNCATE', 'UNION',
      'UNIQUE', 'UPDATE', 'VALUES', 'VIEW', 'WHEN', 'WHERE', 'WITH'].map(kw),

  // Snippets
  snip('select', 'SELECT ${1:*}\nFROM ${2:table_name}\nWHERE ${3:condition};', 'SELECT statement'),
  snip('selectall', 'SELECT *\nFROM ${1:table_name};', 'SELECT all rows'),
  snip('insert', 'INSERT INTO ${1:table_name} (${2:column1}, ${3:column2})\nVALUES (${4:value1}, ${5:value2});', 'INSERT statement'),
  snip('update', 'UPDATE ${1:table_name}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition};', 'UPDATE statement'),
  snip('delete', 'DELETE FROM ${1:table_name}\nWHERE ${2:condition};', 'DELETE statement'),
  snip('create table', 'CREATE TABLE ${1:table_name} (\n    ${2:id} INT PRIMARY KEY AUTO_INCREMENT,\n    ${3:column} ${4:VARCHAR(255)}\n);', 'CREATE TABLE'),
  snip('alter add', 'ALTER TABLE ${1:table_name}\nADD COLUMN ${2:column_name} ${3:data_type};', 'ALTER TABLE ADD COLUMN'),
  snip('drop table', 'DROP TABLE IF EXISTS ${1:table_name};', 'DROP TABLE'),
  snip('create index', 'CREATE INDEX ${1:idx_name}\nON ${2:table_name} (${3:column});', 'CREATE INDEX'),
  snip('inner join', 'INNER JOIN ${1:other_table}\n    ON ${2:t}.${3:id} = ${1:other_table}.${4:fk}', 'INNER JOIN'),
  snip('left join', 'LEFT JOIN ${1:other_table}\n    ON ${2:t}.${3:id} = ${1:other_table}.${4:fk}', 'LEFT JOIN'),
  snip('group by', 'GROUP BY ${1:column}\nHAVING ${2:condition}', 'GROUP BY / HAVING'),
  snip('order by', 'ORDER BY ${1:column} ${2:ASC}', 'ORDER BY'),
  snip('cte', 'WITH ${1:cte_name} AS (\n    SELECT ${2:*} FROM ${3:table_name}\n)\nSELECT * FROM ${1:cte_name};', 'Common Table Expression (WITH)'),
  snip('window', 'ROW_NUMBER() OVER (PARTITION BY ${1:column} ORDER BY ${2:column})', 'Window function'),
  snip('case', 'CASE\n    WHEN ${1:condition} THEN ${2:result}\n    ELSE ${3:default}\nEND', 'CASE expression'),
  snip('transaction', 'BEGIN TRANSACTION;\n    ${1:-- statements}\nCOMMIT;', 'Transaction block'),

  // Aggregate functions
  builtin('COUNT', 'COUNT(${1:*})', 'Count rows or non-null values', '', true),
  builtin('SUM', 'SUM(${1:column})', 'Sum of values', '', true),
  builtin('AVG', 'AVG(${1:column})', 'Average of values', '', true),
  builtin('MAX', 'MAX(${1:column})', 'Maximum value', '', true),
  builtin('MIN', 'MIN(${1:column})', 'Minimum value', '', true),
  builtin('COALESCE', 'COALESCE(${1:value}, ${2:fallback})', 'First non-null value', '', true),
  builtin('NULLIF', 'NULLIF(${1:a}, ${2:b})', 'NULL if a equals b, otherwise a', '', true),
  builtin('CAST', 'CAST(${1:value} AS ${2:type})', 'Type cast', '', true),
  builtin('ISNULL', 'ISNULL(${1:value}, ${2:replacement})', 'Replace NULL with a value', '', true),
  builtin('CONCAT', 'CONCAT(${1:str1}, ${2:str2})', 'Concatenate strings', '', true),
  builtin('SUBSTRING', 'SUBSTRING(${1:str}, ${2:start}, ${3:length})', 'Extract substring', '', true),
  builtin('UPPER', 'UPPER(${1:str})', 'Convert to uppercase', '', true),
  builtin('LOWER', 'LOWER(${1:str})', 'Convert to lowercase', '', true),
  builtin('TRIM', 'TRIM(${1:str})', 'Remove leading and trailing spaces', '', true),
  builtin('LENGTH', 'LENGTH(${1:str})', 'String length', '', true),
  builtin('NOW', 'NOW()', 'Current date and time', ''),
  builtin('DATE', 'DATE(${1:datetime})', 'Extract date part', '', true),
];

// ---------------------------------------------------------------------------
// Provider registration
// ---------------------------------------------------------------------------

/**
 * Language-specific trigger characters for member access and scope operators.
 */
const TRIGGER_CHARS = {
  python:     ['.'],
  java:       ['.'],
  cpp:        ['.', ':', '>'],
  c:          ['.', '>'],
  go:         ['.'],
  rust:       ['.', ':'],
  csharp:     ['.'],
  ruby:       ['.'],
  php:        ['.', '>'],
  kotlin:     ['.'],
  swift:      ['.'],
  sql:        [],
};

/**
 * The completion items for each language.
 */
const LANGUAGE_COMPLETIONS = {
  python: PYTHON_ITEMS,
  java:   JAVA_ITEMS,
  cpp:    CPP_ITEMS,
  c:      C_ITEMS,
  go:     GO_ITEMS,
  rust:   RUST_ITEMS,
  csharp: CSHARP_ITEMS,
  ruby:   RUBY_ITEMS,
  php:    PHP_ITEMS,
  kotlin: KOTLIN_ITEMS,
  swift:  SWIFT_ITEMS,
  sql:    SQL_ITEMS,
};

/**
 * Registers keyword, snippet, and builtin completion providers for all
 * languages that Monaco does not natively handle with a language service.
 *
 * Must be called once inside the Monaco `onMount` handler so that the
 * `monaco` instance is available. Subsequent calls are safely skipped
 * because Monaco deduplicates providers by language ID.
 *
 * @param {import('monaco-editor').Monaco} monaco
 */
export function registerCompletionProviders(monaco) {
  for (const [language, items] of Object.entries(LANGUAGE_COMPLETIONS)) {
    const triggers = TRIGGER_CHARS[language] ?? [];

    try {
      monaco.languages.registerCompletionItemProvider(language, {
        triggerCharacters: triggers,

        provideCompletionItems(model, position) {
          // Resolve the correct range so Monaco replaces the typed prefix.
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber:   position.lineNumber,
            startColumn:     word.startColumn,
            endColumn:       word.endColumn,
          };

          return {
            suggestions: items.map((item) => ({ ...item, range })),
          };
        },
      });
    } catch {
      // Provider already registered (e.g. HMR re-mount) — safe to skip.
    }
  }
}
