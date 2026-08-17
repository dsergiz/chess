import { test, expect } from "@playwright/test";

async function openAppMenu(page: import("@playwright/test").Page) {
  await page.getByTestId("app-menu-button").click();
  await expect(page.getByTestId("app-sidebar")).toBeVisible();
}

async function waitForDeepAnalyzeReady(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("analyze-button")).toBeEnabled({ timeout: 60000 });
}

async function waitForGameReview(page: import("@playwright/test").Page) {
  const bar = page.getByTestId("game-review-progress-bar");
  try {
    await bar.waitFor({ state: "visible", timeout: 10000 });
  } catch {
    /* batch may finish quickly when positions are cached */
  }
  await expect(bar).toBeHidden({ timeout: 180000 });
}

async function loadDemoGame(page: import("@playwright/test").Page) {
  await page.goto("/");
  await openAppMenu(page);
  await page.getByTestId("load-demo-game").click();
  await expect(page.getByTestId("game-review-progress-bar")).toContainText("Legal", { timeout: 5000 });
  await waitForGameReview(page);
  await expect(page.getByTestId("game-title")).toContainText("Legal vs Saint Brie");
}

async function expandMoveList(page: import("@playwright/test").Page) {
  const list = page.getByTestId("move-list");
  if (!(await list.isVisible())) {
    await clickMoveListToggle(page);
    await expect(list).toBeVisible({ timeout: 5000 });
  }
  return list;
}

async function clickMoveListToggle(page: import("@playwright/test").Page) {
  await page.getByTestId("move-list-toggle").evaluate((el) => {
    (el as HTMLButtonElement).click();
  });
}

test.describe("Chess Eval App", () => {
  test("loads import screen and demo game", async ({ page }) => {
    test.setTimeout(180000);
    await page.goto("/");
    await openAppMenu(page);
    await expect(page.getByTestId("import-panel")).toBeVisible();
    await page.getByTestId("load-demo-game").click();
    await expect(page.getByTestId("game-review-progress-bar")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("game-review-progress-bar")).toContainText("Legal");
    await expect(page.getByTestId("chess-board")).not.toBeVisible();
    await waitForGameReview(page);
    await expect(page.getByTestId("chess-board")).toBeVisible();
    await expect(page.getByTestId("engine-rail")).toBeVisible();
    await expect(page.getByTestId("best-moves-panel")).toBeVisible();
    await expect(page.getByTestId("analysis-mode-fast")).toBeVisible();
  });

  test("shows progress bar while reviewing demo game", async ({ page }) => {
    test.setTimeout(180000);
    await page.goto("/");
    await openAppMenu(page);
    await page.getByTestId("load-demo-game").click();
    const bar = page.getByTestId("game-review-progress-bar");
    await expect(bar).toBeVisible({ timeout: 5000 });
    await expect(bar).toContainText("Legal");
    await expect(bar).toContainText("Stockfish");
    await waitForGameReview(page);
  });

  test("navigates through moves", async ({ page }) => {
    test.setTimeout(180000);
    await loadDemoGame(page);
    await page.getByTitle("Next").click();
    await expect(page.getByTestId("engine-line-best")).toBeVisible({ timeout: 15000 });
  });

  test("full game review walkthrough", async ({ page }) => {
    test.setTimeout(180000);
    await loadDemoGame(page);

    await expect(page.getByTestId("opening-info")).toBeVisible();
    await expect(page.getByTestId("eval-display")).not.toHaveText("—", { timeout: 15000 });

    await page.getByTitle("Next").click();
    await expect(page.getByTestId("eval-display")).not.toHaveText("—", { timeout: 15000 });

    await page.getByTestId("analysis-mode-tactical").click();
    await waitForDeepAnalyzeReady(page);
    await page.getByTestId("analyze-button").click();
    await expect(page.getByTestId("engine-rail").getByTestId("commentary-panel")).toBeVisible({ timeout: 45000 });
    await expect(page.getByTestId("engine-line-2")).toBeVisible({ timeout: 45000 });

    await page.getByTitle("Next").click();
    await expect(page.getByTestId("engine-rail").getByTestId("commentary-panel")).not.toBeVisible();
  });

  test("tactical deep analyze shows multiple engine lines", async ({ page }) => {
    test.setTimeout(180000);
    await loadDemoGame(page);
    await page.getByTitle("Next").click();
    await page.getByTestId("analysis-mode-tactical").click();
    await waitForDeepAnalyzeReady(page);
    await page.getByTestId("analyze-button").click();
    await expect(page.getByTestId("engine-line-best")).toBeVisible({ timeout: 45000 });
    await expect(page.getByTestId("engine-line-2")).toBeVisible();
  });

  test("deep analyze returns insight", async ({ page }) => {
    test.setTimeout(180000);
    await loadDemoGame(page);
    await waitForDeepAnalyzeReady(page);
    await page.getByTestId("analyze-button").click();
    await expect(page.getByTestId("engine-rail").getByTestId("commentary-panel")).toBeVisible({ timeout: 45000 });
  });

  test("opening book stats on start position", async ({ page }) => {
    test.setTimeout(180000);
    await loadDemoGame(page);
    await expect(page.getByTestId("book-move-row").first()).toBeVisible({ timeout: 15000 });
  });

  test("shows model games for philidor demo", async ({ page }) => {
    test.setTimeout(180000);
    await loadDemoGame(page);
    await page.getByTitle("Next").click();
    await page.getByTitle("Next").click();
    await page.getByTitle("Next").click();
    await openAppMenu(page);
    await page.getByRole("button", { name: "Masters" }).click();
    await expect(page.getByTestId("model-games-panel")).toBeVisible({ timeout: 10000 });
  });

  test("move list collapsed by default on desktop", async ({ page }) => {
    test.setTimeout(180000);
    await loadDemoGame(page);
    await expect(page.getByTestId("move-list")).not.toBeVisible();
    await clickMoveListToggle(page);
    await expect(page.getByTestId("move-list-toggle")).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("right-sidebar")).toBeVisible();
  });

  test("move list collapses on mobile", async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width: 390, height: 844 });
    await loadDemoGame(page);
    await expect(page.getByTestId("move-list")).not.toBeVisible();
    await clickMoveListToggle(page);
    await expect(page.getByTestId("move-list-toggle")).toHaveAttribute("aria-expanded", "true");
  });
});
