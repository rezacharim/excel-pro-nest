export function generateSevenDigitRandomNumber(): number {
  return Math.floor(1000000 + Math.random() * 9000000);
}
