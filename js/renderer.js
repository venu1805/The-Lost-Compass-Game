/* ==========================================================================
   RENDERER & VISUAL EFFECTS ENGINE - The Lost Compass
   Multi-layer Parallax, Dynamic Lighting, Weather Particles & Post-Processing
   ========================================================================== */

// Polyfill roundRect if not present
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    if (!radii) radii = 0;
    const r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? radii[0] : 0);
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.lightsCanvas = document.createElement('canvas');
    this.lightsCtx = this.lightsCanvas.getContext('2d');

    // Weather & Particle Systems
    this.particles = [];
    this.ambientParticles = [];
    this.maxAmbient = 100;

    // Weather states: 'clear', 'storm', 'jungle', 'underwater', 'sunset'
    this.weather = 'storm';
    this.lightningTimer = 0;
    this.isLightning = false;

    // Camera view
    this.camera = { x: 0, y: 0, width: 0, height: 0, target: null };

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
    this.lightsCanvas.width = this.width;
    this.lightsCanvas.height = this.height;
    this.camera.width = this.width;
    this.camera.height = this.height;
  }

  setWeather(type) {
    this.weather = type;
    this.ambientParticles = [];
  }

  update(dt) {
    // Lightning generator during storm
    if (this.weather === 'storm') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        if (Math.random() < 0.3) {
          this.isLightning = true;
          this.lightningTimer = 0.15; // flash duration
          if (window.soundEngine) window.soundEngine.playThunder();
        } else {
          this.isLightning = false;
          this.lightningTimer = 3.0 + Math.random() * 6.0;
        }
      }
    } else {
      this.isLightning = false;
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Maintain weather-specific ambient particles
    this.updateAmbientWeatherParticles(dt);

    // Update Camera tracking target smoothly
    if (this.camera.target) {
      const targetX = this.camera.target.x + this.camera.target.width / 2 - this.width / 2;
      const targetY = this.camera.target.y + this.camera.target.height / 2 - this.height / 2;
      this.camera.x += (targetX - this.camera.x) * 6.0 * dt;
      this.camera.y += (targetY - this.camera.y) * 6.0 * dt;
    }
  }

  updateAmbientWeatherParticles(dt) {
    // Generate new particles if needed
    if (this.ambientParticles.length < this.maxAmbient) {
      if (this.weather === 'storm') {
        // Rain particles
        this.ambientParticles.push({
          x: this.camera.x + Math.random() * this.width,
          y: this.camera.y - 40,
          vx: -350 - Math.random() * 150,
          vy: 800 + Math.random() * 400,
          len: 18 + Math.random() * 12,
          type: 'rain'
        });
      } else if (this.weather === 'jungle') {
        // Drifting leaves / pollen
        this.ambientParticles.push({
          x: this.camera.x + Math.random() * this.width,
          y: this.camera.y - 20,
          vx: -40 + Math.random() * 80,
          vy: 60 + Math.random() * 60,
          size: 4 + Math.random() * 4,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 3,
          type: 'leaf'
        });
      } else if (this.weather === 'underwater') {
        // Rising air bubbles & glowing bioluminescent spores
        this.ambientParticles.push({
          x: this.camera.x + Math.random() * this.width,
          y: this.camera.y + this.height + 20,
          vx: (Math.random() - 0.5) * 30,
          vy: -60 - Math.random() * 70,
          size: 2 + Math.random() * 5,
          type: Math.random() > 0.4 ? 'bubble' : 'spore'
        });
      } else if (this.weather === 'sunset' || this.weather === 'volcano') {
        // Floating embers
        this.ambientParticles.push({
          x: this.camera.x + Math.random() * this.width,
          y: this.camera.y + this.height + 20,
          vx: (Math.random() - 0.5) * 50,
          vy: -80 - Math.random() * 80,
          size: 2 + Math.random() * 3,
          alpha: 1.0,
          type: 'ember'
        });
      }
    }

    // Update active ambient particles
    for (let i = this.ambientParticles.length - 1; i >= 0; i--) {
      const p = this.ambientParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vrot) p.rot += p.vrot * dt;

      // Wrap around bounds
      if (p.type === 'rain' && p.y > this.camera.y + this.height) {
        this.ambientParticles.splice(i, 1);
      } else if (p.type === 'leaf' && p.y > this.camera.y + this.height) {
        this.ambientParticles.splice(i, 1);
      } else if ((p.type === 'bubble' || p.type === 'spore' || p.type === 'ember') && p.y < this.camera.y - 30) {
        this.ambientParticles.splice(i, 1);
      }
    }
  }

  addSplash(x, y, count = 12, color = '#e0f2fe') {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 1.2) + Math.random() * (Math.PI * 0.6);
      const speed = 120 + Math.random() * 240;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 600,
        size: 2 + Math.random() * 3,
        color,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        type: 'splash'
      });
    }
  }

  addSparks(x, y, count = 8, color = '#fef08a') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 180;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 300,
        size: 2 + Math.random() * 2,
        color,
        life: 0.25 + Math.random() * 0.25,
        type: 'spark'
      });
    }
  }

  addSmoke(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 60,
        vy: -40 - Math.random() * 50,
        size: 8 + Math.random() * 12,
        alpha: 0.7,
        life: 0.8 + Math.random() * 0.5,
        maxLife: 1.3,
        type: 'smoke'
      });
    }
  }

  /* -------------------------------------------------------------------------
     PARALLAX SKY & ENVIRONMENT BACKGROUNDS
     ------------------------------------------------------------------------- */

  renderParallaxBackground(levelId) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();

    if (levelId === 1) { // Stormy Open Sea
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, this.isLightning ? '#94a3b8' : '#080d1a');
      skyGrad.addColorStop(0.6, '#0f172a');
      skyGrad.addColorStop(1, '#020617');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Rolling storm clouds parallax
      const cloudOffset = (this.camera.x * 0.1 + Date.now() * 0.02) % 600;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      for (let x = -600; x < w + 600; x += 300) {
        ctx.beginPath();
        ctx.arc(x - cloudOffset, 120, 180, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (levelId === 2) { // The Hidden Island (Tropical Jungle & Mountains)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#0284c7');
      skyGrad.addColorStop(0.5, '#38bdf8');
      skyGrad.addColorStop(0.8, '#bae6fd');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Distant lush volcanic mountains
      ctx.fillStyle = '#0f4c3a';
      const mtnOffset = (this.camera.x * 0.15) % w;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.65);
      ctx.lineTo(w * 0.25 - mtnOffset, h * 0.35);
      ctx.lineTo(w * 0.6 - mtnOffset, h * 0.7);
      ctx.lineTo(w * 0.85 - mtnOffset, h * 0.38);
      ctx.lineTo(w + 200, h * 0.75);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // Midground jungle silhouette
      ctx.fillStyle = '#14532d';
      const jungleOffset = (this.camera.x * 0.35) % 400;
      for (let x = -400; x < w + 400; x += 180) {
        ctx.beginPath();
        ctx.arc(x - jungleOffset, h * 0.7, 120, Math.PI, 0);
        ctx.fill();
      }
    } else if (levelId === 3) { // Port Royale (Town at Dusk)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#1e1b4b');
      skyGrad.addColorStop(0.4, '#701a75');
      skyGrad.addColorStop(0.8, '#d97706');
      skyGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Town silhouette (galleon masts and colonial rooftops)
      ctx.fillStyle = '#09090b';
      const townOffset = (this.camera.x * 0.2) % 500;
      for (let x = -500; x < w + 500; x += 220) {
        ctx.fillRect(x - townOffset, h * 0.65, 140, h * 0.35);
        // Gable roof
        ctx.beginPath();
        ctx.moveTo(x - townOffset - 10, h * 0.65);
        ctx.lineTo(x - townOffset + 70, h * 0.55);
        ctx.lineTo(x - townOffset + 150, h * 0.65);
        ctx.closePath();
        ctx.fill();
      }
    } else if (levelId === 4) { // Open Sea Naval Battle
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#1e293b');
      skyGrad.addColorStop(0.6, '#475569');
      skyGrad.addColorStop(0.9, '#94a3b8');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);
    } else if (levelId === 5) { // The Cursed Caves (Underwater Abyss)
      const deepGrad = ctx.createLinearGradient(0, 0, 0, h);
      deepGrad.addColorStop(0, '#022c22');
      deepGrad.addColorStop(0.5, '#064e3b');
      deepGrad.addColorStop(1, '#021e17');
      ctx.fillStyle = deepGrad;
      ctx.fillRect(0, 0, w, h);

      // Bioluminescent underwater rock arches
      ctx.fillStyle = '#011c14';
      for (let x = 0; x < w; x += 280) {
        ctx.beginPath();
        ctx.arc(x, 0, 160, 0, Math.PI);
        ctx.fill();
      }
    } else if (levelId === 6) {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#0f172a');
      skyGrad.addColorStop(0.7, '#334155');
      skyGrad.addColorStop(1, '#020617');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      for (let x = 50; x < w; x += 110) ctx.fillRect(x, h * 0.35, 8, h * 0.4);
    } else if (levelId === 7) {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#0c1d2b');
      skyGrad.addColorStop(0.65, '#164e63');
      skyGrad.addColorStop(1, '#111827');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);
    } else if (levelId === 8 || levelId === 9 || levelId === 11) {
      const deepGrad = ctx.createLinearGradient(0, 0, 0, h);
      deepGrad.addColorStop(0, '#083344');
      deepGrad.addColorStop(0.55, '#155e75');
      deepGrad.addColorStop(1, '#082f49');
      ctx.fillStyle = deepGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(8, 47, 73, 0.55)';
      for (let x = 0; x < w; x += 240) ctx.fillRect(x, h * 0.55, 120, h * 0.45);
    } else if (levelId === 10 || levelId === 13) {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#172554');
      skyGrad.addColorStop(0.65, '#475569');
      skyGrad.addColorStop(1, '#1c1917');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#111827';
      for (let x = 0; x < w; x += 180) ctx.fillRect(x, h * 0.62, 110, h * 0.38);
    } else if (levelId === 12) {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#111827');
      skyGrad.addColorStop(0.6, '#164e63');
      skyGrad.addColorStop(1, '#020617');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);
    } else if (levelId === 14) {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#111827');
      skyGrad.addColorStop(0.6, '#475569');
      skyGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);
    } else if (levelId === 15) { // The Final Treasure (Citadel at Golden Sunset)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#450a0a');
      skyGrad.addColorStop(0.3, '#991b1b');
      skyGrad.addColorStop(0.7, '#ea580c');
      skyGrad.addColorStop(1, '#facc15');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Dramatic golden Sun
      ctx.fillStyle = '#fef08a';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(w * 0.75, h * 0.35, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Citadel ancient ramparts
      ctx.fillStyle = '#1c1917';
      const fortOffset = (this.camera.x * 0.2) % 600;
      for (let x = -600; x < w + 600; x += 320) {
        ctx.fillRect(x - fortOffset, h * 0.6, 220, h * 0.4);
      }
    }

    ctx.restore();
  }

  /* -------------------------------------------------------------------------
     RENDER WEATHER PARTICLES & DYNAMIC LIGHTING
     ------------------------------------------------------------------------- */

  renderWeatherOverlay() {
    const ctx = this.ctx;
    ctx.save();

    // Render Ambient Particles
    this.ambientParticles.forEach(p => {
      const sx = p.x - this.camera.x;
      const sy = p.y - this.camera.y;

      if (p.type === 'rain') {
        ctx.strokeStyle = 'rgba(224, 242, 254, 0.45)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (p.vx * 0.02), sy + p.len);
        ctx.stroke();
      } else if (p.type === 'leaf') {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.rot);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.7)';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'bubble') {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.fillStyle = 'rgba(224, 242, 254, 0.2)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.type === 'spore') {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.8)';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (p.type === 'ember') {
        ctx.fillStyle = 'rgba(249, 115, 22, 0.85)';
        ctx.shadowColor = '#ea580c';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Render Active Action Particles (sparks, splashes, smoke)
    this.particles.forEach(p => {
      const sx = p.x - this.camera.x;
      const sy = p.y - this.camera.y;

      if (p.type === 'splash' || p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'smoke') {
        const alpha = (p.life / p.maxLife) * p.alpha;
        ctx.fillStyle = `rgba(180, 180, 180, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();
  }

  /* -------------------------------------------------------------------------
     DYNAMIC LIGHTING PASS
     ------------------------------------------------------------------------- */

  beginLightingPass(ambientDarkness = 0.55) {
    const lCtx = this.lightsCtx;
    lCtx.clearRect(0, 0, this.width, this.height);

    // Fill with ambient darkness
    lCtx.fillStyle = `rgba(5, 8, 15, ${ambientDarkness})`;
    lCtx.fillRect(0, 0, this.width, this.height);
    lCtx.globalCompositeOperation = 'destination-out';
  }

  addPointLight(worldX, worldY, radius, intensity = 1.0, color = 'rgba(255, 220, 150, 1.0)') {
    const lCtx = this.lightsCtx;
    const sx = worldX - this.camera.x;
    const sy = worldY - this.camera.y;

    if (sx < -radius || sx > this.width + radius || sy < -radius || sy > this.height + radius) return;

    const grad = lCtx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    grad.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
    grad.addColorStop(0.4, `rgba(255, 255, 255, ${intensity * 0.7})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    lCtx.fillStyle = grad;
    lCtx.beginPath();
    lCtx.arc(sx, sy, radius, 0, Math.PI * 2);
    lCtx.fill();
  }

  compositeLighting() {
    this.lightsCtx.globalCompositeOperation = 'source-over';
    this.ctx.save();
    this.ctx.drawImage(this.lightsCanvas, 0, 0);
    this.ctx.restore();
  }
}
