# Implementation Plan - Backup LLM Profile Failover

> **Reference:** `docs/designs/2026-03-09-backup-profile-design.md`
> **Execution:** Use `executing-plans` skill.

---

### Task 1: Add `backupProfile` default setting

**Goal:** Register `backupProfile` in `defaultSettings` so the setting exists and persists.

**Step 1: Write the Failing Test**
- File: `tests/constants.test.js`
- Code: Add to the existing describe block:
  ```javascript
  it('has backupProfile in defaultSettings', () => {
      expect(defaultSettings.backupProfile).toBe('');
  });
  ```
  Also add the import of `defaultSettings`:
  ```javascript
  import { PAYLOAD_CALC, defaultSettings } from '../src/constants.js';
  ```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/constants.test.js`
- Expect: Fail — `defaultSettings` has no `backupProfile` property.

**Step 3: Implementation (Green)**
- File: `src/constants.js`
- Action: Add `backupProfile: '',` after the `extractionProfile: '',` line (line ~28).
  ```javascript
  extractionProfile: '',
  backupProfile: '',
  ```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/constants.test.js`
- Expect: PASS

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: add backupProfile to defaultSettings"`

---

### Task 2: Add backup failover logic in `callLLM()`

**Goal:** When the main profile fails, retry the same request with the backup profile before throwing.

**Step 1: Write the Failing Tests**
- File: `tests/llm.test.js`
- Code: Add at end of file. These tests import `callLLM` and use `setupTestContext` to inject mock deps:
  ```javascript
  import { callLLM, LLM_CONFIGS } from '../src/llm.js';
  import { resetDeps } from '../src/deps.js';

  describe('callLLM backup profile failover', () => {
      const testConfig = {
          profileSettingKey: 'extractionProfile',
          maxTokens: 100,
          errorContext: 'Test',
          timeoutMs: 5000,
          getJsonSchema: undefined,
      };
      const testMessages = [{ role: 'user', content: 'hello' }];

      afterEach(() => {
          resetDeps();
      });

      it('succeeds on main profile without touching backup', async () => {
          const sendRequest = vi.fn().mockResolvedValue({ content: 'main-ok' });
          setupTestContext({
              settings: { extractionProfile: 'main-id', backupProfile: 'backup-id' },
              deps: { connectionManager: { sendRequest } },
          });

          const result = await callLLM(testMessages, testConfig);
          expect(result).toBe('main-ok');
          expect(sendRequest).toHaveBeenCalledTimes(1);
          expect(sendRequest.mock.calls[0][0]).toBe('main-id');
      });

      it('falls back to backup when main fails', async () => {
          const sendRequest = vi.fn()
              .mockRejectedValueOnce(new Error('main down'))
              .mockResolvedValueOnce({ content: 'backup-ok' });
          setupTestContext({
              settings: { extractionProfile: 'main-id', backupProfile: 'backup-id' },
              deps: { connectionManager: { sendRequest } },
          });

          const result = await callLLM(testMessages, testConfig);
          expect(result).toBe('backup-ok');
          expect(sendRequest).toHaveBeenCalledTimes(2);
          expect(sendRequest.mock.calls[0][0]).toBe('main-id');
          expect(sendRequest.mock.calls[1][0]).toBe('backup-id');
      });

      it('throws main error when both profiles fail', async () => {
          const sendRequest = vi.fn()
              .mockRejectedValueOnce(new Error('main down'))
              .mockRejectedValueOnce(new Error('backup down'));
          setupTestContext({
              settings: { extractionProfile: 'main-id', backupProfile: 'backup-id' },
              deps: { connectionManager: { sendRequest } },
          });

          await expect(callLLM(testMessages, testConfig)).rejects.toThrow('main down');
          expect(sendRequest).toHaveBeenCalledTimes(2);
      });

      it('skips backup when backupProfile is empty', async () => {
          const sendRequest = vi.fn().mockRejectedValueOnce(new Error('main down'));
          setupTestContext({
              settings: { extractionProfile: 'main-id', backupProfile: '' },
              deps: { connectionManager: { sendRequest } },
          });

          await expect(callLLM(testMessages, testConfig)).rejects.toThrow('main down');
          expect(sendRequest).toHaveBeenCalledTimes(1);
      });

      it('skips backup when backup equals main profile', async () => {
          const sendRequest = vi.fn().mockRejectedValueOnce(new Error('main down'));
          setupTestContext({
              settings: { extractionProfile: 'same-id', backupProfile: 'same-id' },
              deps: { connectionManager: { sendRequest } },
          });

          await expect(callLLM(testMessages, testConfig)).rejects.toThrow('main down');
          expect(sendRequest).toHaveBeenCalledTimes(1);
      });

      it('throws when backup returns empty response', async () => {
          const sendRequest = vi.fn()
              .mockRejectedValueOnce(new Error('main down'))
              .mockResolvedValueOnce({ content: '' });
          setupTestContext({
              settings: { extractionProfile: 'main-id', backupProfile: 'backup-id' },
              deps: { connectionManager: { sendRequest } },
          });

          await expect(callLLM(testMessages, testConfig)).rejects.toThrow('main down');
          expect(sendRequest).toHaveBeenCalledTimes(2);
      });
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/llm.test.js`
- Expect: Multiple failures — `callLLM` does not retry with backup.

**Step 3: Implementation (Green)**
- File: `src/llm.js`
- Action: Restructure the try/catch in `callLLM()`. Extract the `sendRequest` + response handling into a helper, then add backup retry in the catch block.

  Replace the entire try/catch block (lines 95–145) with:
  ```javascript
      // --- Helper: execute a single LLM request against a given profile ---
      async function executeRequest(targetProfileId) {
          const requestPromise = deps.connectionManager.sendRequest(
              targetProfileId,
              messages,
              maxTokens,
              {
                  includePreset: true,
                  includeInstruct: true,
                  stream: false,
              },
              jsonSchema ? { jsonSchema } : {}
          );

          const result = await withTimeout(requestPromise, timeoutMs || 120000, `${errorContext} API`);
          const content = result?.content || result || '';

          log(`LLM response received (${content.length} chars)`);
          logRequest(errorContext, { messages, maxTokens, profileId: targetProfileId, response: content });

          if (content.length === 0) {
              log(`ERROR: Empty LLM response! Full result: ${JSON.stringify(result).substring(0, 200)}`);
          }

          if (!content) {
              throw new Error('Empty response from LLM');
          }

          const context = deps.getContext();
          if (context.parseReasoningFromString) {
              const parsed = context.parseReasoningFromString(content);
              return parsed ? parsed.content : content;
          }

          return content;
      }

      // --- Main request with backup failover ---
      try {
          log(`Using ConnectionManagerRequestService with profile: ${profileId}`);
          return await executeRequest(profileId);
      } catch (mainError) {
          // Attempt backup profile if configured and different from main
          const backupProfileId = settings.backupProfile;
          if (backupProfileId && backupProfileId !== profileId) {
              const profiles = extension_settings?.connectionManager?.profiles || [];
              const backupName = profiles.find((p) => p.id === backupProfileId)?.name || backupProfileId;
              log(`${errorContext} failed on main profile, trying backup: ${backupName}`);
              try {
                  return await executeRequest(backupProfileId);
              } catch (backupError) {
                  log(`${errorContext} backup also failed: ${backupError.message}`);
              }
          }

          // Original error handling — toast + re-throw main error
          const errorMessage = mainError.message || 'Unknown error';
          log(`${errorContext} LLM call error: ${errorMessage}`);
          if (!errorMessage.includes('timed out')) {
              showToast('error', `${errorContext} failed: ${errorMessage}`);
          }
          logRequest(errorContext, { messages, maxTokens, profileId, error: mainError });
          throw mainError;
      }
  ```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/llm.test.js`
- Expect: All 6 new tests PASS + existing tests PASS.

**Step 5: Git Commit**
- Command: `git add . && git commit -m "feat: backup profile failover in callLLM"`

---

### Task 3: Add backup profile UI (HTML + settings wiring)

**Goal:** Add a dropdown for backup profile selection in the settings panel and wire it to save/load.

**Step 1: Write the Failing Test**
- File: `tests/ui-templates.test.js`
- Code: Add to existing describe block (check if backup dropdown exists in template):
  ```javascript
  it('contains backup profile dropdown', () => {
      expect(html).toContain('id="openvault_backup_profile"');
      expect(html).toContain('None (no failover)');
  });
  ```

**Step 2: Run Test (Red)**
- Command: `npx vitest run tests/ui-templates.test.js`
- Expect: Fail — template does not contain `openvault_backup_profile`.

**Step 3: Implementation (Green)**

- File: `templates/settings_panel.html`
- Action: Add after the `</small>` tag for extraction profile hint (after line 38):
  ```html
                        <!-- Backup Profile -->
                        <label for="openvault_backup_profile">Backup Profile</label>
                        <select id="openvault_backup_profile" class="text_pole">
                            <option value="">None (no failover)</option>
                        </select>
                        <small class="openvault-hint">Fallback profile if the main one fails</small>
  ```

- File: `src/ui/settings.js`
- Action 1: Add change handler after the `extractionProfile` handler (~line 571):
  ```javascript
  $('#openvault_backup_profile').on('change', function () {
      saveSetting('backupProfile', $(this).val());
  });
  ```

- Action 2: In `populateProfileSelector()`, add a second `populateProfileDropdown` call after the existing one:
  ```javascript
  populateProfileDropdown($('#openvault_backup_profile'), profiles, settings.backupProfile);
  ```

**Step 4: Verify (Green)**
- Command: `npx vitest run tests/ui-templates.test.js`
- Expect: PASS

**Step 5: Full Suite Verify**
- Command: `npx vitest run`
- Expect: All tests PASS. No regressions.

**Step 6: Git Commit**
- Command: `git add . && git commit -m "feat: add backup profile dropdown to settings UI"`
