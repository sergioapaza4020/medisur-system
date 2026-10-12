export function formatSpecialtyName(value: string): string {
  return value
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^| )\S/g, (letter) => letter.toUpperCase());
}
