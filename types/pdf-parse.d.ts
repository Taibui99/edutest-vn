declare module "pdf-parse" {
  interface PDFData {
    text: string;
    numpages?: number;
    numrender?: number;
    info?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }

  type PDFParse = (data: Buffer | Uint8Array | ArrayBuffer) => Promise<PDFData>;

  const pdfParse: PDFParse;
  export default pdfParse;
}
