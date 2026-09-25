import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RichAnswer } from "./rich-answer";

describe("RichAnswer", () => {
  it("groups itinerary sections and renders follow-up questions as an accessible list", () => {
    const html = renderToStaticMarkup(<RichAnswer
      content={"## Lịch trình ngày 1\n- Biển Mỹ Khê\n- Cầu Rồng\n## Mình cần bạn trả lời 2 câu để chốt lịch\n1. Budget có tính vé đến Đà Nẵng không?\n2. Bạn đi mấy người?"}
      places={[]}
      onSelectPlace={() => {}}
    />);
    expect(html).toContain("<h3");
    expect(html).toContain("<ul");
    expect(html).toContain("<ol");
    expect(html).toContain("bg-primary/5");
    expect(html).toContain("Budget có tính vé đến Đà Nẵng không?");
  });

  it("links only names backed by a canonical preview place, never model URLs", () => {
    const html = renderToStaticMarkup(<RichAnswer
      content={"## Ngày 1\n- Ghé **Biển Mỹ Khê** rồi [Khách sạn lạ](https://example.test/unverified)."}
      places={[{ canonicalPlaceId: "place-my-khe", title: "Biển Mỹ Khê", location: { lat: 16.1, lng: 108.2 } }]}
      onSelectPlace={() => {}}
    />);
    expect(html).toContain("Biển Mỹ Khê</button>");
    expect(html).toContain("Khách sạn lạ");
    expect(html).not.toContain("https://example.test");
    expect(html).not.toContain("<a ");
  });

  it("does not make a place interactive without verified coordinates", () => {
    const html = renderToStaticMarkup(<RichAnswer
      content="**Chợ Hàn**"
      places={[{ canonicalPlaceId: "place-market", title: "Chợ Hàn" }]}
      onSelectPlace={() => {}}
    />);
    expect(html).toContain("<strong");
    expect(html).not.toContain("<button");
  });

  it("renders lists followed by paragraphs without key collisions", () => {
    const content = "## Gợi ý\n- Điểm 1\n- Điểm 2\n- Điểm 3\n- Điểm 4\nĐoạn văn nối tiếp sau danh sách 4 mục\n- Tiếp tục mục khác\nĐoạn văn cuối cùng";
    const html = renderToStaticMarkup(<RichAnswer
      content={content}
      places={[]}
      onSelectPlace={() => {}}
    />);
    expect(html).toContain("Đoạn văn nối tiếp sau danh sách 4 mục");
    expect(html).toContain("Đoạn văn cuối cùng");
  });

  it("renders recommendation markdown as a semantic table", () => {
    const content = `| Ưu tiên | Quán | Đánh giá | Khoảng cách ước tính |
| --- | --- | --- | --- |
| 1 | **Cafe Du Musee** | 3,9/5 — 57 lượt | 0,7 km |`;
    const html = renderToStaticMarkup(<RichAnswer content={content} places={[]} onSelectPlace={() => {}} />);
    expect(html).toContain("<table");
    expect(html).toContain("<thead");
    expect(html).toContain("Cafe Du Musee");
    expect(html).not.toContain("| --- |");
  });

  it("does not trigger key warnings during DOM reconciliation with real markdown", async () => {
    const { createRoot } = await import("react-dom/client");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.join(" "));
      originalError(...args);
    };

    const realContent = `Dưới đây là **bản xem trước 3 ngày**, bắt đầu **19/09/2026**...

## Ngày 1 — Biển Mỹ Khê và bán đảo Sơn Trà
- **Sáng:** Tắm biển hoặc đi bộ dọc khu vực biển Mỹ Khê.
- **Trưa:** Ăn các món địa phương như mì Quảng.
- **Chiều:** Khám phá bán đảo Sơn Trà.
- **Tối:** Đi bộ khu vực cầu Rồng.
- **Ngân sách mục tiêu:** ăn uống 250.000–350.000đ.

## Ngày 2 — Ngũ Hành Sơn và Hội An
- **Sáng:** Tham quan khu danh thắng Ngũ Hành Sơn.
- **Trưa:** Ăn trưa.
- **Chiều–tối:** Đi Hội An.
- **Lưu ý:** Hội An nằm ngoài Đà Nẵng.
- **Ngân sách mục tiêu:** ăn uống 300.000đ.

## Ngày 3 — Công viên biển
**Phương án nhẹ:**
- Sáng đi bộ.
- Trưa ăn hải sản.
- Chiều tham quan.

**Phương án vận động hơn:**
- Chọn một cung đường ngắm cảnh.
- Chỉ đi nếu có phương tiện.`;

    await (async () => {
      const { act } = await import("react");
      act(() => {
        root.render(<RichAnswer content={realContent} places={[]} onSelectPlace={() => {}} />);
      });
    })();

    console.error = originalError;
    root.unmount();
    document.body.removeChild(container);

    const keyErrors = errors.filter((err) => err.includes("same key"));
    expect(keyErrors).toEqual([]);
  });
});
