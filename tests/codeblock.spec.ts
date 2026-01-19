import { test, expect } from '@playwright/test';

test.describe('CodeBlock Web Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
    // Wait for custom element to be defined and ready
    await page.waitForSelector('code-block[ready]');
  });

  test.describe('Basic Rendering', () => {
    test('renders code content', async ({ page }) => {
      // Target a code-block with specific content
      const codeBlock = page.locator('code-block').first();
      await expect(codeBlock).toBeVisible();

      const content = await codeBlock.textContent();
      expect(content?.length).toBeGreaterThan(0);
    });

    test('has ready attribute when fully loaded', async ({ page }) => {
      const codeBlocks = page.locator('code-block');
      const count = await codeBlocks.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        await expect(codeBlocks.nth(i)).toHaveAttribute('ready', '');
      }
    });

    test('displays different languages', async ({ page }) => {
      await expect(page.locator('code-block[language="bash"]').first()).toBeVisible();
      await expect(page.locator('code-block[language="javascript"]').first()).toBeVisible();
      await expect(page.locator('code-block[language="typescript"]').first()).toBeVisible();
      await expect(page.locator('code-block[language="css"]').first()).toBeVisible();
    });
  });

  test.describe('Line Numbers', () => {
    test('displays line numbers when attribute is set', async ({ page }) => {
      const codeBlock = page.locator('code-block[line-numbers]').first();
      const gutter = codeBlock.locator('.line-numbers-gutter');

      await expect(gutter).toBeVisible();
    });

    test('line numbers match content lines', async ({ page }) => {
      const codeBlock = page.locator('code-block[line-numbers]').first();
      const gutter = codeBlock.locator('.line-numbers-gutter');
      const lineNumbers = gutter.locator('span');

      // Get the count of line numbers
      const count = await lineNumbers.count();
      expect(count).toBeGreaterThan(0);

      // Verify line numbers are sequential
      for (let i = 0; i < count; i++) {
        await expect(lineNumbers.nth(i)).toHaveText(String(i + 1));
      }
    });

    test('does not display line numbers without attribute', async ({ page }) => {
      // Find a code-block without line-numbers attribute
      const codeBlock = page.locator('code-block:not([line-numbers])').first();
      const gutter = codeBlock.locator('.line-numbers-gutter');

      await expect(gutter).not.toBeVisible();
    });
  });

  test.describe('Copy Button', () => {
    test('displays copy button when attribute is set', async ({ page }) => {
      const codeBlock = page.locator('code-block[copy-button]').first();
      const copyButton = codeBlock.locator('.copy-button');

      await expect(copyButton).toBeVisible();
    });

    test('copy button shows feedback on click', async ({ page }) => {
      const codeBlock = page.locator('code-block[copy-button]').first();
      const copyButton = codeBlock.locator('.copy-button');

      // Grant clipboard permissions
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

      await copyButton.click();

      // Button should have 'copied' class
      await expect(copyButton).toHaveClass(/copied/);

      // Wait for feedback to clear (2 seconds)
      await page.waitForTimeout(2100);
      await expect(copyButton).not.toHaveClass(/copied/);
    });

    test('copy event dispatches with content', async ({ page }) => {
      const codeBlock = page.locator('code-block[copy-button]').first();
      const copyButton = codeBlock.locator('.copy-button');

      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

      // Listen for copy event
      const copyEventPromise = codeBlock.evaluate((el) => {
        return new Promise<{ value: string; success: boolean }>((resolve) => {
          el.addEventListener('copy', ((e: CustomEvent) => {
            resolve(e.detail);
          }) as EventListener, { once: true });
        });
      });

      await copyButton.click();
      const detail = await copyEventPromise;

      expect(detail.success).toBe(true);
      expect(detail.value.length).toBeGreaterThan(0);
    });

    test('does not display copy button without attribute', async ({ page }) => {
      // Find a code-block without copy-button attribute
      const codeBlock = page.locator('code-block:not([copy-button])').first();
      const copyButton = codeBlock.locator('.copy-button');

      await expect(copyButton).not.toBeVisible();
    });
  });

  test.describe('Code Folding', () => {
    test('displays fold gutter when foldable and line-numbers', async ({ page }) => {
      const codeBlock = page.locator('code-block[foldable]');
      const foldGutter = codeBlock.locator('.fold-gutter');

      await expect(foldGutter).toBeVisible();
    });

    test('shows fold toggle on foldable lines', async ({ page }) => {
      const codeBlock = page.locator('code-block[foldable]');
      const foldToggles = codeBlock.locator('.fold-toggle[data-region]');

      // Calculator class has multiple foldable regions
      const count = await foldToggles.count();
      expect(count).toBeGreaterThan(0);
    });

    test('clicking fold toggle collapses region', async ({ page }) => {
      const codeBlock = page.locator('code-block[foldable]');
      const foldToggle = codeBlock.locator('.fold-toggle[data-region]').first();
      const codeContent = codeBlock.locator('.code-content');

      // Get original content
      const originalContent = await codeContent.textContent();

      // Click to fold
      await foldToggle.click();

      // Content should change (collapsed)
      const foldedContent = await codeContent.textContent();
      expect(foldedContent).not.toBe(originalContent);
      expect(foldedContent).toContain('...}');
    });

    test('clicking fold toggle again expands region', async ({ page }) => {
      const codeBlock = page.locator('code-block[foldable]');
      const foldToggle = codeBlock.locator('.fold-toggle[data-region]').first();
      const codeContent = codeBlock.locator('.code-content');

      // Get original content
      const originalContent = await codeContent.textContent();

      // Fold
      await foldToggle.click();
      const foldedContent = await codeContent.textContent();
      expect(foldedContent).toContain('...}');

      // Unfold
      await foldToggle.click();
      const unfoldedContent = await codeContent.textContent();
      expect(unfoldedContent).toBe(originalContent);
    });

    test('copy returns full content when folded', async ({ page }) => {
      const codeBlock = page.locator('code-block[foldable]');
      const foldToggle = codeBlock.locator('.fold-toggle[data-region]').first();
      const copyButton = codeBlock.locator('.copy-button');

      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

      // Get original content
      const originalValue = await codeBlock.evaluate((el: any) => el.value);

      // Fold a region
      await foldToggle.click();

      // Copy should return full content
      const copyEventPromise = codeBlock.evaluate((el) => {
        return new Promise<{ value: string }>((resolve) => {
          el.addEventListener('copy', ((e: CustomEvent) => {
            resolve(e.detail);
          }) as EventListener, { once: true });
        });
      });

      await copyButton.click();
      const detail = await copyEventPromise;

      expect(detail.value).toBe(originalValue);
    });
  });

  test.describe('Editable Mode', () => {
    test('content is editable when attribute is set', async ({ page }) => {
      const codeBlock = page.locator('code-block[editable]');

      // Without line-numbers, the code-block itself is contenteditable
      await expect(codeBlock).toHaveAttribute('contenteditable', 'plaintext-only');
    });

    test('can edit content', async ({ page }) => {
      const codeBlock = page.locator('code-block[editable]');

      // Get original value
      const originalValue = await codeBlock.evaluate((el: any) => el.value);

      // Click to focus and type at cursor position
      await codeBlock.click();
      await page.keyboard.type('EDITED');

      const value = await codeBlock.evaluate((el: any) => el.value);
      expect(value).toContain('EDITED');
      expect(value).not.toBe(originalValue);
    });

    test('fires change event on edit', async ({ page }) => {
      const codeBlock = page.locator('code-block[editable]');

      // Listen for change event
      const changeEventPromise = codeBlock.evaluate((el) => {
        return new Promise<boolean>((resolve) => {
          el.addEventListener('change', () => resolve(true), { once: true });
        });
      });

      await codeBlock.click();
      await page.keyboard.type('x');

      const changeReceived = await changeEventPromise;
      expect(changeReceived).toBe(true);
    });

    test('content is not editable without attribute', async ({ page }) => {
      const codeBlock = page.locator('code-block[language="javascript"]').first();

      // Should not have contenteditable attribute
      const attr = await codeBlock.getAttribute('contenteditable');
      expect(attr).toBeNull();
    });
  });

  test.describe('Theme Switching', () => {
    test('applies default prettylights theme', async ({ page }) => {
      const codeBlock = page.locator('code-block').first();

      // Default theme has specific background color
      const bg = await codeBlock.evaluate((el) => {
        return getComputedStyle(el).backgroundColor;
      });

      // Prettylights light mode background is #f6f8fa
      expect(bg).toMatch(/rgb\(246, 248, 250\)|rgba\(246, 248, 250/);
    });

    test('switches to prism theme', async ({ page }) => {
      // Click prism theme button
      await page.click('button:has-text("Prism")');

      const codeBlock = page.locator('code-block').first();

      // Prism theme background is #f5f2f0
      const bg = await codeBlock.evaluate((el) => {
        return getComputedStyle(el).backgroundColor;
      });

      expect(bg).toMatch(/rgb\(245, 242, 240\)|rgba\(245, 242, 240/);
    });

    test('preserves content when switching themes', async ({ page }) => {
      const codeBlock = page.locator('code-block[language="javascript"]').first();
      const contentBefore = await codeBlock.textContent();

      // Switch theme
      await page.click('button:has-text("Prism")');

      const contentAfter = await codeBlock.textContent();
      expect(contentAfter).toBe(contentBefore);
    });
  });

  test.describe('Value Property', () => {
    test('returns current code content', async ({ page }) => {
      const codeBlock = page.locator('code-block').first();

      const value = await codeBlock.evaluate((el: any) => el.value);

      // Just verify it has content
      expect(value.length).toBeGreaterThan(0);
    });

    test('can set code content via property', async ({ page }) => {
      const codeBlock = page.locator('code-block').first();

      await codeBlock.evaluate((el: any) => {
        el.value = 'const x = 42;';
      });

      const value = await codeBlock.evaluate((el: any) => el.value);
      expect(value).toBe('const x = 42;');
    });
  });

  test.describe('Language Property', () => {
    test('returns current language', async ({ page }) => {
      const codeBlock = page.locator('code-block[language="typescript"]').first();

      const lang = await codeBlock.evaluate((el: any) => el.language);
      expect(lang).toBe('typescript');
    });

    test('can change language dynamically', async ({ page }) => {
      // Get first code-block element handle for stable reference
      const codeBlock = page.locator('code-block').first();

      // Get initial language
      const initialLang = await codeBlock.getAttribute('language');

      // Change language to something different
      const newLang = initialLang === 'python' ? 'ruby' : 'python';
      await codeBlock.evaluate((el: any, lang: string) => {
        el.language = lang;
      }, newLang);

      // Verify the attribute changed
      await expect(codeBlock).toHaveAttribute('language', newLang);

      // Language getter should also reflect the change
      const lang = await codeBlock.evaluate((el: any) => el.language);
      expect(lang).toBe(newLang);
    });
  });
});
