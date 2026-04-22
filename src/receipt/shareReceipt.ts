import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { renderReceipt, type ReceiptData } from './renderReceipt';

export async function shareReceipt(data: ReceiptData): Promise<boolean> {
  const html = renderReceipt(data);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const available = await Sharing.isAvailableAsync();
  if (!available) return false;
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Share receipt',
  });
  return true;
}
