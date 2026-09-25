/**
 * SyncStream Multi-Language Code Completion Provider
 *
 * Strategy (reliable, VS Code-like, low-overhead):
 * 1. Extract ALL identifiers from the document as word suggestions
 *    (catches variables, classes, method names — anything you've typed)
 * 2. Context-sensitive static snippets (psvm, sout, fori, for, if…)
 * 3. Standard library builtins (System.out.println, Math.max…)
 * 4. Member access suggestions when triggered by "."
 * 5. Context guards (suppress method snippets on class-declaration lines)
 */

// ---------------------------------------------------------------------------
// Keyword sets (used to exclude from word suggestions)
// ---------------------------------------------------------------------------

const JAVA_KEYWORDS = new Set([
  'abstract','assert','boolean','break','byte','case','catch','char','class',
  'continue','default','do','double','else','enum','extends','final','finally',
  'float','for','if','implements','import','instanceof','int','interface','long',
  'native','new','null','package','private','protected','public','record',
  'return','sealed','short','static','strictfp','super','switch','synchronized',
  'this','throw','throws','transient','try','var','void','volatile','while','yield',
  'true','false','String','System','Math','Arrays','Collections','Object',
]);

const PYTHON_KEYWORDS = new Set([
  'False','None','True','and','as','assert','async','await','break','class',
  'continue','def','del','elif','else','except','finally','for','from','global',
  'if','import','in','is','lambda','nonlocal','not','or','pass','raise',
  'return','try','while','with','yield','print','len','range','type','input',
]);

const CPP_KEYWORDS = new Set([
  'auto','bool','break','case','catch','char','class','const','constexpr',
  'continue','default','delete','do','double','else','enum','explicit','extern',
  'false','float','for','friend','if','inline','int','long','namespace','new',
  'nullptr','private','protected','public','return','short','signed','sizeof',
  'static','struct','switch','template','this','throw','true','try','typedef',
  'typename','union','unsigned','using','virtual','void','volatile','while',
]);

const KEYWORD_SETS = {
  java: JAVA_KEYWORDS, python: PYTHON_KEYWORDS,
  cpp: CPP_KEYWORDS, c: CPP_KEYWORDS,
  csharp: JAVA_KEYWORDS, kotlin: JAVA_KEYWORDS,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function kw(word) {
  return {
    label: word, kind: 17,
    insertText: word, sortText: 'z_kw_' + word, filterText: word,
  };
}

function snip(label, body, detail, filterText) {
  return {
    label, kind: 27, detail: detail || 'Snippet',
    insertText: body, insertTextRules: 4,
    sortText: 'c_' + label,
    filterText: filterText || label,
  };
}

function api(label, insertText, detail, isSnippet) {
  return {
    label, kind: 1, detail: detail || '',
    insertText, insertTextRules: isSnippet ? 4 : undefined,
    sortText: 'b_' + label, filterText: label,
  };
}

// ---------------------------------------------------------------------------
// Static Snippets per language
// ---------------------------------------------------------------------------

const SNIPPETS = {
  java: [
    snip('psvm', 'public static void main(String[] args) {\n    ${1:// TODO}\n}', 'public static void main(String[] args)', 'psvm'),
    snip('main', 'public static void main(String[] args) {\n    ${1:// TODO}\n}', 'main method', 'main'),
    snip('sout', 'System.out.println(${1:value});', 'System.out.println', 'sout'),
    snip('souf', 'System.out.printf("${1:%s}%n", ${2:args});', 'System.out.printf', 'souf'),
    snip('fori', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3:// body}\n}', 'indexed for loop', 'fori'),
    snip('foreach', 'for (${1:Type} ${2:item} : ${3:collection}) {\n    ${4:// body}\n}', 'enhanced for-each loop', 'foreach'),
    snip('if', 'if (${1:condition}) {\n    ${2:// body}\n}', 'if statement', 'if'),
    snip('ifelse', 'if (${1:condition}) {\n    ${2:// body}\n} else {\n    ${3:// else}\n}', 'if-else', 'ifelse'),
    snip('while', 'while (${1:condition}) {\n    ${2:// body}\n}', 'while loop', 'while'),
    snip('dowhile', 'do {\n    ${1:// body}\n} while (${2:condition});', 'do-while loop', 'dowhile'),
    snip('switch', 'switch (${1:expr}) {\n    case ${2:value}:\n        ${3:// body}\n        break;\n    default:\n        break;\n}', 'switch statement', 'switch'),
    snip('try', 'try {\n    ${1:// body}\n} catch (${2:Exception} ${3:e}) {\n    ${4:e.printStackTrace()}\n}', 'try-catch', 'try'),
    snip('trycatch', 'try {\n    ${1:// body}\n} catch (${2:Exception} ${3:e}) {\n    ${4:e.printStackTrace()}\n} finally {\n    ${5:// cleanup}\n}', 'try-catch-finally', 'trycatch'),
    snip('class', 'public class ${1:ClassName} {\n    ${2:// body}\n}', 'public class', 'class'),
    snip('interface', 'public interface ${1:Name} {\n    ${2:// methods}\n}', 'interface', 'interface'),
    snip('enum', 'public enum ${1:Name} {\n    ${2:VALUE1}, ${3:VALUE2}\n}', 'enum', 'enum'),
    snip('record', 'public record ${1:Name}(${2:Type} ${3:field}) {}', 'record', 'record'),
    snip('lambda', '(${1:args}) -> ${2:expr}', 'lambda expression', 'lambda'),
    snip('ternary', '${1:condition} ? ${2:thenExpr} : ${3:elseExpr}', 'ternary operator', 'ternary'),
    snip('arrlist', 'new ArrayList<${1:Type}>()', 'new ArrayList', 'arrlist'),
    snip('hashmap', 'new HashMap<${1:K}, ${2:V}>()', 'new HashMap', 'hashmap'),
  ],
  python: [
    snip('def', 'def ${1:name}(${2:args}):\n    ${3:pass}', 'function definition', 'def'),
    snip('class', 'class ${1:ClassName}:\n    def __init__(self${2:, args}):\n        ${3:pass}', 'class definition', 'class'),
    snip('if', 'if ${1:condition}:\n    ${2:pass}', 'if', 'if'),
    snip('ifelse', 'if ${1:condition}:\n    ${2:pass}\nelse:\n    ${3:pass}', 'if-else', 'ifelse'),
    snip('for', 'for ${1:item} in ${2:iterable}:\n    ${3:pass}', 'for loop', 'for'),
    snip('forrange', 'for ${1:i} in range(${2:10}):\n    ${3:pass}', 'for range loop', 'forrange'),
    snip('while', 'while ${1:condition}:\n    ${2:pass}', 'while loop', 'while'),
    snip('try', 'try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${4:pass}', 'try-except', 'try'),
    snip('with', 'with ${1:open("file")} as ${2:f}:\n    ${3:pass}', 'with', 'with'),
    snip('lambda', 'lambda ${1:args}: ${2:expr}', 'lambda', 'lambda'),
    snip('main', 'def main():\n    ${1:pass}\n\nif __name__ == "__main__":\n    main()', 'main guard', 'main'),
    snip('lc', '[${1:expr} for ${2:x} in ${3:iterable}]', 'list comprehension', 'lc'),
  ],
  cpp: [
    snip('main', '#include <iostream>\nusing namespace std;\nint main() {\n    ${1:// body}\n    return 0;\n}', 'main function', 'main'),
    snip('class', 'class ${1:Name} {\npublic:\n    ${2:// members}\n};', 'class', 'class'),
    snip('struct', 'struct ${1:Name} {\n    ${2:// fields}\n};', 'struct', 'struct'),
    snip('if', 'if (${1:condition}) {\n    ${2:// body}\n}', 'if', 'if'),
    snip('for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n    ${3:// body}\n}', 'for loop', 'for'),
    snip('rangefor', 'for (const auto& ${1:item} : ${2:container}) {\n    ${3:// body}\n}', 'range-for', 'rangefor'),
    snip('while', 'while (${1:condition}) {\n    ${2:// body}\n}', 'while loop', 'while'),
    snip('cout', 'cout << ${1:value} << endl;', 'cout', 'cout'),
    snip('cin', 'cin >> ${1:variable};', 'cin', 'cin'),
  ],
  c: [
    snip('main', '#include <stdio.h>\nint main(void) {\n    ${1:// body}\n    return 0;\n}', 'main', 'main'),
    snip('if', 'if (${1:condition}) {\n    ${2:// body}\n}', 'if', 'if'),
    snip('for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n    ${3:// body}\n}', 'for', 'for'),
    snip('while', 'while (${1:condition}) {\n    ${2:// body}\n}', 'while', 'while'),
    snip('printf', 'printf("${1:%s}\\n", ${2:args});', 'printf', 'printf'),
    snip('scanf', 'scanf("${1:%d}", &${2:var});', 'scanf', 'scanf'),
    snip('struct', 'typedef struct ${1:Name} {\n    ${2:// fields}\n} ${1:Name};', 'struct', 'struct'),
  ],
  csharp: [
    snip('cw', 'Console.WriteLine(${1:value});', 'Console.WriteLine', 'cw'),
    snip('main', 'static void Main(string[] args)\n{\n    ${1:// body}\n}', 'Main method', 'main'),
    snip('class', 'public class ${1:ClassName}\n{\n    ${2:// body}\n}', 'class', 'class'),
    snip('if', 'if (${1:condition})\n{\n    ${2:// body}\n}', 'if', 'if'),
    snip('for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++)\n{\n    ${3:// body}\n}', 'for loop', 'for'),
    snip('foreach', 'foreach (var ${1:item} in ${2:collection})\n{\n    ${3:// body}\n}', 'foreach', 'foreach'),
    snip('try', 'try\n{\n    ${1:// body}\n}\ncatch (${2:Exception} ${3:ex})\n{\n    ${4:// handle}\n}', 'try-catch', 'try'),
    snip('prop', 'public ${1:int} ${2:Name} { get; set; }', 'auto property', 'prop'),
  ],
  go: [
    snip('main', 'package main\n\nimport "fmt"\n\nfunc main() {\n    ${1:// body}\n}', 'main', 'main'),
    snip('func', 'func ${1:name}(${2:args}) ${3:returnType} {\n    ${4:// body}\n}', 'func', 'func'),
    snip('struct', 'type ${1:Name} struct {\n    ${2:Field} ${3:Type}\n}', 'struct', 'struct'),
    snip('if', 'if ${1:condition} {\n    ${2:// body}\n}', 'if', 'if'),
    snip('iferr', 'if err != nil {\n    ${1:return err}\n}', 'if err != nil', 'iferr'),
    snip('for', 'for ${1:i} := 0; ${1:i} < ${2:n}; ${1:i}++ {\n    ${3:// body}\n}', 'for', 'for'),
  ],
  rust: [
    snip('main', 'fn main() {\n    ${1:// body}\n}', 'main', 'main'),
    snip('fn', 'fn ${1:name}(${2:args}) ${3:-> ReturnType} {\n    ${4:// body}\n}', 'function', 'fn'),
    snip('struct', 'struct ${1:Name} {\n    ${2:field}: ${3:Type},\n}', 'struct', 'struct'),
    snip('impl', 'impl ${1:Type} {\n    pub fn ${2:new}(${3:args}) -> Self {\n        ${4:todo!()}\n    }\n}', 'impl', 'impl'),
    snip('if', 'if ${1:condition} {\n    ${2:// body}\n}', 'if', 'if'),
    snip('match', 'match ${1:expr} {\n    ${2:pattern} => ${3:// body},\n    _ => ${4:// default},\n}', 'match', 'match'),
    snip('for', 'for ${1:item} in ${2:iter} {\n    ${3:// body}\n}', 'for', 'for'),
  ],
  kotlin: [
    snip('main', 'fun main() {\n    ${1:// body}\n}', 'main', 'main'),
    snip('fun', 'fun ${1:name}(${2:args}): ${3:Unit} {\n    ${4:// body}\n}', 'function', 'fun'),
    snip('class', 'class ${1:Name}(${2:val field: Type}) {\n    ${3:// body}\n}', 'class', 'class'),
    snip('if', 'if (${1:condition}) {\n    ${2:// body}\n}', 'if', 'if'),
    snip('for', 'for (${1:item} in ${2:collection}) {\n    ${3:// body}\n}', 'for', 'for'),
    snip('when', 'when (${1:expr}) {\n    ${2:value} -> ${3:// body}\n    else -> ${4:// default}\n}', 'when', 'when'),
  ],
  swift: [
    snip('func', 'func ${1:name}(${2:args}) ${3:-> ReturnType} {\n    ${4:// body}\n}', 'function', 'func'),
    snip('if', 'if ${1:condition} {\n    ${2:// body}\n}', 'if', 'if'),
    snip('for', 'for ${1:item} in ${2:collection} {\n    ${3:// body}\n}', 'for', 'for'),
    snip('guard', 'guard let ${1:value} = ${2:optional} else {\n    ${3:return}\n}', 'guard', 'guard'),
  ],
  sql: [
    snip('select', 'SELECT ${1:*}\nFROM ${2:table_name}\nWHERE ${3:condition};', 'SELECT', 'select'),
    snip('insert', 'INSERT INTO ${1:table_name} (${2:columns})\nVALUES (${3:values});', 'INSERT', 'insert'),
    snip('update', 'UPDATE ${1:table_name}\nSET ${2:column} = ${3:value}\nWHERE ${4:condition};', 'UPDATE', 'update'),
    snip('delete', 'DELETE FROM ${1:table_name}\nWHERE ${2:condition};', 'DELETE', 'delete'),
    snip('create', 'CREATE TABLE ${1:table_name} (\n    ${2:id} INT PRIMARY KEY AUTO_INCREMENT,\n    ${3:column} ${4:VARCHAR(255)}\n);', 'CREATE TABLE', 'create'),
  ],
  ruby: [
    snip('def', 'def ${1:method_name}(${2:args})\n  ${3:# body}\nend', 'method', 'def'),
    snip('class', 'class ${1:ClassName}\n  def initialize(${2:args})\n    ${3:# body}\n  end\nend', 'class', 'class'),
    snip('if', 'if ${1:condition}\n  ${2:# body}\nend', 'if', 'if'),
  ],
  php: [
    snip('class', 'class ${1:ClassName} {\n    public function __construct(${2:args}) {\n        ${3:// body}\n    }\n}', 'class', 'class'),
    snip('function', 'function ${1:name}(${2:args}): ${3:void} {\n    ${4:// body}\n}', 'function', 'function'),
    snip('if', 'if (${1:condition}) {\n    ${2:// body}\n}', 'if', 'if'),
    snip('foreach', 'foreach (${1:$array} as ${2:$key} => ${3:$value}) {\n    ${4:// body}\n}', 'foreach', 'foreach'),
  ],
};

// ---------------------------------------------------------------------------
// Static API builtins
// ---------------------------------------------------------------------------

const BUILTINS = {
  java: [
    api('System.out.println', 'System.out.println(${1:value});', 'print line to stdout', true),
    api('System.out.print', 'System.out.print(${1:value});', 'print to stdout', true),
    api('System.out.printf', 'System.out.printf("${1:%s}%n", ${2:args});', 'printf', true),
    api('System.err.println', 'System.err.println(${1:value});', 'print line to stderr', true),
    api('String.format', 'String.format("${1:%s}", ${2:args})', 'format string', true),
    api('Math.max', 'Math.max(${1:a}, ${2:b})', 'Math.max(a,b)', true),
    api('Math.min', 'Math.min(${1:a}, ${2:b})', 'Math.min(a,b)', true),
    api('Math.abs', 'Math.abs(${1:x})', 'Math.abs(x)', true),
    api('Math.sqrt', 'Math.sqrt(${1:x})', 'Math.sqrt(x)', true),
    api('Math.pow', 'Math.pow(${1:base}, ${2:exp})', 'Math.pow(base, exp)', true),
    api('Math.floor', 'Math.floor(${1:x})', 'Math.floor(x)', true),
    api('Math.ceil', 'Math.ceil(${1:x})', 'Math.ceil(x)', true),
    api('Math.round', 'Math.round(${1:x})', 'Math.round(x)', true),
    api('Math.random', 'Math.random()', 'Math.random() → [0,1)', false),
    api('Integer.parseInt', 'Integer.parseInt(${1:s})', 'parse int from string', true),
    api('Integer.toString', 'Integer.toString(${1:i})', 'int to string', true),
    api('Double.parseDouble', 'Double.parseDouble(${1:s})', 'parse double from string', true),
    api('String.valueOf', 'String.valueOf(${1:x})', 'convert to String', true),
    api('Arrays.sort', 'Arrays.sort(${1:array})', 'sort array', true),
    api('Arrays.asList', 'Arrays.asList(${1:elements})', 'array to List', true),
    api('Arrays.toString', 'Arrays.toString(${1:array})', 'array to string', true),
    api('Collections.sort', 'Collections.sort(${1:list})', 'sort list', true),
    api('Collections.reverse', 'Collections.reverse(${1:list})', 'reverse list', true),
    api('Collections.unmodifiableList', 'Collections.unmodifiableList(${1:list})', 'unmodifiable list', true),
    api('new ArrayList', 'new ArrayList<${1:Type}>()', 'create ArrayList', true),
    api('new LinkedList', 'new LinkedList<${1:Type}>()', 'create LinkedList', true),
    api('new HashMap', 'new HashMap<${1:K}, ${2:V}>()', 'create HashMap', true),
    api('new HashSet', 'new HashSet<${1:Type}>()', 'create HashSet', true),
    api('new Scanner', 'new Scanner(System.in)', 'create Scanner for stdin', false),
    api('new StringBuilder', 'new StringBuilder()', 'create StringBuilder', false),
  ],
  python: [
    api('print', 'print(${1:value})', 'print to stdout', true),
    api('len', 'len(${1:obj})', 'len(s) → int', true),
    api('range', 'range(${1:stop})', 'range(stop) or range(start, stop[, step])', true),
    api('type', 'type(${1:obj})', 'type(object) → type', true),
    api('isinstance', 'isinstance(${1:obj}, ${2:classinfo})', 'isinstance', true),
    api('enumerate', 'enumerate(${1:iterable})', 'enumerate', true),
    api('zip', 'zip(${1:iter1}, ${2:iter2})', 'zip iterables', true),
    api('map', 'map(${1:func}, ${2:iterable})', 'map', true),
    api('filter', 'filter(${1:func}, ${2:iterable})', 'filter', true),
    api('sorted', 'sorted(${1:iterable})', 'sorted', true),
    api('reversed', 'reversed(${1:seq})', 'reversed', true),
    api('list', 'list(${1:iterable})', 'list(iterable)', true),
    api('dict', 'dict()', 'dict()', false),
    api('set', 'set(${1:iterable})', 'set(iterable)', true),
    api('tuple', 'tuple(${1:iterable})', 'tuple(iterable)', true),
    api('int', 'int(${1:x})', 'int(x)', true),
    api('str', 'str(${1:obj})', 'str(object)', true),
    api('float', 'float(${1:x})', 'float(x)', true),
    api('bool', 'bool(${1:x})', 'bool(x)', true),
    api('input', 'input(${1:"prompt: "})', 'read string from stdin', true),
    api('open', 'open(${1:"file"}, ${2:"r"})', 'open file', true),
    api('abs', 'abs(${1:x})', 'absolute value', true),
    api('max', 'max(${1:iterable})', 'maximum value', true),
    api('min', 'min(${1:iterable})', 'minimum value', true),
    api('sum', 'sum(${1:iterable})', 'sum of iterable', true),
    api('any', 'any(${1:iterable})', 'any true', true),
    api('all', 'all(${1:iterable})', 'all true', true),
    api('hasattr', 'hasattr(${1:obj}, ${2:"name"})', 'has attribute', true),
    api('getattr', 'getattr(${1:obj}, ${2:"name"})', 'get attribute', true),
  ],
  cpp: [
    api('cout', 'cout << ${1:value} << endl;', 'print to stdout', true),
    api('cerr', 'cerr << ${1:msg} << endl;', 'print to stderr', true),
    api('cin', 'cin >> ${1:variable};', 'read from stdin', true),
    api('std::cout', 'std::cout << ${1:value} << std::endl;', 'std::cout', true),
    api('std::cin', 'std::cin >> ${1:variable};', 'std::cin', true),
    api('std::string', 'std::string', 'string type', false),
    api('std::vector', 'std::vector<${1:T}>', 'vector', true),
    api('std::map', 'std::map<${1:K}, ${2:V}>', 'map', true),
    api('std::sort', 'std::sort(${1:begin}, ${2:end})', 'sort range', true),
    api('std::find', 'std::find(${1:begin}, ${2:end}, ${3:val})', 'find in range', true),
  ],
};

// ---------------------------------------------------------------------------
// Member access suggestions (triggered by ".")
// ---------------------------------------------------------------------------

const MEMBERS = {
  java: [
    // String
    { label: 'length()', insert: 'length()', detail: 'int length()' },
    { label: 'charAt(i)', insert: 'charAt(${1:i})', detail: 'char charAt(int i)', snip: true },
    { label: 'substring(begin)', insert: 'substring(${1:begin})', detail: 'String substring(int begin)', snip: true },
    { label: 'substring(begin, end)', insert: 'substring(${1:begin}, ${2:end})', detail: 'String substring(int begin, int end)', snip: true },
    { label: 'contains(s)', insert: 'contains(${1:s})', detail: 'boolean contains(CharSequence s)', snip: true },
    { label: 'equals(obj)', insert: 'equals(${1:obj})', detail: 'boolean equals(Object obj)', snip: true },
    { label: 'equalsIgnoreCase(s)', insert: 'equalsIgnoreCase(${1:s})', detail: 'boolean equalsIgnoreCase(String s)', snip: true },
    { label: 'startsWith(prefix)', insert: 'startsWith(${1:prefix})', detail: 'boolean startsWith(String prefix)', snip: true },
    { label: 'endsWith(suffix)', insert: 'endsWith(${1:suffix})', detail: 'boolean endsWith(String suffix)', snip: true },
    { label: 'indexOf(str)', insert: 'indexOf(${1:str})', detail: 'int indexOf(String str)', snip: true },
    { label: 'lastIndexOf(str)', insert: 'lastIndexOf(${1:str})', detail: 'int lastIndexOf(String str)', snip: true },
    { label: 'replace(old, new)', insert: 'replace(${1:old}, ${2:new})', detail: 'String replace(CharSequence old, CharSequence new)', snip: true },
    { label: 'replaceAll(regex, r)', insert: 'replaceAll(${1:regex}, ${2:replacement})', detail: 'String replaceAll(String regex, String replacement)', snip: true },
    { label: 'split(regex)', insert: 'split(${1:regex})', detail: 'String[] split(String regex)', snip: true },
    { label: 'trim()', insert: 'trim()', detail: 'String trim()' },
    { label: 'strip()', insert: 'strip()', detail: 'String strip()' },
    { label: 'toLowerCase()', insert: 'toLowerCase()', detail: 'String toLowerCase()' },
    { label: 'toUpperCase()', insert: 'toUpperCase()', detail: 'String toUpperCase()' },
    { label: 'isEmpty()', insert: 'isEmpty()', detail: 'boolean isEmpty()' },
    { label: 'isBlank()', insert: 'isBlank()', detail: 'boolean isBlank()' },
    { label: 'compareTo(s)', insert: 'compareTo(${1:s})', detail: 'int compareTo(String s)', snip: true },
    { label: 'toCharArray()', insert: 'toCharArray()', detail: 'char[] toCharArray()' },
    { label: 'intern()', insert: 'intern()', detail: 'String intern()' },
    { label: 'toString()', insert: 'toString()', detail: 'String toString()' },
    // List / Collection
    { label: 'size()', insert: 'size()', detail: 'int size()' },
    { label: 'isEmpty()', insert: 'isEmpty()', detail: 'boolean isEmpty()' },
    { label: 'add(e)', insert: 'add(${1:element})', detail: 'boolean add(E e)', snip: true },
    { label: 'add(i, e)', insert: 'add(${1:index}, ${2:element})', detail: 'void add(int index, E element)', snip: true },
    { label: 'addAll(c)', insert: 'addAll(${1:collection})', detail: 'boolean addAll(Collection<? extends E> c)', snip: true },
    { label: 'get(index)', insert: 'get(${1:index})', detail: 'E get(int index)', snip: true },
    { label: 'set(i, e)', insert: 'set(${1:index}, ${2:element})', detail: 'E set(int index, E element)', snip: true },
    { label: 'remove(o)', insert: 'remove(${1:o})', detail: 'boolean remove(Object o)', snip: true },
    { label: 'remove(index)', insert: 'remove(${1:index})', detail: 'E remove(int index)', snip: true },
    { label: 'contains(o)', insert: 'contains(${1:o})', detail: 'boolean contains(Object o)', snip: true },
    { label: 'clear()', insert: 'clear()', detail: 'void clear()' },
    { label: 'sort(c)', insert: 'sort(${1:comparator})', detail: 'void sort(Comparator<? super E> c)', snip: true },
    { label: 'toArray()', insert: 'toArray()', detail: 'Object[] toArray()' },
    { label: 'iterator()', insert: 'iterator()', detail: 'Iterator<E> iterator()' },
    { label: 'stream()', insert: 'stream()', detail: 'Stream<E> stream()' },
    { label: 'forEach(action)', insert: 'forEach(${1:e -> })', detail: 'void forEach(Consumer<? super T> action)', snip: true },
    { label: 'subList(from, to)', insert: 'subList(${1:from}, ${2:to})', detail: 'List<E> subList(int fromIndex, int toIndex)', snip: true },
    // Map
    { label: 'put(k, v)', insert: 'put(${1:key}, ${2:value})', detail: 'V put(K key, V value)', snip: true },
    { label: 'get(key)', insert: 'get(${1:key})', detail: 'V get(Object key)', snip: true },
    { label: 'getOrDefault(k, def)', insert: 'getOrDefault(${1:key}, ${2:defaultValue})', detail: 'V getOrDefault(Object key, V defaultValue)', snip: true },
    { label: 'containsKey(key)', insert: 'containsKey(${1:key})', detail: 'boolean containsKey(Object key)', snip: true },
    { label: 'containsValue(v)', insert: 'containsValue(${1:value})', detail: 'boolean containsValue(Object value)', snip: true },
    { label: 'remove(key)', insert: 'remove(${1:key})', detail: 'V remove(Object key)', snip: true },
    { label: 'keySet()', insert: 'keySet()', detail: 'Set<K> keySet()' },
    { label: 'values()', insert: 'values()', detail: 'Collection<V> values()' },
    { label: 'entrySet()', insert: 'entrySet()', detail: 'Set<Map.Entry<K,V>> entrySet()' },
    { label: 'putIfAbsent(k, v)', insert: 'putIfAbsent(${1:key}, ${2:value})', detail: 'V putIfAbsent(K key, V value)', snip: true },
    // Stream
    { label: 'filter(p)', insert: 'filter(${1:e -> condition})', detail: 'Stream<T> filter(Predicate<? super T> p)', snip: true },
    { label: 'map(f)', insert: 'map(${1:e -> expr})', detail: 'Stream<R> map(Function<? super T, ? extends R> f)', snip: true },
    { label: 'collect(c)', insert: 'collect(${1:Collectors.toList()})', detail: 'R collect(Collector<? super T,A,R> c)', snip: true },
    { label: 'count()', insert: 'count()', detail: 'long count()' },
    { label: 'distinct()', insert: 'distinct()', detail: 'Stream<T> distinct()' },
    { label: 'sorted()', insert: 'sorted()', detail: 'Stream<T> sorted()' },
    { label: 'findFirst()', insert: 'findFirst()', detail: 'Optional<T> findFirst()' },
    { label: 'findAny()', insert: 'findAny()', detail: 'Optional<T> findAny()' },
    { label: 'toList()', insert: 'toList()', detail: 'List<T> toList() (Java 16+)' },
    // Object / general
    { label: 'hashCode()', insert: 'hashCode()', detail: 'int hashCode()' },
    { label: 'getClass()', insert: 'getClass()', detail: 'Class<?> getClass()' },
    // Array
    { label: 'length', insert: 'length', detail: 'int length (array field)', kind: 'field' },
  ],
  python: [
    { label: 'append(x)', insert: 'append(${1:x})', detail: 'list.append(x)', snip: true },
    { label: 'extend(it)', insert: 'extend(${1:iterable})', detail: 'list.extend(iterable)', snip: true },
    { label: 'insert(i, x)', insert: 'insert(${1:i}, ${2:x})', detail: 'list.insert(i, x)', snip: true },
    { label: 'remove(x)', insert: 'remove(${1:x})', detail: 'list.remove(x)', snip: true },
    { label: 'pop()', insert: 'pop(${1:index})', detail: 'list.pop([i])', snip: true },
    { label: 'sort()', insert: 'sort(key=${1:None}, reverse=${2:False})', detail: 'list.sort()', snip: true },
    { label: 'reverse()', insert: 'reverse()', detail: 'list.reverse()' },
    { label: 'index(x)', insert: 'index(${1:x})', detail: 'list.index(x)', snip: true },
    { label: 'count(x)', insert: 'count(${1:x})', detail: 'list.count(x)', snip: true },
    { label: 'clear()', insert: 'clear()', detail: 'list.clear()' },
    { label: 'copy()', insert: 'copy()', detail: 'list.copy()' },
    { label: 'keys()', insert: 'keys()', detail: 'dict.keys()' },
    { label: 'values()', insert: 'values()', detail: 'dict.values()' },
    { label: 'items()', insert: 'items()', detail: 'dict.items()' },
    { label: 'get(key, default)', insert: 'get(${1:key}, ${2:None})', detail: 'dict.get(key[, default])', snip: true },
    { label: 'update(d)', insert: 'update(${1:dict})', detail: 'dict.update([other])', snip: true },
    { label: 'split(sep)', insert: 'split(${1:sep})', detail: 'str.split(sep=None)', snip: true },
    { label: 'join(it)', insert: 'join(${1:iterable})', detail: 'str.join(iterable)', snip: true },
    { label: 'strip()', insert: 'strip()', detail: 'str.strip([chars])' },
    { label: 'replace(old, new)', insert: 'replace(${1:old}, ${2:new})', detail: 'str.replace(old, new)', snip: true },
    { label: 'lower()', insert: 'lower()', detail: 'str.lower()' },
    { label: 'upper()', insert: 'upper()', detail: 'str.upper()' },
    { label: 'startswith(p)', insert: 'startswith(${1:prefix})', detail: 'str.startswith(prefix)', snip: true },
    { label: 'endswith(s)', insert: 'endswith(${1:suffix})', detail: 'str.endswith(suffix)', snip: true },
    { label: 'format(*args)', insert: 'format(${1:args})', detail: 'str.format(*args, **kwargs)', snip: true },
    { label: 'find(sub)', insert: 'find(${1:sub})', detail: 'str.find(sub)', snip: true },
    { label: 'isdigit()', insert: 'isdigit()', detail: 'str.isdigit()' },
    { label: 'isalpha()', insert: 'isalpha()', detail: 'str.isalpha()' },
    { label: 'isalnum()', insert: 'isalnum()', detail: 'str.isalnum()' },
  ],
  cpp: [
    { label: 'size()', insert: 'size()', detail: 'size_t size() const' },
    { label: 'empty()', insert: 'empty()', detail: 'bool empty() const' },
    { label: 'clear()', insert: 'clear()', detail: 'void clear()' },
    { label: 'begin()', insert: 'begin()', detail: 'iterator begin()' },
    { label: 'end()', insert: 'end()', detail: 'iterator end()' },
    { label: 'push_back(v)', insert: 'push_back(${1:val})', detail: 'void push_back(const T& val)', snip: true },
    { label: 'emplace_back(args)', insert: 'emplace_back(${1:args})', detail: 'void emplace_back(Args&&... args)', snip: true },
    { label: 'pop_back()', insert: 'pop_back()', detail: 'void pop_back()' },
    { label: 'front()', insert: 'front()', detail: 'reference front()' },
    { label: 'back()', insert: 'back()', detail: 'reference back()' },
    { label: 'find(key)', insert: 'find(${1:key})', detail: 'iterator find(const Key& key)', snip: true },
    { label: 'length()', insert: 'length()', detail: 'size_t length() const' },
    { label: 'substr(pos, n)', insert: 'substr(${1:pos}, ${2:n})', detail: 'string substr(size_t pos, size_t n)', snip: true },
    { label: 'c_str()', insert: 'c_str()', detail: 'const char* c_str() const' },
  ],
};

MEMBERS.c = MEMBERS.cpp;
MEMBERS.csharp = MEMBERS.java;
MEMBERS.kotlin = MEMBERS.java;

// ---------------------------------------------------------------------------
// Word-based completions from the document (the main VS Code-like feature)
// ---------------------------------------------------------------------------

function getWordSuggestions(model, language, currentWord, kinds) {
  const code = model.getValue();
  const keywordSet = KEYWORD_SETS[language] || new Set();
  const wordSet = new Set();
  const wordPattern = /[A-Za-z_$][A-Za-z0-9_$]*/g;
  let m;
  while ((m = wordPattern.exec(code)) !== null) {
    const w = m[0];
    if (w.length > 1 && w !== currentWord && !keywordSet.has(w)) {
      wordSet.add(w);
    }
  }
  return [...wordSet].map(w => ({
    label: w,
    kind: kinds.Text || 18,
    insertText: w,
    sortText: 'e_' + w,
    filterText: w,
    detail: '(identifier)',
  }));
}

// ---------------------------------------------------------------------------
// Provider Registration
// ---------------------------------------------------------------------------

const TRIGGER_CHARS = {
  java: ['.'], python: ['.'], cpp: ['.', '>'], c: ['.', '>'],
  csharp: ['.'], kotlin: ['.'], go: ['.'], rust: ['.', ':'],
  ruby: ['.'], php: ['>', ':'], swift: ['.'], sql: ['.'],
};

const LANG_KEYWORDS = {
  java: ['abstract','assert','boolean','break','byte','case','catch','char','class','continue','default','do','double','else','enum','extends','final','finally','float','for','if','implements','import','instanceof','int','interface','long','native','new','null','package','private','protected','public','record','return','sealed','short','static','super','switch','synchronized','this','throw','throws','transient','try','var','void','volatile','while','yield','true','false'],
  python: ['False','None','True','and','as','assert','async','await','break','class','continue','def','del','elif','else','except','finally','for','from','global','if','import','in','is','lambda','nonlocal','not','or','pass','raise','return','try','while','with','yield'],
  cpp: ['auto','bool','break','case','catch','char','class','const','constexpr','continue','default','delete','do','double','else','enum','explicit','extern','false','float','for','friend','if','inline','int','long','namespace','new','nullptr','private','protected','public','return','short','signed','sizeof','static','struct','switch','template','this','throw','true','try','typedef','typename','union','unsigned','using','virtual','void','volatile','while'],
  c: ['auto','break','case','char','const','continue','default','do','double','else','enum','extern','float','for','goto','if','inline','int','long','register','restrict','return','short','signed','sizeof','static','struct','switch','typedef','union','unsigned','void','volatile','while'],
  csharp: ['abstract','as','async','await','base','bool','break','byte','case','catch','char','class','const','continue','default','do','double','else','enum','event','false','finally','float','for','foreach','if','int','interface','internal','is','lock','long','namespace','new','null','object','override','private','protected','public','readonly','return','static','string','struct','switch','this','throw','true','try','using','var','virtual','void','while'],
  kotlin: ['abstract','as','break','class','const','continue','data','do','else','enum','false','final','finally','for','fun','if','import','in','interface','is','null','object','open','override','package','private','protected','public','return','sealed','super','this','throw','true','try','val','var','when','while'],
  go: ['break','case','chan','const','continue','default','defer','else','fallthrough','for','func','go','goto','if','import','interface','map','package','range','return','select','struct','switch','type','var'],
  rust: ['as','async','await','break','const','continue','crate','dyn','else','enum','extern','false','fn','for','if','impl','in','let','loop','match','mod','move','mut','pub','ref','return','self','Self','static','struct','super','trait','true','type','unsafe','use','where','while'],
  ruby: ['alias','and','begin','break','case','class','def','do','else','elsif','end','false','for','if','in','module','next','nil','not','or','rescue','return','self','super','then','true','unless','until','when','while','yield'],
  php: ['abstract','and','array','as','break','case','catch','class','const','continue','default','do','echo','else','enum','extends','false','final','finally','fn','for','foreach','function','if','implements','interface','new','null','private','protected','public','return','static','switch','throw','true','try','var','while'],
  swift: ['associatedtype','class','deinit','enum','extension','func','import','init','let','open','private','protocol','public','static','struct','var','break','case','catch','continue','default','else','for','guard','if','in','return','switch','while','true','false','nil','self','try'],
  kotlin: ['abstract','as','break','class','const','continue','data','do','else','enum','false','final','finally','for','fun','if','import','in','interface','is','null','object','open','override','package','private','protected','public','return','sealed','super','this','throw','true','try','val','var','when','while'],
};

let disposables = [];

export function registerCompletionProviders(monaco) {
  // Dispose previous to avoid duplicates on HMR
  disposables.forEach(d => { try { d.dispose(); } catch {} });
  disposables = [];

  const kinds = monaco.languages.CompletionItemKind;
  const allLanguages = Object.keys({ ...SNIPPETS, java: 1 });

  for (const lang of allLanguages) {
    const triggers = TRIGGER_CHARS[lang] || [];
    const snippets = SNIPPETS[lang] || [];
    const builtins = BUILTINS[lang] || [];
    const keywords = (LANG_KEYWORDS[lang] || []).map(kw);
    const memberList = MEMBERS[lang] || [];

    try {
      const d = monaco.languages.registerCompletionItemProvider(lang, {
        triggerCharacters: triggers,

        provideCompletionItems(model, position) {
          const lineUntil = model.getLineContent(position.lineNumber).substring(0, position.column - 1);
          const wordInfo = model.getWordUntilPosition(position);
          const currentWord = wordInfo.word;

          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: wordInfo.startColumn,
            endColumn: wordInfo.endColumn,
          };

          // Guard: type declaration header → no suggestions (prevents snippet hijacking class names)
          if (/^\s*(?:(?:public|protected|private|static|final|abstract|sealed|open|data)\s+)*(?:class|interface|enum|record|struct)\s+\w*$/.test(lineUntil)) {
            return { suggestions: [] };
          }

          // Member access context (triggered by ".", ">", "::")
          if (/[\.>\:]\s*\w*$/.test(lineUntil)) {
            return {
              suggestions: memberList.map(m => ({
                label: m.label,
                kind: m.kind === 'field' ? (kinds.Field || 4) : (kinds.Method || 0),
                detail: m.detail,
                insertText: m.insert,
                insertTextRules: m.snip ? 4 : undefined,
                sortText: '0_' + m.label,
                range,
              })),
            };
          }

          // General completion: word suggestions + snippets + keywords + builtins
          const wordSuggestions = getWordSuggestions(model, lang, currentWord, kinds);

          return {
            suggestions: [
              ...wordSuggestions.map(s => ({ ...s, range })),
              ...snippets.map(s => ({ ...s, range })),
              ...builtins.map(s => ({ ...s, range })),
              ...keywords.map(s => ({ ...s, range })),
            ],
          };
        },
      });

      disposables.push(d);
    } catch {
      // ignore
    }
  }
}
