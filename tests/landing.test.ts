import { BASE, check, run, step } from "./harness";
import { DESKTOP, launch, openAs, overflow, PHONE, visit } from "./browser";

/**
 * The front page, and the guides it offers.
 *
 * This is the one page nobody signs in to reach, so nothing else in the suites
 * touches it. It is also where an official who has never used the system starts
 * — which makes a guide that 404s worse here than almost anywhere else: the
 * player shows a black rectangle and says nothing, and the first impression of
 * the system is that it is broken.
 */
const PANELS = ["user", "foreign", "admin", "bank"] as const;

async function main() {
  const browser = await launch();
  try {
    step("the page itself");
    {
      const s = await openAs(browser, null, PHONE);
      const res = await visit(s.page, "/", 900);
      const text = await s.page.innerText("body");
      check("it answers", res?.status() === 200, res?.status());
      check("it names the system", text.includes("سامانه پرداخت ارزی سازمان منطقه آزاد"));
      check("the four panels are offered", text.includes("انتخاب پنل"));
      check("and so are the guides", text.includes("راهنمای کارکرد سامانه"));
      check("it says the videos are silent", text.includes("صدا ندارند"), text.slice(0, 200));
      check("no sideways scroll at 390px", (await overflow(s.page)) <= 1);
      check("nothing threw", s.errors.length === 0, s.errors.join("\n"));
      await s.close();
    }

    step("every guide the page links to exists");
    {
      const s = await openAs(browser, null, DESKTOP);
      await visit(s.page, "/", 600);

      for (const key of PANELS) {
        for (const [ext, type] of [
          ["mp4", "video/mp4"],
          ["pdf", "application/pdf"],
        ]) {
          const res = await s.context.request.get(`${BASE}/guide/${key}.${ext}`);
          const ok = res.status() === 200 && (res.headers()["content-type"] ?? "").includes(type);
          // Size matters as much as status: a truncated encode still answers
          // 200 and still plays as nothing.
          const bytes = Number(res.headers()["content-length"] ?? 0);
          check(
            `/guide/${key}.${ext}`,
            ok && bytes > 50_000,
            `${res.status()} ${res.headers()["content-type"]} ${bytes} bytes`,
          );
        }
      }
      await s.close();
    }

    step("the player opens onto the right file");
    {
      const s = await openAs(browser, null, DESKTOP);
      await visit(s.page, "/", 900);

      await s.page.getByRole("button", { name: /تماشای ویدئو/ }).first().click();
      await s.page.waitForSelector("video", { timeout: 8000 });

      const player = await s.page.evaluate(async () => {
        const v = document.querySelector("video")!;
        v.muted = true;
        await new Promise((done) => {
          if (v.readyState >= 1) return done(null);
          v.onloadedmetadata = () => done(null);
          v.onerror = () => done(null);
          setTimeout(() => done(null), 8000);
        });
        return {
          source: (v.currentSrc || "").split("/").pop(),
          controls: v.hasAttribute("controls"),
          width: v.videoWidth,
          error: v.error?.code ?? null,
          // Whether this browser can decode H.264 at all. The bundled headless
          // Chromium ships without it, so a failure to decode here says nothing
          // about the file — but a wrong source or a missing control does.
          decodes: v.canPlayType('video/mp4; codecs="avc1.640028"') !== "",
        };
      });

      check("the player opened on an mp4", player.source?.endsWith(".mp4") === true, player.source);
      check("with controls, so it can be paused on a step", player.controls);
      if (player.decodes) {
        check("it decodes at 1080p", player.width === 1920, player);
        check("with no media error", player.error === null, player.error);
      } else {
        console.log("     (this browser has no H.264 decoder — playback not asserted)");
      }

      await s.page.keyboard.press("Escape");
      await s.close();
    }

    step("the written guide opens as a document");
    {
      const s = await openAs(browser, null, DESKTOP);
      await visit(s.page, "/", 600);
      const link = s.page.getByRole("link", { name: /راهنمای متنی/ }).first();
      check("the document is linked", (await link.getAttribute("href"))?.endsWith(".pdf") === true);
      check("and opens in its own tab", (await link.getAttribute("target")) === "_blank");
      await s.close();
    }
  } finally {
    await browser.close();
  }
}

run(main);
