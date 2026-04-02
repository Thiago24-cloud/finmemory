const MAX_VERIFY_HASHES = 12;

export function mergeVerifyTokenHashes(existing, newHash) {
  const prev = Array.isArray(existing) ? existing.filter(Boolean) : [];
  const set = new Set([...prev, newHash]);
  return [...set].slice(-MAX_VERIFY_HASHES);
}
