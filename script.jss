// ==========================================
// ⚙️ GAME CONFIGURATION
// ==========================================
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const TILE_SIZE = 32;

// ==========================================
// 💾 STATE & STORAGE
// ==========================================
const GameState = {
    player: { x: 400, y: 300, hp: 100, maxHp: 100, speed: 4, name: "Hero" },
    mercenary: { x: 350, y: 350, class: "Healer", action: "Idle", lastAction: 0 },
    enemies: [],
    particles: [], // Floating damage numbers
    keys: {} // Keyboard input
};

// Load saved game if exists
const savedData = localStorage.getItem('ember_save');
if (savedData) {
    const parsed = JSON.parse(savedData);
    GameState.player = parsed.player;
    // We reset enemies on reload to avoid bugs
}

// Spawn some enemies
function spawnEnemies() {
    GameState.enemies = [
        { id: 1, x: 200, y: 200, hp: 50, maxHp: 50, name: "Goblin", color: "#ef4444" },
        { id: 2, x: 600, y: 150, hp: 80, maxHp: 80, name: "Orc", color: "#b91c1c" },
        { id: 3, x: 400, y: 500, hp: 30, maxHp: 30, name: "Rat", color: "#713f12" }
    ];
}
spawnEnemies();

// ==========================================
// 🧠 MERCENARY AI (The "EQ Brain")
// ==========================================
function updateMercenary() {
    const merc = GameState.mercenary;
    const player = GameState.player;
    const enemies = GameState.enemies;
    const now = Date.now();

    const DIST_LEASH = 120; // If farther, run to player
    const DIST_CAST = 150;  // Range to heal/nuke
    const DIST_MELEE = 40;  
    
    // 1. LEASH CHECK (Priority #1)
    const distToPlayer = Math.hypot(merc.x - player.x, merc.y - player.y);
    if (distToPlayer > DIST_LEASH) {
        const angle = Math.atan2(player.y - merc.y, player.x - merc.x);
        merc.x += Math.cos(angle) * 3; // Merc runs fast
        merc.y += Math.sin(angle) * 3;
        merc.action = "Following";
        return;
    }

    // 2. HEALER LOGIC (Priority #2)
    if (merc.class === "Healer" && now - merc.lastAction > 2500) {
        // Heal Player if hurt
        if (player.hp < player.maxHp * 0.7) {
            player.hp = Math.min(player.maxHp, player.hp + 20);
            createParticle(player.x, player.y, "+20", "#22c55e"); // Green Text
            merc.action = "Casting Heal";
            merc.lastAction = now;
            return;
        }
    }

    // 3. COMBAT ASSIST (Priority #3)
    // Find closest enemy
    let target = null;
    let minDist = 9999;
    
    enemies.forEach(e => {
        const d = Math.hypot(e.x - merc.x, e.y - merc.y);
        if (d < minDist) { minDist = d; target = e; }
    });

    if (target && minDist < 200) {
        // If Healer, stay back. If Warrior, charge in.
        if (minDist > DIST_MELEE) {
            const angle = Math.atan2(target.y - merc.y, target.x - merc.x);
            merc.x += Math.cos(angle) * 2;
            merc.y += Math.sin(angle) * 2;
            merc.action = "Chasing";
        } else {
            // Attack logic would go here
            merc.action = "Fighting";
        }
    } else {
        merc.action = "Idle";
    }
}

// ==========================================
// ⚔️ COMBAT SYSTEM
// ==========================================
function playerAttack() {
    const p = GameState.player;
    let hitSomething = false;

    GameState.enemies.forEach(e => {
        const dist = Math.hypot(e.x - p.x, e.y - p.y);
        if (dist < 60) {
            // HIT!
            const dmg = Math.floor(Math.random() * 10) + 5;
            e.hp -= dmg;
            createParticle(e.x, e.y, `-${dmg}`, "#fff");
            hitSomething = true;
        }
    });

    // Remove dead enemies
    GameState.enemies = GameState.enemies.filter(e => {
        if (e.hp <= 0) {
            createParticle(e.x, e.y, "DEAD", "#ffff00");
            return false;
        }
        return true;
    });

    if (GameState.enemies.length === 0) {
        setTimeout(spawnEnemies, 3000); // Respawn after 3s
    }
}

function createParticle(x, y, text, color) {
    GameState.particles.push({ x, y, text, color, life: 30 });
}

// ==========================================
// 🎮 ENGINE LOOP
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Resize canvas to fit screen
function resize() {
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
}
resize();

function update() {
    const p = GameState.player;

    // Movement
    if (GameState.keys['ArrowUp']) p.y -= p.speed;
    if (GameState.keys['ArrowDown']) p.y += p.speed;
    if (GameState.keys['ArrowLeft']) p.x -= p.speed;
    if (GameState.keys['ArrowRight']) p.x += p.speed;

    // Boundary Checks
    p.x = Math.max(0, Math.min(CANVAS_WIDTH - TILE_SIZE, p.x));
    p.y = Math.max(0, Math.min(CANVAS_HEIGHT - TILE_SIZE, p.y));

    // AI
    updateMercenary();

    // Particles
    GameState.particles.forEach(part => {
        part.y -= 1; // Float up
        part.life--;
    });
    GameState.particles = GameState.particles.filter(p => p.life > 0);

    // Update UI
    document.getElementById('player-hp-fill').style.width = (p.hp / p.maxHp * 100) + '%';
    document.getElementById('merc-hp-fill').style.width = (100) + '%'; // Merc invincible for now
    document.getElementById('merc-action').innerText = GameState.mercenary.action;

    // Auto-Save every 5 seconds (optional, disabled for speed loop)
    // localStorage.setItem('ember_save', JSON.stringify(GameState));
}

function draw() {
    // Clear Screen
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grass
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(50, 50, 700, 500);

    // Draw Player (Blue)
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(GameState.player.x, GameState.player.y, TILE_SIZE, TILE_SIZE);

    // Draw Merc (Purple)
    ctx.fillStyle = "#a855f7";
    const m = GameState.mercenary;
    ctx.fillRect(m.x, m.y, TILE_SIZE, TILE_SIZE);

    // Draw Enemies (Red)
    GameState.enemies.forEach(e => {
        ctx.fillStyle = e.color;
        ctx.fillRect(e.x, e.y, TILE_SIZE, TILE_SIZE);
        // HP Bar
        ctx.fillStyle = "black";
        ctx.fillRect(e.x, e.y - 8, TILE_SIZE, 4);
        ctx.fillStyle = "red";
        ctx.fillRect(e.x, e.y - 8, TILE_SIZE * (e.hp / e.maxHp), 4);
    });

    // Draw Particles
    ctx.font = "bold 16px Courier New";
    GameState.particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
    });
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// Start
loop();

// ==========================================
// 🕹️ INPUT HANDLING
// ==========================================

// Keyboard
window.addEventListener('keydown', e => GameState.keys[e.key] = true);
window.addEventListener('keyup', e => GameState.keys[e.key] = false);

// Touch Controls (Connect Buttons to Keys)
const btnMap = {
    'btn-up': 'ArrowUp', 'btn-down': 'ArrowDown', 
    'btn-left': 'ArrowLeft', 'btn-right': 'ArrowRight'
};

Object.keys(btnMap).forEach(id => {
    const btn = document.getElementById(id);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); GameState.keys[btnMap[id]] = true; });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); GameState.keys[btnMap[id]] = false; });
    // Mouse fallback for PC testing
    btn.addEventListener('mousedown', () => GameState.keys[btnMap[id]] = true);
    btn.addEventListener('mouseup', () => GameState.keys[btnMap[id]] = false);
});

// Attack Button
const atkBtn = document.getElementById('btn-attack');
atkBtn.addEventListener('touchstart', (e) => { e.preventDefault(); playerAttack(); });
atkBtn.addEventListener('mousedown', () => playerAttack());
