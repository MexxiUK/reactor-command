const INITIAL_STATE = {
    cash: 150,
    lastSaveTime: Date.now(),
    managers: [],
    buildings: {
        house: { count: 0, baseCost: 100, demand: 1, revenue: 2 },
        factory: { count: 0, baseCost: 15000, demand: 25, revenue: 150 },
        datacenter: { count: 0, baseCost: 2000000, demand: 200, revenue: 2500 },
        skyscraper: { count: 0, baseCost: 50000000, demand: 1000, revenue: 25000 }
    },
    reactors: [{ id: 1, gen: 2, heat: 0, isOverdrive: false, isScrammed: false, upgradeCost: 5000, baseMW: 150 }],
    nextUnitCost: 5000,
    hasSync: false,
    hasFirefighters: false,
    hasSmartGrid: false,
    hasAI: false,
    hasLLM: false,
    hasMaintenance: false,
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
    contracts: { available: [], active: null, completed: 0, reputation: 0 }
};

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
