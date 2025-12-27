let state = JSON.parse(JSON.stringify(INITIAL_STATE));
let lastTick = Date.now();

// actions for updates need to be defined here since they modify state directly
// We can't put them in data.js easily w/o referencing state
function assignUpgradeActions() {
    UPGRADES.find(u => u.id === 'arch').action = buyArchitecture;
    UPGRADES.find(u => u.id === 'sync').action = () => { state.hasSync = true; };
    UPGRADES.find(u => u.id === 'fire').action = () => { state.hasFirefighters = true; };
    UPGRADES.find(u => u.id === 'grid').action = () => { state.hasSmartGrid = true; };
    UPGRADES.find(u => u.id === 'ai').action = () => { state.hasAI = true; };
    UPGRADES.find(u => u.id === 'llm').action = () => { state.hasLLM = true; };
    UPGRADES.find(u => u.id === 'maintenance').action = () => { state.hasMaintenance = true; };
}

// SAVE SYSTEM
function saveGame() {
    state.lastSaveTime = Date.now();
    localStorage.setItem('atomic-tycoon-save', JSON.stringify(state));
    console.log('Game Saved');
}

function loadGame() {
    const saved = localStorage.getItem('atomic-tycoon-save');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state = { ...INITIAL_STATE, ...parsed, buildings: { ...INITIAL_STATE.buildings, ...parsed.buildings } };
            // Deep merge buildings to ensure new types exist
            Object.keys(INITIAL_STATE.buildings).forEach(k => {
                if (!state.buildings[k]) state.buildings[k] = INITIAL_STATE.buildings[k];
            });
            if (!state.market) state.market = { ...INITIAL_STATE.market };

            // Validate Next Unit Cost for new scaling
            const rCount = state.reactors.length;
            if (rCount === 1) state.nextUnitCost = 5000;
            else if (rCount === 2) state.nextUnitCost = 500000;
            else if (rCount === 3) state.nextUnitCost = 50000000;

            checkOfflineProgress();
        } catch (e) { console.error("Save Corrupt", e); }
    }
    assignUpgradeActions();
    refreshStaticUI(); renderReactors(); renderManagers();
}

function checkOfflineProgress() {
    const now = Date.now();
    const diff = now - state.lastSaveTime;
    if (diff > 60000) { // 1 minute minimum
        const eC = state.managers.filter(m => m.type === 'engineer').length;
        const tC = state.managers.filter(m => m.type === 'tax').length;
        const pM = 1 + (eC * 0.15);
        const rM = 1 + (tC * 0.15);
        const maintM = state.hasMaintenance ? 1.5 : 1.0;

        const dcDemand = state.hasLLM ? 400 : (state.hasAI ? 600 : 200);
        const dcRevenue = state.hasAI ? 5000 : 2500;

        let totalCap = 0;
        state.reactors.forEach(r => {
            totalCap += r.baseMW * pM * maintM;
        });

        const demand = (state.buildings.house.count * 1) + (state.buildings.factory.count * 25) +
            (state.buildings.datacenter.count * dcDemand) + (state.buildings.skyscraper.count * 1000);

        const isBrownout = totalCap < demand && demand > 0;
        const eff = isBrownout ? (state.hasSmartGrid ? 0.90 : 0.70) : 1.0;

        const cityBase = (state.buildings.house.count * 2) + (state.buildings.factory.count * 150) +
            (state.buildings.datacenter.count * dcRevenue) + (state.buildings.skyscraper.count * 25000);

        const reactorUnitRev = state.reactors.reduce((acc, r) => acc + (GEN_BASE_GRANT[r.gen] || 5), 0);

        const surplus = Math.max(0, totalCap - demand);
        const exportInc = surplus * 0.10;

        const revPerSec = ((cityBase * eff) + reactorUnitRev) * rM + exportInc;

        const earned = revPerSec * (diff / 1000) * 0.50; // 50% penalty

        if (earned > 0) {
            state.cash += earned;
            document.getElementById('offline-cash').innerText = formatNum(earned);
            document.getElementById('offline-time').innerText = formatTime(diff);
            document.getElementById('offline-modal').classList.add('open');
        }
    }
}

function toggleDataModal() { document.getElementById('data-modal').classList.toggle('open'); }
function closeOfflineModal() { document.getElementById('offline-modal').classList.remove('open'); }

function exportSave() {
    const str = btoa(JSON.stringify(state));
    navigator.clipboard.writeText(str).then(() => alert("Save Copied to Clipboard!"));
}

function importSave() {
    const str = document.getElementById('import-area').value;
    try {
        const json = atob(str);
        const parsed = JSON.parse(json);
        state = parsed;
        document.getElementById('data-modal').classList.remove('open');
        saveGame();
        location.reload();
    } catch (e) { alert("Invalid Save String"); }
}

function hardReset() {
    if (confirm("Are you sure? This will wipe all progress.")) {
        window.onbeforeunload = null;
        localStorage.removeItem('atomic-tycoon-save');
        location.reload();
    }
}

function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return s + 's';
    if (s < 3600) return Math.floor(s / 60) + 'm';
    return Math.floor(s / 3600) + 'h';
}

setInterval(saveGame, 30000); // Auto save 30s
window.onbeforeunload = saveGame; // Save on exit

function getHeatFillClass(heat) {
    if (heat >= 75) return 'zone-tier-4';
    if (heat >= 50) return 'zone-tier-3';
    if (heat >= 25) return 'zone-tier-2';
    if (heat >= 1) return 'zone-tier-1';
    return 'bg-gray-700';
}

function toggleDebug() {
    state.debugOpen = !state.debugOpen;
    const panel = document.getElementById('debug-panel');
    if (panel) panel.style.display = (state.debugOpen ? 'block' : 'none');
}

function debugInstantResearch() {
    state.maxGenUnlocked = 5; state.hasSync = true; state.hasFirefighters = true; state.hasSmartGrid = true; state.hasAI = true; state.hasLLM = true; refreshStaticUI(); renderReactors();
}

function debugToggleFF() {
    state.ffMultiplier = (state.ffMultiplier === 1 ? 5 : 1);
    const ffBtn = document.getElementById('btn-ff');
    if (ffBtn) ffBtn.innerText = "FF Toggle (" + state.ffMultiplier + "x)";
}

function buyLand() {
    if (state.cash >= state.landCost) {
        state.cash -= state.landCost;
        state.districtSize += 100;
        state.landCost *= 5;
        refreshStaticUI();
    }
}

function refreshStaticUI() {
    const pC = state.managers.filter(m => m.type === 'procurement').length;
    const discount = 1 - (pC * 0.10);

    ['house', 'factory', 'datacenter', 'skyscraper'].forEach(t => {
        const b = state.buildings[t];
        const countEl = document.getElementById('count-' + t);
        const costEl = document.getElementById('cost-' + t);
        if (countEl) countEl.innerText = b.count;
        if (costEl) costEl.innerText = formatNum(Math.floor(b.baseCost * Math.pow(1.2, b.count) * discount));
    });

    const dcTitle = document.getElementById('dc-title-label');
    if (dcTitle) dcTitle.innerText = (state.hasAI ? "AI DATA CENTER" : "DATA CENTER");
    const dcDemand = state.hasLLM ? 400 : (state.hasAI ? 600 : 200);
    const dcRevenue = state.hasAI ? 5000 : 2500;
    const demandLabel = document.getElementById('dc-demand-label');
    const revLabel = document.getElementById('dc-revenue-label');
    if (demandLabel) demandLabel.innerText = dcDemand;
    if (revLabel) revLabel.innerText = formatNum(dcRevenue);

    const hC = state.buildings.house.count, fC = state.buildings.factory.count, dC = state.buildings.datacenter.count;
    const fusUnlocked = state.maxGenUnlocked >= 5;

    const btnFactory = document.getElementById('btn-factory');
    if (btnFactory) btnFactory.classList.toggle('disabled-milestone', hC < 10);

    const btnDC = document.getElementById('btn-datacenter');
    if (btnDC) btnDC.classList.toggle('disabled-milestone', fC < 20);

    const btnSky = document.getElementById('btn-skyscraper');
    const skyIsLocked = dC < 10 || !fusUnlocked;
    if (btnSky) btnSky.classList.toggle('disabled-milestone', skyIsLocked);

    const skyDescEl = document.getElementById('skyscraper-desc');
    if (skyDescEl) {
        let skyDesc = "1k MW | $25k/s • " + state.buildings.skyscraper.count + " Units";
        if (dC < 10) skyDesc = "Unlock: 10 Data Centers";
        else if (!fusUnlocked) skyDesc = "Unlock: Research FUSION";
        skyDescEl.innerText = skyDesc;
    }

    const landCostEl = document.getElementById('land-cost');
    if (landCostEl) landCostEl.innerText = formatNum(state.landCost);

    const mBtn = document.getElementById('master-ovr-btn');
    if (state.hasSync && mBtn) { mBtn.classList.remove('hidden'); setupMasterHoldEvents(); }

    renderUpgradeTray();
    const dClabel = document.getElementById('unit-cost-label-dynamic');
    if (dClabel) dClabel.innerText = '$' + formatNum(state.nextUnitCost);
}

function renderUpgradeTray() {
    const tray = document.getElementById('upgrade-tray');
    if (!tray) return;

    let sorted = [...UPGRADES];
    sorted.sort((a, b) => {
        const installedA = a.isInstalled(state);
        const installedB = b.isInstalled(state);
        if (installedA !== installedB) return (installedA ? 1 : -1);
        const canBuyA = (a.canBuy(state) && state.cash >= a.getCost(state));
        const canBuyB = (b.canBuy(state) && state.cash >= b.getCost(state));
        if (canBuyA !== canBuyB) return (canBuyA ? -1 : 1);
        return (a.getCost(state) - b.getCost(state));
    });

    tray.innerHTML = '';
    sorted.forEach(u => {
        const isInstalled = u.isInstalled(state);
        const cost = u.getCost(state);
        const isAffordable = (state.cash >= cost);
        const canBuy = u.canBuy(state);

        const el = document.createElement('div');
        let statusClass = isInstalled ? 'installed' : ((isAffordable && canBuy) ? 'affordable' : 'locked');
        el.className = "upgrade-tray-item " + statusClass;
        el.dataset.id = u.id;

        if (!isInstalled) {
            el.onclick = () => { if (state.cash >= cost && canBuy) { state.cash -= cost; u.action(); refreshStaticUI(); } };
        }

        const costFormatted = formatNum(cost);
        const nameDisplay = u.name + (isInstalled ? "" : " ($" + costFormatted + ")");
        const badgeHtml = isInstalled ? '<span class="installed-badge">System Active</span>' : '';
        const costStyle = (isAffordable && canBuy ? 'text-emerald-400' : 'text-rose-500');
        const costHtml = isInstalled ? "" : '<div class="upgrade-cost-text ' + costStyle + '">$' + costFormatted + '</div>';

        el.innerHTML = `
            ${badgeHtml}
            <div class="upgrade-title-text ${isInstalled ? 'text-blue-300' : 'text-gray-100'} uppercase">
                ${nameDisplay}
            </div>
            <div class="upgrade-desc-text ${isInstalled ? 'text-blue-500' : 'text-gray-400'}">${u.getLabel(state)}</div>
            ${costHtml}
        `;
        tray.appendChild(el);
    });
}

function setupMasterHoldEvents() {
    const btn = document.getElementById('master-ovr-btn');
    if (!btn || btn.dataset.setup) return;
    const startM = (e) => { e.preventDefault(); state.masterOverdriveActive = true; btn.classList.add('master-ovr-active'); btn.innerText = "LINKED REDLINE ACTIVE"; };
    const stopM = () => { state.masterOverdriveActive = false; btn.classList.remove('master-ovr-active'); btn.innerText = "Hold for Master Overdrive"; state.reactors.forEach(r => r.isOverdrive = false); };
    btn.onmousedown = startM; btn.onmouseup = stopM; btn.onmouseleave = stopM; btn.ontouchstart = startM; btn.ontouchend = stopM;
    btn.dataset.setup = "true";
}

function getManagerCost(count) {
    if (count === 0) return 1000;
    if (count === 1) return 25000;
    if (count === 2) return 1000000;
    if (count === 3) return 25000000;
    return 0; // Maxed
}

function addReactor() {
    if (state.reactors.length < 4 && state.cash >= state.nextUnitCost) {
        state.cash -= state.nextUnitCost;
        state.reactors.push({ id: state.reactors.length + 1, gen: 2, heat: 0, isOverdrive: false, isScrammed: false, baseMW: 150 });

        // New Cost Scaling
        if (state.reactors.length === 2) state.nextUnitCost = 500000;
        else if (state.reactors.length === 3) state.nextUnitCost = 50000000;

        renderReactors(); refreshStaticUI();
    }
}

function getUpgradeCost(gen) {
    if (gen >= 5) return 0;
    return 100000 * Math.pow(10, gen - 2);
}

function upgradeReactor(id) {
    const r = state.reactors.find(x => x.id === id);
    const cost = getUpgradeCost(r.gen);
    if (r && r.gen < state.maxGenUnlocked && state.cash >= cost) {
        state.cash -= cost;
        r.gen++;
        if (r.gen === 5) {
            r.baseMW = 5000;
        } else {
            r.baseMW *= 3.0;
        }
        renderReactors(); refreshStaticUI();
    }
}

function getCoolantCost(gen) {
    const baseGrant = GEN_BASE_GRANT[gen] || 5;
    return baseGrant * 20; // 20x Base Revenue of unit
}

function injectCoolant(id) {
    const r = state.reactors.find(x => x.id === id);
    if (!r || r.isScrammed) return;

    const cost = getCoolantCost(r.gen);
    if (state.cash >= cost) {
        state.cash -= cost;
        r.heat = Math.max(0, r.heat - 15); // -15% Heat

        // Visual Feedback
        const ui = document.querySelector('.reactor-unit[data-id="' + id + '"]');
        if (ui) {
            const btn = ui.querySelector('.u-coolant-btn');
            btn.classList.add('coolant-flash');
            setTimeout(() => btn.classList.remove('coolant-flash'), 300);

            // Floating text for heat drop
            const rect = btn.getBoundingClientRect();
            spawnFloatingText(rect.left + 50, rect.top - 20, "-15% HEAT", "text-cyan-400 text-sm");
        }
        refreshStaticUI(); // Update cash display immediately
    }
}

function renderReactors() {
    const grid = document.getElementById('reactor-grid');
    if (!grid) return;
    grid.innerHTML = '';
    state.reactors.forEach(r => {
        const clone = document.getElementById('reactor-template').content.cloneNode(true);
        const root = clone.querySelector('.reactor-unit');
        root.dataset.id = r.id;
        root.querySelector('.u-id').innerText = r.id;

        let genLabel = "GEN " + (r.gen === 2 ? "II" : r.gen === 3 ? "III" : r.gen === 4 ? "IV" : "V");
        if (r.gen === 5) {
            genLabel = "FUSION";
            root.querySelector('.u-gen').classList.add('text-cyan-400', 'border-cyan-900');
        }
        const cost = getUpgradeCost(r.gen);
        root.querySelector('.u-gen').innerText = genLabel;
        root.querySelector('.u-upgrade-cost').innerText = formatNum(cost);

        const upBtn = root.querySelector('.u-upgrade-btn');
        if (r.gen >= state.maxGenUnlocked) {
            upBtn.innerText = (r.gen === 5 ? "STABLE EQUILIBRIUM" : "RESEARCH REQ.");
            upBtn.disabled = true;
        }
        else upBtn.onclick = () => upgradeReactor(r.id);

        // Coolant Button Logic
        const coolBtn = root.querySelector('.u-coolant-btn');
        const coolCost = getCoolantCost(r.gen);
        root.querySelector('.u-coolant-cost').innerText = formatNum(coolCost);

        coolBtn.onclick = () => injectCoolant(r.id);

        // Disable if affordable OR if heat is too low (< 1%)
        const canAffordCoolant = state.cash >= coolCost;
        const hasHeat = r.heat >= 1;
        const isEnabled = canAffordCoolant && hasHeat;

        coolBtn.classList.toggle('opacity-50', !isEnabled);
        coolBtn.classList.toggle('cursor-not-allowed', !isEnabled);
        coolBtn.disabled = !isEnabled;

        const ovrBtn = root.querySelector('.u-overdrive-btn');
        const startO = (e) => { e.preventDefault(); if (!state.masterOverdriveActive) r.isOverdrive = true; };
        const stopO = () => { if (!state.masterOverdriveActive) r.isOverdrive = false; };
        ovrBtn.onmousedown = startO; ovrBtn.onmouseup = stopO; ovrBtn.onmouseleave = stopO; ovrBtn.ontouchstart = startO; ovrBtn.ontouchend = stopO;
        grid.appendChild(clone);
    });
    if (state.reactors.length < 4) { grid.appendChild(document.getElementById('buy-unit-template').content.cloneNode(true)); }
}

function buyBuilding(type) {
    const b = state.buildings[type];
    const pC = state.managers.filter(m => m.type === 'procurement').length;
    const disc = 1 - (pC * 0.10);
    const cost = Math.floor(b.baseCost * Math.pow(1.2, b.count) * disc);
    if ((type === 'factory' && state.buildings.house.count < 10) ||
        (type === 'datacenter' && state.buildings.factory.count < 20) ||
        (type === 'skyscraper' && (state.buildings.datacenter.count < 10 || state.maxGenUnlocked < 5))) return;
    if (state.cash >= cost) { state.cash -= cost; b.count++; refreshStaticUI(); }
}

function hireManager() {
    const cost = getManagerCost(state.managers.length);
    if (state.managers.length >= 4 || state.cash < cost) return;
    state.cash -= cost;
    state.managers.push({ id: Date.now(), type: 'engineer' });
    renderManagers(); refreshStaticUI();
}

function buyArchitecture() { if (state.maxGenUnlocked < 5) { state.maxGenUnlocked++; renderReactors(); refreshStaticUI(); } }

function updateManagerType(managerId, nT) {
    const m = state.managers.find(m => m.id === managerId);
    if (m) {
        m.type = nT;
        const idx = state.managers.indexOf(m);
        const bEl = document.getElementById('manager-bonus-' + idx);
        const tEl = document.getElementById('manager-tooltip-' + idx);
        if (bEl) bEl.innerText = MANAGER_TYPES[nT].bonus;
        if (tEl) tEl.innerText = MANAGER_TYPES[nT].desc;
        refreshStaticUI();
    }
}

function renderManagers() {
    const container = document.getElementById('manager-slots');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const m = state.managers[i];
        const slot = document.createElement('div');
        slot.className = "border border-gray-700 bg-gray-900/80 rounded p-2 flex flex-col justify-between h-20 transition-all";
        if (m) {
            const ct = MANAGER_TYPES[m.type];
            slot.innerHTML = `
                <div class="flex justify-between items-start">
                    <span class="text-[7px] font-bold text-gray-600 uppercase flex items-center">P-${i + 1} <div class="tooltip ml-1 cursor-help"><span class="text-[10px] text-gray-400 bg-gray-800 px-1 rounded-full border border-gray-700">?</span><span class="tooltiptext" id="manager-tooltip-${i}">${ct.desc}</span></div></span>
                    <span class="text-[7px] font-bold text-emerald-500 uppercase animate-pulse">Online</span>
                </div>
                <div class="my-1"><select class="manager-select" onchange="updateManagerType(${m.id}, this.value)">${Object.keys(MANAGER_TYPES).map(t => `<option value="${t}" ${t === m.type ? 'selected' : ''}>${MANAGER_TYPES[t].name}</option>`).join('')}</select></div>
                <div id="manager-bonus-${i}" class="text-[6px] text-gray-500 leading-tight uppercase font-bold tracking-tighter">${ct.bonus}</div>
            `;
        } else {
            const cost = getManagerCost(state.managers.length);
            slot.innerHTML = `<button onclick="hireManager()" id="hire-btn-${i}" class="w-full h-full flex flex-col items-center justify-center group transition-all"><span class="text-[9px] font-bold text-emerald-500 group-hover:text-emerald-400 uppercase">+ Hire</span><span class="text-[7px] text-gray-500 font-bold">$${formatNum(cost)}</span></button>`;
            if (state.managers.length >= 4) slot.innerHTML = `<div class="w-full h-full flex items-center justify-center"><span class="text-[8px] text-gray-800 font-bold uppercase tracking-widest">Reserved</span></div>`;
        }
        container.appendChild(slot);
    }
    const managerCountEl = document.getElementById('manager-count');
    if (managerCountEl) managerCountEl.innerText = state.managers.length;
}

function formatNum(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return Math.floor(num);
}

function renderMarketSparkline() {
    const el = document.getElementById('market-sparkline');
    if (!el) return;
    el.innerHTML = '';
    const data = state.market.trend.slice(-24);
    if (data.length === 0) return;

    const min = 0.5;
    const max = 2.0;

    data.forEach(val => {
        const bar = document.createElement('div');
        let h = ((val - min) / (max - min)) * 100;
        if (h < 5) h = 5; if (h > 100) h = 100;

        bar.style.height = h + '%';
        bar.className = "w-1 " + (val >= 1.0 ? "bg-emerald-500" : "bg-red-500");
        el.appendChild(bar);
    });
}

function generateContracts() {
    state.contracts.available = [];
    for (let i = 0; i < 3; i++) {
        const type = CONTRACT_TYPES[Math.floor(Math.random() * CONTRACT_TYPES.length)];
        const baseReward = Math.max(10000, state.income * type.rewardScale);
        state.contracts.available.push({
            uid: Date.now() + i,
            typeId: type.id,
            title: type.title,
            desc: type.desc,
            duration: type.duration,
            difficulty: type.difficulty,
            reward: Math.floor(baseReward),
            tier: i
        });
    }
    renderContractsModal();
}

function toggleContractsModal() {
    const m = document.getElementById('contracts-modal');
    if (!m.classList.contains('open')) {
        if (state.contracts.available.length === 0) generateContracts();
        renderContractsModal();
    }
    m.classList.toggle('open');
}

function renderContractsModal() {
    const list = document.getElementById('contracts-list');
    const rep = document.getElementById('corp-rep-display');
    if (rep) rep.innerText = state.contracts.reputation;
    if (!list) return;

    list.innerHTML = '';
    state.contracts.available.forEach(c => {
        const el = document.createElement('div');
        const diffColor = c.difficulty === 'easy' ? 'text-emerald-400' : (c.difficulty === 'med' ? 'text-yellow-400' : 'text-red-500');
        const borderClass = 'contract-d-' + c.difficulty;

        el.className = "contract-card " + borderClass;
        el.onclick = () => acceptContract(c.uid);
        el.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-2">
                    <span class="text-[9px] font-bold uppercase tracking-widest ${diffColor}">[${c.difficulty.toUpperCase()}]</span>
                    <span class="text-[9px] font-bold text-gray-500">${c.duration}s</span>
                </div>
                <h3 class="text-sm font-bold text-gray-200 uppercase mb-1">${c.title}</h3>
                <p class="text-[10px] text-gray-400 leading-tight">${c.desc}</p>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-700 flex justify-between items-end">
                <div class="text-[8px] uppercase text-gray-500 font-bold">Payout</div>
                <div class="text-lg font-bold text-emerald-400">$${formatNum(c.reward)}</div>
            </div>
        `;
        list.appendChild(el);
    });
}

function acceptContract(uid) {
    const c = state.contracts.available.find(x => x.uid === uid);
    if (c) {
        state.contracts.active = {
            ...c,
            timeLeft: c.duration,
            progress: 0
        };
        state.contracts.available = [];
        toggleContractsModal();
        updateContractHUD();
    }
}

function updateContractHUD() {
    const hud = document.getElementById('contract-hud');
    const c = state.contracts.active;
    if (!c) {
        hud.classList.add('hidden');
        return;
    }
    hud.classList.remove('hidden');

    document.getElementById('contract-title').innerText = c.title;
    document.getElementById('contract-timer').innerText = c.timeLeft.toFixed(1) + 's';
    document.getElementById('contract-desc-hud').innerText = c.desc;
}

function spawnFloatingText(x, y, text, colorClass) {
    const el = document.createElement('div');
    el.className = `floating-text ${colorClass} text-2xl`;
    el.innerText = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

function completeContract(success) {
    const c = state.contracts.active;
    state.contracts.active = null;
    updateContractHUD();

    const cashEl = document.getElementById('cash-display');
    const rect = cashEl ? cashEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2 };

    if (success) {
        state.cash += c.reward;
        state.contracts.completed++;
        state.contracts.reputation += (c.difficulty === 'hard' ? 5 : 1);

        spawnFloatingText(rect.left + 20, rect.top, "+$" + formatNum(c.reward), "text-emerald-400");
        spawnFloatingText(rect.left + 20, rect.top + 30, "CONTRACT COMPLETE", "text-yellow-400 text-sm");
    } else {
        spawnFloatingText(rect.left, rect.top, "CONTRACT FAILED", "text-red-500");
    }
    refreshStaticUI();
}

function gameLoop() {
    const now = Date.now();
    const dt = ((now - lastTick) / 1000) * state.ffMultiplier;
    lastTick = now;

    if (!state.contracts) state.contracts = { available: [], active: null, completed: 0, reputation: 0 };
    state.income = state.lastIncome || 100;

    // CONTRACT LOGIC
    if (state.contracts.active) {
        const c = state.contracts.active;
        const def = CONTRACT_TYPES.find(x => x.id === c.typeId);
        const passed = def.check(state);

        if (c.typeId === 'stability') {
            if (!passed) { completeContract(false); return requestAnimationFrame(gameLoop); }
        } else {
            if (!passed) c.failTimer = (c.failTimer || 0) + dt;
            else c.failTimer = 0;
            if (c.failTimer > 2.0) { } // Placeholder for grace period logic
        }

        if (!c.timeSatisfied) c.timeSatisfied = 0;

        if (passed) {
            c.timeSatisfied += dt;
            document.getElementById('contract-status-text').innerHTML = '<span class="text-emerald-500">CONDITION MET</span>';
            document.getElementById('contract-progress-bar').className = 'bg-emerald-500 h-full transition-all duration-300';
        } else {
            document.getElementById('contract-status-text').innerHTML = '<span class="text-red-500">CONDITION FAILED</span>';
            document.getElementById('contract-progress-bar').className = 'bg-red-500 h-full transition-all duration-300';
            if (c.typeId === 'stability') { completeContract(false); return requestAnimationFrame(gameLoop); }
        }

        const pct = (c.timeSatisfied / c.duration) * 100;
        document.getElementById('contract-progress-bar').style.width = pct + '%';
        document.getElementById('contract-timer').innerText = (c.duration - c.timeSatisfied).toFixed(1) + 's';

        if (c.timeSatisfied >= c.duration) {
            completeContract(true);
            return requestAnimationFrame(gameLoop);
        }
    }

    // MARKET LOGIC
    if (!state.market) state.market = { basePrice: 0.10, multiplier: 1.0, trend: [], phase: 0, state: 'STABLE', news: 'Market Stable.', timer: 0 };

    if (!state.market.timer) state.market.timer = 0;
    state.market.timer -= dt;
    if (state.market.timer <= 0) {
        const r = Math.random();
        let duration = 30 + Math.random() * 60;

        if (r < 0.6) {
            state.market.state = 'STABLE';
            state.market.news = "Market Stable. Grid demand normal.";
        } else if (r < 0.75) {
            state.market.state = 'BULL';
            state.market.news = "NEWS: Heatwave predicted! Grid demand SURGING.";
            duration = 45;
        } else if (r < 0.90) {
            state.market.state = 'BEAR';
            state.market.news = "NEWS: Mild weather across region. Consumption LOW.";
            duration = 45;
        } else {
            state.market.state = 'HIGH_VOLATILITY';
            state.market.news = "NEWS: Grid instability detected. Prices ERRATIC.";
            duration = 20;
        }
        state.market.timer = duration;
    }

    state.market.phase += dt * 0.5;
    let target = 1.0;

    if (state.market.state === 'STABLE') {
        target = 1.0 + Math.sin(state.market.phase) * 0.2;
    } else if (state.market.state === 'BULL') {
        target = 1.8 + Math.sin(state.market.phase * 2) * 0.4;
    } else if (state.market.state === 'BEAR') {
        target = 0.4 + Math.sin(state.market.phase * 0.5) * 0.1;
    } else if (state.market.state === 'HIGH_VOLATILITY') {
        state.market.phase += dt * 4;
        target = 1.0 + Math.sin(state.market.phase) * 1.5;
    }

    state.market.multiplier += (target - state.market.multiplier) * dt * (state.market.state === 'HIGH_VOLATILITY' ? 2.0 : 0.5);

    if (state.market.multiplier < 0.05) state.market.multiplier = 0.05;
    if (state.market.multiplier > 3.0) state.market.multiplier = 3.0;

    if (!state.market.lastTrendUpdate) state.market.lastTrendUpdate = 0;
    if (now - state.market.lastTrendUpdate > 1000) {
        state.market.trend.push(state.market.multiplier);
        if (state.market.trend.length > 24) state.market.trend.shift();
        state.market.lastTrendUpdate = now;
        renderMarketSparkline();
    }

    let powerAvail = 0, unitRevTotal = 0;
    const eC = state.managers.filter(m => m.type === 'engineer').length, sC = state.managers.filter(m => m.type === 'safety').length, tC = state.managers.filter(m => m.type === 'tax').length;
    const pM = 1 + (eC * 0.25), hM = 1 - (sC * 0.30), rM = 1 + (tC * 0.25);
    const maintM = state.hasMaintenance ? 1.5 : 1.0;

    if (state.masterOverdriveActive) state.reactors.forEach(r => { if (!r.isScrammed) r.isOverdrive = true; });

    let cascade = false;
    state.reactors.forEach(r => {
        const ui = document.querySelector('.reactor-unit[data-id="' + r.id + '"]');
        if (!ui) return;
        const stab = GEN_STABILITY[r.gen] || 1.0;
        if (r.isScrammed) {
            const rR = state.hasFirefighters ? 15 : 12;
            r.heat -= dt * rR; if (r.heat <= 0) { r.heat = 0; r.isScrammed = false; }
            ui.classList.add('scram-active');
        } else {
            ui.classList.remove('scram-active');
            if (r.isOverdrive) {
                r.heat += dt * 16 * (1 + (r.heat / 40)) * hM * stab;
                if (r.heat >= 100) { r.heat = 100; r.isScrammed = true; r.isOverdrive = false; if (state.masterOverdriveActive) cascade = true; }
            } else r.heat = Math.max(0, r.heat - dt * 5);
            ui.classList.toggle('shake-light', r.heat > 50 && r.heat <= 75); ui.classList.toggle('shake-heavy', r.heat > 75);
        }

        const tierIdx = (r.heat < 25 ? 0 : r.heat < 50 ? 1 : r.heat < 75 ? 2 : 3);
        const bonusMW = (GEN_POWER_BONUS[r.gen] || [0, 0, 0, 0])[tierIdx];

        const o = (r.isScrammed ? 0 : r.baseMW + bonusMW) * pM * maintM;
        powerAvail += o;

        const zm = r.isScrammed ? 0 : (r.heat < 1 ? 1 : GEN_TIER_MULTIPLIERS[r.gen][tierIdx]);
        const unitRev = (GEN_BASE_GRANT[r.gen] || 5) * zm;
        unitRevTotal += unitRev;
        ui.querySelector('.u-temp-val').innerText = Math.floor(r.heat) + '%'; ui.querySelector('.u-multiplier-val').innerText = zm.toFixed(2) + 'x';
        const f = ui.querySelector('.u-heat-fill'); f.style.width = r.heat + '%';
        f.className = 'heat-bar-fill u-heat-fill ' + getHeatFillClass(r.heat);
        ui.querySelector('.u-power').innerText = Math.floor(o); ui.querySelector('.u-rev').innerText = formatNum(unitRev);
        ui.querySelector('.u-scram-overlay').classList.toggle('hidden', !r.isScrammed);

        // Dynamic update of Coolant Button state
        const coolBtn = ui.querySelector('.u-coolant-btn');
        if (coolBtn) {
            const coolCost = getCoolantCost(r.gen);
            const canAfford = state.cash >= coolCost;
            const hasHeat = r.heat >= 1;
            const isEnabled = canAfford && hasHeat;

            coolBtn.disabled = !isEnabled;
            coolBtn.classList.toggle('opacity-50', !isEnabled);
            coolBtn.classList.toggle('cursor-not-allowed', !isEnabled);
        }
    });

    if (cascade) {
        state.masterOverdriveActive = false; const mB = document.getElementById('master-ovr-btn');
        if (mB) { mB.classList.remove('master-ovr-active'); mB.innerText = "Hold for Master Overdrive"; }
        state.reactors.forEach(r => { r.isScrammed = true; r.isOverdrive = false; r.heat = 100; });
    }

    const dcDemand = state.hasLLM ? 400 : (state.hasAI ? 600 : 200);
    const dcRevenue = state.hasAI ? 5000 : 2500;
    const demand = (state.buildings.house.count * 1) + (state.buildings.factory.count * 25) + (state.buildings.datacenter.count * dcDemand) + (state.buildings.skyscraper.count * 1000);
    const isBrownout = powerAvail < demand && demand > 0, eff = isBrownout ? (state.hasSmartGrid ? 0.90 : 0.70) : 1.00;

    let wm = 0;
    if (powerAvail > 0) state.reactors.forEach(r => {
        if (!r.isScrammed) {
            const tierIdx = (r.heat < 25 ? 0 : r.heat < 50 ? 1 : r.heat < 75 ? 2 : 3);
            const bonusMW = (GEN_POWER_BONUS[r.gen] || [0, 0, 0, 0])[tierIdx];
            const s = ((r.baseMW + bonusMW) * pM * maintM) / powerAvail;

            wm += (r.heat < 1 ? 1 : GEN_TIER_MULTIPLIERS[r.gen][tierIdx]) * s;
        }
    });

    const cityBase = (state.buildings.house.count * 2) + (state.buildings.factory.count * 150) + (state.buildings.datacenter.count * dcRevenue) + (state.buildings.skyscraper.count * 25000);
    const surplus = Math.max(0, powerAvail - demand);
    const currentPrice = state.market.basePrice * state.market.multiplier;
    const exportInc = surplus * currentPrice;
    const finalInc = (cityBase * eff * wm * rM) + (unitRevTotal * rM) + exportInc;
    state.cash += (finalInc * dt);

    const cashDisplay = document.getElementById('cash-display');
    const incomeDisplay = document.getElementById('income-display');
    const exportDisplay = document.getElementById('export-display');
    const powerTotal = document.getElementById('power-total');
    const powerUsed = document.getElementById('power-used');
    if (cashDisplay) cashDisplay.innerText = formatNum(state.cash);
    if (incomeDisplay) incomeDisplay.innerText = formatNum(finalInc);
    if (exportDisplay) {
        exportDisplay.innerText = formatNum(exportInc);
        exportDisplay.className = (state.market.multiplier > 1.2 ? "text-emerald-400" : (state.market.multiplier < 0.8 ? "text-red-400" : "text-orange-400"));
    }
    if (powerTotal) powerTotal.innerText = Math.floor(powerAvail);
    if (powerUsed) powerUsed.innerText = Math.floor(demand);

    const priceEl = document.getElementById('market-price');
    const arrowEl = document.getElementById('market-trend-arrow');
    if (priceEl) {
        priceEl.innerText = '$' + currentPrice.toFixed(2);
        priceEl.className = "font-bold " + (state.market.multiplier > 1.0 ? "text-emerald-400" : "text-red-400");
    }
    if (arrowEl) {
        const prev = state.market.trend[state.market.trend.length - 2] || 1.0;
        const isUp = state.market.multiplier > prev;
        arrowEl.innerHTML = isUp ? "▲" : "▼";
        arrowEl.className = "text-xl font-bold " + (isUp ? "text-emerald-500" : "text-red-500");
    }

    const newsEl = document.getElementById('market-news');
    if (newsEl && state.market.news) {
        newsEl.innerText = state.market.news;
        newsEl.className = "text-[8px] font-bold uppercase tracking-widest inline-block animate-marquee pl-48 " +
            (state.market.state === 'BULL' ? "text-emerald-400" :
                state.market.state === 'BEAR' ? "text-red-400" :
                    state.market.state === 'HIGH_VOLATILITY' ? "text-orange-400" : "text-gray-500");
    }

    const effTag = document.getElementById('efficiency-tag');
    if (effTag) {
        effTag.innerText = "Efficiency: " + Math.round(eff * 100) + "%";
        effTag.className = "text-[9px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 " + (isBrownout ? 'text-red-500 bg-red-950/30' : 'text-emerald-500 bg-emerald-950/30');
    }

    const sI = document.getElementById('stability-indicator');
    if (sI) {
        sI.innerText = (isBrownout ? "BROWNOUT DETECTED" : "Grid Stable");
        sI.className = "text-[10px] uppercase font-bold tracking-widest " + (isBrownout ? 'text-red-500 animate-pulse' : 'text-emerald-500');
    }

    if (Math.abs(state.cash - state.lastTickCash) > (state.cash * 0.05) || state.cash < 500) {
        renderUpgradeTray();
        state.lastTickCash = state.cash;
    }

    const trayItems = document.querySelectorAll('.upgrade-tray-item');
    trayItems.forEach(el => {
        const u = UPGRADES.find(x => x.id === el.dataset.id);
        if (u && !u.isInstalled(state)) {
            const isAff = (state.cash >= u.getCost(state));
            const canB = u.canBuy(state);
            el.classList.toggle('affordable', isAff && canB);
            el.classList.toggle('locked', !isAff || !canB);
        }
    });

    const gridDiv = document.getElementById('city-visual-grid');
    if (gridDiv) {
        const totalD = state.buildings.house.count + state.buildings.factory.count + state.buildings.datacenter.count + state.buildings.skyscraper.count;
        if (gridDiv.children.length !== Math.min(state.districtSize, totalD)) {
            gridDiv.innerHTML = '';
            let d = 0;
            const types = [
                { c: state.buildings.skyscraper.count, cl: 'bg-cyan-400 shadow-[0_0_8px_cyan]' },
                { c: state.buildings.datacenter.count, cl: 'bg-purple-500 shadow-[0_0_5px_purple]' },
                { c: state.buildings.factory.count, cl: 'bg-blue-500 shadow-[0_0_5px_blue]' },
                { c: state.buildings.house.count, cl: 'bg-emerald-500 shadow-[0_0_5px_emerald]' }
            ];
            types.forEach(type => { for (let i = 0; i < type.c && d < state.districtSize; i++) { const el = document.createElement('div'); el.className = "city-grid-item " + type.cl; gridDiv.appendChild(el); d++; } });
        }
        gridDiv.querySelectorAll('.city-grid-item').forEach(item => item.classList.toggle('city-grid-dim', isBrownout));
        gridDiv.classList.toggle('brownout-flicker', isBrownout);
    }

    const btnBuyLand = document.getElementById('btn-buy-land');
    if (btnBuyLand) btnBuyLand.classList.toggle('not-affordable', state.cash < state.landCost);

    requestAnimationFrame(gameLoop);
}

loadGame();
renderReactors(); renderManagers(); refreshStaticUI(); requestAnimationFrame(gameLoop);
