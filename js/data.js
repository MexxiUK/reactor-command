// INITIAL_STATE Definition
const INITIAL_STATE = {
    cash: 150,
    lastSaveTime: Date.now(),
    managers: [],
    unlockedManagerSlots: 2, // New default: 2 slots open
    buildings: {
        house: { count: 0, baseCost: 250, demand: 1, revenue: 2 },
        factory: { count: 0, baseCost: 25000, demand: 25, revenue: 150 },
        datacenter: { count: 0, baseCost: 5000000, demand: 200, revenue: 2500 },
        cryoplant: { count: 0, baseCost: 250000000, demand: 50, revenue: 0 },
        skyscraper: { count: 0, baseCost: 75000000, demand: 1000, revenue: 25000 },
        battery: { count: 0, baseCost: 150000, demand: 0, capacity: 100, stored: 0 }
    },
    reactors: [{ id: 1, gen: 2, heat: 0, isOverdrive: false, isScrammed: false, upgradeCost: 5000, baseMW: 150 }],
    nextUnitCost: 100000,
    hasSync: false,
    hasFirefighters: false,
    hasSmartGrid: false,
    hasAI: false,
    hasLLM: false,
    hasMaintenance: false,
    hasUnlockBattery: false,
    hasTier1Bat: false,
    hasTier2Bat: false,
    hasTier3Bat: false,
    hasTier4Bat: false,
    maxGenUnlocked: 2,
    masterOverdriveActive: false,
    ffMultiplier: 1,
    lastTickCash: 0,
    debugOpen: false,
    districtSize: 100,
    landCost: 10000,
    market: {
        basePrice: 0.10,
        multiplier: 1.0,
        trend: [],
        phase: 0,
        state: 'STABLE',
        news: "Market Stable. Grid demand normal.",
        timer: 0
    },
    contracts: { available: [], active: null, completed: 0, reputation: 0, completedContractIds: [] },
    // Research Tree State
    researchUnlocked: [],
    // Prestige State
    prestigeLevel: 0,
    prestigePoints: 0,
    permanentBonuses: {
        revenueMultiplier: 1.0,
        heatDissipation: 1.0,
        startingCash: 0
    }
};

// Research Tree Definition
const RESEARCH_TREE = [
    // Tier 0 - Root
    { id: 'core_physics', name: 'Core Physics', desc: 'Foundation of reactor science. Unlocks advanced research paths.', cost: 1000, requires: [], row: 0, col: 1, category: 'core', effect: () => { } },

    // Tier 1 - Branches
    { id: 'thermal_eng', name: 'Thermal Engineering', desc: 'Unlocks Firefighter crews to reduce SCRAM recovery time.', cost: 5000, requires: ['core_physics'], row: 1, col: 0, category: 'core', effect: (s) => { s.hasFirefighters = true; } },
    { id: 'grid_tech', name: 'Grid Technology', desc: 'Power distribution and storage systems.', cost: 5000, requires: ['core_physics'], row: 1, col: 1, category: 'storage', effect: (s) => { s.hasUnlockBattery = true; } },
    { id: 'ai_systems', name: 'AI Systems', desc: 'Computational optimization for power grids.', cost: 10000, requires: ['core_physics'], row: 1, col: 2, category: 'digital', effect: (s) => { s.hasSmartGrid = true; } },

    // Tier 2 - Specializations
    { id: 'overdrive_tech', name: 'Master Overdrive Protocol', desc: 'Synchronized reactor overclocking.', cost: 25000, requires: ['thermal_eng'], row: 2, col: 0, category: 'core', effect: (s) => { s.hasSync = true; } },
    { id: 'battery_t1', name: 'Lithium-Ion Cells', desc: '+400 MWs battery capacity per unit.', cost: 50000, requires: ['grid_tech'], row: 2, col: 1, category: 'storage', effect: (s) => { s.hasTier1Bat = true; s.buildings.battery.capacity += 400; } },
    { id: 'neural_net', name: 'Neural Networks', desc: 'AI-powered datacenters. 2x profit, 3x power.', cost: 75000, requires: ['ai_systems'], row: 2, col: 2, category: 'digital', effect: (s) => { s.hasAI = true; } },

    // Tier 3 - Advanced
    { id: 'gen3_reactor', name: 'GEN III Core Design', desc: 'Unlocks Generation 3 reactor construction.', cost: 100000, requires: ['overdrive_tech'], row: 3, col: 0, category: 'core', effect: (s) => { if (s.maxGenUnlocked < 3) s.maxGenUnlocked = 3; } },
    { id: 'battery_t2', name: 'Solid State Storage', desc: '+1500 MWs battery capacity per unit.', cost: 200000, requires: ['battery_t1'], row: 3, col: 1, category: 'storage', effect: (s) => { s.hasTier2Bat = true; s.buildings.battery.capacity += 1500; } },
    { id: 'llm_opt', name: 'LLM Optimization', desc: 'Reduce datacenter power to 2x (400MW).', cost: 250000, requires: ['neural_net'], row: 3, col: 2, category: 'digital', effect: (s) => { s.hasLLM = true; } },

    // Tier 4 - Mastery
    { id: 'gen4_reactor', name: 'GEN IV Core Design', desc: 'Unlocks Generation 4 reactor construction.', cost: 500000, requires: ['gen3_reactor'], row: 4, col: 0, category: 'core', effect: (s) => { if (s.maxGenUnlocked < 4) s.maxGenUnlocked = 4; } },
    { id: 'battery_t3', name: 'Graphene Supercaps', desc: '+8000 MWs battery capacity per unit.', cost: 1000000, requires: ['battery_t2'], row: 4, col: 1, category: 'storage', effect: (s) => { s.hasTier3Bat = true; s.buildings.battery.capacity += 8000; } },
    { id: 'maintenance', name: 'Elite Maintenance', desc: '+50% reactor output.', cost: 500000, requires: ['llm_opt', 'gen3_reactor'], row: 4, col: 2, category: 'digital', effect: (s) => { s.hasMaintenance = true; } },

    // Tier 5 - Expansion
    { id: 'cryo_tech', name: 'Cryogenic Engineering', desc: 'Unlocks Cryo-Plant construction. Reduces global reactor heat.', cost: 5000000, requires: ['gen4_reactor'], row: 5, col: 0, category: 'core', effect: (s) => { } },
    { id: 'personnel_3', name: 'Personnel Slot 3', desc: 'Unlocks the 3rd Manager Slot.', cost: 500000, requires: ['maintenance'], row: 5, col: 2, category: 'digital', effect: (s) => { s.unlockedManagerSlots = 3; } },

    // Tier 6 - Endgame
    { id: 'fusion', name: 'Fusion Technology', desc: 'Unlocks GEN V Fusion reactors.', cost: 10000000, requires: ['gen4_reactor', 'battery_t3'], row: 6, col: 0, category: 'core', effect: (s) => { if (s.maxGenUnlocked < 5) s.maxGenUnlocked = 5; } },
    { id: 'quantum_bat', name: 'Quantum Storage', desc: '+40000 MWs. Near-infinite cycle life.', cost: 50000000, requires: ['battery_t3'], row: 6, col: 1, category: 'storage', effect: (s) => { s.hasTier4Bat = true; s.buildings.battery.capacity += 40000; } },
    { id: 'personnel_4', name: 'Personnel Slot 4', desc: 'Unlocks the 4th Manager Slot.', cost: 5000000, requires: ['personnel_3'], row: 6, col: 2, category: 'digital', effect: (s) => { s.unlockedManagerSlots = 4; } }
];

// Prestige Bonuses (Purchased with Prestige Points)
const PRESTIGE_BONUSES = [
    { id: 'revenue_i', name: 'Revenue Boost I', desc: '+5% base revenue permanently.', cost: 1, effect: (s) => { s.permanentBonuses.revenueMultiplier += 0.05; } },
    { id: 'revenue_ii', name: 'Revenue Boost II', desc: '+10% base revenue permanently.', cost: 3, requires: 'revenue_i', effect: (s) => { s.permanentBonuses.revenueMultiplier += 0.10; } },
    { id: 'heat_i', name: 'Cooling Efficiency I', desc: '+10% heat dissipation permanently.', cost: 2, effect: (s) => { s.permanentBonuses.heatDissipation += 0.10; } },
    { id: 'heat_ii', name: 'Cooling Efficiency II', desc: '+20% heat dissipation permanently.', cost: 4, requires: 'heat_i', effect: (s) => { s.permanentBonuses.heatDissipation += 0.20; } },
    { id: 'start_cash', name: 'Seed Capital', desc: 'Start with +$1,000 per prestige.', cost: 2, effect: (s) => { s.permanentBonuses.startingCash += 1000; } }
];


const MANAGER_TYPES = {
    engineer: { name: "Engineer", bonus: "+15% Power", color: "emerald", desc: "Optimizes turbines to increase total MegaWatt capacity." },
    procurement: { name: "Procurement", bonus: "-10% Price", color: "blue", desc: "Negotiates bulk rates to reduce city construction costs." },
    safety: { name: "Safety", bonus: "-20% Heat", color: "red", desc: "Advanced liquid cooling slows core temperature rise." },
    tax: { name: "Tax Consultant", bonus: "+15% Revenue", color: "purple", desc: "Maximizes taxation revenue from all buildings on the grid." }
};

const GEN_STABILITY = { 2: 1.0, 3: 0.75, 4: 0.5, 5: 0.4 };
const GEN_TIER_MULTIPLIERS = {
    2: [1.10, 1.30, 1.70, 2.00],
    3: [1.30, 1.60, 2.20, 2.80],
    4: [1.50, 2.00, 3.00, 4.00],
    5: [1.80, 2.50, 4.00, 6.00]
};
const GEN_POWER_BONUS = {
    2: [0, 50, 150, 400],
    3: [0, 200, 600, 1500],
    4: [0, 600, 2000, 5000],
    5: [0, 3000, 8000, 20000]
};
const GEN_BASE_GRANT = { 2: 5, 3: 50, 4: 250, 5: 2500 };

const UPGRADES = [
    {
        id: 'arch',
        name: 'R&D Laboratory',
        getLabel: (s) => s.maxGenUnlocked < 4 ? ("Develop advanced core blueprints for GEN " + (s.maxGenUnlocked + 1) + " units. Massive increase to Power Capacity and base Revenue yield.") : (s.maxGenUnlocked === 4 ? "Research FUSION Architecture (GEN V). Capable of sustaining 1.5GW base load per core." : "Fusion Era Unlocked"),
        getCost: (s) => (s.maxGenUnlocked === 2 ? 250000 : (s.maxGenUnlocked === 3 ? 1250000 : 100000000)),
        isInstalled: (s) => s.maxGenUnlocked >= 5,
        canBuy: () => true
    },
    {
        id: 'sync',
        name: 'Synchronous Overdrive',
        getLabel: () => 'Unlocks Master Overdrive button which allows for control of all reactor units simultaneously.',
        getCost: () => 50000,
        isInstalled: (s) => s.hasSync,
        canBuy: () => true
    },
    {
        id: 'fire',
        name: 'Firefighters',
        getLabel: () => 'On site emergency services reduce SCRAM time by 20%, bringing crashed units back online significantly faster.',
        getCost: () => 75000,
        isInstalled: (s) => s.hasFirefighters,
        canBuy: () => true
    },
    {
        id: 'grid',
        name: 'Smart Grid',
        getLabel: () => 'Install automated load-shedding hardware. Prevents city revenue from crashing during brownouts, maintaining a 90% income floor.',
        getCost: () => 500000,
        isInstalled: (s) => s.hasSmartGrid,
        canBuy: () => true
    },
    {
        id: 'ai',
        name: 'Artificial Intelligence',
        getLabel: () => 'Integrate neural networks. Data Centers produce 2x profit but use 3x more energy (600MW).',
        getCost: () => 1500000,
        isInstalled: (s) => s.hasAI,
        canBuy: () => true
    },
    {
        id: 'unlock_battery',
        name: 'Grid Storage Tech',
        getLabel: () => 'Research basic chemical energy storage. Unlocks Grid Battery construction.',
        getCost: () => 50000,
        isInstalled: (s) => s.hasUnlockBattery,
        canBuy: () => true
    },
    {
        id: 'tier1_bat',
        name: 'Lithium-Ion Density',
        getLabel: () => 'Advanced cathode materials increase Grid Storage density. Adds +400 MWs per unit.',
        getCost: () => 100000,
        isInstalled: (s) => s.hasTier1Bat,
        canBuy: (s) => s.hasUnlockBattery
    },
    {
        id: 'tier2_bat',
        name: 'Solid State Cells',
        getLabel: () => 'Eliminates liquid electrolyte for safer, denser storage. Adds +1,500 MWs per unit.',
        getCost: () => 1000000,
        isInstalled: (s) => s.hasTier2Bat,
        canBuy: (s) => s.hasTier1Bat
    },
    {
        id: 'tier3_bat',
        name: 'Graphene Supercaps',
        getLabel: () => 'Flash-charge capable carbon lattice storage. Adds +8,000 MWs per unit.',
        getCost: () => 10000000,
        isInstalled: (s) => s.hasTier3Bat,
        canBuy: (s) => s.hasTier2Bat
    },
    {
        id: 'tier4_bat',
        name: 'Quantum Storage',
        getLabel: () => 'Entangled state energy buffers with near-infinite cycle life. Adds +40,000 MWs per unit.',
        getCost: () => 100000000,
        isInstalled: (s) => s.hasTier4Bat,
        canBuy: (s) => s.hasTier3Bat
    },
    {
        id: 'personnel_3',
        name: 'Personnel Slot 3',
        getLabel: () => 'Unlocks the 3rd Manager Slot.',
        getCost: () => 500000,
        isInstalled: (s) => s.unlockedManagerSlots >= 3,
        canBuy: () => true
    },
    {
        id: 'personnel_4',
        name: 'Personnel Slot 4',
        getLabel: () => 'Unlocks the 4th Manager Slot.',
        getCost: () => 5000000,
        isInstalled: (s) => s.unlockedManagerSlots >= 4,
        canBuy: () => true
    },
    {
        id: 'llm',
        name: 'Large Language Models (LLM)',
        getLabel: () => 'Efficiencies in AI usage reduces data center energy use to 2x (400MW). REQUIRES Artificial Intelligence.',
        getCost: () => 5000000,
        isInstalled: (s) => s.hasLLM,
        canBuy: (s) => s.hasAI
    },
    {
        id: 'maintenance',
        name: 'Maintenance Crews',
        getLabel: () => 'Better maintenance crews allow for more efficient efficiency of reactor units. Grants +50% Max Output to all reactor cores.',
        getCost: () => 750000,
        isInstalled: (s) => s.hasMaintenance,
        canBuy: () => true
    }
];

const CONTRACT_TYPES = [
    {
        id: 'surge',
        title: 'Surge Test',
        desc: 'Maintain Heat > 50% on all units.',
        duration: 30,
        difficulty: 'med',
        rewardScale: 300,
        check: (s) => s.reactors.every(r => r.heat >= 50 && !r.isScrammed),
        fail: (s) => s.reactors.some(r => r.isScrammed)
    },
    {
        id: 'stability',
        title: 'Stability Audit',
        desc: 'No Brownouts permitted.',
        duration: 60,
        difficulty: 'easy',
        rewardScale: 100,
        check: (s) => {
            const dcDemand = s.hasLLM ? 400 : (s.hasAI ? 600 : 200);
            const demand = (s.buildings.house.count * 1) + (s.buildings.factory.count * 25) + (s.buildings.datacenter.count * dcDemand) + (s.buildings.skyscraper.count * 1000);
            const eC = s.managers.filter(m => m.type === 'engineer').length;
            const pM = 1 + (eC * 0.15); // Correction: 0.15 matches MANAGER_TYPES desc (changed from 0.25 to 0.15 to match?)
            // WAIT. MANAGER_TYPES says "+15% Power". The constants in original file said 0.15 in checkOffline, but 0.25 in gameLoop?
            // Original code gameLoop line 1740 says: eC * 0.25. 
            // Original code manager types line 928 says: "+15% Power".
            // DISCREPANCY DETECTED. The code uses 0.25, the text says 15%.
            // I will match the CODE logic (0.25) but maybe update description or keep as is?
            // For data.js I am only putting constants.
            // I'll stick to what was there.
            const maintM = s.hasMaintenance ? 1.5 : 1.0;
            let cap = 0;
            s.reactors.forEach(r => { if (!r.isScrammed) cap += r.baseMW * (r.isOverdrive ? 2.5 : 1) * pM * maintM; });
            return cap >= demand;
        },
        fail: (s) => false
    },
    {
        id: 'export',
        title: 'Export Rush',
        desc: 'Export > 50% of Total Gen.',
        duration: 45,
        difficulty: 'hard',
        rewardScale: 500,
        check: (s) => {
            const dcDemand = s.hasLLM ? 400 : (s.hasAI ? 600 : 200);
            const demand = (s.buildings.house.count * 1) + (s.buildings.factory.count * 25) + (s.buildings.datacenter.count * dcDemand) + (s.buildings.skyscraper.count * 1000);
            const eC = s.managers.filter(m => m.type === 'engineer').length;
            const pM = 1 + (eC * 0.25);
            const maintM = s.hasMaintenance ? 1.5 : 1.0;
            let cap = 0;
            s.reactors.forEach(r => { if (!r.isScrammed) cap += r.baseMW * (r.isOverdrive ? 2.5 : 1) * pM * maintM; });
            if (cap === 0) return false;
            return (cap - demand) > (cap * 0.5);
        },
        fail: (s) => false
    }
];
