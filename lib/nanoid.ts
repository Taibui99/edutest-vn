const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function nanoid(size = 6): string {
  let result = "";
  for (let i = 0; i < size; i++) {
    result += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return result;
}
