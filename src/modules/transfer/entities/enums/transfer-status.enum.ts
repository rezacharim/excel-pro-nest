export enum TransferStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed', // User confirmed payment
  VERIFIED = 'verified', // Admin verified payment
  REJECTED = 'rejected', // Admin rejected payment
  EXPIRED = 'expired', // Payment request expired
}
