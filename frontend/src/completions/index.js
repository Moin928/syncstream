/**
 * SyncStream Multi-Language Advanced Completion & IntelliSense Provider
 *
 * Features:
 * 1. Live Document Symbol Extraction:
 *    - All Classes, Interfaces, Enums, Records, Structs
 *    - All Constructors (e.g. `Main()`, `ClassName()`)
 *    - All Class Fields & Constants (e.g. `age`, `name`, `MAX_VALUE`)
 *    - All Methods with signatures & parameter placeholders (e.g. `sayHello()`, `setName(name)`)
 *    - All Local Variables & Method Parameters (e.g. `m`, `count`, `args`)
 * 2. Context-Aware Suggestion Filtering:
 *    - After `class` / `public class`: Suppresses method snippets (prevents `Main` from being hijacked by `main()`)
 *    - After `new `: Specifically prioritizes Classes and Constructors (`Main()`, `ArrayList<>()`, `Scanner(...)`)
 *    - In expressions: Uses `psvm` for `public static void main` so typing `Main` never triggers `main` method replacement
 * 3. Member Access (`.` Trigger):
 *    - Comprehensive standard library methods for `String`, `List`, `Map`, `Set`, `Stream`, `Optional`, `Object`, `Array`
 *    - Live fields and methods of classes defined in the file and workspace
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function kw(word) {
  return {
    label: word,
    kind: 17, // CompletionItemKind.Keyword
    detail: 'keyword',
    insertText: word,
    sortText: '20_' + word,
    filterText: word,
  };
}

function snip(label, body, detail, doc, sortOrder = '30', filterText = label) {
  const item = {
    label,
    kind: 27, // CompletionItemKind.Snippet
    detail: detail || 'Snippet',
    insertText: body,
    insertTextRules: 4, // InsertTextRule.InsertAsSnippet
    sortText: `${sortOrder}_${label}`,
    filterText,
  };
  if (doc) item.documentation = { value: doc };
  return item;
}

function builtin(label, insertText, detail, doc, isSnippet = false, sortOrder = '25') {
  const item = {
    label,
    kind: 1, // CompletionItemKind.Function
    detail: detail || '',
    insertText,
    sortText: `${sortOrder}_${label}`,
    filterText: label,
  };
  if (isSnippet) item.insertTextRules = 4;
  if (doc) item.documentation = { value: doc };
  return item;
}

function typeConstructor(name, params = '', kind = 2) {
  return {
    label: `${name}()`,
    kind, // CompletionItemKind.Constructor
    detail: `new ${name}(${params})`,
    insertText: params ? `${name}(\${1:${params}})` : `${name}()`,
    insertTextRules: 4,
    sortText: `00_${name}`,
    filterText: name,
    documentation: { value: `**Constructor:** \`new ${name}(${params})\`` },
  };
}

// ---------------------------------------------------------------------------
// Standard Common Constructors for 'new'
// ---------------------------------------------------------------------------

const JAVA_COMMON_CONSTRUCTORS = [
  typeConstructor('ArrayList', ''),
  typeConstructor('HashMap', ''),
  typeConstructor('HashSet', ''),
  typeConstructor('LinkedList', ''),
  typeConstructor('TreeMap', ''),
  typeConstructor('TreeSet', ''),
  typeConstructor('StringBuilder', ''),
  typeConstructor('StringBuffer', ''),
  typeConstructor('Scanner', 'System.in'),
  typeConstructor('Random', ''),
  typeConstructor('File', 'path'),
  typeConstructor('Thread', 'runnable'),
  typeConstructor('Date', ''),
  typeConstructor('Exception', 'message'),
  typeConstructor('RuntimeException', 'message'),
  typeConstructor('IllegalArgumentException', 'message'),
];

// ---------------------------------------------------------------------------
// Standard Library Member Methods for Dot (.) Trigger
// ---------------------------------------------------------------------------

const JAVA_MEMBERS = [
  // Object methods
  { label: 'toString()', insertText: 'toString()', detail: 'String toString()', doc: 'Returns a string representation of the object.', kind: 0 },
  { label: 'equals(obj)', insertText: 'equals(${1:obj})', detail: 'boolean equals(Object obj)', doc: 'Indicates whether some other object is equal to this one.', isSnippet: true, kind: 0 },
  { label: 'hashCode()', insertText: 'hashCode()', detail: 'int hashCode()', doc: 'Returns a hash code value for the object.', kind: 0 },
  { label: 'getClass()', insertText: 'getClass()', detail: 'Class<?> getClass()', doc: 'Returns the runtime class of this Object.', kind: 0 },
  { label: 'clone()', insertText: 'clone()', detail: 'Object clone()', doc: 'Creates and returns a copy of this object.', kind: 0 },

  // String methods
  { label: 'length()', insertText: 'length()', detail: 'int length()', doc: 'Returns the length of this string or collection.', kind: 0 },
  { label: 'charAt(index)', insertText: 'charAt(${1:index})', detail: 'char charAt(int index)', doc: 'Returns the char value at the specified index.', isSnippet: true, kind: 0 },
  { label: 'substring(begin, end)', insertText: 'substring(${1:beginIndex}, ${2:endIndex})', detail: 'String substring(int beginIndex, int endIndex)', doc: 'Returns a substring of this string.', isSnippet: true, kind: 0 },
  { label: 'substring(begin)', insertText: 'substring(${1:beginIndex})', detail: 'String substring(int beginIndex)', doc: 'Returns a substring from beginIndex to end.', isSnippet: true, kind: 0 },
  { label: 'contains(s)', insertText: 'contains(${1:s})', detail: 'boolean contains(CharSequence s)', doc: 'Returns true if this string contains the sequence.', isSnippet: true, kind: 0 },
  { label: 'equals(anotherString)', insertText: 'equals(${1:anotherString})', detail: 'boolean equals(Object anObject)', doc: 'Compares this string to the specified object.', isSnippet: true, kind: 0 },
  { label: 'equalsIgnoreCase(s)', insertText: 'equalsIgnoreCase(${1:anotherString})', detail: 'boolean equalsIgnoreCase(String anotherString)', doc: 'Compares this string ignoring case considerations.', isSnippet: true, kind: 0 },
  { label: 'startsWith(prefix)', insertText: 'startsWith(${1:prefix})', detail: 'boolean startsWith(String prefix)', doc: 'Tests if this string starts with the specified prefix.', isSnippet: true, kind: 0 },
  { label: 'endsWith(suffix)', insertText: 'endsWith(${1:suffix})', detail: 'boolean endsWith(String suffix)', doc: 'Tests if this string ends with the specified suffix.', isSnippet: true, kind: 0 },
  { label: 'indexOf(str)', insertText: 'indexOf(${1:str})', detail: 'int indexOf(String str)', doc: 'Returns the index within this string of the first occurrence.', isSnippet: true, kind: 0 },
  { label: 'lastIndexOf(str)', insertText: 'lastIndexOf(${1:str})', detail: 'int lastIndexOf(String str)', doc: 'Returns the index of the last occurrence.', isSnippet: true, kind: 0 },
  { label: 'toLowerCase()', insertText: 'toLowerCase()', detail: 'String toLowerCase()', doc: 'Converts all characters in this String to lower case.', kind: 0 },
  { label: 'toUpperCase()', insertText: 'toUpperCase()', detail: 'String toUpperCase()', doc: 'Converts all characters in this String to upper case.', kind: 0 },
  { label: 'trim()', insertText: 'trim()', detail: 'String trim()', doc: 'Returns a string with leading and trailing space removed.', kind: 0 },
  { label: 'strip()', insertText: 'strip()', detail: 'String strip()', doc: 'Returns a string with all whitespace removed.', kind: 0 },
  { label: 'replace(old, new)', insertText: 'replace(${1:oldChar}, ${2:newChar})', detail: 'String replace(CharSequence target, CharSequence replacement)', doc: 'Replaces each substring matching target with replacement.', isSnippet: true, kind: 0 },
  { label: 'replaceAll(regex, rep)', insertText: 'replaceAll(${1:regex}, ${2:replacement})', detail: 'String replaceAll(String regex, String replacement)', doc: 'Replaces each substring matching regex with replacement.', isSnippet: true, kind: 0 },
  { label: 'split(regex)', insertText: 'split("${1:regex}")', detail: 'String[] split(String regex)', doc: 'Splits this string around matches of the given regular expression.', isSnippet: true, kind: 0 },
  { label: 'toCharArray()', insertText: 'toCharArray()', detail: 'char[] toCharArray()', doc: 'Converts this string to a new character array.', kind: 0 },
  { label: 'getBytes()', insertText: 'getBytes()', detail: 'byte[] getBytes()', doc: 'Encodes this String into a sequence of bytes.', kind: 0 },
  { label: 'isEmpty()', insertText: 'isEmpty()', detail: 'boolean isEmpty()', doc: 'Returns true if length() is 0.', kind: 0 },
  { label: 'isBlank()', insertText: 'isBlank()', detail: 'boolean isBlank()', doc: 'Returns true if the string is empty or contains only whitespace.', kind: 0 },
  { label: 'compareTo(another)', insertText: 'compareTo(${1:anotherString})', detail: 'int compareTo(String anotherString)', doc: 'Compares two strings lexicographically.', isSnippet: true, kind: 0 },

  // List / Collection / Set methods
  { label: 'size()', insertText: 'size()', detail: 'int size()', doc: 'Returns the number of elements in this collection or map.', kind: 0 },
  { label: 'add(e)', insertText: 'add(${1:element})', detail: 'boolean add(E e)', doc: 'Ensures that this collection contains the specified element.', isSnippet: true, kind: 0 },
  { label: 'addAll(c)', insertText: 'addAll(${1:collection})', detail: 'boolean addAll(Collection<? extends E> c)', doc: 'Appends all elements in the specified collection.', isSnippet: true, kind: 0 },
  { label: 'get(index)', insertText: 'get(${1:index})', detail: 'E get(int index)', doc: 'Returns the element at the specified position in this list.', isSnippet: true, kind: 0 },
  { label: 'set(index, element)', insertText: 'set(${1:index}, ${2:element})', detail: 'E set(int index, E element)', doc: 'Replaces the element at the specified position.', isSnippet: true, kind: 0 },
  { label: 'remove(o)', insertText: 'remove(${1:o})', detail: 'boolean remove(Object o)', doc: 'Removes the first occurrence of the specified element.', isSnippet: true, kind: 0 },
  { label: 'clear()', insertText: 'clear()', detail: 'void clear()', doc: 'Removes all elements from this collection or map.', kind: 0 },
  { label: 'iterator()', insertText: 'iterator()', detail: 'Iterator<E> iterator()', doc: 'Returns an iterator over elements.', kind: 0 },
  { label: 'toArray()', insertText: 'toArray()', detail: 'Object[] toArray()', doc: 'Returns an array containing all elements in this collection.', kind: 0 },
  { label: 'stream()', insertText: 'stream()', detail: 'Stream<E> stream()', doc: 'Returns a sequential Stream with this collection as its source.', kind: 0 },
  { label: 'forEach(action)', insertText: 'forEach(${1:action})', detail: 'void forEach(Consumer<? super T> action)', doc: 'Performs the given action for each element.', isSnippet: true, kind: 0 },
  { label: 'sort(comparator)', insertText: 'sort(${1:comparator})', detail: 'void sort(Comparator<? super E> c)', doc: 'Sorts this list according to Comparator.', isSnippet: true, kind: 0 },

  // Map methods
  { label: 'get(key)', insertText: 'get(${1:key})', detail: 'V get(Object key)', doc: 'Returns the value to which specified key is mapped.', isSnippet: true, kind: 0 },
  { label: 'getOrDefault(key, defaultVal)', insertText: 'getOrDefault(${1:key}, ${2:defaultValue})', detail: 'V getOrDefault(Object key, V defaultValue)', doc: 'Returns mapped value, or defaultValue if not present.', isSnippet: true, kind: 0 },
  { label: 'put(key, value)', insertText: 'put(${1:key}, ${2:value})', detail: 'V put(K key, V value)', doc: 'Associates specified value with specified key.', isSnippet: true, kind: 0 },
  { label: 'putIfAbsent(key, value)', insertText: 'putIfAbsent(${1:key}, ${2:value})', detail: 'V putIfAbsent(K key, V value)', doc: 'Associates key with value if key is not already mapped.', isSnippet: true, kind: 0 },
  { label: 'containsKey(key)', insertText: 'containsKey(${1:key})', detail: 'boolean containsKey(Object key)', doc: 'Returns true if map contains key.', isSnippet: true, kind: 0 },
  { label: 'containsValue(value)', insertText: 'containsValue(${1:value})', detail: 'boolean containsValue(Object value)', doc: 'Returns true if map maps one or more keys to value.', isSnippet: true, kind: 0 },
  { label: 'keySet()', insertText: 'keySet()', detail: 'Set<K> keySet()', doc: 'Returns a Set view of keys.', kind: 0 },
  { label: 'values()', insertText: 'values()', detail: 'Collection<V> values()', doc: 'Returns a Collection view of values.', kind: 0 },
  { label: 'entrySet()', insertText: 'entrySet()', detail: 'Set<Map.Entry<K, V>> entrySet()', doc: 'Returns a Set view of mappings.', kind: 0 },

  // Stream methods
  { label: 'filter(predicate)', insertText: 'filter(${1:x -> predicate})', detail: 'Stream<T> filter(Predicate<? super T> predicate)', doc: 'Returns a stream consisting of elements matching predicate.', isSnippet: true, kind: 0 },
  { label: 'map(mapper)', insertText: 'map(${1:x -> mapper})', detail: '<R> Stream<R> map(Function<? super T, ? extends R> mapper)', doc: 'Returns a stream consisting of results of applying mapper.', isSnippet: true, kind: 0 },
  { label: 'collect(collector)', insertText: 'collect(${1:Collectors.toList()})', detail: '<R, A> R collect(Collector<? super T, A, R> collector)', doc: 'Performs a mutable reduction operation on elements.', isSnippet: true, kind: 0 },
  { label: 'count()', insertText: 'count()', detail: 'long count()', doc: 'Returns count of elements in stream.', kind: 0 },

  // Array field
  { label: 'length', insertText: 'length', detail: 'int length (array)', doc: 'The length of the array.', kind: 3 },
];

const PYTHON_MEMBERS = [
  { label: 'append(x)', insertText: 'append(${1:x})', detail: 'list.append(x)', doc: 'Add an item to the end of the list.', isSnippet: true, kind: 0 },
  { label: 'extend(iterable)', insertText: 'extend(${1:iterable})', detail: 'list.extend(iterable)', doc: 'Extend list by appending elements from iterable.', isSnippet: true, kind: 0 },
  { label: 'insert(i, x)', insertText: 'insert(${1:i}, ${2:x})', detail: 'list.insert(i, x)', doc: 'Insert item at given position.', isSnippet: true, kind: 0 },
  { label: 'remove(x)', insertText: 'remove(${1:x})', detail: 'list.remove(x)', doc: 'Remove first item whose value is equal to x.', isSnippet: true, kind: 0 },
  { label: 'pop(i)', insertText: 'pop(${1:index})', detail: 'list.pop([i])', doc: 'Remove item at given position in list and return it.', isSnippet: true, kind: 0 },
  { label: 'clear()', insertText: 'clear()', detail: 'list.clear()', doc: 'Remove all items from list/dict/set.', kind: 0 },
  { label: 'keys()', insertText: 'keys()', detail: 'dict.keys()', doc: 'Return a new view of dictionary keys.', kind: 0 },
  { label: 'values()', insertText: 'values()', detail: 'dict.values()', doc: 'Return a new view of dictionary values.', kind: 0 },
  { label: 'items()', insertText: 'items()', detail: 'dict.items()', doc: 'Return a new view of dictionary items (key, value).', kind: 0 },
  { label: 'get(key, default)', insertText: 'get(${1:key}, ${2:default})', detail: 'dict.get(key[, default])', doc: 'Return value for key if in dict, else default.', isSnippet: true, kind: 0 },
  { label: 'split(sep)', insertText: 'split(${1:sep})', detail: 'str.split(sep=None, maxsplit=-1)', doc: 'Return a list of words in string.', isSnippet: true, kind: 0 },
  { label: 'join(iterable)', insertText: 'join(${1:iterable})', detail: 'str.join(iterable)', doc: 'Concatenate strings in iterable with separator.', isSnippet: true, kind: 0 },
  { label: 'strip()', insertText: 'strip(${1:chars})', detail: 'str.strip([chars])', doc: 'Return copy of string with leading/trailing whitespace removed.', isSnippet: true, kind: 0 },
  { label: 'replace(old, new)', insertText: 'replace(${1:old}, ${2:new})', detail: 'str.replace(old, new[, count])', doc: 'Return copy of string with occurrences of old replaced by new.', isSnippet: true, kind: 0 },
  { label: 'startswith(prefix)', insertText: 'startswith(${1:prefix})', detail: 'str.startswith(prefix)', doc: 'Return True if string starts with prefix.', isSnippet: true, kind: 0 },
  { label: 'endswith(suffix)', insertText: 'endswith(${1:suffix})', detail: 'str.endswith(suffix)', doc: 'Return True if string ends with suffix.', isSnippet: true, kind: 0 },
  { label: 'lower()', insertText: 'lower()', detail: 'str.lower()', doc: 'Return copy of string converted to lowercase.', kind: 0 },
  { label: 'upper()', insertText: 'upper()', detail: 'str.upper()', doc: 'Return copy of string converted to uppercase.', kind: 0 },
];

const CPP_MEMBERS = [
  { label: 'size()', insertText: 'size()', detail: 'size_t size() const', doc: 'Returns the number of elements in the container.', kind: 0 },
  { label: 'empty()', insertText: 'empty()', detail: 'bool empty() const', doc: 'Checks whether container is empty.', kind: 0 },
  { label: 'clear()', insertText: 'clear()', detail: 'void clear()', doc: 'Clears contents of container.', kind: 0 },
  { label: 'begin()', insertText: 'begin()', detail: 'iterator begin()', doc: 'Returns iterator to beginning.', kind: 0 },
  { label: 'end()', insertText: 'end()', detail: 'iterator end()', doc: 'Returns iterator to end.', kind: 0 },
  { label: 'push_back(val)', insertText: 'push_back(${1:val})', detail: 'void push_back(const T& value)', doc: 'Appends element to end.', isSnippet: true, kind: 0 },
  { label: 'emplace_back(args)', insertText: 'emplace_back(${1:args})', detail: 'void emplace_back(Args&&... args)', doc: 'Constructs element in-place at end.', isSnippet: true, kind: 0 },
  { label: 'pop_back()', insertText: 'pop_back()', detail: 'void pop_back()', doc: 'Removes last element.', kind: 0 },
  { label: 'length()', insertText: 'length()', detail: 'size_t length() const', doc: 'Returns number of characters in string.', kind: 0 },
  { label: 'c_str()', insertText: 'c_str()', detail: 'const char* c_str() const', doc: 'Returns pointer to null-terminated char array.', kind: 0 },
];

// ---------------------------------------------------------------------------
// Dynamic Symbol Extractor (Variables, Methods, Classes from Document)
// ---------------------------------------------------------------------------

function extractDocumentSymbols(code, language, monaco) {
  const kinds = monaco.languages.CompletionItemKind;
  const symbols = [];
  const seen = new Set();

  function add(label, kind, detail, insertText = label, isSnippet = false, doc = '', sortOrder = '00') {
    if (!label || label.length < 1 || seen.has(label)) return;
    seen.add(label);

    const item = {
      label,
      kind,
      detail: detail || '',
      insertText,
      sortText: `${sortOrder}_${label}`,
      filterText: label,
    };
    if (isSnippet) item.insertTextRules = 4;
    if (doc) item.documentation = { value: doc };
    symbols.push(item);
  }

  // --- JAVA / C# / KOTLIN / C++ / C ---
  if (['java', 'csharp', 'kotlin', 'cpp', 'c'].includes(language)) {
    // 1. Classes, Interfaces, Enums, Records, Structs
    const classRegex = /\b(?:public|private|protected|static|final|abstract|sealed|open|data|\s)*\b(class|interface|enum|record|struct)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    let match;
    while ((match = classRegex.exec(code)) !== null) {
      const type = match[1];
      const name = match[2];
      const kind = type === 'interface' ? (kinds.Interface || 7) : type === 'enum' ? (kinds.Enum || 12) : (kinds.Class || 6);

      // Add Class Identifier
      add(name, kind, `(${type}) ${name}`, name, false, `**Declared ${type}:** \`${name}\``, '00');

      // Also add Class Constructor `ClassName()`
      if (type === 'class' || type === 'record' || type === 'struct') {
        add(`${name}()`, kinds.Constructor || 2, `new ${name}()`, `${name}(\${1:})`, true, `**Constructor:** \`new ${name}()\``, '00');
      }
    }

    // 2. Methods and Functions
    const methodRegex = /(?:public|protected|private|static|final|synchronized|abstract|default|inline|virtual|override|fun|\s)+\s+([A-Za-z0-9_$<>\[\], ?]+)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)\s*(?:\{|;|->|=)/g;
    while ((match = methodRegex.exec(code)) !== null) {
      const retType = match[1].trim();
      const methodName = match[2];
      const params = match[3].trim();
      if (['if', 'for', 'while', 'switch', 'catch', 'synchronized', 'return', 'else', 'class', 'struct', 'interface', 'enum'].includes(methodName)) continue;

      const paramList = params ? params.split(',').map(p => p.trim()).filter(Boolean) : [];
      let snippetInsert = methodName + '()';
      if (paramList.length > 0) {
        const placeholders = paramList.map((p, idx) => {
          const parts = p.split(/\s+/);
          const pName = parts[parts.length - 1].replace(/[^A-Za-z0-9_$]/g, '');
          return `\${${idx + 1}:${pName || 'arg'}}`;
        }).join(', ');
        snippetInsert = `${methodName}(${placeholders})`;
      }

      add(
        methodName,
        kinds.Method || 0,
        `(${retType}) ${methodName}(${params})`,
        snippetInsert,
        paramList.length > 0,
        `**Method:** \`${retType} ${methodName}(${params})\``,
        '01'
      );

      // Extract parameter names as local variables in scope
      for (const p of paramList) {
        const pParts = p.split(/\s+/);
        const pName = pParts[pParts.length - 1].replace(/[^A-Za-z0-9_$]/g, '');
        const pType = pParts.slice(0, pParts.length - 1).join(' ') || 'param';
        if (pName && !seen.has(pName)) {
          add(pName, kinds.Variable || 5, `(parameter) ${pType} ${pName}`, pName, false, `**Parameter:** \`${pType} ${pName}\``, '00');
        }
      }
    }

    // 3. Variables & Fields
    const varRegex = /(?:(?:public|protected|private|static|final|volatile|transient|val|var|const|auto|let)\s+)*(?:var|val|int|double|float|long|short|byte|char|boolean|String|auto|let|const|[A-Z][A-Za-z0-9_$<>, ?\[\]]*)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:=|;|,|\)|\()/g;
    while ((match = varRegex.exec(code)) !== null) {
      const varName = match[1];
      if (['class', 'interface', 'enum', 'record', 'struct', 'new', 'return', 'if', 'else', 'for', 'while', 'try', 'catch', 'throw', 'public', 'private', 'protected', 'static', 'void', 'this', 'super', 'true', 'false', 'null', 'Main'].includes(varName)) continue;
      add(varName, kinds.Field || 4, `(variable) ${varName}`, varName, false, `**Variable/Field:** \`${varName}\``, '00');
    }
  }

  // --- PYTHON ---
  if (language === 'python') {
    const pyClassRegex = /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)(?:\(([^)]*)\))?:/g;
    let match;
    while ((match = pyClassRegex.exec(code)) !== null) {
      add(match[1], kinds.Class || 6, `(class) ${match[1]}`, match[1], false, `**Class:** \`${match[1]}\``, '00');
      add(`${match[1]}()`, kinds.Constructor || 2, `${match[1]}()`, `${match[1]}(\${1:})`, true, `**Constructor:** \`${match[1]}()\``, '00');
    }

    const pyDefRegex = /\bdef\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?:/g;
    while ((match = pyDefRegex.exec(code)) !== null) {
      const fnName = match[1];
      const params = match[2].trim();
      const retType = match[3] ? match[3].trim() : '';

      const paramList = params.split(',').map(p => p.trim()).filter(p => p && p !== 'self' && p !== 'cls');
      let snippetInsert = fnName + '()';
      if (paramList.length > 0) {
        const placeholders = paramList.map((p, idx) => {
          const pName = p.split(':')[0].split('=')[0].trim();
          return `\${${idx + 1}:${pName}}`;
        }).join(', ');
        snippetInsert = `${fnName}(${placeholders})`;
      }

      add(
        fnName,
        kinds.Function || 1,
        `def ${fnName}(${params})${retType ? ' -> ' + retType : ''}`,
        snippetInsert,
        paramList.length > 0,
        `**Function:** \`def ${fnName}(${params})\``,
        '01'
      );

      for (const p of paramList) {
        const pName = p.split(':')[0].split('=')[0].trim();
        if (pName && /^[A-Za-z_][A-Za-z0-9_]*$/.test(pName)) {
          add(pName, kinds.Variable || 5, `(parameter) ${pName}`, pName, false, '', '00');
        }
      }
    }

    const pyVarRegex = /(?:self\.)?([A-Za-z_][A-Za-z0-9_]*)\s*=/g;
    while ((match = pyVarRegex.exec(code)) !== null) {
      const varName = match[1];
      if (['if', 'elif', 'else', 'for', 'while', 'def', 'class', 'import', 'from', 'return', 'pass', 'try', 'except', 'with', 'as', 'lambda'].includes(varName)) continue;
      add(varName, kinds.Variable || 5, `(variable) ${varName}`, varName, false, '', '00');
    }
  }

  // --- GO ---
  if (language === 'go') {
    const goTypeRegex = /\btype\s+([A-Za-z_][A-Za-z0-9_]*)\s+(struct|interface)/g;
    let match;
    while ((match = goTypeRegex.exec(code)) !== null) {
      add(match[1], kinds.Class || 6, `(type) ${match[1]} ${match[2]}`, match[1], false, '', '00');
    }
    const goFuncRegex = /\bfunc\s+(?:\([^)]+\)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g;
    while ((match = goFuncRegex.exec(code)) !== null) {
      add(match[1], kinds.Function || 1, `func ${match[1]}(${match[2]})`, `${match[1]}()`, false, '', '01');
    }
    const goVarRegex = /\b(?:var|const)\s+([A-Za-z_][A-Za-z0-9_]*)|([A-Za-z_][A-Za-z0-9_]*)\s*:=/g;
    while ((match = goVarRegex.exec(code)) !== null) {
      const name = match[1] || match[2];
      if (name) add(name, kinds.Variable || 5, `(variable) ${name}`, name, false, '', '00');
    }
  }

  return symbols;
}

// ---------------------------------------------------------------------------
// Language Static Definitions
// ---------------------------------------------------------------------------

const PYTHON_ITEMS = [
  ...['False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
      'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
      'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
      'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
      'try', 'while', 'with', 'yield'].map(kw),

  snip('def', 'def ${1:function_name}(${2:args}):\n    ${3:pass}', 'Define a function'),
  snip('class', 'class ${1:ClassName}(${2:object}):\n    def __init__(self${3:, args}):\n        ${4:pass}', 'Define a class'),
  snip('if', 'if ${1:condition}:\n    ${2:pass}', 'If statement'),
  snip('ifelse', 'if ${1:condition}:\n    ${2:pass}\nelse:\n    ${3:pass}', 'If/else statement'),
  snip('elif', 'elif ${1:condition}:\n    ${2:pass}', 'Elif branch'),
  snip('for', 'for ${1:item} in ${2:iterable}:\n    ${3:pass}', 'For loop'),
  snip('forrange', 'for ${1:i} in range(${2:10}):\n    ${3:pass}', 'For range loop'),
  snip('while', 'while ${1:condition}:\n    ${2:pass}', 'While loop'),
  snip('try', 'try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${4:pass}', 'Try/except block'),
  snip('main', 'def main():\n    ${1:pass}\n\nif __name__ == "__main__":\n    main()', 'Main guard', '', '50'),

  builtin('print', 'print(${1:value})', 'print(value, ...)', 'Print to stdout.', true),
  builtin('len', 'len(${1:obj})', 'len(s) -> int', 'Return the number of items in a container.', true),
  builtin('range', 'range(${1:stop})', 'range(stop) or range(start, stop[, step])', '', true),
  builtin('isinstance', 'isinstance(${1:obj}, ${2:classinfo})', 'isinstance(object, classinfo) -> bool', '', true),
  builtin('enumerate', 'enumerate(${1:iterable})', 'enumerate(iterable, start=0)', '', true),
  builtin('zip', 'zip(${1:iter1}, ${2:iter2})', 'zip(*iterables)', '', true),
  builtin('sorted', 'sorted(${1:iterable})', 'sorted(iterable, *, key=None, reverse=False)', '', true),
];

const JAVA_ITEMS = [
  ...['abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch',
      'char', 'class', 'continue', 'default', 'do', 'double', 'else',
      'enum', 'extends', 'final', 'finally', 'float', 'for', 'if',
      'implements', 'import', 'instanceof', 'int', 'interface', 'long',
      'native', 'new', 'null', 'package', 'private', 'protected', 'public',
      'record', 'return', 'sealed', 'short', 'static', 'strictfp', 'super',
      'switch', 'synchronized', 'this', 'throw', 'throws', 'transient',
      'try', 'var', 'void', 'volatile', 'while', 'yield'].map(kw),

  // psvm / sout / fori snippets with distinct filterText
  snip('psvm', 'public static void main(String[] args) {\n    ${1:// body}\n}', 'public static void main(String[] args)', 'Main entry point method', '30', 'psvm'),
  snip('sout', 'System.out.println(${1:value});', 'System.out.println(...)', 'Print line to standard output', '25', 'sout'),
  snip('souf', 'System.out.printf("${1:%s}", ${2:args});', 'System.out.printf(...)', 'Print formatted string', '25', 'souf'),
  snip('fori', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3:// body}\n}', 'Indexed for loop', '', '25', 'fori'),
  snip('class', 'public class ${1:ClassName} {\n    ${2:// body}\n}', 'Public class definition', '', '30', 'class'),
  snip('if', 'if (${1:condition}) {\n    ${2:// body}\n}', 'If statement', '', '30', 'if'),
  snip('ifelse', 'if (${1:condition}) {\n    ${2:// body}\n} else {\n    ${3:// else}\n}', 'If/else', '', '30', 'ifelse'),
  snip('for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3:// body}\n}', 'For loop', '', '30', 'for'),
  snip('foreach', 'for (${1:Type} ${2:item} : ${3:collection}) {\n    ${4:// body}\n}', 'Enhanced for loop', '', '30', 'foreach'),
  snip('while', 'while (${1:condition}) {\n    ${2:// body}\n}', 'While loop', '', '30', 'while'),
  snip('try', 'try {\n    ${1:// body}\n} catch (${2:Exception} ${3:e}) {\n    ${4:e.printStackTrace()}\n}', 'Try/catch', '', '30', 'try'),
  snip('switch', 'switch (${1:expr}) {\n    case ${2:value}:\n        ${3:// body}\n        break;\n    default:\n        ${4:// default}\n}', 'Switch statement', '', '30', 'switch'),

  // Builtins / common API
  builtin('System.out.println', 'System.out.println(${1:value});', 'Print line to stdout', '', true),
  builtin('System.out.print', 'System.out.print(${1:value});', 'Print to stdout (no newline)', '', true),
  builtin('System.err.println', 'System.err.println(${1:value});', 'Print line to stderr', '', true),
  builtin('String.format', 'String.format("${1:%s}", ${2:args})', 'Format a string', '', true),
  builtin('Arrays.asList', 'Arrays.asList(${1:elements})', 'Create a fixed-size list', '', true),
  builtin('Collections.sort', 'Collections.sort(${1:list})', 'Sort a list in-place', '', true),
  builtin('Math.max', 'Math.max(${1:a}, ${2:b})', 'Return the larger of two values', '', true),
  builtin('Math.min', 'Math.min(${1:a}, ${2:b})', 'Return the smaller of two values', '', true),
  builtin('Math.abs', 'Math.abs(${1:x})', 'Return the absolute value', '', true),
  builtin('Math.sqrt', 'Math.sqrt(${1:x})', 'Return the square root', '', true),
  builtin('Integer.parseInt', 'Integer.parseInt(${1:s})', 'Parse an int from a string', '', true),
  builtin('Double.parseDouble', 'Double.parseDouble(${1:s})', 'Parse a double from a string', '', true),
];

const CPP_ITEMS = [
  ...['auto', 'bool', 'break', 'case', 'catch', 'char', 'class', 'const',
      'constexpr', 'continue', 'default', 'delete', 'do', 'double', 'else',
      'enum', 'explicit', 'export', 'extern', 'false', 'float', 'for',
      'friend', 'if', 'inline', 'int', 'long', 'namespace', 'new',
      'nullptr', 'private', 'protected', 'public', 'return', 'short',
      'signed', 'sizeof', 'static', 'struct', 'switch', 'template', 'this',
      'throw', 'true', 'try', 'typedef', 'typename', 'union', 'unsigned',
      'using', 'virtual', 'void', 'volatile', 'while'].map(kw),

  snip('main', '#include <iostream>\n\nint main() {\n    ${1:// body}\n    return 0;\n}', 'Main function', '', '50', 'main'),
  snip('class', 'class ${1:ClassName} {\npublic:\n    ${1:ClassName}() = default;\n    ~${1:ClassName}() = default;\n\n    ${2:// members}\n};', 'Class definition', '', '30', 'class'),
  snip('struct', 'struct ${1:Name} {\n    ${2:// fields}\n};', 'Struct definition', '', '30', 'struct'),
  snip('for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n    ${3:// body}\n}', 'For loop', '', '30', 'for'),
  snip('cout', 'std::cout << ${1:value} << "\\n";', 'std::cout print', '', '25', 'cout'),

  builtin('std::cout', 'std::cout << ${1:value} << "\\n"', 'Print to stdout', '', true),
  builtin('std::cin', 'std::cin >> ${1:variable}', 'Read from stdin', '', true),
  builtin('std::string', 'std::string', 'Standard string type', ''),
  builtin('std::vector', 'std::vector<${1:T}>', 'Dynamic array', '', true),
];

const C_ITEMS = [
  ...['auto', 'break', 'case', 'char', 'const', 'continue', 'default',
      'do', 'double', 'else', 'enum', 'extern', 'float', 'for', 'goto',
      'if', 'inline', 'int', 'long', 'register', 'restrict', 'return',
      'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef',
      'union', 'unsigned', 'void', 'volatile', 'while'].map(kw),

  snip('main', '#include <stdio.h>\n\nint main(void) {\n    ${1:// body}\n    return 0;\n}', 'Main function', '', '50', 'main'),
  snip('printf', 'printf("${1:%s}\\n", ${2:args});', 'printf', '', '25', 'printf'),
  builtin('printf', 'printf("${1:format}", ${2:args})', 'Print formatted output', '', true),
];

const GO_ITEMS = [
  ...['break', 'case', 'chan', 'const', 'continue', 'default', 'defer',
      'else', 'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import',
      'interface', 'map', 'package', 'range', 'return', 'select', 'struct',
      'switch', 'type', 'var'].map(kw),

  snip('main', 'package main\n\nimport "fmt"\n\nfunc main() {\n    ${1:// body}\n}', 'Main package', '', '50', 'main'),
  snip('func', 'func ${1:name}(${2:args}) ${3:returnType} {\n    ${4:// body}\n}', 'Function definition', '', '30', 'func'),
  builtin('fmt.Println', 'fmt.Println(${1:args})', 'fmt.Println — print with newline', '', true),
];

const RUST_ITEMS = [
  ...['as', 'async', 'await', 'break', 'const', 'continue', 'crate',
      'dyn', 'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl',
      'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref',
      'return', 'self', 'Self', 'static', 'struct', 'super', 'trait',
      'true', 'type', 'union', 'unsafe', 'use', 'where', 'while'].map(kw),

  snip('main', 'fn main() {\n    ${1:// body}\n}', 'Main function', '', '50', 'main'),
  snip('fn', 'fn ${1:name}(${2:args}) ${3:-> ReturnType} {\n    ${4:// body}\n}', 'Function definition', '', '30', 'fn'),
  builtin('println!', 'println!("${1:{:?}}", ${2:val})', 'println! — print with newline', '', true),
];

const CSHARP_ITEMS = [
  ...['abstract', 'as', 'async', 'await', 'base', 'bool', 'break', 'byte',
      'case', 'catch', 'char', 'class', 'const', 'continue', 'default',
      'do', 'double', 'else', 'enum', 'event', 'false', 'finally', 'float',
      'for', 'foreach', 'if', 'int', 'interface', 'internal', 'is', 'lock',
      'long', 'namespace', 'new', 'null', 'object', 'override', 'private',
      'protected', 'public', 'readonly', 'record', 'return', 'static',
      'string', 'struct', 'switch', 'this', 'throw', 'true', 'try',
      'using', 'var', 'virtual', 'void', 'while'].map(kw),

  snip('class', 'public class ${1:ClassName}\n{\n    ${2:// body}\n}', 'Public class', '', '30', 'class'),
  snip('cw', 'Console.WriteLine(${1:value});', 'Console.WriteLine', '', '25', 'cw'),
  builtin('Console.WriteLine', 'Console.WriteLine(${1:value});', 'Print line to console', '', true),
];

const RUBY_ITEMS = [
  ...['alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'do',
      'else', 'elsif', 'end', 'false', 'for', 'if', 'in', 'module',
      'next', 'nil', 'not', 'or', 'rescue', 'return', 'self', 'super',
      'then', 'true', 'unless', 'until', 'when', 'while', 'yield'].map(kw),
  builtin('puts', 'puts ${1:value}', 'Print with newline', '', true),
];

const PHP_ITEMS = [
  ...['abstract', 'and', 'array', 'as', 'break', 'case', 'catch',
      'class', 'const', 'continue', 'default', 'do', 'echo', 'else',
      'enum', 'extends', 'false', 'final', 'finally', 'fn', 'for',
      'foreach', 'function', 'if', 'implements', 'interface', 'new',
      'null', 'private', 'protected', 'public', 'return', 'static',
      'switch', 'throw', 'true', 'try', 'var', 'while'].map(kw),
  builtin('echo', 'echo ${1:$value};', 'Output a value', '', true),
];

const KOTLIN_ITEMS = [
  ...['abstract', 'as', 'break', 'class', 'const', 'continue', 'data',
      'do', 'else', 'enum', 'false', 'final', 'finally', 'for', 'fun',
      'if', 'import', 'in', 'interface', 'is', 'null', 'object', 'open',
      'override', 'package', 'private', 'protected', 'public', 'return',
      'sealed', 'super', 'this', 'throw', 'true', 'try', 'val', 'var',
      'when', 'while'].map(kw),
  snip('fun', 'fun ${1:name}(${2:args}): ${3:Unit} {\n    ${4:// body}\n}', 'Function definition', '', '30', 'fun'),
  builtin('println', 'println(${1:value})', 'Print with newline', '', true),
];

const SWIFT_ITEMS = [
  ...['associatedtype', 'class', 'deinit', 'enum', 'extension', 'func',
      'import', 'init', 'let', 'open', 'private', 'protocol', 'public',
      'static', 'struct', 'var', 'break', 'case', 'catch', 'continue',
      'default', 'else', 'for', 'guard', 'if', 'in', 'return', 'switch',
      'while', 'true', 'false', 'nil', 'self', 'try'].map(kw),
  builtin('print', 'print(${1:value})', 'Print to stdout', '', true),
];

const SQL_ITEMS = [
  ...['ADD', 'ALTER', 'AND', 'AS', 'ASC', 'BY', 'CASE', 'CAST',
      'COUNT', 'CREATE', 'DATABASE', 'DEFAULT', 'DELETE', 'DESC',
      'DISTINCT', 'DROP', 'ELSE', 'END', 'FROM', 'GROUP', 'HAVING',
      'IN', 'INDEX', 'INSERT', 'INTO', 'IS', 'JOIN', 'KEY', 'LEFT',
      'LIKE', 'LIMIT', 'MAX', 'MIN', 'NOT', 'NULL', 'ON', 'OR',
      'ORDER', 'PRIMARY', 'RIGHT', 'SELECT', 'SET', 'TABLE', 'UNION',
      'UPDATE', 'VALUES', 'WHERE'].map(kw),
  snip('select', 'SELECT ${1:*}\nFROM ${2:table_name}\nWHERE ${3:condition};', 'SELECT statement', '', '30', 'select'),
];

// ---------------------------------------------------------------------------
// Provider Registration & Engine
// ---------------------------------------------------------------------------

const TRIGGER_CHARS = {
  python:     ['.', '@'],
  java:       ['.', '@'],
  cpp:        ['.', ':', '>'],
  c:          ['.', '>'],
  go:         ['.'],
  rust:       ['.', ':'],
  csharp:     ['.'],
  ruby:       ['.', ':'],
  php:        ['.', '>', ':'],
  kotlin:     ['.', '?', ':'],
  swift:      ['.'],
  sql:        ['.'],
  javascript: ['.'],
  typescript: ['.'],
};

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
  javascript: [],
  typescript: [],
};

const LANGUAGE_MEMBER_DEFS = {
  java:       JAVA_MEMBERS,
  python:     PYTHON_MEMBERS,
  cpp:        CPP_MEMBERS,
  c:          CPP_MEMBERS,
  csharp:     JAVA_MEMBERS,
  kotlin:     JAVA_MEMBERS,
  javascript: JAVA_MEMBERS,
  typescript: JAVA_MEMBERS,
};

let activeDisposables = [];

/**
 * Registers multi-language dynamic code completion and symbol intelligence providers.
 *
 * @param {import('monaco-editor').Monaco} monaco
 */
export function registerCompletionProviders(monaco) {
  // Dispose any existing registrations first to guarantee fresh provider
  while (activeDisposables.length > 0) {
    const d = activeDisposables.pop();
    if (d && typeof d.dispose === 'function') d.dispose();
  }

  const kinds = monaco.languages.CompletionItemKind;

  for (const [language, staticItems] of Object.entries(LANGUAGE_COMPLETIONS)) {
    const triggers = TRIGGER_CHARS[language] ?? ['.'];

    try {
      const disposable = monaco.languages.registerCompletionItemProvider(language, {
        triggerCharacters: triggers,

        provideCompletionItems(model, position) {
          const lineContent = model.getLineContent(position.lineNumber);
          const lineUntilCursor = lineContent.substring(0, position.column - 1);
          const word = model.getWordUntilPosition(position);

          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber:   position.lineNumber,
            startColumn:     word.startColumn,
            endColumn:       word.endColumn,
          };

          const fullCode = model.getValue();
          const docSymbols = extractDocumentSymbols(fullCode, language, monaco);

          // 1. Context: Class/Interface/Type Declaration Line (e.g. `public class Main`)
          const isClassDeclaration = /^\s*(?:public|protected|private|static|final|abstract|sealed|open|data|\s)*\b(?:class|interface|enum|record|struct)\s+[A-Za-z0-9_$]*$/.test(lineUntilCursor);
          if (isClassDeclaration) {
            return { suggestions: [] };
          }

          // 2. Context: After `new ` (e.g. `new Main`, `new Array`, `new `)
          const isAfterNew = /\bnew\s+[A-Za-z0-9_$<>]*$/.test(lineUntilCursor);
          if (isAfterNew) {
            const constructorSuggestions = [];

            // Add constructors of classes extracted from current document
            for (const sym of docSymbols) {
              if (sym.kind === (kinds.Class || 6) || sym.kind === (kinds.Constructor || 2)) {
                constructorSuggestions.push({
                  ...sym,
                  sortText: '00_' + sym.label,
                  range,
                });
              }
            }

            // Add common standard constructors for Java
            if (language === 'java') {
              for (const c of JAVA_COMMON_CONSTRUCTORS) {
                constructorSuggestions.push({
                  ...c,
                  range,
                });
              }
            }

            return { suggestions: constructorSuggestions };
          }

          // 3. Context: Member Access (e.g. `obj.`, `this.`, `str.`, `Main.`)
          const isMemberAccess = /[\.\:\>]\s*[A-Za-z0-9_$]*$/.test(lineUntilCursor);
          if (isMemberAccess) {
            const memberSuggestions = [];
            const memberDefs = LANGUAGE_MEMBER_DEFS[language] || [];

            // Add standard library member methods
            for (const m of memberDefs) {
              memberSuggestions.push({
                label: m.label,
                kind: m.kind === 3 ? (kinds.Field || 4) : (kinds.Method || 0),
                detail: m.detail,
                insertText: m.insertText,
                insertTextRules: m.isSnippet ? 4 : 0,
                sortText: '00_' + m.label,
                range,
                documentation: m.doc ? { value: m.doc } : undefined,
              });
            }

            // Add custom methods & fields declared in current document
            for (const sym of docSymbols) {
              if (sym.kind === (kinds.Method || 0) || sym.kind === (kinds.Function || 1) || sym.kind === (kinds.Field || 4) || sym.kind === (kinds.Variable || 5)) {
                memberSuggestions.push({
                  ...sym,
                  sortText: '01_' + sym.label,
                  range,
                });
              }
            }

            return { suggestions: memberSuggestions };
          }

          // 4. General Completion (Document Symbols + Keywords + Stdlib + Snippets)
          const workspaceSymbols = [];
          try {
            const allModels = monaco.editor.getModels();
            for (const m of allModels) {
              if (m !== model && m.getValueLength() < 100000) {
                const otherCode = m.getValue();
                const otherSymbols = extractDocumentSymbols(otherCode, language, monaco);
                for (const s of otherSymbols) {
                  if (s.kind === (kinds.Class || 6) || s.kind === (kinds.Interface || 7)) {
                    workspaceSymbols.push(s);
                  }
                }
              }
            }
          } catch {
            // Ignore cross-model extraction errors
          }

          const allSuggestions = [
            ...docSymbols.map(s => ({ ...s, range })),
            ...workspaceSymbols.map(s => ({ ...s, range })),
            ...staticItems.map(item => ({ ...item, range })),
          ];

          return {
            suggestions: allSuggestions,
          };
        },
      });

      activeDisposables.push(disposable);
    } catch {
      // Provider already registered
    }
  }
}
