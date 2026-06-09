export function formatCurrency(n: number): string {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' ₫';
}
