---
description: How to test the Atomic Tycoon game
---

# Testing Atomic Tycoon

## Prerequisites

> [!IMPORTANT]
> Before testing, you **MUST** enable debug access by setting `DEBUG_ENABLED = true` in `js/main.js` (line 2).

```javascript
// ========== DEBUG CONFIGURATION ==========
const DEBUG_ENABLED = true; // Set to true for testing
```

## Testing Steps

// turbo-all

1. Open `index.html` in a browser
2. Use the Debug Access button (bottom-right) to access debug tools:
   - **+$100M Cash**: Add money for testing purchases
   - **Max Research**: Unlock all research instantly
   - **Reset Heat**: Cool all reactors
   - **FF Toggle**: Speed up game time

## Key Features to Test

- [ ] Building purchase (House, Factory, etc.)
- [ ] Reactor controls (Overdrive, SCRAM, Upgrade)
- [ ] Research Tree unlocking
- [ ] Battery/Grid Storage system
- [ ] Contracts modal
- [ ] Prestige button (appears at $1B)
- [ ] Save/Load persistence

## After Testing

Set `DEBUG_ENABLED = false` for production.
