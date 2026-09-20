export function createOrderNumber(): string {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `AC-${stamp}-${rand}`;
}
