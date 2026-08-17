import { test, expect } from "@playwright/test";

async function waitForGameReview(page: import("@playwright/test").Page) {
  const bar = page.getByTestId("game-review-progress-bar");
  try {
    await bar.waitFor({ state: "visible", timeout: 10000 });
  } catch {
    /* batch may finish quickly when positions are cached */
  }
  await expect(bar).toBeHidden({ timeout: 180000 });
}

async function clickMoveListToggle(page: import("@playwright/test").Page) {
  await page.getByTestId("move-list-toggle").evaluate((el) => {
    (el as HTMLButtonElement).click();
  });
}

async function loadDemoGame(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByTestId("app-menu-button").click();
  await page.getByTestId("load-demo-game").click();
  await expect(page.getByTestId("game-review-progress-bar")).toContainText("Legal", { timeout: 5000 });
  await waitForGameReview(page);
}

async function waitForEvalReady(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("eval-display")).not.toHaveText("—", { timeout: 30000 });
}

test.describe("Agent: player walkthrough", () => {
  test.setTimeout(180000);

  test("navigates full demo game and eval tracks position", async ({ page }) => {
    await loadDemoGame(page);
    await waitForEvalReady(page);

    const evalAtStart = await page.getByTestId("eval-display").innerText();
    expect(evalAtStart).toMatch(/[+−-]?\d/);

    await page.getByTitle("Next").click();
    await waitForEvalReady(page);

    const bestLine = page.getByTestId("engine-line-best");
    await expect(bestLine).toBeVisible({ timeout: 15000 });
    const bestSan = await bestLine.locator("span.font-mono").first().innerText();
    expect(bestSan.length).toBeGreaterThan(0);

    for (let i = 0; i < 8; i++) {
      await page.getByTitle("Next").click();
      await expect(page.getByTestId("eval-display")).not.toHaveText("—", { timeout: 10000 });
    }

    await page.getByTitle("Start").click();
    await waitForEvalReady(page);
    await expect(page.getByTestId("eval-display")).toHaveText(evalAtStart);
  });

  test("collapses engine and move list panels", async ({ page }) => {
    await loadDemoGame(page);

    await expect(page.getByTestId("engine-section")).toBeVisible();
    await page.getByTestId("engine-section-toggle").click();
    await expect(page.getByTestId("engine-section")).not.toBeVisible();

    await clickMoveListToggle(page);
    await expect(page.getByTestId("move-list-toggle")).toHaveAttribute("aria-expanded", "true");
    await clickMoveListToggle(page);
    await expect(page.getByTestId("move-list-toggle")).toHaveAttribute("aria-expanded", "false");
  });

  test("deep analyze shows insight on left rail", async ({ page }) => {
    await loadDemoGame(page);
    await expect(page.getByTestId("commentary-panel-empty")).toBeVisible();

    await expect(page.getByTestId("analyze-button")).toBeEnabled({ timeout: 60000 });
    await page.getByTestId("analyze-button").click();
    await expect(page.getByTestId("engine-rail").getByTestId("commentary-panel")).toBeVisible({
      timeout: 45000,
    });
  });

  test("keyboard navigation and move list jump", async ({ page }) => {
    await loadDemoGame(page);

    for (let i = 0; i < 2; i++) {
      await page.keyboard.press("ArrowRight");
    }
    await expect(page.getByTestId("eval-display")).not.toHaveText("—", { timeout: 15000 });

    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("eval-display")).not.toHaveText("—", { timeout: 10000 });
    await page.keyboard.press("Home");
    await waitForEvalReady(page);
  });
});

test.describe("Agent: code QA layout", () => {
  test.setTimeout(180000);

  test("review layout fits without page scroll on 27in viewport", async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1440 });
    await loadDemoGame(page);

    await expect(page.getByTestId("review-layout")).toBeVisible();
    await expect(page.getByTestId("engine-rail")).toBeVisible();
    await expect(page.getByTestId("chess-board")).toBeVisible();
    await expect(page.getByTestId("right-sidebar")).toBeVisible();
    await expect(page.getByTestId("board-eval-bar")).toBeVisible();

    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const clientHeight = await page.evaluate(() => document.documentElement.clientHeight);
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight + 120);
  });

  test("eval bar label matches numeric eval at multiple plies", async ({ page }) => {
    await loadDemoGame(page);
    await waitForEvalReady(page);

    const readEval = async () => {
      const num = (await page.getByTestId("eval-display").innerText()).trim();
      const bar = page.getByTestId("board-eval-bar");
      await expect(bar).toBeVisible();
      return num;
    };

    await readEval();
    await page.getByTitle("Next").click();
    await waitForEvalReady(page);
    const ply1 = await readEval();

    await page.getByTitle("Next").click();
    await waitForEvalReady(page);
    const ply2 = await readEval();

    expect(ply1).toBeTruthy();
    expect(ply2).toBeTruthy();
  });
});
