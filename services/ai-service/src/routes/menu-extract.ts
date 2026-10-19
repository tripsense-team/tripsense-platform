import { Hono } from "hono";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getLanguageModel } from "../ai/providers.js";
import { DEFAULT_MODEL_ID } from "../ai/models.js";
import { subjectFromAuthorization } from "../security/access-token.js";

export const menuExtractRouter = new Hono();

function userIdFrom(c: any): string | null {
  const fromAuth = subjectFromAuthorization(c.req.header("Authorization"));
  if (fromAuth) return fromAuth;
  const fromHeader = c.req.header("X-User-Id");
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  return null;
}

const extractedItemSchema = z.object({
  name: z.string().describe("Tên món ăn hoặc đồ uống"),
  category: z.string().optional().describe("Danh mục, phân loại món"),
  price: z.number().describe("Giá tiền số nguyên (VND)"),
  description: z.string().optional().describe("Mô tả ngắn về thành phần hoặc hương vị"),
  tags: z.array(z.string()).optional().describe("Thẻ nhãn ngắn gọn, ví dụ: dacsan, cay, chay"),
});

const menuExtractionSchema = z.object({
  items: z.array(extractedItemSchema),
  detectedCurrency: z.string().default("VND"),
});

export type ExtractedMenuItem = z.infer<typeof extractedItemSchema>;

const EXTRACTION_PROMPT = `Bạn là trợ lý AI chuyên nhận diện và số hóa thực đơn nhà hàng, quán ăn từ hình ảnh.
Hãy phân tích kỹ hình ảnh thực đơn này (kể cả ảnh chụp màn hình, ảnh cắt nhỏ hay ảnh toàn bộ menu) và trích xuất toàn bộ các món ăn, đồ uống kèm giá tiền và nhóm danh mục.

Quy tắc bắt buộc:
1. "name": Tên món ăn hoặc đồ uống chính xác (bỏ số thứ tự 1., 2., ...).
2. "category": Phân nhóm hợp lý (ví dụ: "Khai vị", "Món chính", "Món nướng", "Món lẩu", "Tráng miệng", "Đồ uống", "Bia"). Nếu không rõ để "Món chính".
3. "price": Giá tiền bắt buộc là SỐ NGUYÊN đơn vị VND (numeric).
   - Nếu thực đơn viết tắt đơn vị nghìn (ví dụ: 50, 50k, 50.000) -> quy đổi thành 50000.
   - Nếu ghi 120 -> 120000.
   - Nếu không thấy giá ghi kèm, để ước tính hợp lý tối thiểu 10000.
4. "description": Mô tả thành phần hoặc hương vị nếu ghi chú trên menu, nếu không có để trống.
5. "tags": Gợi ý 1-2 tag ngắn viết liền không dấu (ví dụ: "dacsan", "cay", "chay", "haisan", "bestseller").

Nếu trong ảnh chỉ thấy 1 món hoặc vài dòng chữ tên món, vẫn trích xuất đầy đủ các món đó.
Chỉ trả về dữ liệu có cấu trúc hợp lệ.`;

menuExtractRouter.post("/restaurant-menu/extract", async (c) => {
  const userId = userIdFrom(c);
  if (!userId) {
    return c.json(
      {
        success: false,
        error: "UNAUTHORIZED",
        message: "Vui lòng đăng nhập để sử dụng tính năng trích xuất thực đơn AI",
      },
      401
    );
  }

  try {
    let imageBuffer: Buffer | null = null;
    let mimeType = "image/jpeg";

    const contentType = c.req.header("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const body = await c.req.parseBody();
      const file = body["file"] || body["image"];

      if (file instanceof File) {
        const arrayBuffer = await file.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        mimeType = file.type || "image/jpeg";
      }
    } else {
      const json = await c.req.json().catch(() => null);
      if (json && typeof json.image === "string") {
        let base64Data = json.image;
        if (base64Data.startsWith("data:")) {
          const matches = base64Data.match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/);
          if (matches) {
            mimeType = matches[1];
            base64Data = matches[2];
          }
        }
        imageBuffer = Buffer.from(base64Data, "base64");
      }
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return c.json(
        {
          success: false,
          error: "IMAGE_REQUIRED",
          message: "Vui lòng tải lên ảnh thực đơn (JPG, PNG, WebP) qua form-data hoặc JSON base64",
        },
        400
      );
    }

    // Limit image size to 10MB
    if (imageBuffer.length > 10 * 1024 * 1024) {
      return c.json(
        {
          success: false,
          error: "IMAGE_TOO_LARGE",
          message: "Dung lượng ảnh tối đa là 10MB",
        },
        400
      );
    }

    const model = await getLanguageModel(DEFAULT_MODEL_ID);

    let extractedData: { items: ExtractedMenuItem[]; detectedCurrency: string };

    try {
      // 1. Primary approach: Structured output with generateObject
      const result = await generateObject({
        model,
        schema: menuExtractionSchema,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: EXTRACTION_PROMPT,
              },
              {
                type: "image",
                image: imageBuffer,
              },
            ],
          },
        ],
      });
      extractedData = result.object;
    } catch (structuredErr: unknown) {
      console.warn("[MenuExtract] generateObject fallback to generateText:", structuredErr);

      // 2. Fallback approach: Plain prompt requesting JSON string
      const textResult = await generateText({
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${EXTRACTION_PROMPT}\nTrả về một JSON duy nhất có cấu trúc: {"items": [{"name": "...", "category": "...", "price": 50000, "description": "...", "tags": ["dacsan"]}], "detectedCurrency": "VND"}`,
              },
              {
                type: "image",
                image: imageBuffer,
              },
            ],
          },
        ],
      });

      const cleaned = textResult.text.replace(/```json/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      extractedData = menuExtractionSchema.parse(parsed);
    }

    // Clean up and normalize items
    const normalizedItems = (extractedData.items || []).map((it) => ({
      name: (it.name || "").trim(),
      category: it.category ? it.category.trim() : undefined,
      price: Math.max(1000, Math.round(it.price || 0)),
      currency: "VND",
      description: it.description ? it.description.trim() : undefined,
      tags: Array.isArray(it.tags) ? it.tags.map((t) => t.trim().toLowerCase()).filter(Boolean) : [],
      available: true,
    }));

    return c.json({
      success: true,
      data: {
        items: normalizedItems,
        totalItems: normalizedItems.length,
        detectedCurrency: extractedData.detectedCurrency || "VND",
      },
    });
  } catch (error: unknown) {
    console.error("[MenuExtract] Error extracting menu:", error);
    return c.json(
      {
        success: false,
        error: "EXTRACTION_FAILED",
        message: "Không thể phân tích thực đơn từ ảnh. Vui lòng thử lại sau.",
      },
      500
    );
  }
});
