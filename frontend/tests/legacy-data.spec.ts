import { expect, test } from "@playwright/test";

// Every request is mocked; no backend needed.
test.beforeEach(async ({ page }) => {
  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("**/api/v1/validation/recent", (route) => route.fulfill({ json: [] }));
});

test("offers earlier ~/.clario sessions once and applies the chosen action", async ({ page }) => {
  const posted: unknown[] = [];
  await page.route("**/setup/legacy-data", async (route) => {
    if (route.request().method() === "POST") {
      posted.push(route.request().postDataJSON());
      await route.fulfill({ json: { action: "move", imported_sessions: 3 } });
      return;
    }
    await route.fulfill({ json: { available: true, session_count: 3 } });
  });

  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Bring over your earlier sessions?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Found 3 sessions");
  await expect(dialog.getByRole("button", { name: "Move here" })).toBeFocused();

  await dialog.getByRole("button", { name: "Move here" }).click();
  await expect(dialog).toBeHidden();
  expect(posted).toEqual([{ action: "move" }]);
  await expect(page.getByText("Earlier sessions moved into this installation.")).toBeVisible();
});

test("shows nothing when there is no earlier data", async ({ page }) => {
  await page.route("**/setup/legacy-data", (route) => route.fulfill({ json: { available: false, session_count: 0 } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Validation sessions" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
