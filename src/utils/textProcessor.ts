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
      tf.engine().startScope();

      const model = tf.sequential();
      model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [100] }));
      model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
      model.add(tf.layers.dense({ units: 4, activation: 'softmax' }));

      model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy'],
      });

      this.model = model;
    } finally {
      this.isInitializing = false;
      tf.engine().endScope();
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
      measurements: [],
      diagnosis: [],
      medications: [],
    };

    // Split by both newlines and multiple spaces
    const lines = text.split(/[\n\r]+/).map(line => line.trim());
    console.log('Split lines:', lines);

    lines.forEach(line => {
      const lowerLine = line.toLowerCase().trim();
      console.log('Processing line:', lowerLine);

      // Match the specific format patterns
      if (lowerLine.includes('order id') || 
          lowerLine.includes('name') || 
          lowerLine.includes('collected on') ||
          lowerLine.includes('gender') ||
          lowerLine.includes('age') ||
          lowerLine.includes('sample') ||
          lowerLine.includes('ref. by')) {
        console.log('Found patient info:', line);
        sections.patientInfo.push(line);
      } else if (lowerLine.includes('investigation') || lowerLine.includes('observed value')) {
        console.log('Found measurement:', line);
        sections.measurements.push(line);
      }
    });

    console.log('Processed sections:', sections);
    return sections;
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
            orderId: this.extractValue(patientInfo, 'order id'),
            name: this.extractDetailedValue(patientInfo, 'name'),
            date: this.extractValue(patientInfo, 'collected on'),
            age: this.extractAgeGender(patientInfo)?.age,
            gender: this.extractAgeGender(patientInfo)?.gender,
            sample: this.extractValue(patientInfo, 'sample'),
            referredBy: this.extractValue(patientInfo, 'ref. by'),
          };
          console.log('Extracted patient info:', structuredData.patientInfo);
        }

        // Extract measurements
        if (sections.measurements.length > 0) {
          structuredData.measurements = this.extractDetailedMeasurements(sections.measurements);
          console.log('Extracted measurements:', structuredData.measurements);
        }
      });

      console.log('Final structured data:', structuredData);
      return structuredData;
    } catch (error) {
      console.error('Error in structuring data:', error);
      // Clean up on error
      await this.cleanup();
      throw error;
    }
  }

  private extractValue(text: string, field: string): string | undefined {
    // Handle both : and . as separators
    const regex = new RegExp(`${field}[.:]\\s*([^\\n,]+)`, 'i');
    const match = text.match(regex);
    console.log(`Extracting ${field}:`, { text, match });
    return match ? match[1].trim() : undefined;
  }

  private extractDetailedValue(text: string, field: string): string | undefined {
    const regex = new RegExp(`${field}[.:]\\s*([^\\n]+?)(?=\\s+\\w+[.:]|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : undefined;
  }

  private extractAgeGender(text: string): { age?: string; gender?: string } | undefined {
    const regex = /gender\s*\/?\s*age\s*[.:]?\s*(\d+)\s*(?:yrs|years)?\s*(\w+)/i;
    const match = text.match(regex);
    if (match) {
      return {
        age: match[1],
        gender: match[2].toLowerCase()
      };
    }
    return undefined;
  }

  private extractDetailedMeasurements(lines: string[]): { [key: string]: string } {
    console.log('Extracting measurements from lines:', lines);
    const measurements: { [key: string]: string } = {};
    
    let currentTest: string | null = null;
    
    lines.forEach(line => {
      const measurementMatch = line.match(/(\w+)\s*:\s*([^:]+)(?=\s+\w+:|$)/g);
      if (measurementMatch) {
        measurementMatch.forEach(match => {
          const [key, value] = match.split(':').map(s => s.trim());
          if (key && value) {
            measurements[key] = value;
          }
        });
      }
    });

    return measurements;
  }
}