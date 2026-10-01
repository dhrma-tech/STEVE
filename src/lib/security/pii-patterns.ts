/** Pure PII patterns (no database access), shared by redaction for storage and tool output. */

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const CARD = /\b(?:\d[ -]?){12,18}\d\b/g;

export function redactCardNumbers(text: string): string {
  return text.replace(CARD, (match) => {
    const digits = match.replace(/[ -]/g, "");
    return digits.length >= 13 && digits.length <= 19 && luhnValid(digits) ? "[card number]" : match;
  });
}

const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// International or North American style numbers with at least 9 digits; not bare long numbers (ids, amounts).
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-])\d{3,4}[\s.-]\d{3,4}\b/g;

export function redactPii(text: string): string {
  return redactCardNumbers(text)
    .replace(EMAIL, "[email]")
    .replace(PHONE, (match) => (match.replace(/\D/g, "").length >= 9 ? "[phone]" : match));
}
