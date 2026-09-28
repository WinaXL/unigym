// src/types/api.ts
export interface ReceiptData {
  studentName?: string;
  studentNumber?: string;
  paymentDate?: string;   // YYYY-MM-DD
  referenceId?: string;
  amount?: string;
  planType?: string;
}

export interface ReceiptValidationResult {
  success: boolean;
  receipt?: ReceiptData;
  membershipExpiryDate?: string; // ISO 8601
  error?: 'NAME_MISMATCH' | 'DATE_EXPIRED' | 'NO_DATE' | 'NO_NAME' | 'GENERIC';
}

export type ApiError = {
  code: string;
  message: string;
  statusCode?: number;
};
