// ==========================================
// ⚙️ GAME CONFIGURATION
// ==========================================
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const WORLD_SIZE = 2500; // HUGE Map
const TILE_SIZE = 32;

// ==========================================
// 💾 GAME STATE
// ==========================================
const GameState = {
    player: { 
        x: 1250, y: 1250, // Start in middle
        hp: 100, maxHp: 100, 
        xp: 0, maxXp: 100, level: 1,
        speed: 6, name: "Hero", gold: 0,
        facing: 0 // Rotation for sword swing
    },
    mercenary: { x: 1200, y: 1200, class: "Healer", action: "Idle", lastAction: 0 },
    enemies: [],
    loot: [],
    particles: [],
    scenery: [],
    effects: [], // Sword slashes, heal beams
    keys: {}
};

// ==========================================
// 🌲 WORLD GENERATION
// ==========================================
function initWorld() {
    // 1. Generate Trees & Rocks
    for(let i=0; i<150; i++) {
        GameState.scenery.push({
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            type: Math.random() > 0.8 ? 'rock' : 'tree',
            size: 20 + Math.random() * 50
        });
    }
    // 2. Initial Spawns
    for(let i=0; i<15; i++) spawnEnemy();
}

function spawnEnemy() {
    const types = [
        { name: "Goblin", hp: 30, color: "#ef4444", xp: 20, dmg: 5 },
        { name: "Orc", hp: 60, color: "#b91c1c", xp: 45, dmg: 10 },
        { name: "Elite", hp: 120, color: "#7c3aed", xp: 100, dmg: 15 } // New Elite Enemy
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    
    // Spawn far from player
    let ex, ey, dist;
    do {
        ex = Math.random() * WORLD_SIZE;
        ey = Math.random() * WORLD_SIZE;
        dist = Math.hypot(ex - GameState.player.x, ey - GameState.player.y);
    } while (dist < 500); // Minimum 500px away

    GameState.enemies.push({
        id: Math.random(),
        x: ex, y: ey,
        hp: type.hp, maxHp: type.hp,
        name: type.name, color: type.color, xp: type.xp, dmg: type.dmg
    });
}

// ==========================================
// 🧠 AI & LOGIC
// ==========================================
function updateMercenary() {
    const m = GameState.mercenary;
    const p = GameState.player;
    const now = Date.now();
    const dist = Math.hypot(m.x - p.x, m.y - p.y);

    // 1. Follow Logic (With "Stop" buffer to prevent jitter)
    if (dist > 150) {
        const angle = Math.atan2(p.y - m.y, p.x - m.x);
        m.x += Math.cos(angle) * 4.5;
        m.y += Math.sin(angle) * 4.5;
        m.action = "Following";
    } else if (dist < 100) {
        // Stop moving if close enough
        m.action = "Idle";
    }

    // 2. Heal Logic (Visual Beam)
    if (now - m.lastAction > 3000 && p.hp < p.maxHp * 0.7) {
        p.hp = Math.min(p.maxHp, p.hp + 40);
        createParticle(p.x, p.y, "+40 HP", "#4ade80");
        // Add Heal Beam Effect
        GameState.effects.push({type: 'beam', x1: m.x, y1: m.y, x2: p.x, y2: p.y, life: 10});
        m.action = "Casting Heal";
        m.lastAction = now;
    }

    // 3. Combat Logic
    const target = GameState.enemies.find(e => Math.hypot(e.x - m.x, e.y - m.y) < 200);
    if (target && now - m.lastAction > 1500) {
         // Merc Attack
         target.hp -= 8;
         createParticle(target.x, target.y, "8", "#a855f7");
         m.lastAction = now;
         m.action = "Attacking";
    }
}

function playerAttack() {
    // Add Sword Slash Effect
    GameState.effects.push({
        type: 'slash', 
        x: GameState.player.x, 
        y: GameState.player.y, 
        angle: GameState.player.facing, 
        life: 10
    });

    let hit = false;
    GameState.enemies.forEach(e => {
        if (Math.hypot(e.x - GameState.player.x, e.y - GameState.player.y) < 90) {
            const dmg = 20 + Math.floor(Math.random() * 10);
            e.hp -= dmg;
            createParticle(e.x, e.y, dmg, "#fff");
            hit = true;
        }
    });

    // Cleanup Dead
    GameState.enemies = GameState.enemies.filter(e => {
        if (e.hp <= 0) {
            GameState.loot.push({ x: e.x, y: e.y, val: 10 + Math.floor(Math.random()*20) });
            gainXp(e.xp);
            return false;
        }
        return true;
    });

    // Respawn
    if (GameState.enemies.length < 10) spawnEnemy();
}

function gainXp(amount) {
    const p = GameState.player;
    p.xp += amount;
    createParticle(p.x, p.y-30, `+${amount} XP`, "#fbbf24");
    if (p.xp >= p.maxXp) {
        p.level++;
        p.xp = 0;
        p.maxXp = Math.floor(p.maxXp * 1.5);
        p.maxHp += 20; p.hp = p.maxHp;
        createParticle(p.x, p.y-50, "LEVEL UP!", "#fbbf24");
    }
}

function checkLoot() {
    const p = GameState.player;
    GameState.loot = GameState.loot.filter(l => {
        if (Math.hypot(l.x - p.x, l.y - p.y) < 50) {
            p.gold += l.val;
            createParticle(p.x, p.y, `+${l.val}g`, "#facc15");
            return false;
        }
        return true;
    });
}

function createParticle(x, y, text, color) {
    GameState.particles.push({ x, y, text, color, life: 50 });
}

// ==========================================
// 🎨 RENDER ENGINE
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH; 
canvas.height = CANVAS_HEIGHT;

initWorld();

function loop() {
    const p = GameState.player;
    
    // 1. Move Player
    if (GameState.keys['ArrowUp']) { p.y -= p.speed; p.facing = -Math.PI/2; }
    if (GameState.keys['ArrowDown']) { p.y += p.speed; p.facing = Math.PI/2; }
    if (GameState.keys['ArrowLeft']) { p.x -= p.speed; p.facing = Math.PI; }
    if (GameState.keys['ArrowRight']) { p.x += p.speed; p.facing = 0; }
    
    updateMercenary();
    checkLoot();

    // 2. Draw World
    ctx.fillStyle = "#0f172a"; 
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.save();
    ctx.translate(-p.x + CANVAS_WIDTH/2, -p.y + CANVAS_HEIGHT/2);

    // Ground
    ctx.fillStyle = "#166534";
    ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);

    // Scenery
    GameState.scenery.forEach(s => {
        ctx.fillStyle = s.type === 'tree' ? "#14532d" : "#475569";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI*2);
        ctx.fill();
    });

    // Loot (Pulsing)
    const pulse = 10 + Math.sin(Date.now()/200)*2;
    GameState.loot.forEach(l => {
        ctx.fillStyle = "#facc15";
        ctx.fillRect(l.x - pulse/2, l.y - pulse/2, pulse, pulse);
    });

    // Enemies
    GameState.enemies.forEach(e => {
        ctx.fillStyle = e.color;
        ctx.fillRect(e.x-16, e.y-16, 32, 32);
        // HP Bar
        ctx.fillStyle = "black"; ctx.fillRect(e.x-16, e.y-24, 32, 4);
        ctx.fillStyle = "red"; ctx.fillRect(e.x-16, e.y-24, 32*(e.hp/e.maxHp), 4);
    });

    // Player & Merc
    ctx.fillStyle = "#3b82f6"; ctx.fillRect(p.x-16, p.y-16, 32, 32);
    ctx.fillStyle = "#a855f7"; ctx.fillRect(GameState.mercenary.x-16, GameState.mercenary.y-16, 32, 32);

    // VFX (Effects Layer)
    GameState.effects.forEach(fx => {
        if (fx.type === 'slash') {
            ctx.strokeStyle = "white";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(fx.x, fx.y, 40, fx.angle - 0.5, fx.angle + 0.5);
            ctx.stroke();
        } else if (fx.type === 'beam') {
            ctx.strokeStyle = "#4ade80";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(fx.x1, fx.y1);
            ctx.lineTo(fx.x2, fx.y2);
            ctx.stroke();
        }
        fx.life--;
    });
    GameState.effects = GameState.effects.filter(fx => fx.life > 0);

    // Particles
    ctx.font = "bold 20px monospace";
    GameState.particles.forEach(pt => {
        ctx.fillStyle = pt.color;
        ctx.fillText(pt.text, pt.x, pt.y);
        pt.y -= 1; pt.life--;
    });
    GameState.particles = GameState.particles.filter(pt => pt.life > 0);

    ctx.restore();

    // 3. UI Updates
    document.getElementById('player-hp-fill').style.width = (p.hp/p.maxHp*100) + '%';
    document.getElementById('player-name').innerText = `${p.name} (Lvl ${p.level})`;
    document.getElementById('merc-action').innerText = `💰 ${p.gold} | 🟢 XP ${p.xp}`;
    
    requestAnimationFrame(loop);
}

// ==========================================
// 🕹️ INPUTS
// ==========================================
window.addEventListener('keydown', e => GameState.keys[e.key] = true);
window.addEventListener('keyup', e => GameState.keys[e.key] = false);

const btnMap = {'btn-up':'ArrowUp', 'btn-down':'ArrowDown', 'btn-left':'ArrowLeft', 'btn-right':'ArrowRight'};
Object.keys(btnMap).forEach(id => {
    const btn = document.getElementById(id);
    if(btn) {
        btn.addEventListener('touchstart', (e)=>{e.preventDefault(); GameState.keys[btnMap[id]]=true;});
        btn.addEventListener('touchend', (e)=>{e.preventDefault(); GameState.keys[btnMap[id]]=false;});
        btn.addEventListener('mousedown', ()=>{GameState.keys[btnMap[id]]=true;});
        btn.addEventListener('mouseup', ()=>{GameState.keys[btnMap[id]]=false;});
    }
});
const atkBtn = document.getElementById('btn-attack');
if(atkBtn) {
    atkBtn.addEventListener('touchstart', (e)=>{e.preventDefault(); playerAttack();});
    atkBtn.addEventListener('mousedown', ()=>{playerAttack();});
}

loop();

