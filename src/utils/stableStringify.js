export function stableStringify(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }

  if (value && typeof value === 'object') {
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map(
          k =>
            JSON.stringify(k) +
            ':' +
            stableStringify(value[k])
        )
        .join(',') +
      '}'
    );
  }

  return JSON.stringify(value);
}
