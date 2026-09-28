// src/services/receiptParser.ts
/**
 * receiptParser — Mock OCR / receipt field extraction.
 *
 * In production, replace with a real OCR engine (e.g., react-native-mlkit-ocr,
 * Google Cloud Vision, or server-side extraction).
 *
 * For development, this returns realistic mock data matching the authenticated user.
 */
import type { ReceiptData } from '../types/api';

/**
 * Simulate OCR extraction from a receipt image.
 * In mock mode, returns fake data for the current user.
 * In production, this would process the image URI through an OCR service.
 */
export async function parseReceiptImage(
  _imageUri: string,
  userFullName: string,
  userStudentId: string
): Promise<ReceiptData> {
  // Simulate processing delay
  await new Promise<void>((resolve) => setTimeout(resolve, 1500));

  // In mock mode, generate realistic receipt data that matches the current user
  const today = new Date();
  const paymentDate = new Date(today);
  // Random date within last 3 days for realistic testing
  paymentDate.setDate(paymentDate.getDate() - Math.floor(Math.random() * 3));
  const dateStr = paymentDate.toISOString().split('T')[0];

  return {
    studentName: userFullName,
    studentNumber: userStudentId,
    paymentDate: dateStr,
    referenceId: `RCP-${Date.now().toString(36).toUpperCase()}`,
    amount: '15,000 KZT',
    planType: 'Monthly Gym Access',
  };
}
