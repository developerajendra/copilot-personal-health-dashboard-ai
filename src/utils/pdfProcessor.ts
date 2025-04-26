import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import path from 'path';

// Initialize pdf.js
if (typeof window === 'undefined') {
  // Set worker path for Node environment
  GlobalWorkerOptions.workerSrc = path.resolve(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.js'
  );
}

export class PDFProcessor {
  async extractTextFromPDF(file: ArrayBuffer): Promise<string[]> {
    if (typeof window !== 'undefined') {
      throw new Error('extractTextFromPDF can only be used in server-side code');
    }

    try {
      // Load PDF document
      const pdfDoc = await getDocument({ data: file }).promise;
      const textContent: string[] = [];

      // Process each page
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        try {
          const page = await pdfDoc.getPage(i);
          const content = await page.getTextContent();
          const text = content.items
            .filter((item): item is TextItem => 'str' in item)
            .map(item => item.str)
            .join(' ');
          textContent.push(text);
        } catch (error) {
          console.error(`Error processing page ${i}:`, error);
          textContent.push(''); // Push empty string for failed pages
        }
      }

      return textContent;
    } catch (error) {
      console.error('Error processing PDF:', error);
      throw error;
    }
  }

  async cleanup() {
    // No cleanup needed for pdf.js
  }
}