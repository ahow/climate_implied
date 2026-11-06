/** ISO 6166 check digit, not merely a shape check. */
export function validIsin(value: string) {
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(value)) return false;
  const digits = Array.from(value).map(c => /[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c).join("");
  const sum = Array.from(digits).reverse().reduce((total, c, i) => {
    const n = Number(c) * (i % 2 ? 2 : 1);
    return total + Math.floor(n / 10) + n % 10;
  }, 0);
  return sum % 10 === 0;
}
