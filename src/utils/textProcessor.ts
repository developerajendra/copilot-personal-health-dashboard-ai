import * as tf from '@tensorflow/tfjs';

export interface StructuredMedicalData {
  patientInfo?: {
    name?: string;
    age?: string;
    date?: string;
    gender?: string;
    orderId?: string;
    sample?: string;
    referredBy?: string;
  };
  testResults?: {
    investigation: string[];
    observedValue: string[];
    unit: string[];
    biologicalRefInterval: string[];
  };
  measurements?: { [key: string]: string };
  diagnosis?: string[];
  medications?: string[];
}

export class TextProcessor {
  private model: tf.LayersModel | null = null;
  private isInitializing: boolean = false;

  private async loadModel() {
    if (this.model || this.isInitializing) {
      return;
    }

    try {
      this.isInitializing = true;
      // Clean up any existing tensors
      tf.disposeVariables();

      // For now, we'll just use a simple text classification model
      const model = tf.sequential();
      this.model = model;
    } catch (error) {
      console.error('Error loading model:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  // Cleanup method to dispose of the model when needed
  public async cleanup() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    tf.disposeVariables();
  }

  private preprocessText(text: string): { [key: string]: string[] } {
    console.log('Processing text:', text);
    const sections: { [key: string]: string[] } = {
      patientInfo: [],
      investigation: [],
      observedValue: [],
      unit: [],
      biologicalRefInterval: [],
      diagnosis: [],
      medications: []
    };

    // Clean up the text by removing extra spaces and normalizing whitespace
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const lines = cleanText.split(/[\n\r]+/).map(line => {
      // Remove duplicate words that appear due to PDF formatting
      return line.replace(/(\b\w+\b)(\s+\1\b)+/g, '$1').trim();
    });

    console.log('Split lines:', lines);

    let isTestResultSection = false;
    const columnIndices: { [key: string]: number } = {};

    lines.forEach(line => {
      const lowerLine = line.toLowerCase().trim();

      // Match patient info patterns with more flexible matching
      if (lowerLine.includes('order id') ||
          lowerLine.includes('name') ||
          lowerLine.includes('collected on') ||
          lowerLine.includes('gender') ||
          lowerLine.includes('age') ||
          lowerLine.includes('sample') ||
          lowerLine.includes('ref. by')) {
        sections.patientInfo.push(line);
      }

      // Detect test result section header
      if (lowerLine.includes('investigation') &&
          (lowerLine.includes('observed') || lowerLine.includes('value')) &&
          lowerLine.includes('unit')) {
        isTestResultSection = true;
        const values = line.split(/\s+/);
        
        // Find column indices with more robust detection
        values.forEach((value, index) => {
          const lowerValue = value.toLowerCase();
          if (lowerValue.includes('investigation')) {
            columnIndices['investigation'] = index;
          } else if (lowerValue.includes('observed') || lowerValue.includes('value')) {
            columnIndices['observedValue'] = index;
          } else if (lowerValue === 'unit') {
            columnIndices['unit'] = index;
          } else if (lowerValue.includes('biological') || lowerValue.includes('ref')) {
            columnIndices['biologicalRefInterval'] = index;
          }
        });
      }

      // Process test results
      if (isTestResultSection && Object.keys(columnIndices).length > 0) {
        const values = line.split(/\s+/);
        if (values.length >= 3) {
          const investigationValue = this.getColumnValue(values, columnIndices['investigation']);
          const observedValue = this.getColumnValue(values, columnIndices['observedValue']);
          const unitValue = this.getColumnValue(values, columnIndices['unit']);
          const refValue = this.getColumnValue(values, columnIndices['biologicalRefInterval']);

          if (investigationValue) sections.investigation.push(investigationValue);
          if (observedValue) sections.observedValue.push(observedValue);
          if (unitValue) sections.unit.push(unitValue);
          if (refValue) sections.biologicalRefInterval.push(refValue);
        }
      }
    });

    return sections;
  }

  private getColumnValue(values: string[], index: number): string | undefined {
    if (index === undefined || index >= values.length) return undefined;
    return values[index].trim();
  }

  private extractValue(text: string, field: string): string | undefined {
    const regex = new RegExp(`${field}\\s*[.:]\\s*([^\\n,]+)`, 'i');
    const match = text.match(regex);
    console.log(`Extracting ${field}:`, { text, match });
    return match ? match[1].trim() : undefined;
  }

  private extractName(text: string): string | undefined {
    const nameMatch = text.match(/Name\s*[.:]?\s*([^,\n]+?)(?=\s+(?:Collected|Gender|Age|Sample|Ref))/i);
    return nameMatch ? nameMatch[1].trim() : undefined;
  }

  private extractAgeGender(text: string): { age?: string; gender?: string } | undefined {
    const regex = /Gender\s*\/?\s*Age\s*[.:]?\s*(\d+)\s*(?:Yrs?|Years?)?\s*(\w+)/i;
    const match = text.match(regex);
    if (match) {
      return {
        age: match[1],
        gender: match[2]
      };
    }
    return undefined;
  }

  async structureData(textContent: string[]): Promise<StructuredMedicalData> {
    try {
      console.log('Starting structureData with content:', textContent);

      if (!this.model) {
        await this.loadModel();
      }

      const structuredData: StructuredMedicalData = {};
      
      // Process each page of text
      textContent.forEach((pageText, index) => {
        console.log(`Processing page ${index + 1}:`, pageText);
        const sections = this.preprocessText(pageText);
        
        // Extract patient info
        const patientInfo = sections.patientInfo.join(' ');
        if (patientInfo) {
          structuredData.patientInfo = {
            orderId: this.extractValue(patientInfo, 'Order ID'),
            name: this.extractName(patientInfo),
            date: this.extractValue(patientInfo, 'Collected On'),
            age: this.extractAgeGender(patientInfo)?.age,
            gender: this.extractAgeGender(patientInfo)?.gender,
            sample: this.extractValue(patientInfo, 'Sample'),
            referredBy: this.extractValue(patientInfo, 'Ref. By')
          };
        }

        // Extract test results
        if (sections.investigation.length > 0) {
          structuredData.testResults = {
            investigation: sections.investigation,
            observedValue: sections.observedValue,
            unit: sections.unit,
            biologicalRefInterval: sections.biologicalRefInterval
          };
        }
      });

      console.log('Final structured data:', structuredData);
      return structuredData;
    } catch (error) {
      console.error('Error in structuring data:', error);
      await this.cleanup();
      throw error;
    }
  }
}