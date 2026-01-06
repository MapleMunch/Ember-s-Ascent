// ==========================================
// 📱 DISPLAY CONFIG
// ==========================================
const CANVAS_WIDTH = 360;  
const CANVAS_HEIGHT = 640; 
const WORLD_SIZE = 10000; // 10k x 10k world
const CHUNK_SIZE = 100;   // The world is divided into 100x100px squares

// ==========================================
// 💾 GAME STATE
// ==========================================
const GameState = {
    player: { 
        x: 5000, y: 5000, // Start in Middle
        hp: 100, maxHp: 100, 
        xp: 0, maxXp: 100, level: 1,
        speed: 6, name: "Commander", gold: 0,
        facing: 0 
    },
    mercs: [
        { id: 1, name: "Ironclad", class: "TANK", x: 4950, y: 5000, hp: 150, maxHp: 150, color: "#1e3a8a", range: 40, state: "IDLE" },
        { id: 2, name: "Lumina",   class: "HEAL", x: 4950, y: 4950, hp: 80,  maxHp: 80,  color: "#d946ef", range: 150, state: "IDLE", cooldown: 0 }
    ],
    enemies: [],
    loot: [],
    particles: [],
    scenery: [],
    effects: [],
    keys: {},
    // FOG DATA: A massive 2D grid storing exploration status
    // 0 = Unknown (Black), 1 = Explored (Fog), 2 = Visible (Clear)
    fogGrid: [] 
};

// ==========================================
// 🌲 WORLD & FOG GENERATION
// ==========================================
function initWorld() {
    // 1. Initialize Fog Grid (All Unknown)
    const rows = Math.ceil(WORLD_SIZE / CHUNK_SIZE);
    for (let y = 0; y < rows; y++) {
        GameState.fogGrid[y] = new Uint8Array(rows).fill(0); // 0 = Black
    }

    // 2. Generate Scenery (Trees/Rocks)
    // We create lots of them, but only draw what is explored!
    for(let i=0; i<3000; i++) {
        GameState.scenery.push({
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            type: Math.random() > 0.8 ? 'rock' : 'tree',
            size: 20 + Math.random() * 60
        });
    }
    
    // 3. Initial Spawns near player
    for(let i=0; i<15; i++) spawnEnemy();
}

function spawnEnemy() {
    const types = [
        { name: "Goblin Scout", hp: 40, color: "#ef4444", xp: 20, size: 28 },
        { name: "Orc Centurion", hp: 100, color: "#15803d", xp: 60, size: 38 },
        { name: "Giant Spider", hp: 60, color: "#374151", xp: 40, size: 32 }
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let ex, ey;
    // Spawn somewhat near player to ensure encounters
    do {
        const angle = Math.random() * Math.PI * 2;
        const range = 500 + Math.random() * 1000;
        ex = GameState.player.x + Math.cos(angle) * range;
        ey = GameState.player.y + Math.sin(angle) * range;
        ex = Math.max(0, Math.min(ex, WORLD_SIZE));
        ey = Math.max(0, Math.min(ey, WORLD_SIZE));
    } while (false);

    GameState.enemies.push({
        id: Math.random(), x: ex, y: ey,
        hp: type.hp, maxHp: type.hp,
        name: type.name, color: type.color, xp: type.xp, size: type.size
    });
}

// ==========================================
// 🔦 FOG LOGIC (The "Reveal")
// ==========================================
function updateFog() {
    const p = GameState.player;
    const viewRadius = 350; // How far you can see clearly
    
    // Convert Player Pos to Grid Coords
    const centerCol = Math.floor(p.x / CHUNK_SIZE);
    const centerRow = Math.floor(p.y / CHUNK_SIZE);
    const reach = Math.ceil(viewRadius / CHUNK_SIZE);

    // Loop through nearby chunks and mark them as EXPLORED
    for (let y = centerRow - reach; y <= centerRow + reach; y++) {
        for (let x = centerCol - reach; x <= centerCol + reach; x++) {
            if (y >= 0 && y < GameState.fogGrid.length && x >= 0 && x < GameState.fogGrid[0].length) {
                // If the distance to this chunk is within view radius...
                // (Simplified distance check for performance)
                if (GameState.fogGrid[y][x] === 0) {
                    GameState.fogGrid[y][x] = 1; // Mark as Explored (Persistent Memory)
                }
            }
        }
    }
}

// ==========================================
// 🧠 SQUAD AI
// ==========================================
function updateSquad() {
    const p = GameState.player;
    GameState.mercs.forEach(merc => {
        const distToPlayer = Math.hypot(merc.x - p.x, merc.y - p.y);
        const nearestEnemy = GameState.enemies.find(e => Math.hypot(e.x - merc.x, e.y - merc.y) < 300);

        if (merc.class === "HEAL") {
            if (p.hp < p.maxHp * 0.7 && Date.now() > merc.cooldown) merc.state = "HEAL";
            else if (distToPlayer > 120) merc.state = "FOLLOW";
            else merc.state = "IDLE";
        } else if (merc.class === "TANK") {
            if (nearestEnemy) merc.state = "CHASE";
            else if (distToPlayer > 90) merc.state = "FOLLOW";
            else merc.state = "IDLE";
        }

        switch (merc.state) {
            case "FOLLOW":
                const angle = Math.atan2(p.y - merc.y, p.x - merc.x);
                merc.x += Math.cos(angle) * 4.5; merc.y += Math.sin(angle) * 4.5; break;
            case "CHASE":
                if (nearestEnemy) {
                    const ang = Math.atan2(nearestEnemy.y - merc.y, nearestEnemy.x - merc.x);
                    merc.x += Math.cos(ang) * 4; merc.y += Math.sin(ang) * 4;
                    if (Math.hypot(nearestEnemy.x - merc.x, nearestEnemy.y - merc.y) < merc.range) {
                         nearestEnemy.hp -= 2; createParticle(nearestEnemy.x, nearestEnemy.y, "2", "#fff");
                    }
                } break;
            case "HEAL":
                p.hp = Math.min(p.maxHp, p.hp + 40);
                createParticle(p.x, p.y, "HEAL!", "#d946ef");
                GameState.effects.push({type: 'beam', x1: merc.x, y1: merc.y, x2: p.x, y2: p.y, life: 15});
                merc.cooldown = Date.now() + 5000; merc.state = "IDLE"; break;
        }
    });
}

function playerAttack() {
    GameState.effects.push({type: 'slash', x: GameState.player.x, y: GameState.player.y, angle: GameState.player.facing, life: 10});
    GameState.enemies.forEach(e => {
        if (Math.hypot(e.x - GameState.player.x, e.y - GameState.player.y) < 100) {
            e.hp -= 25; createParticle(e.x, e.y, "25", "#fff");
        }
    });
    GameState.enemies = GameState.enemies.filter(e => {
        if (e.hp <= 0) { GameState.loot.push({x: e.x, y: e.y, val: 15}); gainXp(e.xp); return false; } return true;
    });
    if (GameState.enemies.length < 8) spawnEnemy();
}

function gainXp(amt) {
    const p = GameState.player;
    p.xp += amt;
    if (p.xp >= p.maxXp) { p.level++; p.xp = 0; p.maxXp *= 1.5; p.maxHp += 20; p.hp = p.maxHp; createParticle(p.x, p.y-50, "LEVEL UP!", "#fbbf24"); }
}
function checkLoot() {
    const p = GameState.player;
    GameState.loot = GameState.loot.filter(l => {
        if (Math.hypot(l.x - p.x, l.y - p.y) < 60) { p.gold += l.val; createParticle(p.x, p.y, `+${l.val}g`, "#facc15"); return false; } return true;
    });
}
function createParticle(x, y, text, color) { GameState.particles.push({ x, y, text, color, life: 40 }); }

// ==========================================
// 🎨 RENDER ENGINE (With Fog Layer)
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_WIDTH; canvas.height = CANVAS_HEIGHT;

initWorld();

function loop() {
    const p = GameState.player;
    // Input
    if (GameState.keys['ArrowUp']) { p.y -= p.speed; p.facing = -Math.PI/2; }
    if (GameState.keys['ArrowDown']) { p.y += p.speed; p.facing = Math.PI/2; }
    if (GameState.keys['ArrowLeft']) { p.x -= p.speed; p.facing = Math.PI; }
    if (GameState.keys['ArrowRight']) { p.x += p.speed; p.facing = 0; }
    
    updateSquad();
    updateFog();
    checkLoot();

    // 1. Draw Background (Black Void)
    ctx.fillStyle = "#000000"; ctx.fillRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
    
    ctx.save();
    ctx.translate(-p.x + CANVAS_WIDTH/2, -p.y + CANVAS_HEIGHT/2);

    // 2. VIEW CULLING: Only loop through chunks currently on screen
    const startCol = Math.floor((p.x - CANVAS_WIDTH/2 - 100) / CHUNK_SIZE);
    const endCol   = Math.floor((p.x + CANVAS_WIDTH/2 + 100) / CHUNK_SIZE);
    const startRow = Math.floor((p.y - CANVAS_HEIGHT/2 - 100) / CHUNK_SIZE);
    const endRow   = Math.floor((p.y + CANVAS_HEIGHT/2 + 100) / CHUNK_SIZE);

    for (let y = startRow; y <= endRow; y++) {
        for (let x = startCol; x <= endCol; x++) {
            if (y < 0 || y >= GameState.fogGrid.length || x < 0 || x >= GameState.fogGrid[0].length) continue;
            
            const fogStatus = GameState.fogGrid[y][x]; // 0=Black, 1=Explored

            if (fogStatus >= 1) { // If Explored or Visible
                const chunkX = x * CHUNK_SIZE;
                const chunkY = y * CHUNK_SIZE;

                // Draw Ground
                ctx.fillStyle = "#166534"; 
                ctx.fillRect(chunkX, chunkY, CHUNK_SIZE+1, CHUNK_SIZE+1);

                // Draw Scenery inside this chunk
                // (We iterate scenery but only draw if in this chunk)
                // *Optimization: Random seeded scenery would be faster, but this works for now*
                
                // Determine Visibility Overlay (Fog of War)
                const distToP = Math.hypot((chunkX+50)-p.x, (chunkY+50)-p.y);
                if (distToP > 350) {
                    // Explored but out of sight -> Draw Dark Overlay
                    ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; 
                    ctx.fillRect(chunkX, chunkY, CHUNK_SIZE+1, CHUNK_SIZE+1);
                }
            }
        }
    }
    
    // 3. Draw Objects (They need to be hidden by fog too!)
    // We only draw entities if they are close enough to be seen
    
    // Scenery (Naive loop for simplicity)
    GameState.scenery.forEach(s => {
        if (Math.abs(s.x - p.x) < 400 && Math.abs(s.y - p.y) < 600) {
            ctx.fillStyle = s.type === 'tree' ? "#14532d" : "#475569";
            ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill();
        }
    });

    // Loot
    GameState.loot.forEach(l => { 
        if(Math.hypot(l.x-p.x, l.y-p.y) < 350) {
            ctx.fillStyle = "#facc15"; ctx.fillRect(l.x-8, l.y-8, 16, 16); 
        }
    });

    // Enemies (Only draw if visible!)
    GameState.enemies.forEach(e => {
        if(Math.hypot(e.x-p.x, e.y-p.y) < 350) {
            ctx.fillStyle = e.color; ctx.fillRect(e.x-e.size/2, e.y-e.size/2, e.size, e.size);
            ctx.fillStyle = "red"; ctx.fillRect(e.x-15, e.y-e.size, 30*(e.hp/e.maxHp), 4);
        }
    });

    // Squad & Player (Always drawn)
    ctx.fillStyle = "#3b82f6"; ctx.fillRect(p.x-16, p.y-16, 32, 32); // Hero
    GameState.mercs.forEach(m => {
        ctx.fillStyle = m.color; ctx.fillRect(m.x-16, m.y-16, 32, 32);
    });

    // Effects/Particles
    GameState.effects.forEach(fx => {
        if(fx.type==='slash'){ ctx.strokeStyle="white"; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(fx.x,fx.y,50,fx.angle-0.5,fx.angle+0.5); ctx.stroke(); }
        if(fx.type==='beam'){ ctx.strokeStyle="#d946ef"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(fx.x1,fx.y1); ctx.lineTo(fx.x2,fx.y2); ctx.stroke(); }
        fx.life--;
    });
    GameState.effects = GameState.effects.filter(fx => fx.life > 0);
    
    ctx.font = "bold 20px Arial";
    GameState.particles.forEach(pt => { ctx.fillStyle=pt.color; ctx.fillText(pt.text, pt.x, pt.y); pt.y-=1; pt.life--; });
    GameState.particles = GameState.particles.filter(pt => pt.life > 0);

    ctx.restore();

    // UI Overlay
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(10, 10, 220, 90);
    ctx.fillStyle = "white"; ctx.font = "14px monospace";
    ctx.fillText(`COMMANDER: ${Math.floor(p.hp)}/${p.maxHp} (Lvl ${p.level})`, 20, 30);
    GameState.mercs.forEach((m, i) => {
        ctx.fillStyle = m.color; ctx.fillText(`${m.name}: ${Math.floor(m.hp)}HP [${m.state}]`, 20, 50 + (i*20));
    });
    
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
