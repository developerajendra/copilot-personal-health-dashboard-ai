import { NextRequest, NextResponse } from 'next/server';
import { PDFProcessor } from '@/utils/pdfProcessor';
import { TextProcessor } from '@/utils/textProcessor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Convert file to ArrayBuffer for processing
    const arrayBuffer = await file.arrayBuffer();

    // Process PDF and extract text
    const pdfProcessor = new PDFProcessor();
    const textContent = await pdfProcessor.extractTextFromPDF(arrayBuffer);
    console.log('Extracted text content:', textContent); // Added debug log
    await pdfProcessor.cleanup();

    // Structure the extracted text using TensorFlow
    const textProcessor = new TextProcessor();
    const structuredData = await textProcessor.structureData(textContent);
    console.log('Structured data:', structuredData); // Added debug log

    return NextResponse.json({ 
      success: true, 
      data: structuredData 
    });

  } catch (error) {
    console.error('Error processing PDF:', error);
    return NextResponse.json(
      { error: 'Error processing PDF file' }, 
      { status: 500 }
    );
  }
}