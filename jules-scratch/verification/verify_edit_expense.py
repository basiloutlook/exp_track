from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # 1. Navigate to the dashboard
            page.goto("http://localhost:8081")
            page.screenshot(path="jules-scratch/verification/dashboard-page.png")

            # 2. Click the edit button on the first expense
            edit_button = page.get_by_role("button", name="Edit").first
            edit_button.click()

            # 3. Verify that the "Edit Expense" page is loaded
            expect(page.get_by_text("Edit Expense")).to_be_visible()

            # 4. Take a screenshot
            page.screenshot(path="jules-scratch/verification/edit-expense-page.png")

            # 5. Click the "Update Expense" button
            update_button = page.get_by_role("button", name="Update Expense")
            update_button.click()

            # 6. Verify that the "No Changes" alert is shown
            expect(page.get_by_text("No Changes")).to_be_visible()

            # 7. Take another screenshot
            page.screenshot(path="jules-scratch/verification/no-changes-alert.png")

            # 8. Click the back button
            page.go_back()

            # 9. Verify that the "Discard changes?" alert is shown
            expect(page.get_by_text("Discard changes?")).to_be_visible()

            # 10. Take a third screenshot
            page.screenshot(path="jules-scratch/verification/discard-changes-alert.png")

        finally:
            browser.close()

if __name__ == "__main__":
    run_verification()