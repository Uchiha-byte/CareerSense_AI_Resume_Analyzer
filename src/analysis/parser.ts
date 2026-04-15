import { PDFParse } from 'pdf-parse';
import Tesseract from 'tesseract.js';

/**
 * Extracts text from a visual resume file (PDF, PNG, JPEG, etc.)
 */
export async function extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (mimeType.startsWith('image/')) {
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng');
    return text;
  }

  // Fallback for plain text or unknown types
  return buffer.toString('utf8');
}
