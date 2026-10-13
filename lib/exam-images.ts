/**
 * AI-7 — tách hình minh họa từ tài liệu để nạp cho Gemini "nhìn".
 *
 * Hiện trạng pipeline chỉ đọc CHỮ (mammoth.extractRawText / pdf-parse bỏ ảnh),
 * trừ PDF scan đẩy nguyên file. File này cover 2 ca phổ biến còn lại:
 * - docx: gom ảnh gốc qua `mammoth.convertImage` (không ảnh hưởng text).
 * - pdf: carve JPEG nhúng (`/Subtype /Image` + `/Filter /DCTDecode` — ca phổ
 *   biến của ảnh chụp/ảnh xuất). PNG/FlateDecode vector chưa cover (cần giải
 *   nén + tái tạo PNG, phức tạp) — thiếu thì import vẫn chạy bằng chữ.
 *
 * Nguyên tắc an toàn: hàm này KHÔNG BAO GIỜ ném lỗi (ảnh là phần thêm —
 * hỏng thì pipeline chạy tiếp bằng chữ như cũ). Giới hạn 6 ảnh/lần.
 */
import mammoth from "mammoth";

export interface DocImage {
  bytes: Uint8Array;
  mimeType: string;
}

const MAX_IMAGES = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/* Chỉ lấy định dạng Gemini đọc được. Bỏ WMF/EMF (vector Office, mammoth vẫn
 * bắn callback cho chúng): vừa vô dụng vừa chiếm quota. File mẫu thực tế của
 * user: ~65 media nhưng chỉ ~10 PNG/JPEG là hình thật. */
const READABLE_IMAGE = /^(image\/(png|jpeg|gif|webp|bmp))$/i;

/** Ảnh docx qua convertImage của mammoth (đọc buffer gốc, giữ nguyên file). */
export async function extractDocxImages(buffer: Buffer): Promise<DocImage[]> {
  try {
    const images: DocImage[] = [];
    await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(async (image: { read: (t: string) => Promise<string>; contentType?: string }) => {
          try {
            // mammoth 1.x chỉ hỗ trợ read("base64") — "buffer" ném lỗi câm.
            const b64 = await image.read("base64");
            const type = image.contentType || "";
            const data = b64 ? Buffer.from(b64, "base64") : null;
            if (data && data.byteLength > 0 && data.byteLength <= MAX_IMAGE_BYTES && READABLE_IMAGE.test(type) && images.length < MAX_IMAGES) {
              images.push({ bytes: new Uint8Array(data), mimeType: type.toLowerCase() });
            }
          } catch {
            // Bỏ qua ảnh lỗi, không chặn import.
          }
          return { src: "" };
        }),
      },
    );
    return images;
  } catch {
    return [];
  }
}

/** Carve JPEG nhúng trong PDF: tìm object ảnh DCTDecode rồi cắt stream.
 * Trả về rỗng (không lỗi) khi không có JPEG nào — pipeline chữ vẫn chạy. */
export function extractPdfJpegs(buffer: Buffer): DocImage[] {
  const images: DocImage[] = [];
  try {
    // Đọc latin1 để giữ nguyên byte stream khi regex.
    const raw = buffer.toString("latin1");
    // Object ảnh: ... /Subtype /Image ... /Filter /DCTDecode ... stream ... endstream
    const re = /\/Subtype\s*\/Image[\s\S]{0,2000}?\/Filter\s*\/DCTDecode[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null && images.length < MAX_IMAGES) {
      const chunk = Buffer.from(m[1], "latin1");
      // JPEG hợp lệ bắt đầu bằng SOI marker FFD8.
      if (chunk.length > 1024 && chunk[0] === 0xff && chunk[1] === 0xd8 && chunk.length <= MAX_IMAGE_BYTES) {
        images.push({ bytes: new Uint8Array(chunk), mimeType: "image/jpeg" });
      }
    }
  } catch {
    // Bỏ qua, pipeline chữ vẫn chạy.
  }
  return images;
}

/** Gom ảnh theo loại file. fileName dùng để nhận diện đuôi. */
export async function extractDocImages(buffer: Buffer, fileName: string): Promise<DocImage[]> {
  const lower = (fileName || "").toLowerCase();
  if (lower.endsWith(".docx")) return extractDocxImages(buffer);
  if (lower.endsWith(".pdf")) return extractPdfJpegs(buffer);
  return [];
}
