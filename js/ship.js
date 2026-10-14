/* ==========================================================================
   NAVAL COMBAT & SHIP SIMULATION - The Lost Compass
   Level 4 Dedicated Open-Sea Ship-to-Ship Warfare & Broadside Artillery
   ========================================================================== */

class NavalShip {
  constructor(x, y, isPlayer = true, name = "The Sea Serpent") {
    this.x = x;
    this.y = y;
    this.name = name;
    this.isPlayer = isPlayer;

    this.angle = 0; // heading in radians
    this.speed = 0;
    this.maxSpeed = isPlayer ? 180 : 150;
    this.turnRate = 1.4;
    this.sailsOpen = false;

    // Hull & Health
    this.maxHull = isPlayer ? 300 : 450;
    this.hull = this.maxHull;
    this.isCrippled = false;
    this.isDestroyed = false;

    // Cannon Broadside batteries
    this.reloadTimerPort = 0;
    this.reloadTimerStarboard = 0;
    this.reloadTimerBow = 0;
    this.reloadDuration = 2.0;
    this.repairCooldown = 0;
    this.repairCooldownDuration = 8;

    // Visual dimensions
    this.width = 110;
    this.height = 45;

    // Wake trails
    this.wakeParticles = [];
  }

  update(dt, input, targets, projectiles) {
    if (this.isDestroyed) return;

    if (this.reloadTimerPort > 0) this.reloadTimerPort -= dt;
    if (this.reloadTimerStarboard > 0) this.reloadTimerStarboard -= dt;
    if (this.reloadTimerBow > 0) this.reloadTimerBow -= dt;
    if (this.repairCooldown > 0) this.repairCooldown = Math.max(0, this.repairCooldown - dt);

    if (this.isPlayer) {
      this.handlePlayerControl(dt, input, projectiles);
    } else {
      this.handleAI(dt, targets, projectiles);
    }

    // Move forward based on speed and heading
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;

    // Generate water wake particles
    if (this.speed > 20 && Math.random() < 0.4) {
      const sternX = this.x - Math.cos(this.angle) * (this.width / 2);
      const sternY = this.y - Math.sin(this.angle) * (this.width / 2);
      if (window.game && window.game.renderer) {
        window.game.renderer.addSplash(sternX, sternY, 3, 'rgba(255,255,255,0.4)');
      }
    }
  }

  handlePlayerControl(dt, input, projectiles) {
    // Steering
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) {
      this.angle -= this.turnRate * dt;
    }
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) {
      this.angle += this.turnRate * dt;
    }

    // Toggle sails with one press; keep accelerating while they remain open.
    if (input.isJustPressed('KeyW') || input.isJustPressed('ArrowUp')) {
      this.sailsOpen = !this.sailsOpen;
    }
    if (this.sailsOpen) {
      this.speed = Math.min(this.maxSpeed, this.speed + 80 * dt);
    } else if (input.isDown('KeyS') || input.isDown('ArrowDown')) {
      this.speed = Math.max(0, this.speed - 120 * dt);
    } else {
      // Natural water drag
      this.speed = Math.max(0, this.speed - 25 * dt);
    }

    // Fire Port (Left) Broadsides
    if ((input.isJustPressed('KeyQ') || input.isJustPressed('KeyJ')) && this.reloadTimerPort <= 0) {
      this.fireBroadside('port', projectiles);
    }

    // Fire Starboard (Right) Broadsides
    if ((input.isJustPressed('KeyE') || input.isJustPressed('KeyK')) && this.reloadTimerStarboard <= 0) {
      this.fireBroadside('starboard', projectiles);
    }

    // Fire forward bow cannons
    if (input.isJustPressed('KeyF') && this.reloadTimerBow <= 0) {
      this.fireBroadside('bow', projectiles);
    }

    // Repair Hull (Key R)
    if (input.isJustPressed('KeyR')) {
      if (this.hull < this.maxHull) {
        if (this.repairCooldown > 0) {
          if (window.game) window.game.showToast(`Repair crew ready in ${Math.ceil(this.repairCooldown)}s.`);
          return;
        }
        const repairedAmount = Math.min(40, this.maxHull - this.hull);
        this.hull += repairedAmount;
        this.repairCooldown = this.repairCooldownDuration;
        if (window.game) window.game.showToast(`Crew repaired hull (+${repairedAmount}).`);
        if (window.soundEngine) window.soundEngine.playCoin();
      } else if (window.game) {
        window.game.showToast("Hull already at full strength.");
      }
    }
  }

  handleAI(dt, targets, projectiles) {
    if (!targets || targets.length === 0 || this.isCrippled) return;
    const playerShip = targets[0];

    const dx = playerShip.x - this.x;
    const dy = playerShip.y - this.y;
    const dist = Math.hypot(dx, dy);
    const targetAngle = Math.atan2(dy, dx);

    // AI tries to circle and align broadside (perpendicular angle)
    const desiredAngle = targetAngle + (Math.PI / 2);
    let angleDiff = desiredAngle - this.angle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

    this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.turnRate * 0.7 * dt);
    this.speed = Math.min(this.maxSpeed, 120);

    // Fire broadsides if within range
    if (dist < 450) {
      if (this.reloadTimerPort <= 0 && Math.random() < 0.05) {
        this.fireBroadside('port', projectiles);
      }
      if (this.reloadTimerStarboard <= 0 && Math.random() < 0.05) {
        this.fireBroadside('starboard', projectiles);
      }
    }
  }

  fireBroadside(side, projectiles) {
    if (side === 'port') this.reloadTimerPort = this.reloadDuration;
    if (side === 'starboard') this.reloadTimerStarboard = this.reloadDuration;
    if (side === 'bow') this.reloadTimerBow = this.reloadDuration;

    if (window.soundEngine) window.soundEngine.playCannonFire();

    const fireAngle = side === 'bow'
      ? this.angle
      : this.angle + (side === 'port' ? -Math.PI / 2 : Math.PI / 2);
    const muzzleOffset = side === 'bow' ? this.width / 2 : 20;

    // Fire a battery of 3 cannonballs with small spread
    [-0.15, 0, 0.15].forEach(spread => {
      const cAngle = fireAngle + spread;
      const speed = 480;
      const ball = new Cannonball(
        this.x + Math.cos(fireAngle) * muzzleOffset,
        this.y + Math.sin(fireAngle) * muzzleOffset,
        Math.cos(cAngle) * speed,
        Math.sin(cAngle) * speed,
        this.isPlayer ? 35 : 20,
        this.isPlayer ? 'player_ship' : 'enemy_ship'
      );
      projectiles.push(ball);
    });

    if (window.game && window.game.renderer) {
      const smokeOffset = side === 'bow' ? this.width / 2 + 10 : 30;
      window.game.renderer.addSmoke(this.x + Math.cos(fireAngle) * smokeOffset, this.y + Math.sin(fireAngle) * smokeOffset, 14);
    }
  }

  takeDamage(amount) {
    if (this.isDestroyed || this.isCrippled) return;

    this.hull = Math.max(0, this.hull - amount);
    if (window.soundEngine) window.soundEngine.playNoiseBurst(0.4, 0.7, 400);

    if (this.hull <= 0) {
      this.speed = 0;
      if (this.isPlayer) {
        this.isDestroyed = true;
        if (window.game) window.game.triggerGameOver();
      } else {
        this.isCrippled = true;
        if (window.game) window.game.showToast("⚔ Enemy Flagship Crippled! Board her now! ⚔");
      }
    }
  }

  render(ctx, camera) {
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.angle);

    // Ship Hull (Top-down / 2.5D wooden galleon)
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;

    // Wooden hull body
    ctx.fillStyle = this.isPlayer ? '#451a03' : '#18181b';
    ctx.beginPath();
    ctx.moveTo(this.width / 2, 0); // Bow (front)
    ctx.bezierCurveTo(this.width * 0.25, -this.height / 2, -this.width * 0.35, -this.height / 2, -this.width / 2, -this.height * 0.35);
    ctx.lineTo(-this.width / 2, this.height * 0.35);
    ctx.bezierCurveTo(-this.width * 0.35, this.height / 2, this.width * 0.25, this.height / 2, this.width / 2, 0);
    ctx.closePath();
    ctx.fill();

    // Wood Planking Lines
    ctx.strokeStyle = this.isPlayer ? '#78350f' : '#27272a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Masts & Cross-beams
    ctx.fillStyle = '#b45309';
    [-20, 10].forEach(mastX => {
      ctx.fillRect(mastX - 4, -4, 8, 8); // Mast center
      ctx.fillRect(mastX - 2, -this.height * 0.45, 4, this.height * 0.9); // Yardarm
    });

    // White / Black billowing sails
    ctx.fillStyle = this.isPlayer ? '#f8fafc' : '#713f12';
    if (this.sailsOpen || !this.isPlayer) {
      ctx.fillRect(-22, -this.height * 0.4, 6, this.height * 0.8);
      ctx.fillRect(8, -this.height * 0.4, 6, this.height * 0.8);
    }

    // Pirate Jolly Roger Flag at Stern
    ctx.fillStyle = '#000';
    ctx.fillRect(-this.width / 2 - 12, -6, 12, 12);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-this.width / 2 - 6, -3, 3, 3); // Red pirate skull dot

    // Cannons on Port & Starboard flanks
    ctx.fillStyle = '#111';
    [-15, 0, 15].forEach(cX => {
      ctx.fillRect(cX - 2, -this.height / 2 - 3, 4, 5); // Port gun
      ctx.fillRect(cX - 2, this.height / 2 - 2, 4, 5);  // Starboard gun
    });

    ctx.restore();

    // Render Ship Health Bar
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(sx - 40, sy - 40, 80, 8);
    ctx.fillStyle = this.isPlayer ? '#22c55e' : '#ef4444';
    ctx.fillRect(sx - 40, sy - 40, (this.hull / this.maxHull) * 80, 8);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 40, sy - 40, 80, 8);

    ctx.font = "bold 11px 'Cinzel', serif";
    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, sx, sy - 45);
    ctx.restore();
  }
}

/* ==========================================================================
   CANNONBALL PROJECTILE CLASS
   ========================================================================== */

class Cannonball {
  constructor(x, y, vx, vy, damage, source) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.source = source;
    this.life = 2.0;
  }

  update(dt, playerShip, enemyShips) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.life <= 0) return true;

    // Check hit against ships
    if (this.source === 'player_ship') {
      for (const enemy of enemyShips) {
        if (!enemy.isDestroyed && Math.hypot(enemy.x - this.x, enemy.y - this.y) < 45) {
          enemy.takeDamage(this.damage);
          if (window.soundEngine) window.soundEngine.playNoiseBurst(0.2, 0.8, 600);
          return true;
        }
      }
    } else {
      if (playerShip && Math.hypot(playerShip.x - this.x, playerShip.y - this.y) < 45) {
        playerShip.takeDamage(this.damage);
        return true;
      }
    }

    return false;
  }

  render(ctx, camera) {
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;

    ctx.save();
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fill();
    // Shiny iron highlight
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(sx - 2, sy - 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
