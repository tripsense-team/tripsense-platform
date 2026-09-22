export function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([key, child]) => [key, sortObject(child)])
    );
  }
  return value;
}

export function collectSchema(value, path = '', schema = new Map()) {
  const type = Array.isArray(value) ? 'array' : typeof value;
  if (path) schema.set(path, type);
  if (type === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      collectSchema(child, path ? `${path}.${key}` : key, schema);
    }
  }
  return schema;
}

export function compareSchemas(reference, candidate, referenceLocale, candidateLocale) {
  const errors = [];
  for (const [key, type] of reference) {
    if (!candidate.has(key)) {
      errors.push(`${candidateLocale}.json thiếu key: ${key}`);
    } else if (candidate.get(key) !== type) {
      errors.push(`${candidateLocale}.json có sai kiểu tại ${key} (cần ${type})`);
    }
  }
  for (const key of candidate.keys()) {
    if (!reference.has(key)) {
      errors.push(`${candidateLocale}.json có key thừa so với ${referenceLocale}.json: ${key}`);
    }
  }
  return errors;
}
