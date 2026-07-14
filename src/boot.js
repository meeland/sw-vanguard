import { Network, NETWORK_EVENTS } from './network.js';
import { HexMap } from './hexgrid.js';
import { ABILITIES, WEAPONS, UNIT_STATS, UPGRADES, STATUS_EFFECTS_DICT } from './ships.js';

const MAX_ARMY_SIZE = 16;
const MAP_ICONS = {};
Object.values(UNIT_STATS).forEach(s => { const img = new Image(); img.src = s.icon; MAP_ICONS[s.icon] = img; });

const gameState = {
    phase: 'LOBBY', activePlayer: 'host', turnCount: 1, ready: { me: false, enemy: false }, mySide: null,
    map: null, units: [], unitsToPlace: [], 
    
    selectedUpgrades: [], 
    currentUpgradeTab: 'technology',

    activeUnitId: null, selectedUnitOnMap: null, editingUnitId: null, currentFactionTab: 'standard',
    moveMode: false, weaponMode: null, abilityMode: null, hoveredHex: null, hoveredUnitId: null, attackHovered: false,
    currentAttackableHexes: [], blockedAttackableHexes: [], camera: { x: 100, y: 100, isDragging: false, startX: 0, startY: 0 }
};

const network = new Network();
const ui = {
    lobby: document.getElementById('lobby-screen'), game: document.getElementById('game-screen'),
    draftScreen: document.getElementById('draft-screen'), draftRoster: document.getElementById('draft-roster'),
    draftArmy: document.getElementById('draft-army'), draftCount: document.getElementById('draft-count'),
    btnDraftReady: document.getElementById('btn-draft-ready'), 
    upgradesList: document.getElementById('upgrades-list'),
    
    infoModal: document.getElementById('unit-info-modal'), infoTitle: document.getElementById('info-title'), 
    infoHp: document.getElementById('info-hp'), infoShield: document.getElementById('info-shield'), 
    infoSpd: document.getElementById('info-spd'), infoTonnage: document.getElementById('info-tonnage'),
    infoWeapons: document.getElementById('info-weapons'), infoAbilities: document.getElementById('info-abilities'),
    btnInfoClose: document.getElementById('btn-info-close'), btnInfoDelete: document.getElementById('btn-info-delete'), 

    canvas: document.getElementById('game-canvas'), canvasContainer: document.getElementById('canvas-container'), 
    unitsList: document.getElementById('units-list'), actionPanel: document.getElementById('action-panel'), 
    lblPhase: document.getElementById('hud-phase'), lblTurn: document.getElementById('hud-turn'), 
    lblTurnCount: document.getElementById('hud-turn-count'), btnEndTurn: document.getElementById('btn-end-turn'), 
    hostBtn: document.getElementById('btn-host-start'), hostOfferOut: document.getElementById('host-offer-output'), 
    hostStatus: document.getElementById('host-status'), clientJoinBtn: document.getElementById('btn-client-join'), 
    clientOfferIn: document.getElementById('client-offer-input'), clientAnswerOut: document.getElementById('client-answer-output'), 
    clientStatus: document.getElementById('client-status'), hostFinishBtn: document.getElementById('btn-host-finish'), 
    hostAnswerIn: document.getElementById('host-answer-input'), legendHeader: document.getElementById('legend-header'), 
    btnLegend: document.getElementById('btn-toggle-legend'), pnlLegend: document.getElementById('legend-panel'), 
    hostControls: document.getElementById('host-controls'), btnRestart: document.getElementById('btn-restart'), 
    restartModal: document.getElementById('restart-modal'), btnRestartConfirm: document.getElementById('btn-restart-confirm'), 
    btnRestartCancel: document.getElementById('btn-restart-cancel'), tooltip: document.getElementById('ability-tooltip'), 
    ttIcon: document.getElementById('tt-icon'), ttName: document.getElementById('tt-name'), 
    ttType: document.getElementById('tt-type'), ttDesc: document.getElementById('tt-desc'), 
    ttCdBox: document.getElementById('tt-cd-box'), ttCd: document.getElementById('tt-cd'), 
    ttDamageBox: document.getElementById('tt-damage-box'), ttDamage: document.getElementById('tt-damage'), 
    ttRangeBox: document.getElementById('tt-range-box'), ttRange: document.getElementById('tt-range'), 
    ttChargesBox: document.getElementById('tt-charges-box'), ttCharges: document.getElementById('tt-charges'), 
    statusTooltip: document.getElementById('status-tooltip'), stDesc: document.getElementById('st-desc'), 
    stDuration: document.getElementById('st-duration')
};
const ctx = ui.canvas.getContext('2d');

// ==========================================
// СЕТЕВЫЕ СОБЫТИЯ
// ==========================================

ui.hostBtn.onclick = async () => { ui.hostStatus.innerHTML="Генерация<span class='loading-dots'></span>"; ui.hostStatus.className="status-text status-process"; try { const o=await network.createOffer(); ui.hostOfferOut.value=o; ui.hostAnswerIn.disabled=false; ui.hostFinishBtn.disabled=false; gameState.mySide='host'; ui.hostStatus.textContent="Оффер готов."; ui.hostStatus.className="status-text status-done"; } catch(e){ ui.hostStatus.textContent="Ошибка."; } };
ui.clientJoinBtn.onclick = async () => { const o=ui.clientOfferIn.value.trim(); if(!o)return; ui.clientStatus.innerHTML="Подключение<span class='loading-dots'></span>"; ui.clientStatus.className="status-text status-process"; try { const a=await network.joinGame(o); ui.clientAnswerOut.value=a; gameState.mySide='guest'; ui.clientStatus.textContent="Ответ готов."; ui.clientStatus.className="status-text status-done"; } catch(e){ ui.clientStatus.textContent="Ошибка."; } };
ui.hostFinishBtn.onclick = () => { const v=ui.hostAnswerIn.value.trim(); if(v)network.finalizeHandshake(v); };
document.getElementById('btn-copy-offer').onclick = () => { document.getElementById('host-offer-output').select(); navigator.clipboard.writeText(document.getElementById('host-offer-output').value); };
document.getElementById('btn-copy-answer').onclick = () => { document.getElementById('client-answer-output').select(); navigator.clipboard.writeText(document.getElementById('client-answer-output').value); };

network.on(NETWORK_EVENTS.CONNECTED, () => initDraftScene()); 
network.on(NETWORK_EVENTS.DATA, (msg) => {
    if (msg.type === 'RESTART_GAME') { performGameRestart(); }
    else if (msg.type === 'SYNC_MAP') { msg.payload.forEach(d => { const h=gameState.map.getHex(d.q,d.r); if(h)h.terrain=d.t; }); }
    else if (msg.type === 'PLACE_UNIT') { const u={...msg.payload, owner:(gameState.mySide==='host'?'guest':'host')}; gameState.units.push(u); const h=gameState.map.getHex(u.q,u.r); if(h)h.unitId=u.id; updateUnitMaxAP(u); }
    else if (msg.type === 'PLAYER_READY') { 
        gameState.ready.enemy = true; 
        if (gameState.phase === 'DRAFT') checkStartSetup();
        else if (gameState.phase === 'SETUP') checkStartCombat();
    }
    else if (msg.type === 'END_TURN') { 
        gameState.activePlayer = (gameState.activePlayer==='host'?'guest':'host'); 
        updateHud(); 
    }
    else if (msg.type === 'SYNC_COMBAT_STATE') {
        gameState.units = msg.payload.units;
        gameState.map.getAllHexes().forEach(h => h.unitId = null);
        gameState.units.forEach(u => { if (!u.isDead) { const h = gameState.map.getHex(u.q, u.r); if (h) h.unitId = u.id; } });
        gameState.activePlayer = msg.payload.activePlayer; gameState.turnCount = msg.payload.turnCount;
        gameState.selectedUnitOnMap = null; gameState.activeUnitId = null;
        gameState.currentAttackableHexes = []; gameState.blockedAttackableHexes = [];
        gameState.moveMode = false; gameState.weaponMode = null; gameState.abilityMode = null;
        ui.actionPanel.classList.add('hidden'); updateHud(); renderUnitsPanel();
    }
	else if (msg.type === 'UNIT_UPDATE') {
        const u = gameState.units.find(un => un.id === msg.payload.id);
        if (u) {
            const oldHp = u.currentHp; const oldShield = u.currentShield;
            const oh = gameState.map.getHex(u.q, u.r); if(oh && oh.unitId===u.id) oh.unitId=null;
            Object.assign(u, msg.payload); updateUnitMaxAP(u); 
            if (u.currentHp < oldHp || u.currentShield < oldShield) u.shakeUntil = Date.now() + 300; 
            if (!u.isDead) { const nh = gameState.map.getHex(u.q, u.r); if(nh) nh.unitId=u.id; }
            renderUnitsPanel();
        }
    }
	else if (msg.type === 'BATTLE_LOG') { 
        const a = gameState.units.find(u => u.id === msg.payload.attackerId);
        const d = gameState.units.find(u => u.id === msg.payload.defenderId);
        if (a && d) addBattleLog(msg.payload.turn, a, d, msg.payload.damage, msg.payload.weaponName, msg.payload.isDead, msg.payload.isAbility);
    }
});

function performGameRestart() {
    gameState.phase = 'DRAFT'; gameState.turnCount = 1; gameState.activePlayer = 'host';
    gameState.units = []; gameState.unitsToPlace = []; gameState.ready = { me: false, enemy: false };
    gameState.selectedUnitOnMap = null; gameState.activeUnitId = null; gameState.selectedUpgrades = [];
    gameState.currentAttackableHexes = []; gameState.blockedAttackableHexes = []; gameState.weaponMode = null; gameState.abilityMode = null;
    if (gameState.map) gameState.map.getAllHexes().forEach(h => h.unitId = null);
    if (document.getElementById('battle-log')) document.getElementById('battle-log').innerHTML = '';
    ui.actionPanel.classList.add('hidden'); ui.game.classList.add('hidden'); ui.draftScreen.classList.remove('hidden');
    ui.btnDraftReady.innerText = "ГОТОВ К БИТВЕ"; ui.btnDraftReady.disabled = false;
    renderDraft();
}

// ==========================================
// ДРАФТ И УЛУЧШЕНИЯ
// ==========================================

function initDraftScene() {
    ui.lobby.classList.add('hidden'); ui.draftScreen.classList.remove('hidden'); gameState.phase = 'DRAFT';
    gameState.map = new HexMap(13, 13, 35);
    if (gameState.mySide === 'host') network.send('SYNC_MAP', gameState.map.getAllHexes().map(h => ({q:h.q, r:h.r, t:h.terrain})));
    
    document.querySelectorAll('.faction-tab').forEach(tab => { tab.onclick = () => { gameState.currentFactionTab = tab.dataset.faction; renderDraft(); }; });
    
    document.querySelectorAll('.upg-tab-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('.upg-tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            gameState.currentUpgradeTab = e.target.dataset.type;
            renderUpgrades();
        };
    });

    renderDraft();

    ui.btnDraftReady.onclick = () => {
        if (gameState.unitsToPlace.length === 0) return alert("Выберите хотя бы один корабль!");
        ui.infoModal.classList.add('hidden'); ui.btnDraftReady.disabled = true; ui.btnDraftReady.innerText = "Ожидание оппонента...";
        gameState.ready.me = true; network.send('PLAYER_READY', {}); checkStartSetup();
    };
    
    ui.btnInfoClose.onclick = () => ui.infoModal.classList.add('hidden');
    ui.btnInfoDelete.onclick = () => { 
        if (gameState.editingUnitId) {
            gameState.unitsToPlace = gameState.unitsToPlace.filter(u => u.id !== gameState.editingUnitId); 
            ui.infoModal.classList.add('hidden'); renderDraft(); 
        }
    };
}

function renderUpgrades() {
    ui.upgradesList.innerHTML = '';
    Object.values(UPGRADES).forEach(upg => {
        if (upg.type !== gameState.currentUpgradeTab) return;

        const card = document.createElement('div');
        card.className = 'upgrade-card';
        if (gameState.selectedUpgrades.includes(upg.id)) card.classList.add('selected');
        
        card.innerHTML = `
            <img class="upgrade-icon" src="${upg.icon}">
            <div class="upgrade-info">
                <div class="upgrade-name">${upg.name}</div>
                <div class="upgrade-desc">${upg.desc}</div>
            </div>
        `;
        
        card.onclick = () => {
            const index = gameState.selectedUpgrades.indexOf(upg.id);
            if (index > -1) {
                gameState.selectedUpgrades.splice(index, 1);
            } else {
                gameState.selectedUpgrades.push(upg.id);
            }
            renderUpgrades(); 
        };
        ui.upgradesList.appendChild(card);
    });
}

function openUnitInfo(typeKey, unitId = null) {
    gameState.editingUnitId = unitId; 
    const stats = UNIT_STATS[typeKey];
    ui.infoTitle.innerText = stats.name;
    ui.infoHp.innerText = stats.maxHp; 
    
    // Предрасчет статов с учетом улучшений для визуализации в окне
    let finalShield = stats.maxShield;
    let finalSpeed = stats.speed;

    if (gameState.selectedUpgrades.includes('defense_protocols')) { finalShield = Math.floor(finalShield * 1.15); }
    if (gameState.selectedUpgrades.includes('force_engines') && stats.tonnage === 'S') { finalSpeed += 1; }

    ui.infoShield.innerText = finalShield; 
    ui.infoSpd.innerText = finalSpeed;
    ui.infoTonnage.innerText = stats.tonnage;

    ui.infoWeapons.innerHTML = '';
    if (stats.weapons) {
        stats.weapons.forEach(wKey => {
            let wDef = { ...WEAPONS[wKey] };
            if (gameState.selectedUpgrades.includes('artillery_traditions')) wDef.damage = Math.floor(wDef.damage * 1.1);
            if (gameState.selectedUpgrades.includes('sniper_training')) wDef.range += 1;

            const img = document.createElement('img');
            img.src = wDef.icon; 
            bindTooltip(img, wDef, true); // Используем боевой тултип!
            ui.infoWeapons.appendChild(img);
        });
    }

    ui.infoAbilities.innerHTML = '';
    if (stats.abilities) {
        stats.abilities.forEach(aKey => {
            const a = ABILITIES[aKey]; const img = document.createElement('img');
            img.src = a.icon; 
            bindTooltip(img, a, false); // Используем боевой тултип!
            ui.infoAbilities.appendChild(img);
        });
    }

    ui.btnInfoDelete.style.display = unitId ? 'block' : 'none';
    ui.infoModal.classList.remove('hidden');
}

function renderDraft() {
    renderUpgrades();
    ui.draftRoster.innerHTML = ''; ui.draftArmy.innerHTML = '';
    ui.draftCount.innerText = `Выбранный флот: ${gameState.unitsToPlace.length} / ${MAX_ARMY_SIZE}`;

    document.querySelectorAll('.faction-tab').forEach(btn => { btn.classList.toggle('active', btn.dataset.faction === gameState.currentFactionTab); });

    Object.keys(UNIT_STATS).filter(k => UNIT_STATS[k].faction === gameState.currentFactionTab).forEach(key => {
        const card = createDraftCardHTML(key, false);
        card.onclick = () => {
            if (gameState.unitsToPlace.length < MAX_ARMY_SIZE) {
                gameState.unitsToPlace.push({ id: `u_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, type: key, hasPlaced: false });
                renderDraft(); setTimeout(() => ui.draftArmy.scrollLeft = ui.draftArmy.scrollWidth, 50);
            }
        };
        card.oncontextmenu = (e) => { e.preventDefault(); openUnitInfo(key, null); };
        ui.draftRoster.appendChild(card);
    });

    gameState.unitsToPlace.forEach((u) => {
        const card = createDraftCardHTML(u.type, true);
        if (gameState.editingUnitId === u.id) card.classList.add('selected'); 
        card.onclick = () => openUnitInfo(u.type, u.id);
        ui.draftArmy.appendChild(card);
    });
}

function createDraftCardHTML(typeKey, isArmy) {
    const s = UNIT_STATS[typeKey];
    const card = document.createElement('div'); card.className = `unit-card`; 

    let apBlocksHtml = '<div class="card-ap-container">';
    for (let b = 0; b < s.speed; b++) apBlocksHtml += `<div class="ap-block"></div>`;
    apBlocksHtml += '</div>';

    card.innerHTML = `
        <div class="card-bars-container">
            <div class="card-shield-bar"><div class="card-shield-fill" style="width:100%;"></div><div class="card-shield-text"><span>${s.maxShield}</span><span class="regen-text">+${s.shieldRegen}</span></div></div>
            <div class="card-hp-bar"><div class="card-hp-fill" style="width:100%;"></div><div class="card-hp-text">${s.maxHp}</div></div>
        </div>
        <div class="card-image-container" style="background-image: url('${s.img}');">
            ${!isArmy ? `<div class="card-name-block">${s.name}</div>` : ''}
            ${apBlocksHtml}
        </div>
    `;
    return card;
}

// ==========================================
// ИГРА И ЛОГИКА
// ==========================================

function checkStartSetup() { if (gameState.ready.me && gameState.ready.enemy && gameState.phase === 'DRAFT') { gameState.phase = 'SETUP'; gameState.ready.me = false; gameState.ready.enemy = false; initGameScene(); } }

function initGameScene() {
    ui.draftScreen.classList.add('hidden'); ui.game.classList.remove('hidden');
    window.addEventListener('resize', () => { ui.canvas.width = ui.canvasContainer.clientWidth; ui.canvas.height = ui.canvasContainer.clientHeight; }); 
    window.dispatchEvent(new Event('resize'));
    
    if (gameState.mySide === 'host') ui.hostControls.classList.remove('hidden');
    
    if (ui.btnRestart) ui.btnRestart.onclick = () => ui.restartModal.classList.remove('hidden');
    if (ui.btnRestartCancel) ui.btnRestartCancel.onclick = () => ui.restartModal.classList.add('hidden');
    if (ui.btnRestartConfirm) { 
        ui.btnRestartConfirm.onclick = () => { ui.restartModal.classList.add('hidden'); network.send('RESTART_GAME', {}); performGameRestart(); }; 
    }

    if (ui.legendHeader && ui.pnlLegend) {
        ui.legendHeader.onclick = () => { 
            ui.pnlLegend.classList.toggle('hidden-panel'); 
            const isHidden = ui.pnlLegend.classList.contains('hidden-panel');
            ui.btnLegend.innerText = isHidden ? '◀' : '▼'; 
            
            const legendBox = document.getElementById('legend-box');
            if (isHidden) legendBox.classList.add('legend-expanded-padding');
            else legendBox.classList.remove('legend-expanded-padding');
        };
    }

    renderUnitsPanel(); updateHud();
    
    ui.btnEndTurn.onclick = () => { 
        if (gameState.phase === 'SETUP') { 
            if (gameState.unitsToPlace.some(u => !u.hasPlaced)) return alert("Вы должны разместить все корабли на карте!"); 
            ui.btnEndTurn.disabled = true; ui.btnEndTurn.innerText = "ОЖИДАНИЕ..."; 
            gameState.ready.me = true; network.send('PLAYER_READY', {}); checkStartCombat(); 
        } else if (gameState.phase === 'COMBAT') {
            if (gameState.activePlayer === gameState.mySide) {
                const playerMadeAction = gameState.units.some(u => 
                    u.owner === gameState.mySide && !u.isDead && !u.hasActedThisTurn && 
                    (u.currentAP < u.maxAP || u.weapons.some(w => w.used) || u.abilityUsed)
                );
                if (!playerMadeAction) return alert("Вы должны совершить хотя бы одно действие перед завершением хода!");
            }
            endTurn(); 
        } 
    };
    requestAnimationFrame(gameLoop);
}

function handleSetupPlacement(hex) {
    const isMyZone = (gameState.mySide==='host' && hex.col<4) || (gameState.mySide==='guest' && hex.col>=9);
    const targetHex = gameState.map.getHex(hex.q, hex.r);
    if (!isMyZone || hex.unitId || !targetHex || targetHex.terrain.id === 'asteroid') return;
    
    const c = gameState.unitsToPlace.find(i=>i.id===gameState.selectedCardId); const s = UNIT_STATS[c.type];
    
    let finalMaxShield = s.maxShield;
    let finalSpeed = s.speed;

    if (gameState.selectedUpgrades.includes('defense_protocols')) { finalMaxShield = Math.floor(finalMaxShield * 1.15); }
    if (gameState.selectedUpgrades.includes('force_engines') && s.tonnage === 'S') { finalSpeed += 1; }

    const finalWeapons = s.weapons.map((wKey, index) => {
        let wDef = { ...WEAPONS[wKey] };
        if (gameState.selectedUpgrades.includes('artillery_traditions')) { wDef.damage = Math.floor(wDef.damage * 1.1); }
        if (gameState.selectedUpgrades.includes('sniper_training')) { wDef.range += 1; }
        return { id: index, ref: wKey, used: false, customStats: wDef };
    });

    const u = { 
        id:`${gameState.mySide}_${Date.now()}`, type:c.type, 
        maxHp: s.maxHp, currentHp: s.maxHp, 
        maxShield: finalMaxShield, currentShield: finalMaxShield, shieldRegen: s.shieldRegen,
        baseSpeed: finalSpeed, maxAP: finalSpeed, currentAP: finalSpeed, 
        weapons: finalWeapons, cooldowns: {}, statusEffects: [],
        q: hex.q, r: hex.r, owner: gameState.mySide,
        isDead: false, hasActedThisTurn: false, abilityUsed: false 
    };
    
    gameState.units.push(u); hex.unitId=u.id; updateUnitMaxAP(u); u.currentAP = u.maxAP; 
    c.hasPlaced=true; gameState.selectedCardId=null; 
    gameState.currentAttackableHexes = []; gameState.blockedAttackableHexes = [];
    renderUnitsPanel(); network.send('PLACE_UNIT', u);
}

function checkStartCombat() { if (gameState.ready.me && gameState.ready.enemy && gameState.phase === 'SETUP') { gameState.phase = 'COMBAT'; gameState.turnCount = 0; gameState.activePlayer = 'host'; startGlobalTurn(); updateHud(); renderUnitsPanel(); } }

function startGlobalTurn() {
    gameState.turnCount++;
    gameState.units.forEach(u => {
        if (!u.isDead) {
            u.hasActedThisTurn = false; u.abilityUsed = false;
            u.weapons.forEach(w => w.used = false);
            
            if (u.statusEffects) {
                for (let i = u.statusEffects.length - 1; i >= 0; i--) {
                    u.statusEffects[i].duration--;
                    if (u.statusEffects[i].duration <= 0) u.statusEffects.splice(i, 1);
                }
            }

            updateUnitMaxAP(u); u.currentAP = u.maxAP;
            u.currentShield = Math.min(u.maxShield, u.currentShield + u.shieldRegen);
            for (let ab in u.cooldowns) { if (u.cooldowns[ab] > 0) u.cooldowns[ab]--; }
        }
    });
}

function updateUnitMaxAP(u) { 
    let baseSpeed = u.baseSpeed || UNIT_STATS[u.type].speed; 
    if (u.statusEffects && u.statusEffects.some(s => s.type === 'stasis')) { baseSpeed = Math.max(0, baseSpeed - 2); }
    u.maxAP = baseSpeed; if (u.currentAP > u.maxAP) u.currentAP = u.maxAP; 
}

function hexDistance(q1, r1, q2, r2) { return Math.max(Math.abs(q1-q2), Math.abs(q1+r1-q2-r2), Math.abs(r1-r2)); }

function checkLineOfSight(startHex, endHex) {
    const N = hexDistance(startHex.q, startHex.r, endHex.q, endHex.r); if (N <= 1) return true; 
    const aq = startHex.q, ar = startHex.r, as = -aq - ar; const bq = endHex.q, br = endHex.r, bs = -bq - br;
    const eq = 1e-6, er = 2e-6, es = -3e-6; const a = { q: aq + eq, r: ar + er, s: as + es }; const b = { q: bq + eq, r: br + er, s: bs + es };
    for (let i = 1; i < N; i++) {
        const t = i / N; const lq = a.q + (b.q - a.q) * t; const lr = a.r + (b.r - a.r) * t; const ls = a.s + (b.s - a.s) * t;
        const rounded = gameState.map.cubeRound(lq, lr, ls); const h = gameState.map.getHex(rounded.q, rounded.r);
        if (h && h.terrain.id === 'asteroid') return false; 
    }
    return true;
}

function updateWeaponCone(u, weaponIndex) { 
    gameState.currentAttackableHexes = []; gameState.blockedAttackableHexes = [];
    if(u.owner !== gameState.mySide || u.isDead) return; 
    
    const w = u.weapons[weaponIndex]; if(w.used) return;
    const wDef = w.customStats;
    const aHex = gameState.map.getHex(u.q, u.r);

    let range = wDef.range;
    if (u.statusEffects && u.statusEffects.some(s => s.type === 'jammed')) { range = Math.max(1, range - 2); }

    gameState.map.getAllHexes().forEach(hex => { 
        const d = hexDistance(u.q, u.r, hex.q, hex.r); 
        if (d > 0 && d <= range) { 
            if (checkLineOfSight(aHex, hex)) gameState.currentAttackableHexes.push(hex); 
            else gameState.blockedAttackableHexes.push(hex);
        } 
    }); 
}

function updateAbilityCone(u, abId) {
    gameState.currentAttackableHexes = []; gameState.blockedAttackableHexes = [];
    if(u.owner !== gameState.mySide || u.isDead) return;
    const abDef = ABILITIES[abId]; const aHex = gameState.map.getHex(u.q, u.r);

    gameState.map.getAllHexes().forEach(hex => {
        const d = hexDistance(u.q, u.r, hex.q, hex.r);
        if (d > 0 && d <= abDef.range) {
            if (checkLineOfSight(aHex, hex)) gameState.currentAttackableHexes.push(hex);
            else gameState.blockedAttackableHexes.push(hex);
        }
    });
}

function endTurn() { 
    if (gameState.phase === 'SETUP') {
        gameState.activePlayer = (gameState.activePlayer === 'host') ? 'guest' : 'host'; updateHud(); network.send('END_TURN', {});
    } else if (gameState.phase === 'COMBAT') {
        const actedUnit = gameState.units.find(u => u.id === (gameState.selectedUnitOnMap ? gameState.selectedUnitOnMap.id : gameState.activeUnitId));
        if (actedUnit) actedUnit.hasActedThisTurn = true;
        
        gameState.selectedUnitOnMap = null; gameState.activeUnitId = null;
        gameState.currentAttackableHexes = []; gameState.blockedAttackableHexes = [];
        gameState.moveMode = false; gameState.weaponMode = null; gameState.abilityMode = null;
        ui.actionPanel.classList.add('hidden');

        const livingUnits = gameState.units.filter(u => !u.isDead);
        if (livingUnits.every(u => u.hasActedThisTurn)) {
            startGlobalTurn(); gameState.activePlayer = (gameState.activePlayer === 'host') ? 'guest' : 'host';
        } else {
            const nextPlayer = (gameState.activePlayer === 'host') ? 'guest' : 'host';
            if (livingUnits.some(u => u.owner === nextPlayer && !u.hasActedThisTurn)) gameState.activePlayer = nextPlayer;
        }

        updateHud(); renderUnitsPanel();
        network.send('SYNC_COMBAT_STATE', { units: gameState.units, activePlayer: gameState.activePlayer, turnCount: gameState.turnCount });
    }
}

function syncUnit(u) { network.send('UNIT_UPDATE', u); }

function handleCombatClick(hex) {
    const tu = gameState.units.find(u => u.q === hex.q && u.r === hex.r && !u.isDead);

    if (gameState.weaponMode !== null && gameState.selectedUnitOnMap) {
        const au = gameState.selectedUnitOnMap;
        const wIndex = gameState.weaponMode; const w = au.weapons[wIndex]; 
        const wDef = w.customStats;

        if (tu && tu.owner !== gameState.mySide && gameState.currentAttackableHexes.includes(hex) && !w.used) {
            let dmg = wDef.damage;
            const dHex = gameState.map.getHex(tu.q, tu.r);
            if (dHex && dHex.terrain.id === 'asteroid') dmg = Math.floor(dmg * 0.8);
            
            let shieldDmg = Math.min(tu.currentShield, dmg);
            tu.currentShield -= shieldDmg;
            let hpDmg = dmg - shieldDmg;
            tu.currentHp = Math.max(0, tu.currentHp - hpDmg);
            tu.shakeUntil = Date.now() + 300; 

            let isUnitDead = false; if(tu.currentHp <= 0) { tu.isDead = true; hex.unitId = null; isUnitDead = true; }
            
            addBattleLog(gameState.turnCount, au, tu, dmg, wDef.name, isUnitDead, false);
            network.send('BATTLE_LOG', { turn: gameState.turnCount, attackerId: au.id, defenderId: tu.id, damage: dmg, weaponName: wDef.name, isDead: isUnitDead, isAbility: false });
            
            w.used = true; gameState.activeUnitId = au.id; 
            gameState.currentAttackableHexes = []; gameState.blockedAttackableHexes = []; gameState.weaponMode = null; 
            syncUnit(au); syncUnit(tu); updateActionPanel(au); renderUnitsPanel(); return;
        }
    } 

    if (gameState.abilityMode !== null && gameState.selectedUnitOnMap) {
        const au = gameState.selectedUnitOnMap;
        const abId = gameState.abilityMode;
        const abDef = ABILITIES[abId];

        if (tu && tu.owner !== gameState.mySide && gameState.currentAttackableHexes.includes(hex)) {
            let effectType = '';
            if (abId === 'jammer') effectType = 'jammed';
            if (abId === 'stasis') effectType = 'stasis';
            
            if (tu.statusEffects && tu.statusEffects.some(s => s.type === effectType)) { return; }

            if (!tu.statusEffects) tu.statusEffects = [];
            if (abId === 'jammer') tu.statusEffects.push({ type: 'jammed', duration: 2 });
            if (abId === 'stasis') tu.statusEffects.push({ type: 'stasis', duration: 2 });
            
            updateUnitMaxAP(tu);

            au.cooldowns[abId] = abDef.cooldown; au.abilityUsed = true;
            
            addBattleLog(gameState.turnCount, au, tu, 0, abDef.name, false, true);
            network.send('BATTLE_LOG', { turn: gameState.turnCount, attackerId: au.id, defenderId: tu.id, damage: 0, weaponName: abDef.name, isDead: false, isAbility: true });

            gameState.activeUnitId = au.id;
            gameState.currentAttackableHexes = []; gameState.blockedAttackableHexes = []; gameState.abilityMode = null;
            syncUnit(au); syncUnit(tu); updateActionPanel(au); renderUnitsPanel(); return;
        }
    }

    if (gameState.moveMode && gameState.selectedUnitOnMap) {
        const u = gameState.selectedUnitOnMap; const dist = hexDistance(u.q, u.r, hex.q, hex.r);
        const targetHex = gameState.map.getHex(hex.q, hex.r); const startHex = gameState.map.getHex(u.q, u.r);
        
        if (targetHex && targetHex.terrain.id === 'asteroid') { gameState.moveMode = false; updateActionPanel(u); renderUnitsPanel(); return; }

        if (dist > 0 && dist <= u.currentAP && !hex.unitId) { 
            if (checkLineOfSight(startHex, targetHex)) {
                const oh = gameState.map.getHex(u.q, u.r); if (oh) oh.unitId = null;
                u.q = hex.q; u.r = hex.r; hex.unitId = u.id; u.currentAP -= dist; gameState.activeUnitId = u.id; gameState.moveMode = false;
                updateUnitMaxAP(u); syncUnit(u); updateActionPanel(u);
            } else { gameState.moveMode = false; updateActionPanel(u); }
        } else if (gameState.moveMode) { gameState.moveMode = false; updateActionPanel(u); }
        renderUnitsPanel(); return;
    }

    if (tu && tu.owner === gameState.mySide) {
        if (tu.hasActedThisTurn) return; 
        if (gameState.activeUnitId && gameState.activeUnitId !== tu.id) return;
        gameState.selectedUnitOnMap = tu; gameState.moveMode = false; gameState.weaponMode = null; gameState.abilityMode = null;
        updateActionPanel(tu); renderUnitsPanel();
    } else {
        gameState.selectedUnitOnMap=null; gameState.currentAttackableHexes=[]; gameState.blockedAttackableHexes=[]; gameState.moveMode=false; gameState.weaponMode=null; gameState.abilityMode=null;
        ui.actionPanel.classList.add('hidden'); renderUnitsPanel();
    }
}

function bindTooltip(el, item, isWeapon = false) {
    if (!item) return;
    el.onmouseenter = () => {
        ui.ttIcon.src = item.icon; ui.ttName.innerText = item.name;
        ui.ttType.innerText = isWeapon ? 'Орудийная система' : (item.type === 'active' ? 'Активная система' : 'Пассивная система');
        ui.ttType.className = isWeapon ? 'tt-active' : (item.type === 'active' ? 'tt-active' : 'tt-passive');
        ui.ttDesc.innerText = item.desc;
        
        if (item.cooldown) { ui.ttCdBox.classList.remove('hidden'); ui.ttCd.innerText = item.cooldown; } 
        else { ui.ttCdBox.classList.add('hidden'); }
        
        if (item.range) { ui.ttRangeBox.classList.remove('hidden'); ui.ttRange.innerText = item.range; } 
        else { ui.ttRangeBox.classList.add('hidden'); }
        
        if (item.damage) { ui.ttDamageBox.classList.remove('hidden'); ui.ttDamage.innerText = item.damage; } 
        else { ui.ttDamageBox.classList.add('hidden'); }

        ui.ttChargesBox.classList.add('hidden'); ui.tooltip.classList.remove('hidden');
    };
    el.onmouseleave = () => { ui.tooltip.classList.add('hidden'); };
}

function updateActionPanel(u) { 
    if (!u) { ui.actionPanel.classList.add('hidden'); return; }
    ui.actionPanel.classList.remove('hidden'); 
    const isStunned = u.statusEffects && u.statusEffects.some(s => s.type === 'stun');
    
    let html = `<button id="btn-act-move" title="Движение" class="${gameState.moveMode?'active-action':''}" ${u.currentAP < 1 || isStunned ? 'disabled' : ''}><img src="assets/move.png"></button>`;

    u.weapons.forEach((w, index) => {
        let activeClass = (gameState.weaponMode === index) ? 'active-action' : '';
        let disabledStr = (w.used || isStunned) ? 'disabled' : '';
        html += `<button id="btn-wpn-${index}" class="${activeClass}" ${disabledStr}><img src="${w.customStats.icon}"></button>`;
    });

    html += `<div style="width:2px; background:#555; margin:0 5px; border-radius:2px;"></div>`;

    const abilities = UNIT_STATS[u.type].abilities || [];
    abilities.forEach(ab => {
        const a = ABILITIES[ab];
        if(a && a.type === 'active') {
            let activeClass = (gameState.abilityMode === ab) ? 'active-action' : '';
            let disabledStr = (u.cooldowns && u.cooldowns[ab] > 0 || u.abilityUsed || isStunned) ? 'disabled' : '';
            html += `<button id="btn-act-${ab}" class="${activeClass}" ${disabledStr}><img src="${a.icon}"></button>`;
        }
    });

    abilities.forEach(ab => {
        const a = ABILITIES[ab];
        if(a && a.type === 'passive') { html += `<div id="passive-ico-${ab}" class="passive-icon"><img src="${a.icon}"></div>`; }
    });

    ui.actionPanel.innerHTML = html;

    document.getElementById('btn-act-move').onclick = () => { gameState.moveMode = true; gameState.weaponMode = null; gameState.abilityMode = null; updateActionPanel(u); };
    
    u.weapons.forEach((w, index) => {
        const btn = document.getElementById(`btn-wpn-${index}`);
        if (btn) {
            btn.onclick = () => { gameState.weaponMode = index; gameState.moveMode = false; gameState.abilityMode = null; updateWeaponCone(u, index); updateActionPanel(u); };
            bindTooltip(btn, w.customStats, true);
        }
    });

    abilities.forEach(ab => {
        const a = ABILITIES[ab];
        if (a && a.type === 'active') { 
            const btn = document.getElementById(`btn-act-${ab}`); 
            if (btn) {
                btn.onclick = () => { gameState.abilityMode = ab; gameState.weaponMode = null; gameState.moveMode = false; updateAbilityCone(u, ab); updateActionPanel(u); };
                bindTooltip(btn, a);
            }
        }
        if (a && a.type === 'passive') { const icon = document.getElementById(`passive-ico-${ab}`); if (icon) bindTooltip(icon, a); }
    });
}

function updateHud() {
    ui.lblPhase.innerText = gameState.phase === 'SETUP' ? 'РАССТАНОВКА' : 'БОЙ';
    const turnPanel = document.getElementById('turn-status-panel');
    if (gameState.phase === 'SETUP') { ui.btnEndTurn.innerText = gameState.ready.me ? "ОЖИДАНИЕ..." : "ГОТОВ К БОЮ"; ui.btnEndTurn.disabled = gameState.ready.me; if (turnPanel) turnPanel.classList.add('hidden'); }
    else { 
        const isMyTurn = gameState.activePlayer === gameState.mySide; 
        if (turnPanel) { turnPanel.classList.remove('hidden'); turnPanel.innerText = isMyTurn ? "ВАШ ХОД" : "ХОД ВРАГА"; turnPanel.className = isMyTurn ? 'my-turn' : 'enemy-turn'; }
        ui.btnEndTurn.innerText = "ЗАВЕРШИТЬ"; ui.btnEndTurn.disabled = !isMyTurn; 
    }
    ui.lblTurnCount.innerText = gameState.turnCount;
}

function renderUnitsPanel() {
    ui.unitsList.innerHTML = '';
    const list = gameState.phase === 'SETUP' ? gameState.unitsToPlace : gameState.units.filter(u => u.owner === gameState.mySide);
    
    list.forEach(i => {
        const s = UNIT_STATS[i.type]; 
        const isSel = (gameState.phase === 'SETUP' && gameState.selectedCardId === i.id) || (gameState.phase === 'COMBAT' && gameState.selectedUnitOnMap && gameState.selectedUnitOnMap.id === i.id);
        const card = document.createElement('div'); 
        const actedClass = i.hasActedThisTurn ? ' acted' : '';
        const notMyTurnClass = (gameState.phase === 'COMBAT' && gameState.activePlayer !== gameState.mySide) ? ' not-my-turn' : '';
        
        card.className = `unit-card ${isSel ? 'selected' : ''} ${i.isDead ? 'dead' : ''}${actedClass}${notMyTurnClass}`; 
        card.dataset.id = i.id; 
        
        const maxHp = i.maxHp || s.maxHp;
        const maxShield = i.maxShield !== undefined ? i.maxShield : s.maxShield;
        const shieldRegen = i.shieldRegen !== undefined ? i.shieldRegen : s.shieldRegen;
        const baseSpeed = i.baseSpeed !== undefined ? i.baseSpeed : s.speed;
        
        const currentHp = i.currentHp !== undefined ? i.currentHp : maxHp;
        const currentShield = i.currentShield !== undefined ? i.currentShield : maxShield;

        const hpP = i.isDead ? 0 : (currentHp / maxHp * 100); 
        const shieldP = (i.isDead || maxShield===0) ? 0 : (currentShield / maxShield * 100); 

        const maxAP = i.maxAP !== undefined ? i.maxAP : baseSpeed;
        const currentAP = i.currentAP !== undefined ? i.currentAP : baseSpeed;
        
        let apBlocksHtml = '<div class="card-ap-container">';
        for (let b = 0; b < maxAP; b++) { apBlocksHtml += `<div class="ap-block ${i.isDead || b >= currentAP ? 'spent' : ''}"></div>`; }
        apBlocksHtml += '</div>';

        let statusesHtml = '';
        if (i.statusEffects && i.statusEffects.length > 0) {
            const sorted = [...i.statusEffects].sort((a, b) => a.duration - b.duration);
            statusesHtml += '<div class="card-status-container">';
            sorted.forEach(se => {
                const seDef = STATUS_EFFECTS_DICT[se.type];
                if (seDef) { statusesHtml += `<img src="${seDef.icon}" class="status-icon" data-type="${se.type}" data-duration="${se.duration}">`; }
            });
            statusesHtml += '</div>';
        }
        
        card.innerHTML = `
            <div class="card-bars-container">
                <div class="card-shield-bar">
                    <div class="card-shield-fill" style="width:${shieldP}%;"></div>
                    <div class="card-shield-text"><span>${i.isDead ? "" : currentShield}</span><span class="regen-text">+${shieldRegen}</span></div>
                </div>
                <div class="card-hp-bar">
                    <div class="card-hp-fill" style="width:${hpP}%;"></div>
                    <div class="card-hp-text">${i.isDead ? "МЕРТВ" : currentHp}</div>
                </div>
            </div>
            ${statusesHtml}
            <div class="card-image-container" style="background-image: url('${s.img}');">
                ${!i.id.includes(gameState.mySide) ? `<div class="card-name-block">${s.name}</div>` : ''} 
                ${apBlocksHtml}
            </div>`;

        if (gameState.phase === 'SETUP' && !i.hasPlaced) { 
            const b = document.createElement('button'); b.className = 'btn-place'; b.innerText = 'В БОЙ'; 
            b.onclick = (e) => { e.stopPropagation(); gameState.selectedCardId = i.id; renderUnitsPanel(); }; 
            card.querySelector('.card-image-container').appendChild(b);
        } else if (gameState.phase === 'COMBAT' && !i.isDead) { 
            card.onclick = () => { 
                if (i.hasActedThisTurn || (gameState.activeUnitId && gameState.activeUnitId !== i.id)) return; 
                gameState.selectedUnitOnMap = i; gameState.moveMode = false; gameState.weaponMode = null; gameState.abilityMode = null; updateActionPanel(i); renderUnitsPanel(); 
            }; 
        }
        card.onmouseenter = () => { gameState.hoveredUnitId = i.id; }; card.onmouseleave = () => { gameState.hoveredUnitId = null; };
        ui.unitsList.appendChild(card);

        card.querySelectorAll('.status-icon').forEach(icon => {
            icon.onclick = (e) => e.stopPropagation();
            icon.onmouseenter = () => {
                const type = icon.dataset.type; const duration = icon.dataset.duration; const seDef = STATUS_EFFECTS_DICT[type];
                ui.stDesc.innerText = seDef.desc; ui.stDuration.innerText = duration; ui.statusTooltip.classList.remove('hidden');
            };
            icon.onmouseleave = () => { ui.statusTooltip.classList.add('hidden'); };
        });
    });
}

function syncCardHoverEffects() { Array.from(ui.unitsList.children).forEach(c=>{ if(c.dataset.id===gameState.hoveredUnitId)c.classList.add('hovered'); else c.classList.remove('hovered'); }); }

function addBattleLog(turn, attacker, defender, damage, weaponName, isDead = false, isAbility = false) {
    const log = document.getElementById('battle-log'); if (!log) return;
    const aClass = attacker.owner === 'host' ? 'log-host' : 'log-guest';
    const dClass = defender.owner === 'host' ? 'log-host' : 'log-guest';
    
    const entry = document.createElement('div'); entry.className = 'log-entry';
    let text = '';
    
    if (isAbility) {
        text = `<span class="log-turn">[${turn}]</span> <span class="${aClass}">${UNIT_STATS[attacker.type].name}</span> применяет [${weaponName}] на <span class="${dClass}">${UNIT_STATS[defender.type].name}</span>.`;
    } else {
        text = `<span class="log-turn">[${turn}]</span> <span class="${aClass}">${UNIT_STATS[attacker.type].name}</span> наносит <b>${damage}</b> урона из [${weaponName}] по <span class="${dClass}">${UNIT_STATS[defender.type].name}</span>.`;
        if (isDead) text += ` <br><span style="color:#ff4444; font-weight:bold;">Корабль уничтожен!</span>`;
    }
    
    entry.innerHTML = text; log.appendChild(entry); log.scrollTop = log.scrollHeight;
}

// ==========================================
// CANVSA ОПЕРАЦИИ
// ==========================================

ui.canvas.addEventListener('mousedown', (e) => {
    if (gameState.phase === 'COMBAT' && gameState.activePlayer !== gameState.mySide && e.button === 0) return;
    const rect=ui.canvas.getBoundingClientRect(); const mx=e.clientX-rect.left-gameState.camera.x; const my=e.clientY-rect.top-gameState.camera.y;
    const hex=gameState.map.getHex(gameState.map.pixelToHex(mx,my).q, gameState.map.pixelToHex(mx,my).r);
    if (e.button===0 && hex) { if(gameState.phase==='SETUP' && gameState.selectedCardId) handleSetupPlacement(hex); else if(gameState.phase==='COMBAT') handleCombatClick(hex); }
    if (e.button===2) { gameState.camera.isDragging=true; gameState.camera.startX=e.clientX-gameState.camera.x; gameState.camera.startY=e.clientY-gameState.camera.y; }
});
window.addEventListener('mousemove', (e) => {
    if (gameState.camera.isDragging) { gameState.camera.x=e.clientX-gameState.camera.startX; gameState.camera.y=e.clientY-gameState.camera.startY; }
    const rect=ui.canvas.getBoundingClientRect(); const mx=e.clientX-rect.left-gameState.camera.x; const my=e.clientY-rect.top-gameState.camera.y;
    gameState.hoveredHex=gameState.map.getHex(gameState.map.pixelToHex(mx,my).q, gameState.map.pixelToHex(mx,my).r);
    gameState.hoveredUnitId = (gameState.hoveredHex && gameState.hoveredHex.unitId) ? gameState.hoveredHex.unitId : null;
    syncCardHoverEffects();
    
    [ui.tooltip, ui.statusTooltip].forEach(tt => {
        if (!tt.classList.contains('hidden')) {
            let tx = e.clientX + 15; let ty = e.clientY + 15;
            if (tx + tt.offsetWidth > window.innerWidth) tx = e.clientX - tt.offsetWidth - 10;
            if (ty + tt.offsetHeight > window.innerHeight) ty = e.clientY - tt.offsetHeight - 10;
            tt.style.left = `${tx}px`; tt.style.top = `${ty}px`;
        }
    });
});
window.addEventListener('mouseup', () => gameState.camera.isDragging=false); window.addEventListener('contextmenu', e=>e.preventDefault());

function drawUnitOverlay(u) {
    if (!gameState.moveMode) return; 
    const m = gameState.map; const startHex = m.getHex(u.q, u.r);
    m.getAllHexes().forEach(h => { 
        const d = hexDistance(u.q, u.r, h.q, h.r); 
        if (d > 0 && d <= u.currentAP && h.terrain.id !== 'asteroid' && !h.unitId && checkLineOfSight(startHex, h)) { 
            const pp = m.hexToPixel(h.q, h.r); const px = pp.x + gameState.camera.x; const py = pp.y + gameState.camera.y; 
            ctx.beginPath(); 
            for(let j=0;j<6;j++) { ctx.lineTo(px + (m.hexSize/2) * Math.cos(j*Math.PI/3), py + (m.hexSize/2) * Math.sin(j*Math.PI/3)); }
            ctx.fillStyle = 'rgba(0, 128, 255, 0.6)'; ctx.fill(); 
        } 
    });
}

function gameLoop() {
    ctx.clearRect(0,0,ui.canvas.width,ui.canvas.height); if(!gameState.map)return;
    
    gameState.map.getAllHexes().forEach(h=>{
        const p=gameState.map.hexToPixel(h.q,h.r); const px=p.x+gameState.camera.x; const py=p.y+gameState.camera.y;
        
        ctx.beginPath(); for(let i=0;i<6;i++) { ctx.lineTo(px+gameState.map.hexSize*Math.cos(i*Math.PI/3), py+gameState.map.hexSize*Math.sin(i*Math.PI/3)); } ctx.closePath();
        ctx.fillStyle=(gameState.hoveredHex===h)?'#555':h.terrain.color; ctx.fill();
        
        if(gameState.phase==='SETUP'){ if(gameState.mySide==='host'&&h.col<4){ctx.strokeStyle='#2196F3';ctx.lineWidth=3;} else if(gameState.mySide==='guest'&&h.col>=9){ctx.strokeStyle='#F44336';ctx.lineWidth=3;} else{ctx.strokeStyle='#222';ctx.lineWidth=1;} } else {ctx.strokeStyle='#222';ctx.lineWidth=1;} 
        ctx.stroke();
        
        if(gameState.weaponMode !== null || gameState.abilityMode !== null || gameState.attackHovered) {
            const smallSize = gameState.map.hexSize / 2;
            const highlightColor = (gameState.abilityMode !== null) ? 'rgba(76, 175, 80, 0.8)' : '#cc2714'; 
            const blockedColor = (gameState.abilityMode !== null) ? 'rgba(38, 88, 40, 0.8)' : '#6b0000';

            if (gameState.currentAttackableHexes.includes(h)) {
                ctx.beginPath(); for(let i=0;i<6;i++){ ctx.lineTo(px+smallSize*Math.cos(i*Math.PI/3), py+smallSize*Math.sin(i*Math.PI/3)); } ctx.closePath();
                ctx.fillStyle = highlightColor; ctx.fill();
            } else if (gameState.blockedAttackableHexes && gameState.blockedAttackableHexes.includes(h)) {
                ctx.beginPath(); for(let i=0;i<6;i++){ ctx.lineTo(px+smallSize*Math.cos(i*Math.PI/3), py+smallSize*Math.sin(i*Math.PI/3)); } ctx.closePath();
                ctx.fillStyle = blockedColor; ctx.fill();
            }
        }
    });
    
    if(gameState.selectedUnitOnMap) drawUnitOverlay(gameState.selectedUnitOnMap);
    
    gameState.units.forEach(u=>{
        if(u.isDead) return; 
        const p = gameState.map.hexToPixel(u.q, u.r); 
        let dx = 0, dy = 0; if (u.shakeUntil && Date.now() < u.shakeUntil) { dx = (Math.random() - 0.5) * 8; dy = (Math.random() - 0.5) * 8; }
        const x = p.x + gameState.camera.x + dx; const y = p.y + gameState.camera.y + dy;

        const glowColor = u.owner === 'host' ? 'rgba(33, 150, 243, 0.8)' : 'rgba(244, 67, 54, 0.8)';
        const grad = ctx.createRadialGradient(x, y, 5, x, y, 28);
        grad.addColorStop(0, glowColor); grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x, y, 28, 0, Math.PI*2); ctx.fill();

        const iconImg = MAP_ICONS[UNIT_STATS[u.type].icon];
        if (iconImg && iconImg.complete) { ctx.drawImage(iconImg, x - 18, y - 18, 36, 36); }

        ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI*2);
        if(gameState.hoveredUnitId===u.id){ctx.strokeStyle='#ffeb3b';ctx.lineWidth=3; ctx.stroke();} 
        else if(gameState.selectedUnitOnMap===u){ctx.strokeStyle='#0ff';ctx.lineWidth=3; ctx.stroke();}
    });
    requestAnimationFrame(gameLoop);
}