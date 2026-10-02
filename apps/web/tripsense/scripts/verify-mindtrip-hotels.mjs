import puppeteer from "puppeteer-core";
import path from "path";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACTS_DIR = "C:\\Users\\TwKun\\.gemini\\antigravity-ide\\brain\\543ee45b-2b2b-44a7-a7ec-692f9308dc6f";

async function main() {
  console.log("Launching Edge from:", EDGE_PATH);
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    defaultViewport: { width: 1440, height: 900 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    console.log("Navigating to http://localhost:3000 to authenticate...");
    await page.goto("http://localhost:3000", { waitUntil: "networkidle2" });

    // Authenticate with bootstrapped admin account
    const loginRes = await page.evaluate(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "admin@tripsense.app", password: "Admin@123456" }),
        });
        const data = await res.json();
        if (data.success && data.data?.user) {
          localStorage.setItem("tripsense_cached_user", JSON.stringify(data.data.user));
          if (window.__TRIPSENSE_AUTH_STORE__) {
            window.__TRIPSENSE_AUTH_STORE__.getState().setAuth(data.data.user, data.data.accessToken);
          }
        }
        return data;
      } catch (e) {
        return { error: String(e) };
      }
    });

    console.log("Login response:", loginRes.success ? "Authenticated successfully" : loginRes);

    console.log("Navigating to http://localhost:3000/hotels...");
    await page.goto("http://localhost:3000/hotels", { waitUntil: "networkidle2", timeout: 30000 });

    // Wait for the hotels container to load
    await page.waitForSelector("h1", { timeout: 10000 });
    console.log("Page loaded successfully.");

    // 1. LIGHT MODE: Feed & Details
    const lightPath = path.join(ARTIFACTS_DIR, "mindtrip_hotels_light.png");
    await page.screenshot({ path: lightPath, fullPage: false });
    console.log("Captured Light Mode screenshot:", lightPath);

    // 2. DARK MODE: Toggle dark mode by adding .dark class on html
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
    });
    await new Promise((r) => setTimeout(r, 600));

    const darkPath = path.join(ARTIFACTS_DIR, "mindtrip_hotels_dark.png");
    await page.screenshot({ path: darkPath, fullPage: false });
    console.log("Captured Dark Mode screenshot:", darkPath);

    // 3. Scroll right panel down to show Truthful Fallback Card
    await page.evaluate(() => {
      const panel = document.querySelector(".h-full.relative.overflow-hidden.flex-1 > div");
      if (panel) panel.scrollTop = 500;
    });
    await new Promise((r) => setTimeout(r, 400));
    const fallbackPath = path.join(ARTIFACTS_DIR, "mindtrip_truthful_fallback_dark.png");
    await page.screenshot({ path: fallbackPath, fullPage: false });
    console.log("Captured Truthful Fallback Card screenshot:", fallbackPath);

    // 4. Switch back to light mode, and Search for Crown Retreat (direct booking enabled)
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
    });
    const searchInput = await page.$('input[placeholder*="Tìm khách sạn"]');
    if (searchInput) {
      await searchInput.type("Crown Retreat");
      await new Promise((r) => setTimeout(r, 500));
    }

    // Click on Crown Retreat card
    const hotelCard = await page.evaluateHandle(() => {
      const cards = Array.from(document.querySelectorAll("h3"));
      return cards.find((c) => c.textContent && c.textContent.includes("Crown Retreat"))?.closest('[role="button"]');
    });

    if (hotelCard && hotelCard.asElement()) {
      await hotelCard.asElement().click();
      console.log("Selected Crown Retreat Quy Nhon.");
      await new Promise((r) => setTimeout(r, 600));
    }

    const crownRetreatLightPath = path.join(ARTIFACTS_DIR, "mindtrip_direct_booking_light.png");
    await page.screenshot({ path: crownRetreatLightPath, fullPage: false });
    console.log("Captured Direct Booking Light Mode screenshot:", crownRetreatLightPath);

    // 5. Click "Kiểm tra phòng trống" / "Check availability" to open Book Stay Modal (Screenshot 2)
    const checkAvailBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return btns.find((b) => b.textContent && (b.textContent.includes("Check availability") || b.textContent.includes("Kiểm tra phòng trống")));
    });

    if (checkAvailBtn && checkAvailBtn.asElement()) {
      await checkAvailBtn.asElement().click();
      console.log("Opened Book Stay Modal.");
      await new Promise((r) => setTimeout(r, 600));

      const modalLightPath = path.join(ARTIFACTS_DIR, "mindtrip_book_stay_modal_light.png");
      await page.screenshot({ path: modalLightPath, fullPage: false });
      console.log("Captured Book Stay Modal Light screenshot:", modalLightPath);

      // Toggle to dark mode for modal
      await page.evaluate(() => document.documentElement.classList.add("dark"));
      await new Promise((r) => setTimeout(r, 400));
      const modalDarkPath = path.join(ARTIFACTS_DIR, "mindtrip_book_stay_modal_dark.png");
      await page.screenshot({ path: modalDarkPath, fullPage: false });
      console.log("Captured Book Stay Modal Dark screenshot:", modalDarkPath);

      // 6. Click "Chọn phòng" / "Choose a room" to transition to Available Rooms (Screenshot 1)
      const chooseRoomBtn = await page.evaluateHandle(() => {
        const btns = Array.from(document.querySelectorAll("button"));
        return btns.find((b) => b.textContent && (b.textContent.includes("Choose a room") || b.textContent.includes("Chọn phòng")));
      });

      if (chooseRoomBtn && chooseRoomBtn.asElement()) {
        await chooseRoomBtn.asElement().click();
        console.log("Transitioned to Available Rooms View.");
        await new Promise((r) => setTimeout(r, 600));

        const roomsDarkPath = path.join(ARTIFACTS_DIR, "mindtrip_available_rooms_dark.png");
        await page.screenshot({ path: roomsDarkPath, fullPage: false });
        console.log("Captured Available Rooms Dark screenshot:", roomsDarkPath);

        // Switch to light mode for available rooms
        await page.evaluate(() => document.documentElement.classList.remove("dark"));
        await new Promise((r) => setTimeout(r, 400));
        const roomsLightPath = path.join(ARTIFACTS_DIR, "mindtrip_available_rooms_light.png");
        await page.screenshot({ path: roomsLightPath, fullPage: false });
        console.log("Captured Available Rooms Light screenshot:", roomsLightPath);
      }
    }

    console.log("All screenshots captured successfully!");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Error executing verification script:", err);
  process.exit(1);
});
