/* ==========================================================================
   THE LOST COMPASS - CORE ARTIFACT SYSTEM
   "The compass doesn't point north. It points to what you desire most."
   ========================================================================== */

class MysticCompass {
  constructor() {
    this.hasCompass = false; // Player obtains it in Level 1
    this.target = null;      // Current objective position {x, y, label, type}
    this.angle = 0;          // Current needle angle (radians)
    this.targetAngle = 0;
    this.jitter = 0;         // Mystical supernatural jitter
    
    // Spectral Vision Ability (Press 'C')
    this.isSpectralActive = false;
    this.spectralDuration = 6.0; // 6 seconds active
    this.spectralTimer = 0;
    this.spectralCooldown = 12.0;
    this.cooldownTimer = 0;

    // Pulse effect
    this.pulseRings = [];

    // DOM needle element reference
    this.needlePivot = null;
    this.compassWidget = null;
  }

  init() {
    this.needlePivot = document.getElementById('compass-needle-pivot');
    this.compassWidget = document.getElementById('compass-widget');

    if (this.compassWidget) {
      this.compassWidget.addEventListener('click', () => {
        this.activateSpectralVision();
      });
    }
  }

  setTarget(x, y, label = "Objective", type = "quest") {
    this.target = { x, y, label, type };
  }

  clearTarget() {
    this.target = null;
  }

  activateSpectralVision() {
    if (!this.hasCompass) {
      if (window.game) window.game.showToast("You haven't found the compass yet!");
      return;
    }
    if (this.cooldownTimer > 0) {
      if (window.game) window.game.showToast(`Compass recharging... (${Math.ceil(this.cooldownTimer)}s)`);
      return;
    }

    this.isSpectralActive = true;
    this.spectralTimer = this.spectralDuration;
    this.cooldownTimer = this.spectralCooldown;

    if (window.soundEngine) {
      window.soundEngine.playCompassTone();
    }
    if (window.game) {
      window.game.showToast("✧ Spectral Sight Activated! ✧");
      // Add visual pulse wave from player
      const p = window.game.player;
      if (p) {
        this.pulseRings.push({
          x: p.x + p.width / 2,
          y: p.y + p.height / 2,
          radius: 10,
          maxRadius: 500,
          alpha: 1.0
        });
      }
    }
  }

  update(dt, playerX, playerY) {
    if (!this.hasCompass) {
      // Idle slow spin if not owned
      this.angle += dt * 0.5;
      this.updateDOMNeedle();
      return;
    }

    // Cooldown and active timer
    if (this.spectralTimer > 0) {
      this.spectralTimer -= dt;
      if (this.spectralTimer <= 0) {
        this.isSpectralActive = false;
      }
    }
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= dt;
    }

    // Update pulse rings
    for (let i = this.pulseRings.length - 1; i >= 0; i--) {
      const ring = this.pulseRings[i];
      ring.radius += 450 * dt;
      ring.alpha = Math.max(0, 1 - (ring.radius / ring.maxRadius));
      if (ring.radius >= ring.maxRadius) {
        this.pulseRings.splice(i, 1);
      }
    }

    // Calculate direction to target
    if (this.target) {
      const dx = this.target.x - playerX;
      const dy = this.target.y - playerY;
      this.targetAngle = Math.atan2(dy, dx) + Math.PI / 2; // Orient North upward

      // Supernatural twitching/jitter
      this.jitter = (Math.sin(Date.now() * 0.008) * 0.15) + ((Math.random() - 0.5) * 0.08);

      // Smooth interpolation toward target angle
      let diff = this.targetAngle - this.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.angle += diff * 5.0 * dt;
    } else {
      // Wandering needle looking for a desires
      this.angle += Math.sin(Date.now() * 0.003) * 0.04;
      this.jitter = (Math.random() - 0.5) * 0.05;
    }

    this.updateDOMNeedle();
  }

  updateDOMNeedle() {
    if (!this.needlePivot) return;
    const deg = (this.angle + this.jitter) * (180 / Math.PI);
    this.needlePivot.style.transform = `rotate(${deg}deg)`;

    if (this.compassWidget) {
      if (this.isSpectralActive) {
        this.compassWidget.style.borderColor = "#22d3ee";
        this.compassWidget.style.boxShadow = "0 0 25px rgba(34, 211, 238, 0.9)";
      } else if (this.hasCompass) {
        this.compassWidget.style.borderColor = "var(--gold-primary)";
        this.compassWidget.style.boxShadow = "0 0 15px rgba(212, 175, 55, 0.4)";
      } else {
        this.compassWidget.style.borderColor = "#555";
        this.compassWidget.style.boxShadow = "none";
      }
    }
  }

  renderSpectralOverlay(ctx, camera) {
    if (!this.isSpectralActive && this.pulseRings.length === 0) return;

    ctx.save();

    // Render pulse expanding waves
    this.pulseRings.forEach(ring => {
      const screenX = ring.x - camera.x;
      const screenY = ring.y - camera.y;

      ctx.beginPath();
      ctx.arc(screenX, screenY, ring.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(34, 211, 238, ${ring.alpha * 0.8})`;
      ctx.lineWidth = 4;
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 15;
      ctx.stroke();
    });

    // If spectral sight is currently active, draw magical particle trail to target
    if (this.isSpectralActive && this.target && window.game && window.game.player) {
      const p = window.game.player;
      const startX = p.x + p.width / 2 - camera.x;
      const startY = p.y + p.height / 2 - camera.y;
      const endX = this.target.x - camera.x;
      const endY = this.target.y - camera.y;

      // Draw glowing ethereal dotted trail
      ctx.beginPath();
      ctx.setLineDash([8, 12]);
      ctx.lineDashOffset = -Date.now() * 0.05;
      ctx.moveTo(startX, startY);
      
      // Curving bezier trail to make it look supernatural
      const midX = (startX + endX) / 2 + Math.sin(Date.now() * 0.003) * 60;
      const midY = (startY + endY) / 2 + Math.cos(Date.now() * 0.003) * 40;
      ctx.quadraticCurveTo(midX, midY, endX, endY);

      ctx.strokeStyle = "rgba(34, 211, 238, 0.7)";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw target beacon glyph
      ctx.beginPath();
      ctx.arc(endX, endY, 18 + Math.sin(Date.now() * 0.01) * 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(34, 211, 238, 0.3)";
      ctx.fill();
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = "bold 12px 'Cinzel', serif";
      ctx.fillStyle = "#22d3ee";
      ctx.textAlign = "center";
      ctx.fillText(this.target.label, endX, endY - 26);
    }

    ctx.restore();
  }
}

window.mysticCompass = new MysticCompass();
