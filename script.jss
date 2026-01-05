// ==========================================
// ⚙️ GAME CONFIGURATION
// ==========================================
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const WORLD_SIZE = 2000; // The world is now HUGE
const TILE_SIZE = 32;

// ==========================================
// 💾 GAME STATE
// ==========================================
const GameState = {
    player: { 
        x: 1000, y: 1000, // Start in middle of big world
        hp: 100, maxHp: 100, 
        xp: 0, maxXp: 100, level: 1,
        speed: 5, name: "Hero", gold: 0 
    },
    mercenary: { x: 950, y: 950, class: "Healer", action: "Idle", lastAction: 0 },
    enemies: [],
    loot: [],      // Items on the ground
    particles: [], // Damage numbers
    scenery: [],   // Trees and rocks
    keys: {}
};

// ==========================================
// 🌲 WORLD GENERATION
// ==========================================
function initWorld() {
    // 1. Generate Scenery (Trees & Rocks)
    for(let i=0; i<100; i++) {
        GameState.scenery.push({
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            type: Math.random() > 0.8 ? 'rock' : 'tree',
            size: 20 + Math.random() * 40
        });
    }

    // 2. Spawn Initial Enemies
    for(let i=0; i<10; i++) spawnEnemy();
}

function spawnEnemy() {
    // Spawn random enemy type
    const types = [
        { name: "Goblin", hp: 30, color: "#ef4444", xp: 20 },
        { name: "Orc", hp: 60, color: "#b91c1c", xp: 40 },
        { name: "Spider", hp: 20, color: "#000", xp: 10 }
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    
    // Spawn away from player
    let ex, ey;
    do {
        ex = Math.random() * WORLD_SIZE;
        ey = Math.random() * WORLD_SIZE;
    } while (Math.hypot(ex - GameState.player.x, ey - GameState.player.y) < 400);

    GameState.enemies.push({
        id: Date.now() + Math.random(),
        x: ex, y: ey,
        hp: type.hp, maxHp: type.hp,
        name: type.name, color: type.color, xp: type.xp
    });
}

// ==========================================
// 🧠 LOGIC & AI
// ==========================================
function updateMercenary() {
    const m = GameState.mercenary;
    const p = GameState.player;
    const now = Date.now();
    const dist = Math.hypot(m.x - p.x, m.y - p.y);

    // 1. Follow Player (Leash)
    if (dist > 150) {
        const angle = Math.atan2(p.y - m.y, p.x - m.x);
        m.x += Math.cos(angle) * 4;
        m.y += Math.sin(angle) * 4;
        m.action = "Following";
        return;
    }

    // 2. Auto-Heal
    if (now - m.lastAction > 2000 && p.hp < p.maxHp * 0.6) {
        p.hp = Math.min(p.maxHp, p.hp + 30);
        createParticle(p.x, p.y, "+30 HP", "#4ade80");
        m.action = "Heal!";
        m.lastAction = now;
        return;
    }

    // 3. Combat Assist
    let target = GameState.enemies.find(e => Math.hypot(e.x - m.x, e.y - m.y) < 200);
    if (target) {
        // Move to target
        const angle = Math.atan2(target.y - m.y, target.x - m.x);
        m.x += Math.cos(angle) * 3;
        m.y += Math.sin(angle) * 3;
        m.action = "Attacking!";
        
        // Attack
        if (now - m.lastAction > 1000 && Math.hypot(target.x - m.x, target.y - m.y) < 50) {
            target.hp -= 10;
            createParticle(target.x, target.y, "10", "#a855f7");
            m.lastAction = now;
        }
    } else {
        m.action = "Idle";
    }
}

function playerAttack() {
    let hit = false;
    GameState.enemies.forEach(e => {
        if (Math.hypot(e.x - GameState.player.x, e.y - GameState.player.y) < 80) {
            const dmg = 15 + Math.floor(Math.random() * 10);
            e.hp -= dmg;
            createParticle(e.x, e.y, dmg, "#fff");
            hit = true;
        }
    });

    // Clean up dead enemies & Drop Loot
    GameState.enemies = GameState.enemies.filter(e => {
        if (e.hp <= 0) {
            // Drop Gold
            GameState.loot.push({ x: e.x, y: e.y, val: 5 + Math.floor(Math.random()*10) });
            // Gain XP
            gainXp(e.xp);
            return false;
        }
        return true;
    });

    if (GameState.enemies.length < 5) spawnEnemy(); // Always keep enemies spawning
}

function gainXp(amount) {
    const p = GameState.player;
    p.xp += amount;
    createParticle(p.x, p.y - 40, `+${amount} XP`, "#fbbf24");
    
    if (p.xp >= p.maxXp) {
        p.level++;
        p.xp = 0;
        p.maxXp = Math.floor(p.maxXp * 1.5);
        p.maxHp += 20;
        p.hp = p.maxHp;
        createParticle(p.x, p.y - 60, "LEVEL UP!", "#fbbf24");
    }
}

function checkLoot() {
    const p = GameState.player;
    GameState.loot = GameState.loot.filter(item => {
        if (Math.hypot(item.x - p.x, item.y - p.y) < 40) {
            p.gold += item.val;
            createParticle(p.x, p.y, `+${item.val}g`, "#facc15");
            return false; // Remove from ground
        }
        return true;
    });
}

function createParticle(x, y, text, color) {
    GameState.particles.push({ x, y, text, color, life: 60 });
}

// ==========================================
// 🎨 RENDER ENGINE (The Camera System)
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH; 
canvas.height = CANVAS_HEIGHT;

initWorld(); // Start the world generation

function loop() {
    // 1. Update Physics
    const p = GameState.player;
    if (GameState.keys['ArrowUp']) p.y -= p.speed;
    if (GameState.keys['ArrowDown']) p.y += p.speed;
    if (GameState.keys['ArrowLeft']) p.x -= p.speed;
    if (GameState.keys['ArrowRight']) p.x += p.speed;
    
    updateMercenary();
    checkLoot();

    // 2. Draw World (Camera Logic)
    ctx.fillStyle = "#111"; 
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.save();
    // CAMERA MAGIC: Move the entire world so player is in center
    ctx.translate(-p.x + CANVAS_WIDTH/2, -p.y + CANVAS_HEIGHT/2);

    // Draw Ground
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);

    // Draw Scenery
    GameState.scenery.forEach(s => {
        ctx.fillStyle = s.type === 'tree' ? "#14532d" : "#57534e";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI*2);
        ctx.fill();
    });

    // Draw Loot
    GameState.loot.forEach(l => {
        ctx.fillStyle = "#facc15"; // Gold color
        ctx.fillRect(l.x - 10, l.y - 10, 20, 20);
    });

    // Draw Units
    ctx.fillStyle = "#3b82f6"; // Player
    ctx.fillRect(p.x-16, p.y-16, 32, 32);
    
    ctx.fillStyle = "#a855f7"; // Merc
    ctx.fillRect(GameState.mercenary.x-16, GameState.mercenary.y-16, 32, 32);

    GameState.enemies.forEach(e => {
        ctx.fillStyle = e.color;
        ctx.fillRect(e.x-16, e.y-16, 32, 32);
        // Enemy HP Bar
        ctx.fillStyle = "red";
        ctx.fillRect(e.x-16, e.y-25, 32, 5);
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(e.x-16, e.y-25, 32 * (e.hp/e.maxHp), 5);
    });

    // Draw Particles (Floating Text)
    ctx.font = "bold 20px Courier New";
    GameState.particles.forEach(part => {
        ctx.fillStyle = part.color;
        ctx.fillText(part.text, part.x, part.y);
        part.y -= 1; part.life--;
    });
    GameState.particles = GameState.particles.filter(p => p.life > 0);

    ctx.restore(); // End Camera

    // 3. Draw UI (Static on screen)
    document.getElementById('player-hp-fill').style.width = (p.hp/p.maxHp*100) + '%';
    document.getElementById('player-name').innerText = `${p.name} (Lvl ${p.level})`;
    document.getElementById('merc-action').innerText = `XP: ${p.xp}/${p.maxXp} | Gold: ${p.gold}`;
    
    requestAnimationFrame(loop);
}

// ==========================================
// 🕹️ CONTROLS
// ==========================================
window.addEventListener('keydown', e => GameState.keys[e.key] = true);
window.addEventListener('keyup', e => GameState.keys[e.key] = false);

const btnMap = {'btn-up':'ArrowUp', 'btn-down':'ArrowDown', 'btn-left':'ArrowLeft', 'btn-right':'ArrowRight'};
Object.keys(btnMap).forEach(id => {
    const btn = document.getElementById(id);
    if(btn) {
        btn.addEventListener('touchstart', (e)=>{e.preventDefault(); GameState.keys[btnMap[id]]=true;});
        btn.addEventListener('touchend', (e)=>{e.preventDefault(); GameState.keys[btnMap[id]]=false;});
        // Mouse support for testing
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

