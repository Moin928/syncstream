/**
 * SyncStream Multi-Language Advanced Completion & IntelliSense Provider
 *
 * Provides:
 * 1. Live Document & Workspace Symbol Extraction (Variables, Fields, Parameters, Methods, Classes, Interfaces, Enums)
 * 2. Context-Aware Suggestion Ranking (Fixes class-naming collisions like 'class Main' vs 'main' snippet)
 * 3. Intelligent Member Access (. and ->) for Object, String, Collections, Map, Arrays, Streams, and User Classes
 * 4. Rich Multi-Language Keywords, Snippets (psvm, sout, fori, etc.), and Standard Library API
 */

// ---------------------------------------------------------------------------
// Helpers for Static Items
// ---------------------------------------------------------------------------

function kw(word) {
  return {
    label: word,
    kind: 17, // CompletionItemKind.Keyword
    detail: 'keyword',
    insertText: word,
    sortText: '10_' + word,
    filterText: word,
  };
}

function snip(label, body, detail, doc, sortOrder = '30') {
  const item = {
    label,
    kind: 27, // CompletionItemKind.Snippet
    detail: detail || 'Snippet',
    insertText: body,
    insertTextRules: 4, // InsertTextRule.InsertAsSnippet
    sortText: `${sortOrder}_${label}`,
    filterText: label,
  };
  if (doc) item.documentation = { value: doc };
  return item;
}

function builtin(label, insertText, detail, doc, isSnippet = false) {
  const item = {
    label,
    kind: 1, // CompletionItemKind.Function
    detail: detail || '',
    insertText,
    sortText: '20_' + label,
    filterText: label,
  };
  if (isSnippet) item.insertTextRules = 4;
  if (doc) item.documentation = { value: doc };
  return item;
}

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
  { label: 'contains(s)', insertText: 'contains(${1:s})', detail: 'boolean contains(CharSequence s)', doc: 'Returns true if this string/collection contains the sequence.', isSnippet: true, kind: 0 },
  { label: 'equals(anotherString)', insertText: 'equals(${1:anotherString})', detail: 'boolean equals(Object anObject)', doc: 'Compares this string to the specified object.', isSnippet: true, kind: 0 },
  { label: 'equalsIgnoreCase(s)', insertText: 'equalsIgnoreCase(${1:anotherString})', detail: 'boolean equalsIgnoreCase(String anotherString)', doc: 'Compares this string ignoring case considerations.', isSnippet: true, kind: 0 },
  { label: 'startsWith(prefix)', insertText: 'startsWith(${1:prefix})', detail: 'boolean startsWith(String prefix)', doc: 'Tests if this string starts with the specified prefix.', isSnippet: true, kind: 0 },
  { label: 'endsWith(suffix)', insertText: 'endsWith(${1:suffix})', detail: 'boolean endsWith(String suffix)', doc: 'Tests if this string ends with the specified suffix.', isSnippet: true, kind: 0 },
  { label: 'indexOf(str)', insertText: 'indexOf(${1:str})', detail: 'int indexOf(String str)', doc: 'Returns the index within this string of the first occurrence.', isSnippet: true, kind: 0 },
  { label: 'lastIndexOf(str)', insertText: 'lastIndexOf(${1:str})', detail: 'int lastIndexOf(String str)', doc: 'Returns the index of the last occurrence.', isSnippet: true, kind: 0 },
  { label: 'toLowerCase()', insertText: 'toLowerCase()', detail: 'String toLowerCase()', doc: 'Converts all characters in this String to lower case.', kind: 0 },
  { label: 'toUpperCase()', insertText: 'toUpperCase()', detail: 'String toUpperCase()', doc: 'Converts all characters in this String to upper case.', kind: 0 },
  { label: 'trim()', insertText: 'trim()', detail: 'String trim()', doc: 'Returns a string whose value is this string, with all leading and trailing space removed.', kind: 0 },
  { label: 'strip()', insertText: 'strip()', detail: 'String strip()', doc: 'Returns a string with all leading and trailing white space removed.', kind: 0 },
  { label: 'replace(old, new)', insertText: 'replace(${1:oldChar}, ${2:newChar})', detail: 'String replace(CharSequence target, CharSequence replacement)', doc: 'Replaces each substring matching target with replacement.', isSnippet: true, kind: 0 },
  { label: 'replaceAll(regex, rep)', insertText: 'replaceAll(${1:regex}, ${2:replacement})', detail: 'String replaceAll(String regex, String replacement)', doc: 'Replaces each substring matching regex with replacement.', isSnippet: true, kind: 0 },
  { label: 'split(regex)', insertText: 'split("${1:regex}")', detail: 'String[] split(String regex)', doc: 'Splits this string around matches of the given regular expression.', isSnippet: true, kind: 0 },
  { label: 'toCharArray()', insertText: 'toCharArray()', detail: 'char[] toCharArray()', doc: 'Converts this string to a new character array.', kind: 0 },
  { label: 'getBytes()', insertText: 'getBytes()', detail: 'byte[] getBytes()', doc: 'Encodes this String into a sequence of bytes.', kind: 0 },
  { label: 'isEmpty()', insertText: 'isEmpty()', detail: 'boolean isEmpty()', doc: 'Returns true if length() is 0.', kind: 0 },
  { label: 'isBlank()', insertText: 'isBlank()', detail: 'boolean isBlank()', doc: 'Returns true if the string is empty or contains only white space.', kind: 0 },
  { label: 'compareTo(another)', insertText: 'compareTo(${1:anotherString})', detail: 'int compareTo(String anotherString)', doc: 'Compares two strings lexicographically.', isSnippet: true, kind: 0 },

  // List / Collection / Set methods
  { label: 'size()', insertText: 'size()', detail: 'int size()', doc: 'Returns the number of elements in this collection or map.', kind: 0 },
  { label: 'add(e)', insertText: 'add(${1:element})', detail: 'boolean add(E e)', doc: 'Ensures that this collection contains the specified element.', isSnippet: true, kind: 0 },
  { label: 'addAll(c)', insertText: 'addAll(${1:collection})', detail: 'boolean addAll(Collection<? extends E> c)', doc: 'Appends all elements in the specified collection.', isSnippet: true, kind: 0 },
  { label: 'get(index)', insertText: 'get(${1:index})', detail: 'E get(int index)', doc: 'Returns the element at the specified position in this list.', isSnippet: true, kind: 0 },
  { label: 'set(index, element)', insertText: 'set(${1:index}, ${2:element})', detail: 'E set(int index, E element)', doc: 'Replaces the element at the specified position.', isSnippet: true, kind: 0 },
  { label: 'remove(o)', insertText: 'remove(${1:o})', detail: 'boolean remove(Object o)', doc: 'Removes the first occurrence of the specified element.', isSnippet: true, kind: 0 },
  { label: 'clear()', insertText: 'clear()', detail: 'void clear()', doc: 'Removes all of the elements from this collection or map.', kind: 0 },
  { label: 'iterator()', insertText: 'iterator()', detail: 'Iterator<E> iterator()', doc: 'Returns an iterator over the elements in this collection.', kind: 0 },
  { label: 'toArray()', insertText: 'toArray()', detail: 'Object[] toArray()', doc: 'Returns an array containing all of the elements in this collection.', kind: 0 },
  { label: 'stream()', insertText: 'stream()', detail: 'Stream<E> stream()', doc: 'Returns a sequential Stream with this collection as its source.', kind: 0 },
  { label: 'forEach(action)', insertText: 'forEach(${1:action})', detail: 'void forEach(Consumer<? super T> action)', doc: 'Performs the given action for each element.', isSnippet: true, kind: 0 },
  { label: 'sort(comparator)', insertText: 'sort(${1:comparator})', detail: 'void sort(Comparator<? super E> c)', doc: 'Sorts this list according to the order induced by Comparator.', isSnippet: true, kind: 0 },

  // Map methods
  { label: 'get(key)', insertText: 'get(${1:key})', detail: 'V get(Object key)', doc: 'Returns the value to which the specified key is mapped.', isSnippet: true, kind: 0 },
  { label: 'getOrDefault(key, defaultVal)', insertText: 'getOrDefault(${1:key}, ${2:defaultValue})', detail: 'V getOrDefault(Object key, V defaultValue)', doc: 'Returns mapped value, or defaultValue if not present.', isSnippet: true, kind: 0 },
  { label: 'put(key, value)', insertText: 'put(${1:key}, ${2:value})', detail: 'V put(K key, V value)', doc: 'Associates the specified value with the specified key.', isSnippet: true, kind: 0 },
  { label: 'putIfAbsent(key, value)', insertText: 'putIfAbsent(${1:key}, ${2:value})', detail: 'V putIfAbsent(K key, V value)', doc: 'If key is not already mapped, associates it with given value.', isSnippet: true, kind: 0 },
  { label: 'containsKey(key)', insertText: 'containsKey(${1:key})', detail: 'boolean containsKey(Object key)', doc: 'Returns true if this map contains a mapping for the key.', isSnippet: true, kind: 0 },
  { label: 'containsValue(value)', insertText: 'containsValue(${1:value})', detail: 'boolean containsValue(Object value)', doc: 'Returns true if this map maps one or more keys to the value.', isSnippet: true, kind: 0 },
  { label: 'keySet()', insertText: 'keySet()', detail: 'Set<K> keySet()', doc: 'Returns a Set view of the keys contained in this map.', kind: 0 },
  { label: 'values()', insertText: 'values()', detail: 'Collection<V> values()', doc: 'Returns a Collection view of the values contained in this map.', kind: 0 },
  { label: 'entrySet()', insertText: 'entrySet()', detail: 'Set<Map.Entry<K, V>> entrySet()', doc: 'Returns a Set view of the mappings contained in this map.', kind: 0 },
  { label: 'computeIfAbsent(key, mappingFunction)', insertText: 'computeIfAbsent(${1:key}, ${2:k -> mappingFunction})', detail: 'V computeIfAbsent(K key, Function<? super K, ? extends V> mappingFunction)', doc: 'Computes value if key is not present.', isSnippet: true, kind: 0 },

  // Stream methods
  { label: 'filter(predicate)', insertText: 'filter(${1:x -> predicate})', detail: 'Stream<T> filter(Predicate<? super T> predicate)', doc: 'Returns a stream consisting of elements matching predicate.', isSnippet: true, kind: 0 },
  { label: 'map(mapper)', insertText: 'map(${1:x -> mapper})', detail: '<R> Stream<R> map(Function<? super T, ? extends R> mapper)', doc: 'Returns a stream consisting of the results of applying mapper.', isSnippet: true, kind: 0 },
  { label: 'flatMap(mapper)', insertText: 'flatMap(${1:x -> mapper})', detail: '<R> Stream<R> flatMap(Function<? super T, ? extends Stream<? extends R>> mapper)', doc: 'Returns a stream of elements replaced with contents of mapped stream.', isSnippet: true, kind: 0 },
  { label: 'collect(collector)', insertText: 'collect(${1:Collectors.toList()})', detail: '<R, A> R collect(Collector<? super T, A, R> collector)', doc: 'Performs a mutable reduction operation on elements.', isSnippet: true, kind: 0 },
  { label: 'count()', insertText: 'count()', detail: 'long count()', doc: 'Returns the count of elements in this stream.', kind: 0 },
  { label: 'distinct()', insertText: 'distinct()', detail: 'Stream<T> distinct()', doc: 'Returns a stream with distinct elements.', kind: 0 },
  { label: 'sorted()', insertText: 'sorted()', detail: 'Stream<T> sorted()', doc: 'Returns a stream sorted according to natural order.', kind: 0 },
  { label: 'findFirst()', insertText: 'findFirst()', detail: 'Optional<T> findFirst()', doc: 'Returns an Optional describing the first element of this stream.', kind: 0 },
  { label: 'findAny()', insertText: 'findAny()', detail: 'Optional<T> findAny()', doc: 'Returns an Optional describing some element of the stream.', kind: 0 },

  // Optional methods
  { label: 'isPresent()', insertText: 'isPresent()', detail: 'boolean isPresent()', doc: 'If a value is present, returns true, otherwise false.', kind: 0 },
  { label: 'get()', insertText: 'get()', detail: 'T get()', doc: 'If a value is present, returns the value, otherwise throws NoSuchElementException.', kind: 0 },
  { label: 'orElse(other)', insertText: 'orElse(${1:other})', detail: 'T orElse(T other)', doc: 'Returns value if present, otherwise returns other.', isSnippet: true, kind: 0 },
  { label: 'orElseGet(supplier)', insertText: 'orElseGet(${1:supplier})', detail: 'T orElseGet(Supplier<? extends T> supplier)', doc: 'Returns value if present, otherwise invokes supplier.', isSnippet: true, kind: 0 },
  { label: 'orElseThrow()', insertText: 'orElseThrow()', detail: 'T orElseThrow()', doc: 'If value is present returns value, otherwise throws exception.', kind: 0 },
  { label: 'ifPresent(action)', insertText: 'ifPresent(${1:consumer})', detail: 'void ifPresent(Consumer<? super T> action)', doc: 'If value is present, performs action.', isSnippet: true, kind: 0 },

  // Array field
  { label: 'length', insertText: 'length', detail: 'int length (array)', doc: 'The length of the array.', kind: 3 },
];

const PYTHON_MEMBERS = [
  // List
  { label: 'append(x)', insertText: 'append(${1:x})', detail: 'list.append(x)', doc: 'Add an item to the end of the list.', isSnippet: true, kind: 0 },
  { label: 'extend(iterable)', insertText: 'extend(${1:iterable})', detail: 'list.extend(iterable)', doc: 'Extend the list by appending all items from iterable.', isSnippet: true, kind: 0 },
  { label: 'insert(i, x)', insertText: 'insert(${1:i}, ${2:x})', detail: 'list.insert(i, x)', doc: 'Insert an item at a given position.', isSnippet: true, kind: 0 },
  { label: 'remove(x)', insertText: 'remove(${1:x})', detail: 'list.remove(x)', doc: 'Remove first item from list whose value is equal to x.', isSnippet: true, kind: 0 },
  { label: 'pop(i)', insertText: 'pop(${1:index})', detail: 'list.pop([i])', doc: 'Remove item at given position in list, and return it.', isSnippet: true, kind: 0 },
  { label: 'clear()', insertText: 'clear()', detail: 'list.clear()', doc: 'Remove all items from the list/dict/set.', kind: 0 },
  { label: 'index(x)', insertText: 'index(${1:x})', detail: 'list.index(x)', doc: 'Return zero-based index in list of first item equal to x.', isSnippet: true, kind: 0 },
  { label: 'count(x)', insertText: 'count(${1:x})', detail: 'list.count(x)', doc: 'Return number of times x appears in the list.', isSnippet: true, kind: 0 },
  { label: 'sort()', insertText: 'sort(${1:key=None, reverse=False})', detail: 'list.sort(*, key=None, reverse=False)', doc: 'Sort the items of the list in place.', isSnippet: true, kind: 0 },
  { label: 'reverse()', insertText: 'reverse()', detail: 'list.reverse()', doc: 'Reverse the elements of the list in place.', kind: 0 },
  { label: 'copy()', insertText: 'copy()', detail: 'copy()', doc: 'Return a shallow copy.', kind: 0 },

  // Dict
  { label: 'keys()', insertText: 'keys()', detail: 'dict.keys()', doc: 'Return a new view of the dictionary\'s keys.', kind: 0 },
  { label: 'values()', insertText: 'values()', detail: 'dict.values()', doc: 'Return a new view of the dictionary\'s values.', kind: 0 },
  { label: 'items()', insertText: 'items()', detail: 'dict.items()', doc: 'Return a new view of the dictionary\'s items (key, value).', kind: 0 },
  { label: 'get(key, default)', insertText: 'get(${1:key}, ${2:default})', detail: 'dict.get(key[, default])', doc: 'Return value for key if key is in dict, else default.', isSnippet: true, kind: 0 },
  { label: 'update(other)', insertText: 'update(${1:dict_or_iterable})', detail: 'dict.update([other])', doc: 'Update dictionary with key/value pairs from other.', isSnippet: true, kind: 0 },
  { label: 'setdefault(key, default)', insertText: 'setdefault(${1:key}, ${2:default})', detail: 'dict.setdefault(key[, default])', doc: 'If key in dict, return its value. If not, insert key with default.', isSnippet: true, kind: 0 },

  // Str
  { label: 'split(sep)', insertText: 'split(${1:sep})', detail: 'str.split(sep=None, maxsplit=-1)', doc: 'Return a list of the words in the string.', isSnippet: true, kind: 0 },
  { label: 'rsplit(sep)', insertText: 'rsplit(${1:sep})', detail: 'str.rsplit(sep=None, maxsplit=-1)', doc: 'Return a list of words in string, scanning from right.', isSnippet: true, kind: 0 },
  { label: 'join(iterable)', insertText: 'join(${1:iterable})', detail: 'str.join(iterable)', doc: 'Concatenate strings in iterable with separator.', isSnippet: true, kind: 0 },
  { label: 'strip()', insertText: 'strip(${1:chars})', detail: 'str.strip([chars])', doc: 'Return copy of string with leading/trailing whitespace removed.', isSnippet: true, kind: 0 },
  { label: 'lstrip()', insertText: 'lstrip(${1:chars})', detail: 'str.lstrip([chars])', doc: 'Return copy of string with leading whitespace removed.', isSnippet: true, kind: 0 },
  { label: 'rstrip()', insertText: 'rstrip(${1:chars})', detail: 'str.rstrip([chars])', doc: 'Return copy of string with trailing whitespace removed.', isSnippet: true, kind: 0 },
  { label: 'replace(old, new)', insertText: 'replace(${1:old}, ${2:new})', detail: 'str.replace(old, new[, count])', doc: 'Return a copy of the string with all occurrences of old replaced by new.', isSnippet: true, kind: 0 },
  { label: 'find(sub)', insertText: 'find(${1:sub})', detail: 'str.find(sub[, start[, end]])', doc: 'Return lowest index where substring sub is found.', isSnippet: true, kind: 0 },
  { label: 'startswith(prefix)', insertText: 'startswith(${1:prefix})', detail: 'str.startswith(prefix[, start[, end]])', doc: 'Return True if string starts with prefix.', isSnippet: true, kind: 0 },
  { label: 'endswith(suffix)', insertText: 'endswith(${1:suffix})', detail: 'str.endswith(suffix[, start[, end]])', doc: 'Return True if string ends with suffix.', isSnippet: true, kind: 0 },
  { label: 'lower()', insertText: 'lower()', detail: 'str.lower()', doc: 'Return a copy of string with all characters converted to lowercase.', kind: 0 },
  { label: 'upper()', insertText: 'upper()', detail: 'str.upper()', doc: 'Return a copy of string with all characters converted to uppercase.', kind: 0 },
  { label: 'format(*args)', insertText: 'format(${1:*args})', detail: 'str.format(*args, **kwargs)', doc: 'Perform string formatting.', isSnippet: true, kind: 0 },
  { label: 'isdigit()', insertText: 'isdigit()', detail: 'str.isdigit()', doc: 'Return True if all characters in string are digits.', kind: 0 },
  { label: 'isalpha()', insertText: 'isalpha()', detail: 'str.isalpha()', doc: 'Return True if all characters in string are alphabetic.', kind: 0 },
  { label: 'isalnum()', insertText: 'isalnum()', detail: 'str.isalnum()', doc: 'Return True if all characters in string are alphanumeric.', kind: 0 },
];

const CPP_MEMBERS = [
  { label: 'size()', insertText: 'size()', detail: 'size_t size() const', doc: 'Returns the number of elements in the container.', kind: 0 },
  { label: 'empty()', insertText: 'empty()', detail: 'bool empty() const', doc: 'Checks whether the container is empty.', kind: 0 },
  { label: 'clear()', insertText: 'clear()', detail: 'void clear()', doc: 'Clears the contents of the container.', kind: 0 },
  { label: 'begin()', insertText: 'begin()', detail: 'iterator begin()', doc: 'Returns an iterator to the beginning.', kind: 0 },
  { label: 'end()', insertText: 'end()', detail: 'iterator end()', doc: 'Returns an iterator to the end.', kind: 0 },
  { label: 'push_back(val)', insertText: 'push_back(${1:val})', detail: 'void push_back(const T& value)', doc: 'Appends the given element to the end.', isSnippet: true, kind: 0 },
  { label: 'emplace_back(args)', insertText: 'emplace_back(${1:args})', detail: 'void emplace_back(Args&&... args)', doc: 'Constructs element in-place at the end.', isSnippet: true, kind: 0 },
  { label: 'pop_back()', insertText: 'pop_back()', detail: 'void pop_back()', doc: 'Removes the last element of the container.', kind: 0 },
  { label: 'front()', insertText: 'front()', detail: 'reference front()', doc: 'Access the first element.', kind: 0 },
  { label: 'back()', insertText: 'back()', detail: 'reference back()', doc: 'Access the last element.', kind: 0 },
  { label: 'data()', insertText: 'data()', detail: 'T* data()', doc: 'Direct access to the underlying contiguous storage array.', kind: 0 },
  { label: 'insert(pos, val)', insertText: 'insert(${1:pos}, ${2:val})', detail: 'iterator insert(const_iterator pos, const T& value)', doc: 'Inserts elements at the specified location.', isSnippet: true, kind: 0 },
  { label: 'erase(pos)', insertText: 'erase(${1:pos})', detail: 'iterator erase(const_iterator pos)', doc: 'Erases specified elements from container.', isSnippet: true, kind: 0 },
  { label: 'find(key)', insertText: 'find(${1:key})', detail: 'iterator find(const Key& key)', doc: 'Finds element with specific key.', isSnippet: true, kind: 0 },
  { label: 'count(key)', insertText: 'count(${1:key})', detail: 'size_type count(const Key& key) const', doc: 'Returns the number of elements matching key.', isSnippet: true, kind: 0 },
  { label: 'length()', insertText: 'length()', detail: 'size_t length() const', doc: 'Returns the number of characters in string.', kind: 0 },
  { label: 'c_str()', insertText: 'c_str()', detail: 'const char* c_str() const', doc: 'Returns a pointer to a null-terminated character array with string data.', kind: 0 },
  { label: 'substr(pos, count)', insertText: 'substr(${1:pos}, ${2:count})', detail: 'string substr(size_t pos = 0, size_t count = npos) const', doc: 'Returns a substring [pos, pos+count).', isSnippet: true, kind: 0 },
];

// ---------------------------------------------------------------------------
// Dynamic Symbol Extractor (Variables, Methods, Classes from Document)
// ---------------------------------------------------------------------------

/**
 * Extracts live declared variables, fields, methods, functions, classes, and types
 * from the current active document and workspace models.
 */
function extractDocumentSymbols(code, language, monaco) {
  const kinds = monaco.languages.CompletionItemKind;
  const symbols = [];
  const seen = new Set();

  function add(label, kind, detail, insertText = label, isSnippet = false, doc = '') {
    if (!label || label.length <= 1 || seen.has(label)) return;
    seen.add(label);

    let sortOrder = '00';
    if (kind === kinds.Variable || kind === kinds.Field) sortOrder = '00';
    else if (kind === kinds.Method || kind === kinds.Function) sortOrder = '01';
    else if (kind === kinds.Class || kind === kinds.Interface || kind === kinds.Enum || kind === kinds.Struct) sortOrder = '02';

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
    const classRegex = /\b(?:public|private|protected|static|final|abstract|sealed|open|data)*\s*\b(class|interface|enum|record|struct)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
    let match;
    while ((match = classRegex.exec(code)) !== null) {
      const type = match[1];
      const name = match[2];
      const kind = type === 'interface' ? kinds.Interface : type === 'enum' ? kinds.Enum : type === 'struct' ? (kinds.Struct || kinds.Class) : kinds.Class;
      add(name, kind, `(${type}) ${name}`, name, false, `**Declared ${type}:** \`${name}\``);
    }

    // 2. Methods and Functions
    const methodRegex = /(?:public|protected|private|static|final|synchronized|abstract|default|inline|virtual|override|fun|\s)+\s+([A-Za-z0-9_$<>\[\], ?]+)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)\s*(?:\{|;|->|=)/g;
    while ((match = methodRegex.exec(code)) !== null) {
      const retType = match[1].trim();
      const methodName = match[2];
      const params = match[3].trim();
      if (['if', 'for', 'while', 'switch', 'catch', 'synchronized', 'return', 'else', 'class', 'struct', 'interface'].includes(methodName)) continue;

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
        kinds.Method,
        `(${retType}) ${methodName}(${params})`,
        snippetInsert,
        paramList.length > 0,
        `**Method:** \`${retType} ${methodName}(${params})\``
      );

      // Extract parameter names as local variables in scope
      for (const p of paramList) {
        const pParts = p.split(/\s+/);
        const pName = pParts[pParts.length - 1].replace(/[^A-Za-z0-9_$]/g, '');
        const pType = pParts.slice(0, pParts.length - 1).join(' ') || 'param';
        if (pName && !seen.has(pName)) {
          add(pName, kinds.Variable, `(parameter) ${pType} ${pName}`, pName);
        }
      }
    }

    // 3. Variables & Fields
    const varRegex = /(?:(?:public|protected|private|static|final|volatile|transient|val|var|const|auto|let)\s+)*(?:var|val|int|double|float|long|short|byte|char|boolean|String|auto|let|const|[A-Z][A-Za-z0-9_$<>, ?\[\]]*)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:=|;|,|\))/g;
    while ((match = varRegex.exec(code)) !== null) {
      const varName = match[1];
      if (['class', 'interface', 'enum', 'record', 'struct', 'new', 'return', 'if', 'else', 'for', 'while', 'try', 'catch', 'throw', 'public', 'private', 'protected', 'static', 'void', 'this', 'super', 'true', 'false', 'null'].includes(varName)) continue;
      add(varName, kinds.Field, `(variable) ${varName}`, varName);
    }
  }

  // --- PYTHON ---
  if (language === 'python') {
    // Classes
    const pyClassRegex = /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)(?:\(([^)]*)\))?:/g;
    let match;
    while ((match = pyClassRegex.exec(code)) !== null) {
      add(match[1], kinds.Class, `(class) ${match[1]}`, match[1], false, `**Class:** \`${match[1]}\``);
    }

    // Functions & Methods
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
        kinds.Function,
        `def ${fnName}(${params})${retType ? ' -> ' + retType : ''}`,
        snippetInsert,
        paramList.length > 0,
        `**Function:** \`def ${fnName}(${params})\``
      );

      for (const p of paramList) {
        const pName = p.split(':')[0].split('=')[0].trim();
        if (pName && /^[A-Za-z_][A-Za-z0-9_]*$/.test(pName)) {
          add(pName, kinds.Variable, `(parameter) ${pName}`, pName);
        }
      }
    }

    // Variables & Attributes
    const pyVarRegex = /(?:self\.)?([A-Za-z_][A-Za-z0-9_]*)\s*=/g;
    while ((match = pyVarRegex.exec(code)) !== null) {
      const varName = match[1];
      if (['if', 'elif', 'else', 'for', 'while', 'def', 'class', 'import', 'from', 'return', 'pass', 'try', 'except', 'with', 'as', 'lambda'].includes(varName)) continue;
      add(varName, kinds.Variable, `(variable) ${varName}`, varName);
    }
  }

  // --- GO ---
  if (language === 'go') {
    const goTypeRegex = /\btype\s+([A-Za-z_][A-Za-z0-9_]*)\s+(struct|interface)/g;
    let match;
    while ((match = goTypeRegex.exec(code)) !== null) {
      const kind = match[2] === 'interface' ? kinds.Interface : (kinds.Struct || kinds.Class);
      add(match[1], kind, `(type) ${match[1]} ${match[2]}`, match[1]);
    }
    const goFuncRegex = /\bfunc\s+(?:\([^)]+\)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/g;
    while ((match = goFuncRegex.exec(code)) !== null) {
      add(match[1], kinds.Function, `func ${match[1]}(${match[2]})`, `${match[1]}()`);
    }
    const goVarRegex = /\b(?:var|const)\s+([A-Za-z_][A-Za-z0-9_]*)|([A-Za-z_][A-Za-z0-9_]*)\s*:=/g;
    while ((match = goVarRegex.exec(code)) !== null) {
      const name = match[1] || match[2];
      if (name) add(name, kinds.Variable, `(variable) ${name}`, name);
    }
  }

  // --- RUST ---
  if (language === 'rust') {
    const rsTypeRegex = /\b(struct|enum|trait|type)\s+([A-Za-z_][A-Za-z0-9_]*)/g;
    let match;
    while ((match = rsTypeRegex.exec(code)) !== null) {
      const kind = match[1] === 'trait' ? kinds.Interface : match[1] === 'enum' ? kinds.Enum : (kinds.Struct || kinds.Class);
      add(match[2], kind, `(${match[1]}) ${match[2]}`, match[2]);
    }
    const rsFnRegex = /\bfn\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:<[^>]+>)?\s*\(([^)]*)\)/g;
    while ((match = rsFnRegex.exec(code)) !== null) {
      add(match[1], kinds.Function, `fn ${match[1]}(${match[2]})`, `${match[1]}()`);
    }
    const rsVarRegex = /\blet\s+(?:mut\s+)?([A-Za-z_][A-Za-z0-9_]*)/g;
    while ((match = rsVarRegex.exec(code)) !== null) {
      add(match[1], kinds.Variable, `(let) ${match[1]}`, match[1]);
    }
  }

  return symbols;
}

// ---------------------------------------------------------------------------
// Language Static Definitions
// ---------------------------------------------------------------------------

// Python
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
  snip('tryfinally', 'try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${4:pass}\nfinally:\n    ${5:pass}', 'Try/except/finally'),
  snip('with', 'with ${1:open("file")} as ${2:f}:\n    ${3:pass}', 'With statement'),
  snip('lambda', 'lambda ${1:args}: ${2:expr}', 'Lambda expression'),
  snip('comprehension', '[${1:expr} for ${2:x} in ${3:iterable}]', 'List comprehension'),
  snip('dictcomp', '{${1:key}: ${2:value} for ${3:k}, ${4:v} in ${5:iterable}.items()}', 'Dict comprehension'),
  snip('main', 'def main():\n    ${1:pass}\n\nif __name__ == "__main__":\n    main()', 'Main guard', '', '40'),
  snip('dataclass', 'from dataclasses import dataclass\n\n@dataclass\nclass ${1:MyClass}:\n    ${2:field}: ${3:str}', 'Dataclass'),
  snip('property', '@property\ndef ${1:name}(self):\n    return self._${1:name}\n\n@${1:name}.setter\ndef ${1:name}(self, value):\n    self._${1:name} = value', 'Property with setter'),

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

// Java
const JAVA_ITEMS = [
  ...['abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch',
      'char', 'class', 'continue', 'default', 'do', 'double', 'else',
      'enum', 'extends', 'final', 'finally', 'float', 'for', 'if',
      'implements', 'import', 'instanceof', 'int', 'interface', 'long',
      'native', 'new', 'null', 'package', 'private', 'protected', 'public',
      'record', 'return', 'sealed', 'short', 'static', 'strictfp', 'super',
      'switch', 'synchronized', 'this', 'throw', 'throws', 'transient',
      'try', 'var', 'void', 'volatile', 'while', 'yield'].map(kw),

  // Snippets — standard aliases (psvm, sout, fori)
  snip('psvm', 'public static void main(String[] args) {\n    ${1:// body}\n}', 'public static void main(String[] args)', 'Main method entry point', '25'),
  snip('main', 'public static void main(String[] args) {\n    ${1:// body}\n}', 'public static void main(String[] args)', 'Main method entry point', '45'),
  snip('sout', 'System.out.println(${1:value});', 'System.out.println(...)', 'Print line to standard output', '25'),
  snip('souf', 'System.out.printf("${1:%s}", ${2:args});', 'System.out.printf(...)', 'Print formatted string', '25'),
  snip('fori', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3:// body}\n}', 'Indexed for loop', '', '25'),
  snip('class', 'public class ${1:ClassName} {\n    ${2:// body}\n}', 'Public class definition', '', '30'),
  snip('if', 'if (${1:condition}) {\n    ${2:// body}\n}', 'If statement', '', '30'),
  snip('ifelse', 'if (${1:condition}) {\n    ${2:// body}\n} else {\n    ${3:// else}\n}', 'If/else', '', '30'),
  snip('for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3:// body}\n}', 'For loop', '', '30'),
  snip('foreach', 'for (${1:Type} ${2:item} : ${3:collection}) {\n    ${4:// body}\n}', 'Enhanced for loop', '', '30'),
  snip('while', 'while (${1:condition}) {\n    ${2:// body}\n}', 'While loop', '', '30'),
  snip('try', 'try {\n    ${1:// body}\n} catch (${2:Exception} ${3:e}) {\n    ${4:e.printStackTrace()}\n}', 'Try/catch', '', '30'),
  snip('tryfinally', 'try {\n    ${1:// body}\n} catch (${2:Exception} ${3:e}) {\n    ${4:e.printStackTrace()}\n} finally {\n    ${5:// cleanup}\n}', 'Try/catch/finally', '', '30'),
  snip('interface', 'public interface ${1:Name} {\n    ${2:// methods}\n}', 'Interface', '', '30'),
  snip('enum', 'public enum ${1:Name} {\n    ${2:VALUE1}, ${3:VALUE2}\n}', 'Enum', '', '30'),
  snip('record', 'public record ${1:Name}(${2:Type} ${3:field}) {}', 'Record', '', '30'),
  snip('lambda', '(${1:args}) -> ${2:expr}', 'Lambda expression', '', '30'),
  snip('switch', 'switch (${1:expr}) {\n    case ${2:value}:\n        ${3:// body}\n        break;\n    default:\n        ${4:// default}\n}', 'Switch statement', '', '30'),

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
  builtin('new ArrayList', 'new ArrayList<>()', 'Create an ArrayList', '', false),
  builtin('new HashMap', 'new HashMap<>()', 'Create a HashMap', '', false),
  builtin('new HashSet', 'new HashSet<>()', 'Create a HashSet', '', false),
  builtin('new Scanner', 'new Scanner(System.in)', 'Create standard input Scanner', '', false),
];

// C++
const CPP_ITEMS = [
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

  snip('main', '#include <iostream>\n\nint main() {\n    ${1:// body}\n    return 0;\n}', 'Main function with iostream', '', '40'),
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
  snip('cout', 'std::cout << ${1:value} << "\\n";', 'std::cout print'),

  builtin('std::cout', 'std::cout << ${1:value} << "\\n"', 'Print to stdout', '', true),
  builtin('std::cin', 'std::cin >> ${1:variable}', 'Read from stdin', '', true),
  builtin('std::cerr', 'std::cerr << ${1:msg} << "\\n"', 'Print to stderr', '', true),
  builtin('std::string', 'std::string', 'Standard string type', ''),
  builtin('std::vector', 'std::vector<${1:T}>', 'Dynamic array', '', true),
  builtin('std::map', 'std::map<${1:Key}, ${2:Value}>', 'Ordered key-value map', '', true),
  builtin('std::unordered_map', 'std::unordered_map<${1:Key}, ${2:Value}>', 'Hash map', '', true),
  builtin('std::set', 'std::set<${1:T}>', 'Ordered set', '', true),
  builtin('std::make_unique', 'std::make_unique<${1:T}>(${2:args})', 'Create unique_ptr', '', true),
  builtin('std::make_shared', 'std::make_shared<${1:T}>(${2:args})', 'Create shared_ptr', '', true),
  builtin('std::sort', 'std::sort(${1:begin}, ${2:end})', 'Sort a range', '', true),
];

// C
const C_ITEMS = [
  ...['auto', 'break', 'case', 'char', 'const', 'continue', 'default',
      'do', 'double', 'else', 'enum', 'extern', 'float', 'for', 'goto',
      'if', 'inline', 'int', 'long', 'register', 'restrict', 'return',
      'short', 'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef',
      'union', 'unsigned', 'void', 'volatile', 'while'].map(kw),

  snip('main', '#include <stdio.h>\n\nint main(void) {\n    ${1:// body}\n    return 0;\n}', 'Main function', '', '40'),
  snip('struct', 'typedef struct ${1:Name} {\n    ${2:// fields}\n} ${1:Name};', 'Typedef struct'),
  snip('if', 'if (${1:condition}) {\n    ${2:// body}\n}', 'If statement'),
  snip('for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n    ${3:// body}\n}', 'For loop'),
  snip('printf', 'printf("${1:%s}\\n", ${2:args});', 'printf'),
  snip('#include', '#include <${1:header}.h>', 'Include header'),

  builtin('printf', 'printf("${1:format}", ${2:args})', 'Print formatted output', '', true),
  builtin('scanf', 'scanf("${1:format}", ${2:&var})', 'Read formatted input', '', true),
  builtin('malloc', 'malloc(${1:size})', 'Allocate memory', '', true),
  builtin('free', 'free(${1:ptr})', 'Free allocated memory', '', true),
];

// Go
const GO_ITEMS = [
  ...['break', 'case', 'chan', 'const', 'continue', 'default', 'defer',
      'else', 'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import',
      'interface', 'map', 'package', 'range', 'return', 'select', 'struct',
      'switch', 'type', 'var'].map(kw),

  snip('main', 'package main\n\nimport "fmt"\n\nfunc main() {\n    ${1:// body}\n}', 'Main package', '', '40'),
  snip('func', 'func ${1:name}(${2:args}) ${3:returnType} {\n    ${4:// body}\n}', 'Function definition'),
  snip('struct', 'type ${1:Name} struct {\n    ${2:Field} ${3:Type}\n}', 'Struct definition'),
  snip('if', 'if ${1:condition} {\n    ${2:// body}\n}', 'If statement'),
  snip('iferr', 'if err != nil {\n    ${1:return err}\n}', 'Error check'),
  snip('for', 'for ${1:i} := 0; ${1:i} < ${2:n}; ${1:i}++ {\n    ${3:// body}\n}', 'For loop'),
  snip('forrange', 'for ${1:i}, ${2:v} := range ${3:collection} {\n    ${4:// body}\n}', 'For range loop'),

  builtin('fmt.Println', 'fmt.Println(${1:args})', 'fmt.Println — print with newline', '', true),
  builtin('fmt.Printf', 'fmt.Printf("${1:%v}", ${2:args})', 'fmt.Printf — formatted print', '', true),
  builtin('make', 'make(${1:[]int}, ${2:len})', 'make — allocate slice/map/chan', '', true),
  builtin('append', 'append(${1:slice}, ${2:elems})', 'append — add to slice', '', true),
  builtin('len', 'len(${1:v})', 'len — length of collection', '', true),
];

// Rust
const RUST_ITEMS = [
  ...['as', 'async', 'await', 'break', 'const', 'continue', 'crate',
      'dyn', 'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl',
      'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref',
      'return', 'self', 'Self', 'static', 'struct', 'super', 'trait',
      'true', 'type', 'union', 'unsafe', 'use', 'where', 'while'].map(kw),

  snip('main', 'fn main() {\n    ${1:// body}\n}', 'Main function', '', '40'),
  snip('fn', 'fn ${1:name}(${2:args}) ${3:-> ReturnType} {\n    ${4:// body}\n}', 'Function definition'),
  snip('struct', 'struct ${1:Name} {\n    ${2:field}: ${3:Type},\n}', 'Struct definition'),
  snip('impl', 'impl ${1:Type} {\n    pub fn ${2:new}(${3:args}) -> Self {\n        ${4:// body}\n    }\n}', 'Impl block'),
  snip('if', 'if ${1:condition} {\n    ${2:// body}\n}', 'If expression'),
  snip('match', 'match ${1:expr} {\n    ${2:pattern} => ${3:// body},\n    _ => ${4:// default},\n}', 'Match expression'),

  builtin('println!', 'println!("${1:{:?}}", ${2:val})', 'println! — print with newline', '', true),
  builtin('format!', 'format!("${1:{}}", ${2:val})', 'format! — format to String', '', true),
  builtin('vec!', 'vec![${1:elements}]', 'vec! — create a Vec', '', true),
];

// C#
const CSHARP_ITEMS = [
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

  snip('class', 'public class ${1:ClassName}\n{\n    ${2:// body}\n}', 'Public class'),
  snip('main', 'static void Main(string[] args)\n{\n    ${1:// body}\n}', 'Main method', '', '40'),
  snip('cw', 'Console.WriteLine(${1:value});', 'Console.WriteLine', '', '25'),
  snip('prop', 'public ${1:int} ${2:Name} { get; set; }', 'Auto property'),
  snip('if', 'if (${1:condition})\n{\n    ${2:// body}\n}', 'If statement'),
  snip('for', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++)\n{\n    ${3:// body}\n}', 'For loop'),

  builtin('Console.WriteLine', 'Console.WriteLine(${1:value});', 'Print line to console', '', true),
  builtin('Console.ReadLine', 'Console.ReadLine()', 'Read line from console', '', false),
];

// Ruby
const RUBY_ITEMS = [
  ...['alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'defined?', 'do',
      'else', 'elsif', 'end', 'ensure', 'false', 'for', 'if', 'in',
      'module', 'next', 'nil', 'not', 'or', 'redo', 'rescue', 'retry',
      'return', 'self', 'super', 'then', 'true', 'undef', 'unless',
      'until', 'when', 'while', 'yield'].map(kw),

  snip('def', 'def ${1:method_name}(${2:args})\n  ${3:# body}\nend', 'Define a method'),
  snip('class', 'class ${1:ClassName}\n  def initialize(${2:args})\n    ${3:# body}\n  end\nend', 'Class definition'),
  snip('if', 'if ${1:condition}\n  ${2:# body}\nend', 'If statement'),

  builtin('puts', 'puts ${1:value}', 'Print with newline', '', true),
  builtin('print', 'print ${1:value}', 'Print without newline', '', true),
];

// PHP
const PHP_ITEMS = [
  ...['abstract', 'and', 'array', 'as', 'break', 'callable', 'case',
      'catch', 'class', 'clone', 'const', 'continue', 'declare', 'default',
      'do', 'echo', 'else', 'elseif', 'empty', 'enddeclare', 'endfor',
      'endforeach', 'endif', 'endswitch', 'endwhile', 'enum', 'extends',
      'false', 'final', 'finally', 'fn', 'for', 'foreach', 'function',
      'global', 'goto', 'if', 'implements', 'include', 'include_once',
      'instanceof', 'interface', 'isset', 'list', 'match',
      'namespace', 'new', 'null', 'or', 'print', 'private', 'protected',
      'public', 'readonly', 'require', 'require_once', 'return', 'static',
      'switch', 'throw', 'trait', 'true', 'try', 'unset', 'use',
      'var', 'while', 'xor', 'yield'].map(kw),

  snip('class', 'class ${1:ClassName} {\n    public function __construct(${2:args}) {\n        ${3:// body}\n    }\n}', 'Class definition'),
  snip('function', 'function ${1:name}(${2:args}): ${3:void} {\n    ${4:// body}\n}', 'Function definition'),
  snip('if', 'if (${1:condition}) {\n    ${2:// body}\n}', 'If statement'),

  builtin('echo', 'echo ${1:$value};', 'Output a value', '', true),
  builtin('var_dump', 'var_dump(${1:$value});', 'Dump variable info', '', true),
];

// Kotlin
const KOTLIN_ITEMS = [
  ...['abstract', 'actual', 'annotation', 'as', 'break', 'by', 'catch',
      'class', 'companion', 'const', 'constructor', 'continue',
      'data', 'delegate', 'do', 'else', 'enum', 'expect',
      'false', 'field', 'final', 'finally', 'for',
      'fun', 'get', 'if', 'import', 'in', 'init', 'inline',
      'interface', 'internal', 'is', 'lateinit',
      'null', 'object', 'open', 'override', 'package',
      'private', 'protected', 'public',
      'return', 'sealed', 'set', 'super', 'suspend',
      'this', 'throw', 'true', 'try', 'typealias', 'val',
      'var', 'when', 'while'].map(kw),

  snip('fun', 'fun ${1:name}(${2:args}): ${3:Unit} {\n    ${4:// body}\n}', 'Function definition'),
  snip('main', 'fun main() {\n    ${1:// body}\n}', 'Main function', '', '40'),
  snip('class', 'class ${1:Name}(${2:val field: Type}) {\n    ${3:// body}\n}', 'Class definition'),
  snip('dataclass', 'data class ${1:Name}(\n    val ${2:field}: ${3:Type}\n)', 'Data class'),

  builtin('println', 'println(${1:value})', 'Print with newline', '', true),
  builtin('listOf', 'listOf(${1:elements})', 'Create an immutable List', '', true),
  builtin('mutableListOf', 'mutableListOf(${1:elements})', 'Create a mutable List', '', true),
];

// Swift
const SWIFT_ITEMS = [
  ...['associatedtype', 'class', 'deinit', 'enum', 'extension', 'fileprivate',
      'func', 'import', 'init', 'inout', 'internal', 'let', 'open',
      'operator', 'private', 'protocol', 'public',
      'static', 'struct', 'subscript', 'typealias', 'var',
      'break', 'case', 'catch', 'continue', 'default', 'defer', 'do',
      'else', 'fallthrough', 'for', 'guard', 'if', 'in', 'repeat',
      'return', 'throw', 'switch', 'where', 'while',
      'Any', 'as', 'await', 'false', 'is', 'nil', 'self', 'Self',
      'super', 'throws', 'true', 'try'].map(kw),

  snip('func', 'func ${1:name}(${2:args}) ${3:-> ReturnType} {\n    ${4:// body}\n}', 'Function definition'),
  snip('struct', 'struct ${1:Name} {\n    ${2:var field}: ${3:Type}\n}', 'Struct definition'),
  snip('class', 'class ${1:Name} {\n    ${2:// body}\n}', 'Class definition'),

  builtin('print', 'print(${1:value})', 'Print to stdout', '', true),
];

// SQL
const SQL_ITEMS = [
  ...['ADD', 'ALL', 'ALTER', 'AND', 'ANY', 'AS', 'ASC', 'AUTOINCREMENT',
      'AVG', 'BETWEEN', 'BY', 'CASE', 'CAST', 'COLUMN', 'CONSTRAINT',
      'COUNT', 'CREATE', 'CROSS', 'DATABASE', 'DEFAULT', 'DELETE', 'DESC',
      'DISTINCT', 'DROP', 'ELSE', 'END', 'EXCEPT', 'EXISTS',
      'FOREIGN', 'FROM', 'FULL', 'GROUP', 'HAVING', 'IN',
      'INDEX', 'INNER', 'INSERT', 'INTO', 'IS', 'JOIN',
      'KEY', 'LEFT', 'LIKE', 'LIMIT', 'MAX', 'MIN', 'NOT', 'NULL',
      'ON', 'OR', 'ORDER', 'PRIMARY', 'REFERENCES',
      'RIGHT', 'SELECT', 'SET', 'SUM', 'TABLE', 'THEN',
      'UNION', 'UNIQUE', 'UPDATE', 'VALUES', 'VIEW', 'WHEN', 'WHERE', 'WITH'].map(kw),

  snip('select', 'SELECT ${1:*}\nFROM ${2:table_name}\nWHERE ${3:condition};', 'SELECT statement'),
  snip('insert', 'INSERT INTO ${1:table_name} (${2:column1}, ${3:column2})\nVALUES (${4:value1}, ${5:value2});', 'INSERT statement'),
  snip('create table', 'CREATE TABLE ${1:table_name} (\n    ${2:id} INT PRIMARY KEY AUTO_INCREMENT,\n    ${3:column} ${4:VARCHAR(255)}\n);', 'CREATE TABLE'),
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

let isRegistered = false;

/**
 * Registers multi-language dynamic code completion and symbol intelligence providers.
 *
 * @param {import('monaco-editor').Monaco} monaco
 */
export function registerCompletionProviders(monaco) {
  if (isRegistered) return;
  isRegistered = true;

  const kinds = monaco.languages.CompletionItemKind;

  for (const [language, staticItems] of Object.entries(LANGUAGE_COMPLETIONS)) {
    const triggers = TRIGGER_CHARS[language] ?? ['.'];

    try {
      monaco.languages.registerCompletionItemProvider(language, {
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

          // 1. Check if user is typing in a Class / Interface / Type definition header
          // e.g. "public class Main", "class Foo", "interface Bar", "record Student"
          const isClassDeclaration = /^\s*(?:public|protected|private|static|final|abstract|sealed|open|data)*\s*\b(?:class|interface|enum|record|struct)\s+[A-Za-z0-9_$]*$/.test(lineUntilCursor);
          if (isClassDeclaration) {
            // Do not pop up method body snippets or statements that replace class names (e.g. 'main' snippet)
            return { suggestions: [] };
          }

          // 2. Check if user is typing member access (e.g. "obj.", "this.", "str.", "Main.")
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

            // Also extract and include custom methods & fields declared in current document
            const code = model.getValue();
            const docSymbols = extractDocumentSymbols(code, language, monaco);
            for (const sym of docSymbols) {
              if (sym.kind === kinds.Method || sym.kind === kinds.Function || sym.kind === kinds.Field || sym.kind === kinds.Variable) {
                memberSuggestions.push({
                  ...sym,
                  sortText: '01_' + sym.label,
                  range,
                });
              }
            }

            return { suggestions: memberSuggestions };
          }

          // 3. General Completion (Symbols + Keywords + Stdlib + Snippets)
          const code = model.getValue();
          const docSymbols = extractDocumentSymbols(code, language, monaco);

          // Cross-model workspace symbols from other open files
          const workspaceSymbols = [];
          try {
            const allModels = monaco.editor.getModels();
            for (const m of allModels) {
              if (m !== model && m.getValueLength() < 100000) {
                const otherCode = m.getValue();
                const otherSymbols = extractDocumentSymbols(otherCode, language, monaco);
                for (const s of otherSymbols) {
                  if (s.kind === kinds.Class || s.kind === kinds.Interface) {
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
    } catch {
      // Provider already registered
    }
  }
}
