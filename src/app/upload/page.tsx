'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import type { StructuredMedicalData } from '@/utils/textProcessor';

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processedData, setProcessedData] =
    useState<StructuredMedicalData | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (uploadedFile?.type === 'application/pdf') {
      setFile(uploadedFile);
    } else {
      alert('Please upload a PDF file');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setProcessedData(result.data);
      setFile(null);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Medical Report Analysis</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 mb-4 text-center cursor-pointer
                ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300'
                }`}>
              <input {...getInputProps()} />
              {isDragActive ? (
                <p>Drop the PDF file here</p>
              ) : (
                <p>Drag and drop a PDF file here, or click to select a file</p>
              )}
            </div>

            {file && (
              <div className="mt-4">
                <p className="text-sm">Selected file: {file.name}</p>
                <button
                  onClick={handleSubmit}
                  disabled={uploading}
                  className={`mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 
                    ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {uploading ? 'Processing...' : 'Process PDF'}
                </button>
              </div>
            )}
          </div>

          {processedData && (
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4">Processed Data</h2>

              {processedData.patientInfo && (
                <div className="mb-4">
                  <h3 className="font-medium mb-2">Patient Information</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(processedData.patientInfo).map(
                      ([key, value]) =>
                        value && (
                          <div key={key} className="text-sm">
                            <span className="font-medium">{key}: </span>
                            {value}
                          </div>
                        )
                    )}
                  </div>
                </div>
              )}

              {processedData.measurements && (
                <div className="mb-4">
                  <h3 className="font-medium mb-2">Measurements</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(processedData.measurements).map(
                      ([key, value]) => (
                        <div key={key} className="text-sm">
                          <span className="font-medium">{key}: </span>
                          {value}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {processedData.diagnosis &&
                processedData.diagnosis.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">Diagnosis</h3>
                    <ul className="list-disc list-inside text-sm">
                      {processedData.diagnosis.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {processedData.medications &&
                processedData.medications.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-2">Medications</h3>
                    <ul className="list-disc list-inside text-sm">
                      {processedData.medications.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
