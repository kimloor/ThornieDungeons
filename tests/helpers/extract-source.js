// Pulls a top-level `function name(...) { ... }` or an arrow `const name = ...;` out of a source
// file by brace/paren matching so tests can exercise it without mounting React.
function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`function ${name} not found`);
  const open = source.indexOf("{", source.indexOf(")", start));
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    if (ch === "}") { depth -= 1; if (depth === 0) return source.slice(start, i + 1); }
  }
  throw new Error(`unterminated function ${name}`);
}

function extractArrowConst(source, name) {
  const start = source.indexOf(`const ${name} = `);
  if (start === -1) throw new Error(`const ${name} not found`);
  const end = source.indexOf(";\n", start);
  return source.slice(start, end + 1);
}

module.exports = { extractFunction, extractArrowConst };
