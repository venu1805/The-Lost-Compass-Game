/* ==========================================================================
   GAME ENGINE & STATE MANAGER - The Lost Compass
   Core Game Loop, Input Processing, Level Transitions & State Machine
   ========================================================================== */

const TOTAL_CAMPAIGN_LEVELS = 15;

class InputManager {
  constructor() {
    this.keys = {};
    this.justPressed = {};
    this.mouse = { x: 0, y: 0, isDown: false, rightDown: false };

    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) {
        this.justPressed[e.code] = true;
      }
      this.keys[e.code] = true;

      // Prevent default scrolling for game keys
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.isDown = true;
        this.justPressed['MouseLeft'] = true;
      } else if (e.button === 2) {
        this.mouse.rightDown = true;
        this.justPressed['MouseRight'] = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.isDown = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    document.querySelectorAll('[data-touch-key]').forEach(button => {
      const code = button.dataset.touchKey;
      const press = (event) => {
        event.preventDefault();
        this.pressKey(code);
        button.classList.add('is-pressed');
        if (button.setPointerCapture && event.pointerId !== undefined) {
          button.setPointerCapture(event.pointerId);
        }
      };
      const release = () => {
        this.releaseKey(code);
        button.classList.remove('is-pressed');
      };

      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
    });

    window.addEventListener('blur', () => {
      Object.keys(this.keys).forEach(code => this.releaseKey(code));
      document.querySelectorAll('[data-touch-key]').forEach(button => button.classList.remove('is-pressed'));
    });
  }

  pressKey(code) {
    if (!this.keys[code]) this.justPressed[code] = true;
    this.keys[code] = true;
  }

  releaseKey(code) {
    this.keys[code] = false;
  }

  isDown(code) {
    return !!this.keys[code];
  }

  isJustPressed(code) {
    return !!this.justPressed[code];
  }

  clearFrame() {
    this.justPressed = {};
  }
}

class GameEngine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new GameRenderer(this.canvas);
    this.input = new InputManager();

    this.player = new Player(100, 480);
    this.currentLevelIndex = 1;
    this.currentLevel = null;
    this.saveStorageKey = 'the-lost-compass-checkpoint-v1';

    // States: 'TITLE', 'PLAYING', 'PAUSED', 'LEVEL_COMPLETE', 'GAMEOVER', 'VICTORY'
    this.state = 'TITLE';
    this.lastTime = 0;

    // Toast notifications
    this.toastContainer = document.getElementById('toast-container');

    // UI elements
    this.objectiveTextEl = document.getElementById('current-objective-text');
    this.levelBadgeEl = document.getElementById('current-level-badge');
    this.objectiveHintEl = document.getElementById('current-objective-hint');
    this.objectiveBannerEl = document.querySelector('.objective-banner');
    this.objectiveInfoTimer = 0;
  }

  init() {
    window.mysticCompass.init();
    window.inventorySystem.init();
    window.dialogueSystem.init();

    this.setupUIEventListeners();
    this.loadLevel(1);
    this.updateContinueButton();

    // Start Animation Loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  setupUIEventListeners() {
    const pauseButton = document.getElementById('btn-pause-game');
    const resumeButton = document.getElementById('btn-resume-game');
    const restartButton = document.getElementById('btn-restart-level');
    const mainMenuButton = document.getElementById('btn-main-menu');

    if (pauseButton) pauseButton.addEventListener('click', () => this.pauseGame());
    const levelInfoButton = document.getElementById('btn-level-info');
    if (levelInfoButton) {
      levelInfoButton.addEventListener('click', () => this.showObjectiveInfo());
    }
    if (resumeButton) resumeButton.addEventListener('click', () => this.resumeGame());
    if (restartButton) {
      restartButton.addEventListener('click', () => {
        document.getElementById('pause-modal').classList.remove('active');
        this.loadLevel(this.currentLevelIndex);
        this.state = 'PLAYING';
      });
    }
    if (mainMenuButton) {
      mainMenuButton.addEventListener('click', () => {
        document.getElementById('pause-modal').classList.remove('active');
        this.loadLevel(1);
        this.state = 'TITLE';
        document.getElementById('title-screen').style.display = 'flex';
      });
    }

    const continueButton = document.getElementById('btn-continue-game');
    if (continueButton) continueButton.addEventListener('click', () => this.continueGame());

    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Escape') return;
      event.preventDefault();
      if (this.state === 'PLAYING') this.pauseGame();
      else if (this.state === 'PAUSED') this.resumeGame();
    });

    // Title screen Play button
    const playBtn = document.getElementById('btn-play-game');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        this.startNewGame();
      });
    }

    // Title screen Level Select button
    const levelSelectBtn = document.getElementById('btn-level-select');
    const levelModal = document.getElementById('level-select-modal');
    const closeLevelBtn = document.getElementById('close-level-select');

    if (levelSelectBtn && levelModal) {
      levelSelectBtn.addEventListener('click', () => {
        levelModal.classList.add('active');
      });
    }
    if (closeLevelBtn && levelModal) {
      closeLevelBtn.addEventListener('click', () => {
        levelModal.classList.remove('active');
      });
    }

    // Level select buttons inside modal
    document.querySelectorAll('.select-level-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const levelButton = e.target.closest('.select-level-btn');
        const lvl = parseInt(levelButton && levelButton.dataset.level, 10);
        if (lvl) {
          levelModal.classList.remove('active');
          document.getElementById('title-screen').style.display = 'none';
          window.soundEngine.resume();
          this.loadLevel(lvl);
          this.state = 'PLAYING';
          window.soundEngine.playLevelMusic(lvl);
        }
      });
    });

    // Level Complete Next button
    const nextLvlBtn = document.getElementById('btn-next-level');
    if (nextLvlBtn) {
      nextLvlBtn.addEventListener('click', () => {
        document.getElementById('level-complete-modal').classList.remove('active');
        if (this.currentLevelIndex < TOTAL_CAMPAIGN_LEVELS) {
          this.loadLevel(this.currentLevelIndex + 1);
          this.state = 'PLAYING';
          window.soundEngine.playLevelMusic(this.currentLevelIndex);
        } else {
          this.state = 'VICTORY';
        }
      });
    }

    // Respawn button
    const respawnBtn = document.getElementById('btn-respawn');
    if (respawnBtn) {
      respawnBtn.addEventListener('click', () => {
        document.getElementById('game-over-modal').classList.remove('active');
        this.loadLevel(this.currentLevelIndex);
        this.state = 'PLAYING';
        this.player.isDead = false;
        this.player.health = this.player.maxHealth;
        this.player.stamina = this.player.maxStamina;
      });
    }

    // Ending Choice Buttons (Level 15)
    const btnGold = document.getElementById('btn-choice-gold');
    const btnCurse = document.getElementById('btn-choice-curse');
    if (btnGold) {
      btnGold.addEventListener('click', () => this.finalizeEnding('gold'));
    }
    if (btnCurse) {
      btnCurse.addEventListener('click', () => this.finalizeEnding('curse'));
    }

    // Hotbar action buttons
    const btnAttack = document.getElementById('btn-attack-action');
    const btnPistol = document.getElementById('btn-shoot-action');
    const btnDodge = document.getElementById('btn-dodge-action');
    const btnCompass = document.getElementById('btn-compass-action');

    if (btnAttack) {
      btnAttack.addEventListener('click', () => {
        if (this.state === 'PLAYING' && !this.currentLevel.isNavalBattle) {
          this.player.isAttacking = true;
          this.player.attackTimer = 0.28;
          this.player.performMeleeAttack(this.currentLevel);
        }
      });
    }
    if (btnPistol) {
      btnPistol.addEventListener('click', () => {
        if (this.state !== 'PLAYING') return;
        if (this.currentLevel.isNavalBattle) {
          const ship = this.currentLevel.playerShip;
          if (ship.reloadTimerBow <= 0) {
            ship.fireBroadside('bow', this.currentLevel.projectiles);
          }
        } else {
          this.player.shootPistol(this.currentLevel);
        }
      });
    }
    if (btnDodge) {
      btnDodge.addEventListener('click', () => {
        if (this.state === 'PLAYING' && !this.currentLevel.isNavalBattle) {
          this.player.isDodging = true;
          this.player.dodgeTimer = 0.35;
          this.player.invulnerableTimer = 0.35;
        }
      });
    }
    if (btnCompass) {
      btnCompass.addEventListener('click', () => {
        window.mysticCompass.activateSpectralVision();
      });
    }
  }

  loadLevel(levelIndex) {
    this.currentLevelIndex = levelIndex;

    // Reset player position and camera target
    this.player.x = 100;
    this.player.y = 480;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.isDead = false;
    this.renderer.camera.target = this.player;

    switch (levelIndex) {
      case 1:
        this.currentLevel = new Level1_TheStorm(this);
        break;
      case 2:
        this.currentLevel = new Level2_TheHiddenIsland(this);
        break;
      case 3:
        this.currentLevel = new Level3_PortRoyale(this);
        break;
      case 4:
        this.currentLevel = new Level4_NavalBattle(this);
        break;
      case 5:
        this.currentLevel = new Level5_TheCursedCaves(this);
        break;
      case 6:
      case 7:
      case 8:
      case 9:
      case 10:
      case 11:
      case 12:
      case 13:
      case 14:
        this.currentLevel = new CampaignAdventureLevel(this, levelIndex, EXPANDED_CAMPAIGN_LEVELS[levelIndex]);
        break;
      case 15:
        this.currentLevel = new Level15_TheFinalTreasure(this);
        break;
      default:
        this.currentLevel = new Level1_TheStorm(this);
    }

    this.currentLevel.init();
    this.currentLevel.alignLaddersToWalls?.();
    const shootButton = document.getElementById('btn-shoot-action');
    if (shootButton) {
      const isNavalBattle = this.currentLevel.isNavalBattle;
      shootButton.innerHTML = isNavalBattle
        ? '💥 Bow Fire <span class="key">F</span>'
        : '🔫 Shot <span class="key">F</span>';
      shootButton.title = isNavalBattle ? 'Fire bow cannons' : 'Flintlock Shot';
    }
    this.updateObjectiveBanner();
  }

  readCheckpoint() {
    try {
      const checkpoint = JSON.parse(localStorage.getItem(this.saveStorageKey));
      if (!checkpoint || checkpoint.version !== 1 || !Number.isInteger(checkpoint.levelIndex) || checkpoint.levelIndex < 1 || checkpoint.levelIndex > TOTAL_CAMPAIGN_LEVELS) {
        return null;
      }
      return checkpoint;
    } catch (error) {
      return null;
    }
  }

  updateContinueButton() {
    const button = document.getElementById('btn-continue-game');
    if (button) button.hidden = !this.readCheckpoint();
  }

  saveCheckpoint(levelIndex) {
    try {
      const checkpoint = {
        version: 1,
        levelIndex,
        inventory: window.inventorySystem.getSaveData(),
        player: {
          health: this.player.health,
          stamina: this.player.stamina,
          oxygen: this.player.oxygen
        }
      };
      localStorage.setItem(this.saveStorageKey, JSON.stringify(checkpoint));
      this.updateContinueButton();
    } catch (error) {
      this.showToast('Could not save voyage progress in this browser.');
    }
  }

  startNewGame() {
    try {
      localStorage.removeItem(this.saveStorageKey);
    } catch (error) {}
    window.inventorySystem.resetForNewGame();
    window.mysticCompass.hasCompass = false;
    window.mysticCompass.isSpectralActive = false;
    this.player.health = this.player.maxHealth;
    this.player.stamina = this.player.maxStamina;
    this.player.oxygen = this.player.maxOxygen;
    this.loadLevel(1);
    this.state = 'PLAYING';
    document.getElementById('title-screen').style.display = 'none';
    window.soundEngine.resume();
    window.soundEngine.playLevelMusic(1);
    this.saveCheckpoint(1);
  }

  continueGame() {
    const checkpoint = this.readCheckpoint();
    if (!checkpoint) {
      this.updateContinueButton();
      return;
    }

    window.inventorySystem.restoreSaveData(checkpoint.inventory);
    this.loadLevel(checkpoint.levelIndex);
    this.player.health = Math.max(1, Math.min(this.player.maxHealth, checkpoint.player?.health || this.player.maxHealth));
    this.player.stamina = Math.max(0, Math.min(this.player.maxStamina, checkpoint.player?.stamina || this.player.maxStamina));
    this.player.oxygen = Math.max(0, Math.min(this.player.maxOxygen, checkpoint.player?.oxygen || this.player.maxOxygen));
    window.mysticCompass.hasCompass = window.inventorySystem.hasItem('compass');
    window.mysticCompass.isSpectralActive = false;
    this.state = 'PLAYING';
    document.getElementById('title-screen').style.display = 'none';
    window.soundEngine.resume();
    window.soundEngine.playLevelMusic(checkpoint.levelIndex);
  }

  updateObjectiveBanner() {
    if (this.objectiveTextEl && this.currentLevel) {
      this.objectiveTextEl.innerText = this.currentLevel.objective;
    }
    if (this.levelBadgeEl) {
      this.levelBadgeEl.innerText = `LEVEL ${this.currentLevelIndex}`;
    }
    this.updateObjectiveGuidance();
    this.showObjectiveInfo();
  }

  getObjectiveHint() {
    if (!this.currentLevel) return '';
    switch (this.currentLevelIndex) {
      case 1:
        return window.inventorySystem.hasItem('compass')
          ? 'Next: Reach the escape dinghy at the ship’s stern.'
          : 'Next: Find the compass in the captain’s quarters.';
      case 2:
        return this.currentLevel.puzzleSolved
          ? 'Next: Examine the ancient tablet.'
          : 'Next: Align the three statues in the sanctuary.';
      case 3:
        return this.currentLevel.enemies.some(enemy => enemy.type === 'marine')
          ? 'Next: Defeat the spy, then speak with First Mate Flint.'
          : 'Next: Ask Barnaby and Rouge about the spy.';
      case 4:
        return 'Next: Sink The Black Dread and claim its sea chart.';
      case 5:
        return this.currentLevel.gateOpen
          ? 'Next: Follow the compass to the Spectral Guardian.'
          : 'Next: Find the ancient lever and raise the water gate.';
      case 6:
      case 7:
      case 8:
      case 9:
      case 10:
      case 11:
      case 12:
      case 13:
      case 14:
        return this.currentLevel.activeHint || '';
      case 15:
        return this.currentLevel.boss?.isDead
          ? 'Next: Examine the altar to decide the compass’s fate.'
          : 'Next: Defeat Davy’s Shade, then reach the altar.';
      default:
        return '';
    }
  }

  updateObjectiveGuidance() {
    if (!this.objectiveHintEl) return;
    const hint = this.getObjectiveHint();
    if (hint !== this.lastObjectiveHint) {
      this.objectiveHintEl.textContent = hint;
      this.lastObjectiveHint = hint;
      this.showObjectiveInfo();
    }
  }

  showObjectiveInfo() {
    if (!this.objectiveBannerEl) return;
    this.objectiveBannerEl.classList.remove('is-hidden');
    this.objectiveInfoTimer = 6;
  }

  updateObjectiveInfoTimer(dt) {
    if (this.objectiveInfoTimer <= 0) return;
    this.objectiveInfoTimer = Math.max(0, this.objectiveInfoTimer - dt);
    if (this.objectiveInfoTimer === 0 && this.objectiveBannerEl) {
      this.objectiveBannerEl.classList.add('is-hidden');
    }
  }

  pauseGame() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    document.getElementById('pause-modal').classList.add('active');
  }

  resumeGame() {
    if (this.state !== 'PAUSED') return;
    document.getElementById('pause-modal').classList.remove('active');
    this.state = 'PLAYING';
  }

  completeLevel() {
    this.state = 'LEVEL_COMPLETE';
    if (this.currentLevelIndex < TOTAL_CAMPAIGN_LEVELS) this.saveCheckpoint(this.currentLevelIndex + 1);
    if (window.soundEngine) window.soundEngine.playChestOpen();

    const modal = document.getElementById('level-complete-modal');
    const title = document.getElementById('level-complete-title');
    const desc = document.getElementById('level-complete-desc');

    if (modal && title && desc) {
      title.innerText = `Level ${this.currentLevelIndex} Completed!`;
      desc.innerText = `You have conquered ${this.currentLevel.name}. Prepare for the perils that lie ahead!`;
      modal.classList.add('active');
    }
  }

  triggerGameOver() {
    this.state = 'GAMEOVER';
    const modal = document.getElementById('game-over-modal');
    if (modal) modal.classList.add('active');
  }

  finalizeEnding(choice) {
    try {
      localStorage.removeItem(this.saveStorageKey);
    } catch (error) {}
    this.updateContinueButton();
    const endingModal = document.getElementById('ending-modal');
    if (endingModal) endingModal.classList.remove('active');

    const victoryModal = document.getElementById('victory-modal');
    const victTitle = document.getElementById('victory-title');
    const victDesc = document.getElementById('victory-desc');

    if (choice === 'gold') {
      victTitle.innerText = "The Cursed Pirate Lord";
      victDesc.innerText = "You claimed the cursed Aztec treasure! The immortal curse of the seas courses through your veins. Your skeleton sails forever under the pale moon, the terror of the seven seas!";
    } else {
      victTitle.innerText = "The Curse Breaker Legend";
      victDesc.innerText = "You returned the Compass to the ancient altar, lifting the Aztec curse for all eternity. The spirits rest, the dawn breaks golden over the Caribbean, and you sail into legend as the greatest free captain of all time!";
    }

    if (victoryModal) victoryModal.classList.add('active');
    this.state = 'VICTORY';
  }

  showToast(message) {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3200);
  }

  gameLoop(currentTime) {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    if (this.state === 'PLAYING') {
      this.update(dt);
    }

    this.render();

    this.input.clearFrame();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  update(dt) {
    this.updateObjectiveInfoTimer(dt);

    // Update Renderer (particles, weather, camera)
    this.renderer.update(dt);

    // Update Mystic Compass HUD
    const targetX = this.currentLevel.isNavalBattle && this.currentLevel.playerShip ? this.currentLevel.playerShip.x : this.player.x;
    const targetY = this.currentLevel.isNavalBattle && this.currentLevel.playerShip ? this.currentLevel.playerShip.y : this.player.y;
    window.mysticCompass.update(dt, targetX, targetY);

    // Update Level
    if (this.currentLevel) {
      this.currentLevel.update(dt, this.player, this.input);
      this.updateObjectiveGuidance();

      // If not naval battle, update player & enemies
      if (!this.currentLevel.isNavalBattle) {
        this.player.update(dt, this.input, this.currentLevel);

        // Update enemies
        for (let i = this.currentLevel.enemies.length - 1; i >= 0; i--) {
          const enemy = this.currentLevel.enemies[i];
          enemy.update(dt, this.player, this.currentLevel);
          if (enemy.isDead && enemy.type !== 'boss') {
            this.currentLevel.enemies.splice(i, 1);
          }
        }

        // Update projectiles
        for (let i = this.currentLevel.projectiles.length - 1; i >= 0; i--) {
          const p = this.currentLevel.projectiles[i];
          const hit = p.update(dt, this.player, this.currentLevel.enemies, this.currentLevel);
          if (hit) {
            this.currentLevel.projectiles.splice(i, 1);
          }
        }
      }
    }

    // Toggle Inventory with 'KeyI'
    if (this.input.isJustPressed('KeyI')) {
      window.inventorySystem.toggleInventoryModal();
    }
  }

  render() {
    const ctx = this.renderer.ctx;
    ctx.clearRect(0, 0, this.renderer.width, this.renderer.height);

    if (this.currentLevel) {
      // 1. Multi-layer Parallax background
      this.renderer.renderParallaxBackground(this.currentLevelIndex);

      // 2. Level Geometry & Props
      this.currentLevel.render(ctx, this.renderer.camera);

      // 3. Player & Entities (if not naval)
      if (!this.currentLevel.isNavalBattle) {
        this.player.render(ctx, this.renderer.camera);
        this.currentLevel.enemies.forEach(e => e.render(ctx, this.renderer.camera));
        this.currentLevel.projectiles.forEach(p => p.render(ctx, this.renderer.camera));
      }

      // 4. Weather & Action Particles
      this.renderer.renderWeatherOverlay();

      // 5. Compass Spectral Sight Overlay Trail
      window.mysticCompass.renderSpectralOverlay(ctx, this.renderer.camera);

      // 6. Dynamic Lighting Pass (Darkness & Lanterns)
      if (this.currentLevel.id === 1 || this.currentLevel.id === 5) {
        this.renderer.beginLightingPass(this.currentLevel.id === 5 ? 0.7 : 0.45);
        // Add light around player
        const px = this.currentLevel.isNavalBattle ? this.currentLevel.playerShip.x : this.player.x + 16;
        const py = this.currentLevel.isNavalBattle ? this.currentLevel.playerShip.y : this.player.y + 24;
        this.renderer.addPointLight(px, py, 190, 1.0);
        this.renderer.compositeLighting();
      }
    }
  }
}

// Instantiate and start game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.game = new GameEngine();
  window.game.init();
});
