# SillyTavern-MemoryBooks Macro Positioning Analysis

## Executive Summary

The SillyTavern-MemoryBooks plugin implements macro positioning through SillyTavern's built-in **World Info** system. The plugin doesn't implement its own macro injection system - instead, it leverages SillyTavern's native lorebook positioning infrastructure.

## Key Findings

### 1. Position Values and Their Meanings

The plugin uses numeric position codes that map to SillyTavern's injection points:

| Position Code | Display Name | Description | Injection Point |
|--------------|--------------|-------------|-----------------|
| **0** | ↑Char (Char Up) | **Recommended default** | Before character definitions |
| **1** | ↓Char (Char Down) | After character definitions | After character definitions |
| **5** | ↑EM (EM Up) | Before example messages | Before example messages |
| **6** | ↓EM (EM Down) | After example messages | After example messages |
| **2** | ↑AN (AN Up) | Before author's note | Before author's note |
| **3** | ↓AN (AN Down) | After author's note | After author's note |
| **7** | Outlet | Custom named position | User-defined injection point |

**Source**: `profileManager.js` lines 159-172

```javascript
<select id="stmb-profile-position" class="text_pole">
    <option value="0">↑Char</option>
    <option value="1">↓Char</option>
    <option value="5">↑EM</option>
    <option value="6">↓EM</option>
    <option value="2">↑AN</option>
    <option value="3">↓AN</option>
    <option value="7">Outlet</option>
</select>
```

### 2. Data Structure for Position Configuration

The position configuration is stored in **profile objects** within the extension settings:

```javascript
// From profileManager.js
{
    name: "Profile Name",
    connection: { /* API settings */ },
    prompt: "Prompt template",
    constVectMode: "link",  // or "blue" (constant) or "green" (normal)
    position: 0,            // ← Position code (0-7)
    orderMode: "auto",      // or "manual" or "reverse"
    orderValue: 100,
    reverseStart: 9999,
    outletName: ""          // Required when position === 7
}
```

**Storage Location**: `extension_settings.STMemoryBooks.profiles[]`

### 3. Runtime Application to Lorebook Entries

When creating/updating lorebook entries, the position is applied directly to the entry:

**From `addlore.js` lines 284-290**:

```javascript
// 2. Insertion Position
entry.position = lorebookSettings.position;

// 2a. Outlet Name for Outlet position (7)
if (Number(lorebookSettings.position) === 7) {
    const outName = String(lorebookSettings.outletName || '').trim();
    if (outName) {
        entry.outletName = outName;
    }
}
```

**Lorebook Entry Structure**:

```javascript
{
    // Standard lorebook fields
    key: ["keyword1", "keyword2"],
    content: "Memory content here",
    comment: "Entry title",

    // Positioning fields
    position: 0,              // ← Macro position code
    order: 100,               // Insertion order within position
    outletName: "myOutlet",   // Only used when position === 7

    // Other settings
    vectorized: true,
    constant: false,
    selective: true,
    preventRecursion: false,
    delayUntilRecursion: false,

    // STMB metadata
    stmemorybooks: true       // Flags entry as STMB-managed
}
```

### 4. UI Component Implementation

The position selector is implemented using **Handlebars templates** in `profileManager.js`:

```html
<div class="world_entry_form_control marginTop5">
    <label for="stmb-profile-position">
        <h4 data-i18n="STMemoryBooks_InsertionPosition">Insertion Position:</h4>
        <small data-i18n="STMemoryBooks_InsertionPositionDesc">
            ↑Char is recommended. Aiko recommends memories never go lower than ↑AN.
        </small>
        <select id="stmb-profile-position" class="text_pole">
            <option value="0" {{#if (eq position 0)}}selected{{/if}}>
                ↑Char
            </option>
            <!-- Other options... -->
        </select>
    </label>
</div>
```

**Conditional Outlet Name Field** (shown only when position === 7):

```html
<div id="stmb-profile-outlet-name-container"
     class="world_entry_form_control marginTop5 {{#unless (eq position 7)}}displayNone{{/unless}}">
    <label for="stmb-profile-outlet-name">
        <h4 data-i18n="STMemoryBooks_OutletName">Outlet Name:</h4>
        <input type="text" id="stmb-profile-outlet-name"
               class="text_pole"
               placeholder="Outlet name"
               value="{{outletName}}">
    </label>
</div>
```

### 5. How Macro Injection Works

**Critical Insight**: The plugin does NOT implement macro injection itself. It relies entirely on **SillyTavern's World Info system**:

1. **Plugin creates/updates lorebook entries** with:
   - `entry.position` set to the configured position code (0-7)
   - `entry.outletName` set if position === 7
   - Content, keywords, and other metadata

2. **SillyTavern's core world-info system**:
   - Reads all lorebook entries
   - Groups entries by their `position` value
   - Injects content at the appropriate point in the prompt context
   - Respects `order` field for sorting within each position
   - Handles Outlet injection by matching `outletName` to `{{outlet::name}}` macros

3. **No custom API hooks or event listeners** are used for injection
   - The plugin simply writes to the lorebook data structure
   - SillyTavern's built-in system handles the actual prompt assembly

### 6. Position Configuration Storage Hierarchy

```
extension_settings.STMemoryBooks
├── profiles[]                          # Array of profile objects
│   ├── [0]
│   │   ├── name: "Default Profile"
│   │   ├── position: 0                 # ← Stored here
│   │   ├── outletName: ""
│   │   └── ...
│   └── [1]
│       └── ...
├── defaultProfile: 0                   # Index of active profile
└── moduleSettings
    └── ...
```

**Applied to entries**:

```
world_info["Lorebook Name"]
├── entries[]
│   ├── [0]
│   │   ├── key: ["memory"]
│   │   ├── content: "..."
│   │   ├── position: 0                # ← Copied from profile
│   │   ├── outletName: ""
│   │   └── ...
│   └── ...
```

### 7. Localization Strings

From `locales.js`:

```javascript
'STMemoryBooks_InsertionPosition': 'Insertion Position:',
'STMemoryBooks_InsertionPositionDesc': '↑Char is recommended. Aiko recommends memories never go lower than ↑AN.',
'STMemoryBooks_CharUp': '↑Char',
'STMemoryBooks_CharDown': '↓Char',
'STMemoryBooks_EMUp': '↑EM',
'STMemoryBooks_EMDown': '↓EM',
'STMemoryBooks_ANUp': '↑AN',
'STMemoryBooks_ANDown': '↓AN',
'STMemoryBooks_Outlet': 'Outlet',
'STMemoryBooks_OutletName': 'Outlet Name:',
```

## Implementation Summary

### What the Plugin Does:
1. **Provides UI** for selecting position codes (0-7)
2. **Stores position configuration** in profile settings
3. **Applies position** to lorebook entries when creating/updating
4. **Handles Outlet name** for position 7

### What SillyTavern Core Does:
1. **Reads position field** from lorebook entries
2. **Groups entries** by position value
3. **Injects content** at the appropriate point in prompt context
4. **Processes Outlet macros** (`{{outlet::name}}`) by matching entries

### Key Files:
- **`profileManager.js`**: UI template and position selector
- **`addlore.js`**: Applies position to lorebook entries
- **`sidePrompts.js`**: Uses position for side prompt entries
- **`locales.js`**: Localization strings for position labels

### No Custom Injection System:
The plugin does NOT implement its own macro injection. It's purely a **configuration layer** on top of SillyTavern's existing world-info positioning system.

## Comparison: STMB vs. OpenVault

| Aspect | SillyTavern-MemoryBooks | OpenVault (Your Project) |
|--------|------------------------|--------------------------|
| **Position System** | Uses ST's built-in position codes (0-7) | Could use same or custom system |
| **Injection Mechanism** | Relies on ST core world-info | May need custom implementation |
| **UI** | Handlebars template in profileManager.js | Could use similar dropdown |
| **Data Storage** | `entry.position` field in lorebook | Could use same approach |
| **Outlet Support** | Yes, with `entry.outletName` | Could implement similarly |

## Recommendations for OpenVault

1. **Adopt the same position codes** (0-7) for compatibility
2. **Store position in entry object** as `entry.position`
3. **Support Outlet names** with `entry.outletName` when position === 7
4. **Consider similar UI** with position selector dropdown
5. **Leverage existing system** if running in SillyTavern context
6. **For standalone use**, implement similar prompt assembly logic that groups and injects by position

## Code Snippets for Reference

### Position Selector UI
```html
<select id="position-selector" class="text_pole">
    <option value="0">↑Char (Before Character Definitions)</option>
    <option value="1">↓Char (After Character Definitions)</option>
    <option value="2">↑AN (Before Author's Note)</option>
    <option value="3">↓AN (After Author's Note)</option>
    <option value="5">↑EM (Before Example Messages)</option>
    <option value="6">↓EM (After Example Messages)</option>
    <option value="7">Outlet (Custom Injection Point)</option>
</select>
```

### Entry Creation with Position
```javascript
function createEntry(content, position, outletName) {
    const entry = {
        key: extractKeywords(content),
        content: content,
        comment: generateTitle(content),
        position: position,  // ← Position code
        order: 100,
        vectorized: true,
        selective: true,
        constant: false,
        preventRecursion: false,
        delayUntilRecursion: false
    };

    if (position === 7 && outletName) {
        entry.outletName = outletName;
    }

    return entry;
}
```

### Prompt Assembly Logic (Conceptual)
```javascript
function assemblePrompt(entries, characterDef, exampleMessages, authorsNote, userContent) {
    const prompt = [];

    // Group entries by position
    const byPosition = {};
    entries.forEach(entry => {
        if (!byPosition[entry.position]) {
            byPosition[entry.position] = [];
        }
        byPosition[entry.position].push(entry);
    });

    // Inject at position 0 (↑Char - before character)
    if (byPosition[0]) {
        prompt.push(...injectEntries(byPosition[0]));
    }

    // Character definitions
    prompt.push(characterDef);

    // Inject at position 1 (↓Char - after character)
    if (byPosition[1]) {
        prompt.push(...injectEntries(byPosition[1]));
    }

    // ... similar pattern for other positions

    return prompt.join('\n');
}
```

---

**Analysis Date**: 2026-03-20
**Source**: SillyTavern-MemoryBooks v5.1.0
**Analyzed By**: Claude Code Agent
