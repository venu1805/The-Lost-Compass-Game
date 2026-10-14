/* ==========================================================================
   ENTITIES & ACTORS ENGINE - The Lost Compass
   Player, Enemies, Bosses, Projectiles, Interactive Objects & Physics
   ========================================================================== */

class Entity {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1; // 1 = right, -1 = left
    this.isDead = false;
  }

  getBounds() {
    return {
      left: this.x,
      right: this.x + this.width,
      top: this.y,
      bottom: this.y + this.height
    };
  }

  collidesWith(other) {
    const a = this.getBounds();
    const b = other.getBounds();
    return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
  }
}

/* ==========================================================================
   PLAYER CHARACTER (The Young Pirate)
   ========================================================================== */

class Player extends Entity {
  constructor(x, y) {
    super(x, y, 32, 54);

    // Vitals
    this.maxHealth = 100;
    this.health = 100;
    this.maxStamina = 100;
    this.stamina = 100;
    this.maxOxygen = 100;
    this.oxygen = 100;

    // Movement Physics
    this.speed = 240;
    this.jumpForce = -420;
    this.gravity = 980;
    this.onGround = false;
    this.isClimbing = false;
    this.isSwimming = false;
    this.inWater = false;
    this.swimSpeed = 160;

    // Combat & Actions
    this.isAttacking = false;
    this.attackCombo = 0; // 0, 1, 2
    this.attackTimer = 0;
    this.comboResetTimer = 0;
    this.isBlocking = false;
    this.isDodging = false;
    this.dodgeTimer = 0;
    this.invulnerableTimer = 0;

    // Animation & Visual State
    this.animTime = 0;
    this.currentAnim = 'idle'; // 'idle', 'run', 'jump', 'climb', 'swim', 'attack', 'dodge'
  }

  update(dt, input, currentLevel) {
    this.animTime += dt;

    // Cooldown timers
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.dodgeTimer > 0) {
      this.dodgeTimer -= dt;
      if (this.dodgeTimer <= 0) this.isDodging = false;
    }
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) this.isAttacking = false;
    }
    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) this.attackCombo = 0;
    }

    // Passive Stamina Recovery
    if (!this.isDodging && !this.isAttacking && this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + 22 * dt);
    }

    // Check Water Status in current level
    this.checkWaterState(currentLevel);

    // Manage Oxygen in underwater mode (Level 5)
    if (this.isSwimming && currentLevel.isUnderwater) {
      this.oxygen = Math.max(0, this.oxygen - 10 * dt);
      if (this.oxygen <= 0) {
        this.takeDamage(12 * dt, null, true);
        if (Math.random() < 0.1 && window.soundEngine) window.soundEngine.playHurt();
      }
    } else if (!this.inWater) {
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + 35 * dt);
    }

    // Process Movement Inputs
    this.handleMovement(dt, input, currentLevel);

    // Process Combat Inputs
    this.handleCombat(input, currentLevel);

    // Apply Velocity & World Collisions
    this.applyPhysicsAndCollisions(dt, currentLevel);

    // Update HUD bars
    this.updateHUD();
  }

  checkWaterState(currentLevel) {
    if (!currentLevel || !currentLevel.waterLevel) {
      this.inWater = false;
      this.isSwimming = false;
      return;
    }
    const wasInWater = this.inWater;
    this.inWater = (this.y + this.height > currentLevel.waterLevel);
    this.isSwimming = (this.y + this.height * 0.5 > currentLevel.waterLevel);

    if (!wasInWater && this.inWater) {
      if (window.soundEngine) window.soundEngine.playSplash();
      if (window.game && window.game.renderer) {
        window.game.renderer.addSplash(this.x + this.width / 2, currentLevel.waterLevel, 16);
      }
    }
  }

  handleMovement(dt, input, currentLevel) {
    if (this.isDodging) {
      this.vx = this.facing * 420;
      return;
    }

    // Ladder / Rigging climbing
    const onLadder = currentLevel.checkLadderCollision(this);
    if (onLadder && (input.isDown('KeyW') || input.isDown('ArrowUp') || input.isDown('KeyS') || input.isDown('ArrowDown'))) {
      this.isClimbing = true;
    } else if (!onLadder) {
      this.isClimbing = false;
    }

    if (this.isClimbing) {
      this.vy = 0;
      if (input.isDown('KeyW') || input.isDown('ArrowUp')) this.vy = -180;
      if (input.isDown('KeyS') || input.isDown('ArrowDown')) this.vy = 180;
      if (input.isDown('KeyA') || input.isDown('ArrowLeft')) this.vx = -120;
      else if (input.isDown('KeyD') || input.isDown('ArrowRight')) this.vx = 120;
      else this.vx = 0;
      return;
    }

    // Swimming physics
    if (this.isSwimming) {
      this.vy *= 0.88;
      this.vx *= 0.88;
      let moveX = 0;
      let moveY = 0;

      if (input.isDown('KeyA') || input.isDown('ArrowLeft')) { moveX = -1; this.facing = -1; }
      if (input.isDown('KeyD') || input.isDown('ArrowRight')) { moveX = 1; this.facing = 1; }
      if (input.isDown('KeyW') || input.isDown('ArrowUp')) moveY = -1;
      if (input.isDown('KeyS') || input.isDown('ArrowDown')) moveY = 1;

      if (moveX !== 0 || moveY !== 0) {
        const len = Math.hypot(moveX, moveY);
        if (moveX !== 0) this.facing = moveX;
        this.vx = (moveX / len) * this.swimSpeed;
        this.vy = (moveY / len) * this.swimSpeed;
      }
      return;
    }

    // Standard Land Movement
    this.vx = 0;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) {
      this.vx = -this.speed;
      this.facing = -1;
    }
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) {
      this.vx = this.speed;
      this.facing = 1;
    }

    // Jump
    if ((input.isJustPressed('KeyW') || input.isJustPressed('Space') || input.isJustPressed('ArrowUp')) && this.onGround) {
      this.vy = this.jumpForce;
      this.onGround = false;
      if (window.soundEngine) window.soundEngine.playJump();
    }

    // Dodge Roll (Shift or double tap)
    if (input.isJustPressed('ShiftLeft') || input.isJustPressed('KeyQ')) {
      if (this.stamina >= 25 && !this.isDodging) {
        this.isDodging = true;
        this.dodgeTimer = 0.35;
        this.invulnerableTimer = 0.35;
        this.stamina -= 25;
        if (window.soundEngine) window.soundEngine.playSwordSwing();
      }
    }
  }

  handleCombat(input, currentLevel) {
    if (this.isDodging || this.isClimbing) return;

    // Blocking / Parry (Right click or Key K)
    this.isBlocking = input.isDown('KeyK');

    // Sword Slash (Key J or Left Mouse Button)
    if (input.isJustPressed('KeyJ') && !this.isAttacking && this.stamina >= 15) {
      this.isAttacking = true;
      this.attackTimer = 0.28;
      this.attackCombo = (this.attackCombo + 1) % 3;
      this.comboResetTimer = 0.8;
      this.stamina -= 15;

      if (window.soundEngine) window.soundEngine.playSwordSwing();

      // Perform hit detection in front of player
      this.performMeleeAttack(currentLevel);
    }

    // Flintlock Pistol Shot (Key F)
    if (input.isJustPressed('KeyF')) {
      this.shootPistol(currentLevel);
    }

    // Spectral Compass Sight (Key C)
    if (input.isJustPressed('KeyC')) {
      if (window.mysticCompass) window.mysticCompass.activateSpectralVision();
    }
  }

  performMeleeAttack(currentLevel) {
    const hitbox = {
      x: this.facing === 1 ? this.x + this.width : this.x - 42,
      y: this.y + 6,
      width: 44,
      height: 42
    };

    let hitCount = 0;
    currentLevel.enemies.forEach(enemy => {
      if (!enemy.isDead && enemy.collidesWithHitbox(hitbox)) {
        const dmg = 25 + (this.attackCombo * 10);
        enemy.takeDamage(dmg, this.facing);
        hitCount++;
        if (window.game && window.game.renderer) {
          window.game.renderer.addSparks(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, 10);
        }
      }
    });

    if (hitCount > 0 && window.soundEngine) {
      window.soundEngine.playSwordClash();
    }
  }

  shootPistol(currentLevel) {
    if (window.inventorySystem.ammo <= 0) {
      if (window.game) window.game.showToast("Out of Gunpowder Ammo!");
      return;
    }
    window.inventorySystem.ammo--;
    window.inventorySystem.updateHUD();

    if (window.soundEngine) window.soundEngine.playPistolShot();
    if (window.game && window.game.renderer) {
      window.game.renderer.addSmoke(this.x + (this.facing === 1 ? this.width + 10 : -10), this.y + 18, 8);
    }

    // Spawn Bullet Projectile
    const bullet = new Projectile(
      this.x + (this.facing === 1 ? this.width + 12 : -12),
      this.y + 20,
      this.facing * 750,
      0,
      60,
      'player'
    );
    currentLevel.projectiles.push(bullet);
  }

  applyPhysicsAndCollisions(dt, currentLevel) {
    // Gravity
    if (!this.isClimbing && !this.isSwimming) {
      this.vy += this.gravity * dt;
    }

    // Horizontal Movement & Collisions
    this.x += this.vx * dt;
    currentLevel.resolveHorizontalCollisions(this);

    // Vertical Movement & Collisions
    const prevY = this.y;
    this.y += this.vy * dt;
    this.onGround = false;
    currentLevel.resolveVerticalCollisions(this, prevY);
  }

  takeDamage(amount, knockbackDir = 0, ignoreInvuln = false) {
    if (this.invulnerableTimer > 0 && !ignoreInvuln) return;

    if (this.isBlocking && knockbackDir !== 0) {
      amount *= 0.2; // 80% damage reduction on block
      this.stamina = Math.max(0, this.stamina - 20);
      if (window.soundEngine) window.soundEngine.playSwordClash();
    } else {
      if (window.soundEngine) window.soundEngine.playHurt();
    }

    this.health = Math.max(0, this.health - amount);
    this.invulnerableTimer = 0.5;

    if (knockbackDir !== 0) {
      this.vx = knockbackDir * 200;
      this.vy = -180;
    }

    if (this.health <= 0 && !this.isDead) {
      this.isDead = true;
      if (window.game) window.game.triggerGameOver();
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.updateHUD();
  }

  updateHUD() {
    const hpBar = document.getElementById('health-fill');
    const stamBar = document.getElementById('stamina-fill');
    const oxyRow = document.getElementById('oxygen-row');
    const oxyBar = document.getElementById('oxygen-fill');

    if (hpBar) hpBar.style.width = `${(this.health / this.maxHealth) * 100}%`;
    if (stamBar) stamBar.style.width = `${(this.stamina / this.maxStamina) * 100}%`;

    if (oxyRow && oxyBar) {
      if (window.game && window.game.currentLevel && window.game.currentLevel.isUnderwater) {
        oxyRow.style.display = 'flex';
        oxyBar.style.width = `${(this.oxygen / this.maxOxygen) * 100}%`;
      } else {
        oxyRow.style.display = 'none';
      }
    }
  }

  /* -------------------------------------------------------------------------
     PIRATE CHARACTER RENDERING (Canvas-drawn Hand-Painted Aesthetic)
     ------------------------------------------------------------------------- */

  render(ctx, camera) {
    const screenX = this.x - camera.x;
    const screenY = this.y - camera.y;

    ctx.save();
    if (this.isSwimming) {
      ctx.translate(screenX + this.width / 2, screenY + this.height / 2);
      ctx.scale(this.facing, 1);
      ctx.rotate(Math.PI / 2);
      ctx.translate(0, this.height / 2);
    } else {
      ctx.translate(screenX + this.width / 2, screenY + this.height);
      ctx.scale(this.facing, 1);
    }

    // Flash white when invulnerable
    if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 60) % 2 === 0) {
      ctx.globalAlpha = 0.6;
    }

    // Walking bounce animation
    const isMoving = Math.abs(this.vx) > 10 || (this.isSwimming && Math.abs(this.vy) > 10);
    const legSwing = this.isSwimming
      ? Math.sin(this.animTime * 10) * 8
      : isMoving ? Math.sin(this.animTime * 12) * 14 : 0;
    const bob = this.isSwimming
      ? Math.sin(this.animTime * 8) * 2
      : isMoving ? Math.abs(Math.sin(this.animTime * 12)) * 3 : 0;

    // Legs / Boots
    ctx.fillStyle = '#2b1c11'; // Brown leather boots
    // Left Leg
    ctx.beginPath();
    ctx.roundRect(-10, -18 - bob, 8, 18, 2);
    ctx.fill();
    // Right Leg
    ctx.beginPath();
    ctx.roundRect(2 + (legSwing * 0.3), -18 - bob, 8, 18, 2);
    ctx.fill();

    // Pirate Coat / Torso
    ctx.fillStyle = '#1e3a5f'; // Deep Navy Pirate Captain Coat
    ctx.beginPath();
    ctx.roundRect(-12, -42 - bob, 24, 26, 4);
    ctx.fill();

    // White ruffled shirt & brass belt buckle
    ctx.fillStyle = '#f1ebd8';
    ctx.fillRect(-4, -40 - bob, 8, 12);
    ctx.fillStyle = '#b45309'; // Leather sash
    ctx.fillRect(-12, -26 - bob, 24, 5);
    ctx.fillStyle = '#d4af37'; // Gold buckle
    ctx.fillRect(-3, -27 - bob, 6, 7);

    // Head / Face
    ctx.fillStyle = '#e0a97c'; // Pirate skin tone
    ctx.beginPath();
    ctx.arc(0, -48 - bob, 9, 0, Math.PI * 2);
    ctx.fill();

    // Eye patch & stubble
    ctx.fillStyle = '#111';
    ctx.fillRect(1, -50 - bob, 3, 3);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -51 - bob);
    ctx.lineTo(6, -46 - bob);
    ctx.stroke();

    // Legendary Pirate Tricorn Hat
    ctx.fillStyle = '#171717';
    ctx.beginPath();
    ctx.moveTo(-18, -52 - bob);
    ctx.lineTo(18, -52 - bob);
    ctx.lineTo(2, -66 - bob);
    ctx.closePath();
    ctx.fill();
    // Hat Gold Trim
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Crimson Feather on Hat
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(-8, -56 - bob);
    ctx.quadraticCurveTo(-16, -68 - bob, -4, -68 - bob);
    ctx.fill();

    // Sword Cutlass & Attack Swing Arc
    if (this.isAttacking) {
      // Swashing blade arc
      ctx.save();
      ctx.translate(6, -32 - bob);
      const slashAngle = (1 - (this.attackTimer / 0.28)) * Math.PI * 1.2 - 0.4;
      ctx.rotate(slashAngle);

      // Steel blade
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, -3, 34, 5);
      // Gold hilt
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // Slashing Energy Trail
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 36, -0.6, 0.6);
      ctx.stroke();
      ctx.restore();
    } else if (this.isBlocking) {
      // Sword held up in defensive guard
      ctx.save();
      ctx.translate(10, -32 - bob);
      ctx.rotate(-0.8);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, -3, 32, 5);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(-4, -5, 6, 9);
      // Blue defensive shield gleam
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(10, 0, 16, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
      ctx.restore();
    } else {
      // Sheathed / Rest cutlass
      ctx.save();
      ctx.translate(-6, -26 - bob);
      ctx.rotate(0.5);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, -2, 26, 4);
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(-3, -4, 5, 8);
      ctx.restore();
    }

    ctx.restore();
  }
}

/* ==========================================================================
   ENEMY BASE CLASS & ENEMY TYPES
   ========================================================================== */

class Enemy extends Entity {
  constructor(x, y, width, height, type = 'skeleton') {
    super(x, y, width, height);
    this.type = type;
    this.maxHealth = 50;
    this.health = 50;
    this.damage = 15;
    this.speed = 100;
    this.patrolStartX = x - 120;
    this.patrolEndX = x + 120;
    this.state = 'patrol'; // 'patrol', 'chase', 'attack', 'dead'
    this.attackCooldown = 0;
    this.attackRange = 40;
    this.detectionRange = 260;
  }

  collidesWithHitbox(box) {
    const a = this.getBounds();
    return !(a.right < box.x || a.left > box.x + box.width || a.bottom < box.y || a.top > box.y + box.height);
  }

  takeDamage(amount, hitDir = 0) {
    this.health -= amount;
    this.vx = hitDir * 180;
    this.vy = -120;
    if (this.health <= 0 && !this.isDead) {
      this.isDead = true;
      this.onDeath();
    }
  }

  onDeath() {
    if (window.soundEngine) window.soundEngine.playCoin();
    // Drop gold doubloons
    const goldDrop = 10 + Math.floor(Math.random() * 20);
    window.inventorySystem.addGold(goldDrop);
  }

  update(dt, player, currentLevel) {
    if (this.isDead) return;

    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    const distToPlayer = Math.hypot(player.x - this.x, player.y - this.y);

    if (distToPlayer < this.detectionRange) {
      this.state = 'chase';
      this.facing = player.x > this.x ? 1 : -1;
    } else {
      this.state = 'patrol';
    }

    if (this.state === 'chase') {
      if (distToPlayer <= this.attackRange) {
        this.vx = 0;
        if (this.attackCooldown <= 0) {
          this.performAttack(player);
        }
      } else {
        this.vx = this.facing * this.speed;
      }
    } else {
      // Patrol back and forth
      this.vx = this.facing * (this.speed * 0.6);
      if (this.x <= this.patrolStartX) this.facing = 1;
      if (this.x >= this.patrolEndX) this.facing = -1;
    }

    // Gravity
    this.vy += 980 * dt;

    this.x += this.vx * dt;
    currentLevel.resolveHorizontalCollisions(this);
    const prevY = this.y;
    this.y += this.vy * dt;
    currentLevel.resolveVerticalCollisions(this, prevY);
  }

  performAttack(player) {
    this.attackCooldown = 1.4;
    player.takeDamage(this.damage, this.facing);
    if (window.soundEngine) window.soundEngine.playSwordSwing();
  }

  render(ctx, camera) {
    if (this.isDead) return;
    const screenX = this.x - camera.x;
    const screenY = this.y - camera.y;

    ctx.save();
    ctx.translate(screenX + this.width / 2, screenY + this.height);
    ctx.scale(this.facing, 1);

    if (this.type === 'skeleton') {
      // Cursed Skeleton Swashbuckler
      ctx.fillStyle = '#e2e8f0'; // Bone
      ctx.beginPath();
      // Ribcage
      ctx.fillRect(-8, -36, 16, 20);
      // Skull
      ctx.arc(0, -44, 9, 0, Math.PI * 2);
      ctx.fill();
      // Glowing green eye sockets
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(1, -45, 2, 2);
      // Rusty Cutlass
      ctx.fillStyle = '#92400e';
      ctx.fillRect(10, -28, 22, 4);
    } else if (this.type === 'marine') {
      // Royal Redcoat Marine
      ctx.fillStyle = '#b91c1c'; // Red uniform
      ctx.fillRect(-10, -38, 20, 22);
      // White cross-belts
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, -38);
      ctx.lineTo(10, -16);
      ctx.moveTo(10, -38);
      ctx.lineTo(-10, -16);
      ctx.stroke();
      // Shako Tall Hat
      ctx.fillStyle = '#111';
      ctx.fillRect(-8, -58, 16, 14);
      // Musket with Bayonet
      ctx.fillStyle = '#78350f';
      ctx.fillRect(10, -30, 26, 4);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(36, -30, 8, 2);
    } else if (this.type === 'panther') {
      // Jungle Beast (Panther)
      ctx.fillStyle = '#1e1b18';
      ctx.beginPath();
      ctx.roundRect(-18, -20, 36, 18, 6);
      ctx.fill();
      // Glowing Yellow Eyes
      ctx.fillStyle = '#eab308';
      ctx.fillRect(10, -17, 3, 3);
    } else {
      // Rival Pirate Corsair
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(-10, -38, 20, 22);
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.arc(0, -44, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Health Bar above enemy
    if (this.health < this.maxHealth) {
      ctx.fillStyle = '#000';
      ctx.fillRect(-16, -64, 32, 5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-16, -64, (this.health / this.maxHealth) * 32, 5);
    }

    ctx.restore();
  }
}

/* ==========================================================================
   BOSS CLASS (Level 5 Ghostly Guardian & Level 6 Aztec Leviathan)
   ========================================================================== */

class Boss extends Enemy {
  constructor(x, y, name, type = 'guardian') {
    super(x, y, 64, 96, type);
    this.name = name;
    this.maxHealth = 400;
    this.health = 400;
    this.speed = 130;
    this.detectionRange = 900;
    this.attackRange = 70;
    this.damage = 30;
    this.phase = 1;
    this.specialTimer = 4.0;
  }

  update(dt, player, currentLevel) {
    if (this.isDead) return;

    this.specialTimer -= dt;
    if (this.specialTimer <= 0) {
      this.specialTimer = 5.0;
      this.triggerBossSpecialAttack(player, currentLevel);
    }

    super.update(dt, player, currentLevel);
  }

  triggerBossSpecialAttack(player, currentLevel) {
    if (this.type === 'guardian') {
      // Teleport & Spectral Wave Blade
      if (window.soundEngine) window.soundEngine.playCompassTone();
      if (window.game && window.game.renderer) {
        window.game.renderer.addSparks(this.x + this.width / 2, this.y + this.height / 2, 25, '#22d3ee');
      }
      // Shoot 3 spectral waves
      [-150, 0, 150].forEach(angleOffset => {
        const proj = new Projectile(
          this.x + this.width / 2,
          this.y + this.height / 2 + angleOffset * 0.1,
          this.facing * 350,
          angleOffset * 0.4,
          25,
          'enemy',
          'spectral'
        );
        currentLevel.projectiles.push(proj);
      });
    } else if (this.type === 'leviathan') {
      if (window.soundEngine) window.soundEngine.playCompassTone();
      if (window.game && window.game.renderer) {
        window.game.renderer.addSparks(this.x + this.width / 2, this.y + this.height / 2, 28, '#38bdf8');
      }
      [-1, 0, 1].forEach(spread => {
        currentLevel.projectiles.push(new Projectile(
          this.x + this.width / 2,
          this.y + this.height / 2 + spread * 18,
          this.facing * 320,
          spread * 110,
          28,
          'enemy',
          'spectral'
        ));
      });
    } else {
      // Ground shockwave
      if (window.soundEngine) window.soundEngine.playCannonFire();
      if (window.game && window.game.renderer) {
        window.game.renderer.addSparks(this.x, this.y + this.height, 30, '#f97316');
      }
      [-1, 1].forEach(dir => {
        const wave = new Projectile(
          this.x + this.width / 2,
          this.y + this.height - 10,
          dir * 400,
          0,
          35,
          'enemy',
          'flame'
        );
        currentLevel.projectiles.push(wave);
      });
    }
  }

  render(ctx, camera) {
    if (this.isDead) return;
    const screenX = this.x - camera.x;
    const screenY = this.y - camera.y;

    ctx.save();
    ctx.translate(screenX + this.width / 2, screenY + this.height);
    ctx.scale(this.facing, 1);

    if (this.type === 'guardian') {
      // Spectral Sea Wraith (Ghostly Blue Skull Captain)
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 18;
      ctx.fillStyle = 'rgba(6, 78, 59, 0.85)';
      ctx.beginPath();
      ctx.roundRect(-24, -80, 48, 60, 10);
      ctx.fill();

      // Spectral Ghost Skull
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(0, -88, 18, 0, Math.PI * 2);
      ctx.fill();

      // Ghostly Dual Cursed Blades
      ctx.fillStyle = '#67e8f9';
      ctx.fillRect(20, -60, 48, 8);
    } else if (this.type === 'leviathan') {
      // Abyssal sea creature with a broad body, maw, and trailing tentacles.
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 22;
      ctx.fillStyle = '#0e7490';
      ctx.beginPath();
      ctx.ellipse(0, -48, 34, 30, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#164e63';
      ctx.beginPath();
      ctx.moveTo(-24, -44);
      ctx.lineTo(0, -20);
      ctx.lineTo(24, -44);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-13, -60, 4, 0, Math.PI * 2);
      ctx.arc(13, -60, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#155e75';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      for (let tentacle = -1; tentacle <= 1; tentacle++) {
        ctx.beginPath();
        ctx.moveTo(tentacle * 18, -30);
        ctx.quadraticCurveTo(tentacle * 34, -4, tentacle * 20, 4);
        ctx.stroke();
      }
    } else {
      // Aztec Leviathan Shade (Molten Obsidian Armor)
      ctx.shadowColor = '#ea580c';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.roundRect(-26, -85, 52, 65, 8);
      ctx.fill();

      // Molten Aztec Gold Mask
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-18, -96, 36, 24);
      // Flame Greatsword
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(24, -80, 56, 12);
    }

    // Boss Name & Boss Health Bar at top of Screen
    ctx.restore();

    // Render Boss Health Bar in Screen Space
    ctx.save();
    const barWidth = Math.min(340, window.innerWidth - 32);
    const barX = (window.innerWidth - barWidth) / 2;
    const barY = 68;

    ctx.fillStyle = 'rgba(15, 10, 8, 0.9)';
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.fillRect(barX, barY, barWidth, 14);
    ctx.strokeRect(barX, barY, barWidth, 14);

    ctx.fillStyle = this.type === 'guardian' ? '#22d3ee' : '#ea580c';
    ctx.fillRect(barX + 2, barY + 2, (this.health / this.maxHealth) * (barWidth - 4), 10);

    ctx.font = "bold 13px 'Cinzel', serif";
    ctx.fillStyle = '#f7e07c';
    ctx.textAlign = 'center';
    ctx.fillText(`☠ ${this.name} ☠`, window.innerWidth / 2, barY - 6);
    ctx.restore();
  }
}

/* ==========================================================================
   PROJECTILE CLASS (Bullets, Musket balls, Energy blades)
   ========================================================================== */

class Projectile {
  constructor(x, y, vx, vy, damage, source = 'player', style = 'bullet') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.source = source; // 'player' or 'enemy'
    this.style = style;
    this.radius = 4;
    this.life = 2.5;
  }

  update(dt, player, enemies, currentLevel) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.life <= 0) return true; // destroy

    // Player bullet hits enemy
    if (this.source === 'player') {
      for (const enemy of enemies) {
        if (!enemy.isDead && Math.hypot(enemy.x + enemy.width / 2 - this.x, enemy.y + enemy.height / 2 - this.y) < 28) {
          enemy.takeDamage(this.damage, this.vx > 0 ? 1 : -1);
          if (window.soundEngine) window.soundEngine.playSwordClash();
          return true;
        }
      }
    } else {
      // Enemy bullet hits player
      if (Math.hypot(player.x + player.width / 2 - this.x, player.y + player.height / 2 - this.y) < 26) {
        player.takeDamage(this.damage, this.vx > 0 ? 1 : -1);
        return true;
      }
    }

    // Hit solid walls
    if (currentLevel.checkPointCollision(this.x, this.y)) {
      return true;
    }

    return false;
  }

  render(ctx, camera) {
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;

    ctx.save();
    if (this.style === 'spectral') {
      ctx.fillStyle = '#22d3ee';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.style === 'flame') {
      ctx.fillStyle = '#f97316';
      ctx.shadowColor = '#ea580c';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
