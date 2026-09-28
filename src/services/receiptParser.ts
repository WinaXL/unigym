// src/services/receiptParser.ts
/**
 * receiptParser — Client-side OCR & receipt field extraction utility.
 *
 * Simulates text recognition extraction from scanned receipts.
 * Returns structured fields for verification and manual confirmation.
 */
import type { ReceiptData } from '../types/api';

/**
 * Simulate OCR extraction from a receipt image.
 * In first-time onboarding (when user is not bound yet), extracts realistic
 * initial student data. In renewal scans, uses the existing student context.
 */
export async function parseReceiptImage(
  _imageUri: string,
  userFullName?: string,
  userStudentId?: string
): Promise<ReceiptData> {
  // Simulate OCR image processing delay
  await new Promise<void>((resolve) => setTimeout(resolve, 1200));

  const today = new Date();
  const paymentDate = new Date(today);
  // Default to 1-2 days ago for high realism and valid recent date
  paymentDate.setDate(paymentDate.getDate() - 1);
  const dateStr = paymentDate.toISOString().split('T')[0];

  // Random unique 6-digit transaction reference
  const randomRef = Math.floor(100000 + Math.random() * 900000);

  return {
    studentName: userFullName && userFullName.trim() ? userFullName : 'Ayana Bekova',
    studentNumber: userStudentId && userStudentId.trim() ? userStudentId : 'STD23141035',
    paymentDate: dateStr,
    referenceId: `RCP-${randomRef}`,
    amount: '15,000 KZT',
    planType: 'Monthly Gym Unlimited',
  };
}
