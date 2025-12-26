ATOMIC TYCOON ENGINE SPECIFICATION (v1.1.3)

1. CORE STATE SCHEMA (state)

cash: float (main currency)

buildings: map { count, baseCost, demand, revenue }

reactors: array 

$${ id, gen, heat, isOverdrive, isScrammed, upgradeCost, baseMW }$$

managers: array 

$${ id, type }$$

 (max length: 4)

Upgrades: boolean flags for hasSync, hasFirefighters, hasSmartGrid, hasAI, hasLLM

maxGenUnlocked: integer (2-5)

districtSize: integer (100+)

landCost: float (escalating)

2. PHYSICS & CALCULATIONS (per dt tick)

A. Heat Engine

Passive Cooling: -dt * 5

Active Overdrive Heat Gain: dt * 16 * (1 + (heat / 40)) * heatMult * stabilityMult

SCRAM Recovery: Default -dt * 12. If hasFirefighters: -dt * 15.

Stability Factors: Gen 2: 1.0, Gen 3: 0.75, Gen 4: 0.5, Gen 5: 0.4 (Inverses applied to gain).

B. Power Supply/Demand

Unit Output: (isScrammed ? 0 : baseMW * (isOverdrive ? 2.5 : 1)) * engineerBonus

Total Demand: sum(buildingCounts * buildingDemands)

AI Modifier: If hasAI, Data Center demand is 600MW. If hasAI && hasLLM, demand is 400MW. Default 200MW.

Skyscraper Gate: Locked until buildings.datacenter.count >= 10 && maxGenUnlocked >= 5.

C. Financial Logic

Brownout Efficiency: If Supply < Demand: hasSmartGrid ? 0.90 : 0.70. Else 1.0.

Weighted Multiplier (wm): Calculates average profit multiplier across all active reactors based on their individual MW share of total output.

Profit Tiers (Heat-based): 

$$1.10, 1.30, 1.70, 2.00$$

 for Gen 2-4. Gen 5 (Fusion): 

$$1.80, 2.50, 4.00, 6.00$$

.

Export Revenue: Math.max(0, Supply - Demand) * 0.5.

3. MANAGER MODIFIERS

Engineer: powerMult = 1 + (count * 0.15)

Procurement: costDiscount = 1 - (count * 0.10) (Applied immediately to building cost labels).

Safety: heatGainMult = 1 - (count * 0.20)

Tax Consultant: revenueMult = 1 + (count * 0.15)

4. COMPONENT ARCHITECTURE

Engine: requestAnimationFrame loop with dt delta-time calculation.

Rendering: Manual DOM manipulation (Tailwind classes). Templates used for reactor-unit generation.

Sorting Logic: Upgrade tray uses O(n log n) sort on every 5% cash change or manual refresh. Priority: Affordable > Locked > Installed.

Visuals: Heat Zone markers fixed at 

$$25%, 50%, 75%$$

. UI shake intensity based on heat > 50 and heat > 75 conditions.

5. GATED CONSTRAINTS

Building Progression:

Factory: 10 Houses.

Data Center: 20 Factories.

Skyscraper: 10 Data Centers + Gen 5 Research.

R&D Progression:

Gen 3: $250k.

Gen 4: $1.25M.

Gen 5 (Fusion): $100M.

7. SAVE SYSTEM 2.0 SPECIFICATION
7.1 Persistence Strategy
   - Storage: LocalStorage key `atomic-tycoon-save`.
   - Frequency: Auto-save every 30 seconds and on `window.onbeforeunload`.
   - Data Structure: JSON object including `cash`, `lastSaveTime`, `managers`, `buildings`, `reactors`, `upgrades`.

7.2 Offline Progress
   - Trigger: On load, if `Date.now() - lastSaveTime > 60000` (1 minute).
   - Calculation:
     - `deltaTime = Date.now() - state.lastSaveTime`
     - `RevenueRate = (CityRevenue * Efficiency) + ReactorGrants + ExportIncome`
     - `OfflineCash = RevenueRate * (deltaTime / 1000) * 0.50` (50% Efficiency Penalty).
   - UX: Modal report showing absence duration and cash earned.

7.3 Data Management
   - Export: Base64 encoding of state JSON object to clipboard.
   - Import: Base64 decoding with validation and state merging.
   - Reset: Clear LocalStorage and reload page.

8. ENGINE VALIDATION PROTOCOLS (TESTING PLAN)

T1: Thermal Stress Test

Objective: Validate stability and overdrive multipliers.

Test: Set a GEN 5 reactor to Overdrive with 0 Safety managers. Expected heat gain should be 16 * (1 + 0/40) * 1.0 * 0.4 = 6.4% per second.

Assertion: Reactor must trigger isScrammed = true exactly at heat >= 100. Verify wm (Weighted Multiplier) shifts from 1.80x (Tier 1) to 6.00x (Tier 4) as heat passes the 75% threshold.

T2: Grid Load & Brownout Logic

Objective: Ensure financial penalties apply correctly during power shortages.

Scenario A: Supply: 500MW, Demand: 600MW, hasSmartGrid: false. Verify efficiency = 0.70.

Scenario B: Supply: 500MW, Demand: 600MW, hasSmartGrid: true. Verify efficiency = 0.90.

Scenario C: Supply: 1000MW, Demand: 500MW. Verify Export Income = (1000-500) * 0.5 = $250/s.

T3: Manager Interaction Validation

Objective: Confirm manager bonuses are multiplicative and apply instantly.

Test: Assign 2 Tax Consultants. Base building revenue must be multiplied by 1.30.

Test: Assign 1 Procurement Manager. Re-fetch buildings.factory.baseCost. Cost must reflect a 10% reduction from the previous state without a page reload.

T4: Progression Lock Verification

Objective: Prevent sequence breaking.

Constraint Check: Attempt to purchase a Skyscraper while maxGenUnlocked = 4. Verify the click event returns null and the UI card maintains the disabled-milestone class.

Prerequisite Check: Verify the llm upgrade remains locked until hasAI is true, even if cash >= 5,000,000.

T5: High-Frequency State Consistency

Objective: Prevent race conditions in sorting and UI rendering.

Test: Rapidly toggle between manager types (Safety <-> Tax). Ensure heatMult and revenueMult update within the same animation frame.

Test: In FF (Fast Forward) mode (5x multiplier), ensure cash accumulation remains linear and does not drift due to dt floating point errors.
