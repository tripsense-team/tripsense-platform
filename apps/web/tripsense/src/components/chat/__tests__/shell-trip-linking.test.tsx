import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseFlexiblePreferenceFromNotes } from "@/features/trip-management/utils/date";

describe("AI Chat Trip Linking & Prompt Dispatch Contract", () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let mockLinkChatToTrip: ReturnType<typeof vi.fn>;
  let mockCreateTrip: ReturnType<typeof vi.fn>;
  let mockToastSuccess: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSendMessage = vi.fn();
    mockLinkChatToTrip = vi.fn().mockResolvedValue({ success: true });
    mockCreateTrip = vi.fn().mockResolvedValue({
      id: "trip-dn-1",
      name: "Chuyến đi Đà Nẵng",
      destinationName: "Đà Nẵng",
      startDate: "2026-10-25",
      endDate: "2026-10-28",
      travelerCount: 2,
    });
    mockToastSuccess = vi.fn();
  });

  // Pure decoupled linking logic extracted for verification
  async function linkCreatedTrip(
    trip: { id: string; name: string },
    chatId: string,
    setActiveTrip: (t: any) => void
  ) {
    setActiveTrip(trip);
    await mockLinkChatToTrip(chatId, trip.id, null);
  }

  // Explicit prompt dispatch logic (CreateTripModal flow)
  async function handleTripCreatedWithPrompt(
    trip: { id: string; name: string; destinationName: string; startDate: string; endDate: string; travelerCount: number },
    chatId: string,
    initialPrompt: string | undefined,
    locale: string,
    setActiveTrip: (t: any) => void
  ) {
    await linkCreatedTrip(trip, chatId, setActiveTrip);

    const travelers = trip.travelerCount || 1;
    const dest = trip.destinationName;
    const durationDays = 4;

    const userFacingText = initialPrompt?.trim()
      ? initialPrompt.trim()
      : locale === "vi"
      ? `Lên lịch trình du lịch ${dest} (${durationDays} ngày, ${travelers} khách)`
      : `Plan a ${durationDays}-day trip to ${dest} (${travelers} travelers)`;

    const hiddenDirective = `<!-- ai-directive: Người dùng vừa tạo chuyến đi "${trip.name}" đến ${dest}... -->`;
    const fullMessageText = `${userFacingText}\n\n${hiddenDirective}`;

    mockSendMessage({
      parts: [{ text: fullMessageText, type: "text" }],
      role: "user",
    });
  }

  // Silent auto-link logic (Outer UI: Greeting/Header Where+When selection)
  async function autoCreateAndLinkTrip(
    destination: string,
    chatId: string,
    setActiveTrip: (t: any) => void
  ) {
    const trip = await mockCreateTrip({
      name: `Chuyến đi ${destination}`,
      destinationName: destination,
    });
    mockToastSuccess(`Đã tạo chuyến đi ${trip.name} và liên kết với cuộc trò chuyện`);
    await linkCreatedTrip(trip, chatId, setActiveTrip);
  }

  it("Silent Outer UI flow: creates trip and links to chat WITHOUT calling sendMessage", async () => {
    let activeTripState: any = null;
    const setActiveTrip = (t: any) => {
      activeTripState = t;
    };

    await autoCreateAndLinkTrip("Đà Nẵng", "chat-session-123", setActiveTrip);

    // Assert trip was created & linked
    expect(mockCreateTrip).toHaveBeenCalledWith(
      expect.objectContaining({ destinationName: "Đà Nẵng" })
    );
    expect(mockLinkChatToTrip).toHaveBeenCalledWith("chat-session-123", "trip-dn-1", null);
    expect(activeTripState).toEqual(expect.objectContaining({ id: "trip-dn-1" }));
    expect(mockToastSuccess).toHaveBeenCalled();

    // Critical assertion: NO message sent to AI
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("Explicit Modal flow: links trip AND calls sendMessage with prompt text and AI directive", async () => {
    let activeTripState: any = null;
    const setActiveTrip = (t: any) => {
      activeTripState = t;
    };

    const mockTrip = {
      id: "trip-tokyo-99",
      name: "Chuyến đi Tokyo",
      destinationName: "Tokyo",
      startDate: "2026-11-01",
      endDate: "2026-11-05",
      travelerCount: 2,
    };

    await handleTripCreatedWithPrompt(
      mockTrip,
      "chat-session-123",
      "5 ngày khám phá Tokyo mùa thu",
      "vi",
      setActiveTrip
    );

    // Assert trip was linked
    expect(mockLinkChatToTrip).toHaveBeenCalledWith("chat-session-123", "trip-tokyo-99", null);
    expect(activeTripState).toEqual(mockTrip);

    // Critical assertion: sendMessage WAS called with prompt and hidden directive
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "user",
        parts: [
          expect.objectContaining({
            text: expect.stringContaining("5 ngày khám phá Tokyo mùa thu"),
          }),
        ],
      })
    );
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        parts: [
          expect.objectContaining({
            text: expect.stringContaining("<!-- ai-directive:"),
          }),
        ],
      })
    );
  });

  it("Flexible Date Retention: retains type: 'flexible' when loading linked trip with flexible preference", () => {
    const tripWithFlexibleNotes = {
      id: "trip-flexible-1",
      name: "Chuyến đi Đà Lạt",
      destinationName: "Đà Lạt",
      startDate: "2026-11-01",
      endDate: "2026-11-02",
      travelerCount: 1,
      notes: "Travel preference: 2 days flexible (Tháng 11)",
    };

    const flexInfo = parseFlexiblePreferenceFromNotes(tripWithFlexibleNotes.notes);
    expect(flexInfo).toEqual({
      durationDays: 2,
      flexibleMonths: ["Tháng 11"],
    });

    const isFlexible = Boolean(flexInfo);
    const when = isFlexible
      ? {
          type: "flexible",
          durationDays: flexInfo?.durationDays || 3,
          flexibleMonths: flexInfo?.flexibleMonths || [],
          startDate: tripWithFlexibleNotes.startDate,
          endDate: tripWithFlexibleNotes.endDate,
        }
      : {
          type: "dates",
          startDate: tripWithFlexibleNotes.startDate,
          endDate: tripWithFlexibleNotes.endDate,
        };

    expect(when.type).toBe("flexible");
    expect(when.durationDays).toBe(2);
    expect(when.flexibleMonths).toEqual(["Tháng 11"]);
  });
});
