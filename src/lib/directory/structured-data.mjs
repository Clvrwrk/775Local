/** @param {unknown} value @returns {string} */
export function serializeStructuredData(value) {
  const json = JSON.stringify(value);
  if (json === undefined) throw new TypeError("Structured data must be JSON serializable.");
  return json
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}
