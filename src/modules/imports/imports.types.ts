export interface CsvRow {
  address: string;
  sector: string;
  type: string;
  price: number;
  latitude: number;
  longitude: number;
}

export interface ImportBatchMessage {
  jobId: string;
  tenantId: string;
  seq: number;
  rows: CsvRow[];
}
