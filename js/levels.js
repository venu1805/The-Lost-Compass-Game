/* ==========================================================================
   LEVELS & PROGRESSION ENGINE - The Lost Compass
   Complete 6-Level Campaign Architecture with Custom Geometry, Puzzles & Encounters
   ========================================================================== */

class LevelBase {
  constructor(game, id, name, setting, objective) {
    this.game = game;
    this.id = id;
    this.name = name;
    this.setting = setting;
    this.objective = objective;

    this.platforms = [];   // Solid collision rectangles {x, y, w, h, type}
    this.ladders = [];     // Climbing ropes / ladders {x, y, w, h}
    this.enemies = [];     // Active enemy entities
    this.projectiles = []; // Active projectiles
    this.interactables = []; // Chests, switches, doors, NPCs {x, y, w, h, icon, onInteract}
    this.waterLevel = null;
    this.isUnderwater = false;
    this.isNavalBattle = false;

    // Puzzle and progression state
    this.puzzleState = {};
    this.isCompleted = false;

    // Ship warfare entities for Level 4
    this.playerShip = null;
    this.enemyShips = [];
  }

  init() {}
  update(dt, player, input) {}
  render(ctx, camera) {}

  checkPointCollision(x, y) {
    for (const p of this.platforms) {
      if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true;
    }
    return false;
  }

  resolveHorizontalCollisions(entity) {
    const b = entity.getBounds();
    for (const p of this.platforms) {
      if (b.bottom > p.y && b.top < p.y + p.h) {
        if (entity.vx > 0 && b.right >= p.x && b.left < p.x) {
          entity.x = p.x - entity.width;
          entity.vx = 0;
        } else if (entity.vx < 0 && b.left <= p.x + p.w && b.right > p.x + p.w) {
          entity.x = p.x + p.w;
          entity.vx = 0;
        }
      }
    }
  }

  resolveVerticalCollisions(entity, prevY) {
    const b = entity.getBounds();
    for (const p of this.platforms) {
      if (b.right > p.x && b.left < p.x + p.w) {
        if (entity.vy >= 0 && b.bottom >= p.y && prevY + entity.height <= p.y + 12) {
          entity.y = p.y - entity.height;
          entity.vy = 0;
          entity.onGround = true;
        } else if (entity.vy < 0 && b.top <= p.y + p.h && prevY >= p.y + p.h - 10) {
          entity.y = p.y + p.h;
          entity.vy = 0;
        }
      }
    }
  }

  checkLadderCollision(entity) {
    const b = entity.getBounds();
    for (const l of this.ladders) {
      const ladderLeft = l.x - 24;
      const ladderRight = l.x + l.w + 24;
      const ladderTop = l.y;
      const ladderBottom = l.y + l.h;
      const horizontalOverlap = b.right >= ladderLeft && b.left <= ladderRight;
      const verticalOverlap = b.bottom >= ladderTop && b.top <= ladderBottom;
      if (horizontalOverlap && verticalOverlap) {
        return true;
      }
    }
    return false;
  }

  alignLaddersToWalls() {
    if (!Array.isArray(this.ladders) || !Array.isArray(this.platforms)) return;

    const ladderClearance = 14;

    this.ladders.forEach(ladder => {
      const ladderCenter = ladder.x + ladder.w / 2;
      const wallMatch = this.platforms
        .filter(platform => platform.w < 800
          && ladder.y < platform.y + platform.h
          && ladder.y + ladder.h > platform.y)
        .sort((a, b) => Math.abs(ladderCenter - (a.x + a.w / 2)) - Math.abs(ladderCenter - (b.x + b.w / 2)))[0];

      if (!wallMatch) return;

      ladder.x = wallMatch.x - ladder.w - ladderClearance;

      if (wallMatch.h > wallMatch.w && wallMatch.h > 100) {
        ladder.y = wallMatch.y - this.game.player.height;
        const ground = this.platforms
          .filter(platform => platform.w >= 800
            && platform.x < ladder.x + ladder.w
            && platform.x + platform.w > ladder.x
            && platform.y >= wallMatch.y + wallMatch.h)
          .sort((a, b) => a.y - b.y)[0];
        const ladderBottom = ground ? ground.y : wallMatch.y + wallMatch.h;
        ladder.h = ladderBottom - ladder.y;
        return;
      }

      ladder.y = wallMatch.y;
      const ground = this.platforms
        .filter(platform => platform.w >= 800
          && platform.x < ladder.x + ladder.w
          && platform.x + platform.w > ladder.x
          && platform.y >= wallMatch.y + wallMatch.h)
        .sort((a, b) => a.y - b.y)[0];
      const ladderBottom = ground ? ground.y : wallMatch.y + wallMatch.h;
      ladder.h = Math.max(0, ladderBottom - ladder.y);
    });
  }
}

/* ==========================================================================
   LEVEL 1: THE STORM & THEFT
   ========================================================================== */

class Level1_TheStorm extends LevelBase {
  constructor(game) {
    super(game, 1, "The Storm & Theft", "Open Sea (Raging Storm)", "Survive the storm, reach the abandoned cursed ship, and steal the compass.");
  }

  init() {
    this.game.renderer.setWeather('storm');
    this.waterLevel = 620;
    this.compassTaken = false;

    // Sinking cursed galleon deck & platforms
    this.platforms = [
      { x: 0, y: 560, w: 2400, h: 200, type: 'deck' }, // Lower main deck
      { x: 450, y: 440, w: 260, h: 24, type: 'wood' },  // Rigging platform
      { x: 800, y: 380, w: 280, h: 24, type: 'wood' },  // Forecastle
      { x: 1200, y: 440, w: 320, h: 24, type: 'wood' }, // Poop deck
      { x: 1650, y: 340, w: 450, h: 30, type: 'cabin' }, // Captain's Quarters
      { x: 2100, y: 150, w: 30, h: 190, type: 'wall' } // Cabin wall above the open deck passage
    ];

    // Masts & climbing ropes
    this.ladders = [
      { x: 520, y: 300, w: 20, h: 260 },
      { x: 920, y: 240, w: 20, h: 320 },
      { x: 1400, y: 280, w: 20, h: 280 },
      { x: 1618, y: 340, w: 20, h: 220 } // Rope ladder beside the left edge of the captain's quarters
    ];

    // Cursed Skeletons guarding the ship
    this.enemies = [
      new Enemy(650, 500, 30, 52, 'skeleton'),
      new Enemy(1050, 500, 30, 52, 'skeleton'),
      new Enemy(1450, 380, 30, 52, 'skeleton')
    ];

    // Mysterious Compass Pedestal in Captain's Quarters
    this.interactables = [
      {
        x: 1880, y: 280, w: 40, h: 50,
        name: "Glowing Pedestal",
        label: "Take The Lost Compass [E]",
        interacted: false,
        onInteract: () => {
          if (!window.inventorySystem.hasItem('compass')) {
            window.inventorySystem.addItem('compass', 1);
            window.mysticCompass.hasCompass = true;
            this.compassTaken = true;
            this.game.showToast("✧ YOU OBTAINED THE LOST COMPASS! ✧");
            if (window.soundEngine) window.soundEngine.playCompassTone();
            this.objective = "Escape before the cursed ship sinks into the abyss!";
            this.game.updateObjectiveBanner();
            // Target becomes the escape dinghy at ship stern
            window.mysticCompass.setTarget(2250, 520, "Escape Dinghy");
          }
        }
      },
      {
        x: 2240, y: 500, w: 60, h: 40,
        name: "Escape Dinghy",
        label: "Escape the sinking ship [E]",
        onInteract: () => {
          if (window.inventorySystem.hasItem('compass')) {
            this.game.completeLevel();
          } else {
            this.game.showToast("You cannot leave without the Compass!");
          }
        }
      }
    ];

    // Player starting position
    this.game.player.x = 80;
    this.game.player.y = 480;

    // Compass points to the captain's quarters initially
    window.mysticCompass.setTarget(1880, 280, "The Lost Compass");
  }

  update(dt, player, input) {
    // Sinking ship creak & water rising effect
    if (this.compassTaken) {
      this.waterLevel = Math.max(500, this.waterLevel - dt * 10);
    }

    // Check interaction with nearby interactables (Key E)
    if (input.isJustPressed('KeyE')) {
      this.interactables.forEach(item => {
        if (Math.hypot(player.x - item.x, player.y - item.y) < 65) {
          item.onInteract();
        }
      });
    }
  }

  render(ctx, camera) {
    // Render Ship Wooden Platforms & Masts
    ctx.save();
    this.platforms.forEach(p => {
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;
      ctx.fillStyle = p.type === 'deck' ? '#3e2723' : '#5d4037';
      ctx.fillRect(sx, sy, p.w, p.h);
      ctx.strokeStyle = '#27170e';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, p.w, p.h);
    });

    // Ladders / Ropes
    this.ladders.forEach(l => {
      const sx = l.x - camera.x;
      const sy = l.y - camera.y;
      ctx.fillStyle = '#b45309';
      ctx.fillRect(sx, sy, 4, l.h);
      ctx.fillRect(sx + l.w - 4, sy, 4, l.h);
      for (let y = sy; y < sy + l.h; y += 18) {
        ctx.fillRect(sx, y, l.w, 3);
      }
    });

    // Interactable Pedestal & Dinghy
    this.interactables.forEach(item => {
      const sx = item.x - camera.x;
      const sy = item.y - camera.y;

      if (item.name === "Glowing Pedestal") {
        ctx.fillStyle = '#1e1b18';
        ctx.fillRect(sx, sy + 20, 36, 30);
        if (!window.mysticCompass.hasCompass) {
          // Glowing mystical floating compass
          ctx.shadowColor = '#22d3ee';
          ctx.shadowBlur = 18;
          ctx.fillStyle = '#d4af37';
          ctx.beginPath();
          ctx.arc(sx + 18, sy + 10 + Math.sin(Date.now() * 0.005) * 5, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Wooden dinghy
        ctx.fillStyle = '#4e342e';
        ctx.beginPath();
        ctx.ellipse(sx + 30, sy + 25, 35, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Show prompt if player is close
      if (Math.hypot(this.game.player.x - item.x, this.game.player.y - item.y) < 65) {
        ctx.font = "bold 12px 'Cinzel', serif";
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.fillText(item.label, sx + 20, sy - 15);
      }
    });

    // Render rolling stormy ocean water at bottom
    ctx.fillStyle = 'rgba(11, 29, 40, 0.85)';
    ctx.fillRect(0, this.waterLevel - camera.y, window.innerWidth, 400);

    ctx.restore();
  }
}

/* ==========================================================================
   LEVEL 2: THE HIDDEN ISLAND (Jungle + Ancient Statue Puzzle)
   ========================================================================== */

class Level2_TheHiddenIsland extends LevelBase {
  constructor(game) {
    super(game, 2, "The Hidden Island", "Mysterious Jungle & Ruins", "Reach the cave, solve the statue puzzle, and find the first clue.");
  }

  init() {
    this.game.renderer.setWeather('jungle');
    this.waterLevel = null;

    // Tropical Island Jungle Platforms & Ancient Aztec Stone Steps
    this.platforms = [
      { x: 0, y: 560, w: 3200, h: 200, type: 'earth' },
      { x: 380, y: 440, w: 220, h: 30, type: 'stone' },
      { x: 700, y: 350, w: 260, h: 30, type: 'stone' },
      { x: 1100, y: 420, w: 240, h: 30, type: 'stone' },
      { x: 1450, y: 310, w: 300, h: 30, type: 'ruins' },
      // Temple Sanctuary
      { x: 1950, y: 480, w: 800, h: 200, type: 'temple' },
      { x: 1920, y: 150, w: 30, h: 330, type: 'wall' },
      { x: 2750, y: 150, w: 30, h: 330, type: 'wall' }
    ];

    // Ancient vines to climb
    this.ladders = [
      { x: 500, y: 280, w: 18, h: 280 },
      { x: 820, y: 200, w: 18, h: 360 },
      { x: 1300, y: 240, w: 18, h: 320 },
      { x: 1878, y: 80, w: 18, h: 400 } // Vine on the outside of the sanctuary's left wall
    ];

    // Jungle Panthers & Rival Corsairs
    this.enemies = [
      new Enemy(520, 500, 36, 32, 'panther'),
      new Enemy(900, 500, 32, 52, 'corsair'),
      new Enemy(1250, 360, 36, 32, 'panther'),
      new Enemy(1600, 500, 32, 52, 'corsair')
    ];

    // Environmental Statue Puzzle: 3 Aztec animal statues (Jaguar, Serpent, Eagle)
    // Players rotate them until correct combination is achieved
    this.statues = [
      { x: 2150, y: 420, name: "Jaguar Pillar", current: 0, target: 1, symbols: ["Sun", "Moon", "Star"] },
      { x: 2350, y: 420, name: "Serpent Pillar", current: 2, target: 0, symbols: ["Serpent", "River", "Flame"] },
      { x: 2550, y: 420, name: "Eagle Pillar", current: 1, target: 2, symbols: ["Sky", "Earth", "Wind"] }
    ];

    this.puzzleSolved = false;

    // Clue Stone Tablet in the sanctuary
    this.interactables = [
      {
        x: 2680, y: 430, w: 50, h: 50,
        name: "Ancient Stone Tablet",
        label: "Examine Carved Tablet [E]",
        onInteract: () => {
          if (!this.puzzleSolved) {
            this.game.showToast("The glyphs are locked by the 3 statue pillars! Use the Compass [C] to see the light path.");
          } else {
            window.inventorySystem.addItem('sunken_medallion', 1);
            this.game.showToast("✧ Clue Uncovered: 'He who seeks the cursed gold must seek Old Barnaby at Port Royale!' ✧");
            setTimeout(() => this.game.completeLevel(), 2500);
          }
        }
      }
    ];

    this.game.player.x = 100;
    this.game.player.y = 480;

    window.mysticCompass.setTarget(2350, 420, "Sanctuary Statues");
  }

  update(dt, player, input) {
    // Check statue interactions
    if (input.isJustPressed('KeyE')) {
      // Check statues
      this.statues.forEach(statue => {
        if (Math.hypot(player.x - statue.x, player.y - statue.y) < 60) {
          statue.current = (statue.current + 1) % statue.symbols.length;
          if (window.soundEngine) window.soundEngine.playCoin();
          this.game.showToast(`Rotated ${statue.name} to [${statue.symbols[statue.current]}]`);
          this.checkStatuePuzzle();
        }
      });

      // Check tablet
      this.interactables.forEach(item => {
        if (Math.hypot(player.x - item.x, player.y - item.y) < 65) {
          item.onInteract();
        }
      });
    }
  }

  checkStatuePuzzle() {
    const isAllCorrect = this.statues.every(s => s.current === s.target);
    if (isAllCorrect && !this.puzzleSolved) {
      this.puzzleSolved = true;
      if (window.soundEngine) window.soundEngine.playChestOpen();
      this.game.showToast("✧ The Ancient Aztec Statues Aligned! Light beams unlocked the Tablet! ✧");
      window.mysticCompass.setTarget(2680, 430, "Deciphered Tablet");
    }
  }

  render(ctx, camera) {
    ctx.save();

    // Render Lush Platforms
    this.platforms.forEach(p => {
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;
      if (p.type === 'earth') {
        ctx.fillStyle = '#166534'; // Grass top
        ctx.fillRect(sx, sy, p.w, 16);
        ctx.fillStyle = '#451a03'; // Dirt beneath
        ctx.fillRect(sx, sy + 16, p.w, p.h - 16);
      } else {
        ctx.fillStyle = '#44403c'; // Aztec stone
        ctx.fillRect(sx, sy, p.w, p.h);
        ctx.strokeStyle = '#292524';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, sy, p.w, p.h);
      }
    });

    // Vines
    this.ladders.forEach(l => {
      const sx = l.x - camera.x;
      const sy = l.y - camera.y;
      ctx.fillStyle = '#15803d';
      ctx.fillRect(sx, sy, l.w, l.h);
      // Vine leaves
      for (let y = sy; y < sy + l.h; y += 22) {
        ctx.beginPath();
        ctx.arc(sx + 6, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Statues
    this.statues.forEach(s => {
      const sx = s.x - camera.x;
      const sy = s.y - camera.y;

      // Stone Pillar Base
      ctx.fillStyle = '#57534e';
      ctx.fillRect(sx - 18, sy - 40, 36, 60);

      // Gold Inlaid Glyph
      ctx.fillStyle = (s.current === s.target) ? '#facc15' : '#78716c';
      ctx.beginPath();
      ctx.arc(sx, sy - 20, 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = "bold 11px 'Cinzel', serif";
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText(s.symbols[s.current], sx, sy - 46);

      if (Math.hypot(this.game.player.x - s.x, this.game.player.y - s.y) < 60) {
        ctx.font = "bold 11px 'Cinzel', serif";
        ctx.fillStyle = '#38bdf8';
        ctx.fillText("Rotate [E]", sx, sy - 60);
      }
    });

    // Tablet
    this.interactables.forEach(item => {
      const sx = item.x - camera.x;
      const sy = item.y - camera.y;
      ctx.fillStyle = this.puzzleSolved ? '#d97706' : '#292524';
      ctx.fillRect(sx, sy, 40, 50);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, 40, 50);

      if (Math.hypot(this.game.player.x - item.x, this.game.player.y - item.y) < 65) {
        ctx.font = "bold 12px 'Cinzel', serif";
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.fillText(item.label, sx + 20, sy - 12);
      }
    });

    ctx.restore();
  }
}

/* ==========================================================================
   LEVEL 3: PORT ROYALE (TOWN HUB & QUESTS)
   ========================================================================== */

class Level3_PortRoyale extends LevelBase {
  constructor(game) {
    super(game, 3, "Port Royale (Town)", "Pirate Town / Port City", "Gather information from NPCs, expose the spy, and prepare your crew for the voyage.");
  }

  init() {
    this.game.renderer.setWeather('clear');
    this.waterLevel = null;

    // Docks, cobblestone alleys, tavern
    this.platforms = [
      { x: 0, y: 560, w: 3400, h: 200, type: 'cobblestone' },
      { x: 600, y: 440, w: 320, h: 25, type: 'wood' },
      { x: 1200, y: 400, w: 400, h: 25, type: 'balcony' },
      { x: 2200, y: 460, w: 300, h: 25, type: 'dock' }
    ];

    // Ladders to balconies
    this.ladders = [
      { x: 620, y: 440, w: 18, h: 120 },
      { x: 1220, y: 400, w: 18, h: 160 }
    ];

    // Friendly NPCs & Interactive Quest Givers
    this.npcs = [
      {
        x: 400, y: 508, name: "Old Blind Barnaby", role: 'barnaby',
        dialogue: {
          start: {
            speaker: "Old Blind Barnaby",
            speakerRole: 'barnaby',
            text: "Ah... I hear the click of the Cursed Compass in yer grip, lad. The spirits tell me you seek the Lost Aztec Citadel.",
            choices: [
              { text: "Tell me how to reach it.", nextNode: 'lore' },
              { text: "Where can I find a ship?", nextNode: 'ship_info' }
            ]
          },
          lore: {
            speaker: "Old Blind Barnaby",
            speakerRole: 'barnaby',
            text: "The compass does not point north, boy. It leads to the Cursed Caves and the Citadel of Davy's Shade. But beware: an East India spy is hunting you in this very town!",
            choices: [
              { text: "I'll find the spy and deal with him.", action: (qs) => { qs.level3_talked_barnaby = true; } }
            ]
          },
          ship_info: {
            speaker: "Old Blind Barnaby",
            speakerRole: 'barnaby',
            text: "Talk to First Mate Flint at the pier. He's got our galleon rigged and ready, but you'll need gunpowder and supplies from Madame Rouge's tavern.",
            choices: [{ text: "Thank you, Barnaby." }]
          }
        }
      },
      {
        x: 1050, y: 508, name: "Madame Rouge", role: 'rouge',
        dialogue: {
          start: {
            speaker: "Madame Rouge",
            speakerRole: 'rouge',
            text: "Welcome to The Salty Mermaid! Care for a sip of aged Caribbean rum, handsome?",
            choices: [
              { text: "Buy Provisions (Rum & Gunpowder)", nextNode: 'shop' },
              { text: "Have you seen anyone suspicious?", nextNode: 'spy_tip' }
            ]
          },
          spy_tip: {
            speaker: "Madame Rouge",
            speakerRole: 'rouge',
            text: "Indeed! A hooded Redcoat marine has been lurking behind the harbor warehouse crate at the east pier. Go flush him out!",
            choices: [{ text: "On it!" }]
          },
          shop: {
            speaker: "Madame Rouge",
            speakerRole: 'rouge',
            text: "Here is what we have in the cellar today:",
            choices: [
              { text: "Buy Aged Rum (25 Gold)", action: () => {
                if (window.inventorySystem.spendGold(25)) {
                  window.inventorySystem.addItem('rum', 1);
                } else {
                  window.game.showToast("Not enough gold!");
                }
              }},
              { text: "Buy Gunpowder Horn (20 Gold)", action: () => {
                if (window.inventorySystem.spendGold(20)) {
                  window.inventorySystem.addItem('powder_pouch', 1);
                } else {
                  window.game.showToast("Not enough gold!");
                }
              }},
              { text: "Close Tavern Menu" }
            ]
          }
        }
      },
      {
        x: 2100, y: 508, name: "The East India Spy", role: 'marine', isSpy: true,
        dialogue: {
          start: {
            speaker: "Suspicious Informant",
            speakerRole: 'marine',
            text: "What are you looking at, pirate scum?! You'll never get that compass out of Port Royale alive!",
            choices: [
              { text: "Draw your steel!", action: (qs) => {
                // Spawn spy combat encounter
                window.dialogueSystem.closeDialogue();
                this.spawnSpyFight();
              }}
            ]
          }
        }
      },
      {
        x: 2900, y: 508, name: "First Mate Flint", role: 'flint',
        dialogue: {
          start: {
            speaker: "First Mate Flint",
            speakerRole: 'flint',
            text: "Captain! The Sea Serpent is loaded with cannons and ready to cast off. But rival warship 'The Black Dread' is waiting outside the harbor!",
            choices: [
              { text: "Let's set sail and crush them! [Set Sail]", action: (qs) => {
                window.dialogueSystem.closeDialogue();
                this.game.completeLevel();
              }}
            ]
          }
        }
      }
    ];

    this.enemies = []; // initially calm town
    this.game.player.x = 80;
    this.game.player.y = 480;

    window.mysticCompass.setTarget(400, 508, "Old Blind Barnaby");
  }

  spawnSpyFight() {
    this.npcs = this.npcs.filter(n => !n.isSpy);
    const spy = new Enemy(2100, 500, 32, 52, 'marine');
    spy.maxHealth = 90;
    spy.health = 90;
    this.enemies.push(spy);
    this.game.showToast("⚔ Defeat the East India Spy! ⚔");
    window.mysticCompass.setTarget(2900, 508, "First Mate Flint (Pier)");
  }

  update(dt, player, input) {
    if (input.isJustPressed('KeyE')) {
      this.npcs.forEach(npc => {
        if (Math.hypot(player.x - npc.x, player.y - npc.y) < 65) {
          window.dialogueSystem.startDialogue(npc.dialogue);
        }
      });
    }
  }

  render(ctx, camera) {
    ctx.save();

    // Cobblestone ground & buildings
    this.platforms.forEach(p => {
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;
      ctx.fillStyle = '#292524';
      ctx.fillRect(sx, sy, p.w, p.h);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, p.w, p.h);
    });

    // Ladders
    this.ladders.forEach(l => {
      const sx = l.x - camera.x;
      const sy = l.y - camera.y;
      ctx.fillStyle = '#92400e';
      ctx.fillRect(sx, sy, l.w, l.h);
    });

    // Render NPCs
    this.npcs.forEach(npc => {
      const sx = npc.x - camera.x;
      const sy = npc.y - camera.y;

      // Draw NPC figure
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(sx - 10, sy - 36, 20, 36);
      ctx.fillStyle = '#cf9f74';
      ctx.beginPath();
      ctx.arc(sx, sy - 44, 9, 0, Math.PI * 2);
      ctx.fill();

      // Nametag & [E] Talk prompt
      ctx.font = "bold 11px 'Cinzel', serif";
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText(npc.name, sx, sy - 58);

      if (Math.hypot(this.game.player.x - npc.x, this.game.player.y - npc.y) < 65) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillText("Talk [E]", sx, sy - 72);
      }
    });

    ctx.restore();
  }
}

/* ==========================================================================
   LEVEL 4: NAVAL BATTLE (OPEN SEA COMBAT)
   ========================================================================== */

class Level4_NavalBattle extends LevelBase {
  constructor(game) {
    super(game, 4, "Naval Battle", "Open Sea", "Control your ship, defeat 'The Black Dread' with cannon broadsides, and capture their loot.");
    this.isNavalBattle = true;
  }

  init() {
    this.game.renderer.setWeather('storm');
    this.waterLevel = null;
    this.platforms = []; // Open sea navigation!

    // Create player galleon and rival warship
    this.playerShip = new NavalShip(300, 400, true, "The Sea Serpent");
    this.enemyShips = [
      new NavalShip(1100, 400, false, "The Black Dread")
    ];

    this.projectiles = [];
    this.isBoardingPhase = false;

    // Camera targets player ship
    this.game.renderer.camera.target = this.playerShip;
    window.mysticCompass.setTarget(1100, 400, "The Black Dread");
  }

  update(dt, player, input) {
    // Update player ship
    this.playerShip.update(dt, input, this.enemyShips, this.projectiles);

    // Update enemy ships
    this.enemyShips.forEach(es => {
      es.update(dt, null, [this.playerShip], this.projectiles);
    });

    // Update cannonball ballistics
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const hit = p.update(dt, this.playerShip, this.enemyShips);
      if (hit) {
        this.projectiles.splice(i, 1);
      }
    }

    // Check victory condition
    const flagship = this.enemyShips[0];
    if (flagship && flagship.hull <= 0 && !this.isBoardingPhase) {
      this.isBoardingPhase = true;
      this.game.showToast("✧ Victory! The Black Dread's flag is struck! Capturing their maps and loot... ✧");
      window.inventorySystem.addGold(150);
      window.inventorySystem.addItem('sea_chart', 1);
      setTimeout(() => this.game.completeLevel(), 3000);
    }

    // Keep compass pointed at enemy flagship
    if (flagship) {
      window.mysticCompass.setTarget(flagship.x, flagship.y, "The Black Dread");
    }
  }

  render(ctx, camera) {
    // Render deep ocean waves
    ctx.save();
    ctx.fillStyle = '#091e2b';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    // Render wave crests
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 3;
    for (let y = -200; y < window.innerHeight + 200; y += 80) {
      ctx.beginPath();
      const waveShift = Math.sin(Date.now() * 0.002 + y) * 20;
      ctx.moveTo(-100, y + waveShift);
      ctx.lineTo(window.innerWidth + 100, y + waveShift);
      ctx.stroke();
    }

    // Render ships
    this.playerShip.render(ctx, camera);
    this.enemyShips.forEach(es => es.render(ctx, camera));

    // Render cannonballs
    this.projectiles.forEach(cb => cb.render(ctx, camera));

    // Naval Combat Controls Banner
    ctx.fillStyle = 'rgba(15, 10, 8, 0.85)';
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    const controlsWidth = Math.min(420, window.innerWidth - 40);
    ctx.fillRect(20, window.innerHeight - 94, controlsWidth, 64);
    ctx.strokeRect(20, window.innerHeight - 94, controlsWidth, 64);

    ctx.font = "bold 11px 'Cinzel', serif";
    ctx.fillStyle = '#fef08a';
    ctx.fillText("A/D: Steer | W: Toggle Sails | S: Brake", 30, window.innerHeight - 70);
    ctx.fillText("F: Bow Fire | Q/J: Port | E/K: Starboard | R: Repair", 30, window.innerHeight - 48);

    this.renderRadar(ctx);

    ctx.restore();
  }

  renderRadar(ctx) {
    const radarX = 88;
    const radarY = 178;
    const radarRadius = 62;
    const radarRange = 1200;
    const flagship = this.enemyShips.find(ship => !ship.isDestroyed);

    ctx.save();
    ctx.fillStyle = 'rgba(3, 20, 25, 0.88)';
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(radarX, radarY, radarRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(radarX, radarY, radarRadius * 0.5, 0, Math.PI * 2);
    ctx.moveTo(radarX - radarRadius + 4, radarY);
    ctx.lineTo(radarX + radarRadius - 4, radarY);
    ctx.moveTo(radarX, radarY - radarRadius + 4);
    ctx.lineTo(radarX, radarY + radarRadius - 4);
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(radarX, radarY, radarRadius - 3, 0, Math.PI * 2);
    ctx.clip();
    const sweepAngle = (Date.now() * 0.001) % (Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(radarX, radarY);
    ctx.arc(radarX, radarY, radarRadius - 4, sweepAngle - 0.45, sweepAngle);
    ctx.closePath();
    ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
    ctx.fill();

    if (flagship && this.playerShip) {
      const dx = flagship.x - this.playerShip.x;
      const dy = flagship.y - this.playerShip.y;
      const distance = Math.hypot(dx, dy);
      const relativeAngle = Math.atan2(dy, dx) - this.playerShip.angle;
      const blipDistance = Math.min(distance / radarRange, 1) * (radarRadius - 13);
      const blipX = radarX + Math.sin(relativeAngle) * blipDistance;
      const blipY = radarY - Math.cos(relativeAngle) * blipDistance;

      ctx.beginPath();
      ctx.arc(blipX, blipY, 5 + Math.sin(Date.now() * 0.008) * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fb4b4b';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.font = "bold 10px 'Cinzel', serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fecaca';
      ctx.fillText(`${Math.round(distance)} units`, radarX, radarY + radarRadius + 14);
    } else {
      ctx.font = "bold 9px 'Cinzel', serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('NO CONTACT', radarX, radarY + radarRadius + 14);
    }

    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(radarX, radarY + 7);
    ctx.lineTo(radarX - 5, radarY - 4);
    ctx.lineTo(radarX, radarY - 1);
    ctx.lineTo(radarX + 5, radarY - 4);
    ctx.closePath();
    ctx.fillStyle = '#67e8f9';
    ctx.fill();

    ctx.font = "bold 10px 'Cinzel', serif";
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a5f3fc';
    ctx.fillText('RADAR', radarX, radarY - radarRadius - 7);
    ctx.restore();
  }
}

/* ==========================================================================
   LEVEL 5: THE CURSED CAVES (UNDERWATER / GROTTO BOSS FIGHT)
   ========================================================================== */

class Level5_TheCursedCaves extends LevelBase {
  constructor(game) {
    super(game, 5, "The Cursed Caves", "Underwater Caverns", "Explore the submerged grotto, solve ancient water gates, and defeat the Spectral Guardian.");
    this.isUnderwater = true;
  }

  init() {
    this.game.renderer.setWeather('underwater');
    this.waterLevel = 220; // Player will be swimming below this line

    // Cave platforms, underwater tunnels & air pockets
    this.platforms = [
      { x: 0, y: 700, w: 3200, h: 200, type: 'cavern' },
      { x: 0, y: 0, w: 3200, h: 140, type: 'cavern_roof' },
      { x: 400, y: 460, w: 220, h: 30, type: 'rock' },
      { x: 800, y: 350, w: 260, h: 30, type: 'rock' },
      // Water gate puzzle door
      { x: 1600, y: 140, w: 40, h: 420, type: 'gate' },
      // Boss arena
      { x: 1800, y: 640, w: 1200, h: 100, type: 'cavern' }
    ];

    this.gateOpen = false;

    // Lever interactable to lower the water gate
    this.interactables = [
      {
        x: 1250, y: 320, w: 40, h: 40,
        name: "Ancient Water Lever",
        label: "Pull Water Gate Lever [E]",
        onInteract: () => {
          if (!this.gateOpen) {
            this.gateOpen = true;
            // Remove gate platform
            this.platforms = this.platforms.filter(p => p.type !== 'gate');
            this.game.showToast("✧ Ancient Mechanism Grinds: Water Gate Raised! ✧");
            if (window.soundEngine) window.soundEngine.playChestOpen();
            window.mysticCompass.setTarget(2300, 520, "Spectral Guardian Boss");
          }
        }
      }
    ];

    // Air pocket bubbles where player can breathe
    this.airPockets = [
      { x: 700, y: 220, radius: 60 },
      { x: 1400, y: 200, radius: 70 },
      { x: 2250, y: 520, radius: 85 }
    ];

    // Spectral Guardian Boss in Level 5
    this.boss = new Boss(2400, 520, "Spectral Sea Wraith", 'guardian');
    this.enemies = [this.boss];

    this.game.player.x = 100;
    this.game.player.y = 300;

    window.mysticCompass.setTarget(1250, 320, "Water Gate Lever");
  }

  update(dt, player, input) {
    // Air pocket replenishment
    this.airPockets.forEach(ap => {
      if (Math.hypot(player.x - ap.x, player.y - ap.y) < ap.radius) {
        player.oxygen = Math.min(player.maxOxygen, player.oxygen + 50 * dt);
      }
    });

    if (input.isJustPressed('KeyE')) {
      this.interactables.forEach(item => {
        if (Math.hypot(player.x - item.x, player.y - item.y) < 65) {
          item.onInteract();
        }
      });
    }

    // Check boss defeat
    if (this.boss.isDead && !this.isCompleted) {
      this.isCompleted = true;
      window.inventorySystem.addItem('map_fragment', 1);
      this.game.showToast("✧ The Spectral Guardian Defeated! Final Map Fragment Retrieved! ✧");
      setTimeout(() => this.game.completeLevel(), 3000);
    }
  }

  render(ctx, camera) {
    ctx.save();

    // Cavern rock platforms
    this.platforms.forEach(p => {
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;
      ctx.fillStyle = p.type === 'gate' ? '#64748b' : '#0f172a';
      ctx.fillRect(sx, sy, p.w, p.h);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, p.w, p.h);
    });

    // Air pockets (glowing cyan bubble domes)
    this.airPockets.forEach(ap => {
      const sx = ap.x - camera.x;
      const sy = ap.y - camera.y;
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, ap.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = "11px 'Cinzel', serif";
      ctx.fillStyle = '#e0f2fe';
      ctx.textAlign = 'center';
      ctx.fillText("Air Pocket", sx, sy);
    });

    // Lever
    this.interactables.forEach(item => {
      const sx = item.x - camera.x;
      const sy = item.y - camera.y;
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(sx, sy, 30, 30);
      if (Math.hypot(this.game.player.x - item.x, this.game.player.y - item.y) < 65) {
        ctx.font = "bold 12px 'Cinzel', serif";
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.fillText(item.label, sx + 15, sy - 12);
      }
    });

    ctx.restore();
  }
}

const EXPANDED_CAMPAIGN_LEVELS = {
  6: {
    name: 'The Iron Bastion', setting: 'Naval Prison', weather: 'storm',
    objective: 'Break out of the prison, recover the launch key, and escape the Bastion.',
    hint: 'Next: Defeat the guards and find the launch key.',
    platforms: [
      { x: 0, y: 560, w: 2700, h: 200, type: 'metal' },
      { x: 420, y: 440, w: 250, h: 24, type: 'metal' },
      { x: 850, y: 360, w: 270, h: 24, type: 'metal' },
      { x: 1320, y: 440, w: 290, h: 24, type: 'metal' },
      { x: 1840, y: 350, w: 300, h: 24, type: 'metal' }
    ],
    ladders: [{ x: 510, y: 320, w: 20, h: 240 }, { x: 950, y: 240, w: 20, h: 320 }, { x: 1450, y: 320, w: 20, h: 240 }],
    enemies: [{ x: 520, type: 'marine' }, { x: 1050, type: 'marine' }, { x: 1600, type: 'corsair' }],
    steps: [
      { x: 1950, y: 508, name: 'Launch Key', label: 'Take Launch Key [E]', requiresClear: true, hint: 'Next: Take the key to the escape launch.' },
      { x: 2450, y: 508, name: 'Escape Launch', label: 'Escape the Bastion [E]', hint: 'The sea route to the lighthouse is open.' }
    ]
  },
  7: {
    name: 'Ghost Lighthouse', setting: 'Blackreef Lighthouse', weather: 'storm',
    objective: 'Climb the haunted lighthouse and relight its beacon.',
    hint: 'Next: Climb the lighthouse and light the beacon.',
    platforms: [
      { x: 0, y: 560, w: 2500, h: 200, type: 'stone' },
      { x: 380, y: 450, w: 220, h: 24, type: 'stone' },
      { x: 760, y: 360, w: 240, h: 24, type: 'stone' },
      { x: 1160, y: 280, w: 240, h: 24, type: 'stone' },
      { x: 1560, y: 200, w: 260, h: 24, type: 'stone' },
      { x: 1940, y: 150, w: 300, h: 24, type: 'stone' }
    ],
    ladders: [{ x: 480, y: 330, w: 18, h: 230 }, { x: 850, y: 240, w: 18, h: 320 }, { x: 1260, y: 160, w: 18, h: 400 }, { x: 1680, y: 100, w: 18, h: 460 }],
    enemies: [{ x: 900, type: 'skeleton' }, { x: 1500, type: 'corsair' }],
    steps: [{ x: 2080, y: 110, name: 'Beacon Brazier', label: 'Relight the Beacon [E]', hint: 'The beacon reveals the safe reef passage.' }]
  },
  8: {
    name: 'The Shattered Reef', setting: 'Sunken Reef Passage', weather: 'underwater', underwater: true,
    objective: 'Navigate the reef, replenish your air, and activate the channel marker.',
    hint: 'Next: Follow the reef channel and activate its marker.',
    platforms: [
      { x: 0, y: 700, w: 2800, h: 200, type: 'reef' },
      { x: 360, y: 470, w: 190, h: 26, type: 'reef' },
      { x: 800, y: 360, w: 230, h: 26, type: 'reef' },
      { x: 1280, y: 440, w: 220, h: 26, type: 'reef' },
      { x: 1740, y: 330, w: 240, h: 26, type: 'reef' }
    ],
    airPockets: [{ x: 550, y: 220, radius: 65 }, { x: 1200, y: 200, radius: 70 }, { x: 1850, y: 220, radius: 75 }],
    enemies: [{ x: 980, y: 500, type: 'panther' }, { x: 1680, y: 500, type: 'corsair' }],
    steps: [{ x: 2380, y: 520, name: 'Channel Marker', label: 'Activate Channel Marker [E]', hint: 'The marker charts a route to the wreck.' }]
  },
  9: {
    name: 'The Drowned Galleon', setting: 'Shipwreck Graveyard', weather: 'underwater', underwater: true,
    objective: 'Search the wreck and recover the captain’s sealed chart case.',
    hint: 'Next: Reach the wreck’s sealed chart case.',
    platforms: [
      { x: 0, y: 700, w: 2900, h: 200, type: 'wreck' },
      { x: 300, y: 500, w: 280, h: 28, type: 'wreck' },
      { x: 720, y: 410, w: 320, h: 28, type: 'wreck' },
      { x: 1190, y: 330, w: 350, h: 28, type: 'wreck' },
      { x: 1700, y: 430, w: 300, h: 28, type: 'wreck' }
    ],
    ladders: [{ x: 820, y: 280, w: 18, h: 280 }, { x: 1320, y: 200, w: 18, h: 360 }],
    airPockets: [{ x: 600, y: 220, radius: 65 }, { x: 1450, y: 210, radius: 65 }, { x: 2100, y: 250, radius: 75 }],
    enemies: [{ x: 740, y: 500, type: 'skeleton' }, { x: 1500, y: 500, type: 'skeleton' }],
    steps: [{ x: 2440, y: 520, name: 'Chart Case', label: 'Recover the Chart Case [E]', requiresClear: true, rewardItem: 'sea_chart', hint: 'The chart points toward the smugglers’ port.' }]
  },
  10: {
    name: 'Smugglers’ Port', setting: 'Blacktide Harbor', weather: 'clear',
    objective: 'Uncover the smugglers’ route and expose their hidden signal.',
    hint: 'Next: Search the harbor office for the ledger.',
    platforms: [
      { x: 0, y: 560, w: 3000, h: 200, type: 'dock' },
      { x: 450, y: 430, w: 300, h: 24, type: 'wood' },
      { x: 1050, y: 360, w: 300, h: 24, type: 'wood' },
      { x: 1700, y: 420, w: 340, h: 24, type: 'wood' }
    ],
    ladders: [{ x: 540, y: 320, w: 18, h: 240 }, { x: 1150, y: 250, w: 18, h: 310 }],
    enemies: [{ x: 880, type: 'corsair' }, { x: 1580, type: 'marine' }],
    steps: [
      { x: 650, y: 508, name: 'Harbor Ledger', label: 'Take the Harbor Ledger [E]', hint: 'Next: Find the signal lantern at the east pier.' },
      { x: 1600, y: 508, name: 'Signal Lantern', label: 'Inspect the Signal Lantern [E]', hint: 'Next: Give the route to the lookout at the far dock.' },
      { x: 2700, y: 508, name: 'Harbor Lookout', label: 'Warn the Lookout [E]', hint: 'The lookout has marked a safe passage through the haunted bay.' }
    ]
  },
  11: {
    name: 'Leviathan of the Deep', setting: 'Abyssal Trench', weather: 'underwater', underwater: true,
    objective: 'Survive the trench and defeat the sea creature guarding the passage.',
    hint: 'Next: Keep air nearby and defeat the Abyssal Leviathan.',
    platforms: [
      { x: 0, y: 700, w: 2800, h: 200, type: 'cavern' },
      { x: 500, y: 470, w: 260, h: 26, type: 'rock' },
      { x: 1050, y: 370, w: 280, h: 26, type: 'rock' },
      { x: 1570, y: 470, w: 280, h: 26, type: 'rock' }
    ],
    airPockets: [{ x: 600, y: 220, radius: 70 }, { x: 1350, y: 210, radius: 75 }, { x: 2020, y: 220, radius: 90 }],
    boss: { x: 2200, y: 520, name: 'Abyssal Leviathan', type: 'leviathan' },
    rewardItem: 'map_fragment'
  },
  12: {
    name: 'Haunted Bay', setting: 'Wraithwater Cove', weather: 'storm',
    objective: 'Clear the haunted shore and silence the cursed signal bell.',
    hint: 'Next: Defeat the wraiths guarding the signal bell.',
    platforms: [
      { x: 0, y: 560, w: 2800, h: 200, type: 'stone' },
      { x: 470, y: 430, w: 250, h: 24, type: 'stone' },
      { x: 960, y: 350, w: 270, h: 24, type: 'stone' },
      { x: 1490, y: 430, w: 300, h: 24, type: 'stone' }
    ],
    ladders: [{ x: 560, y: 310, w: 18, h: 250 }, { x: 1060, y: 230, w: 18, h: 330 }],
    enemies: [{ x: 600, type: 'skeleton' }, { x: 1230, type: 'skeleton' }, { x: 1770, type: 'marine' }],
    steps: [{ x: 2440, y: 508, name: 'Cursed Signal Bell', label: 'Silence the Signal Bell [E]', requiresClear: true, rewardGold: 60, hint: 'The bell’s map points to the Lost Fleet.' }]
  },
  13: {
    name: 'The Lost Fleet', setting: 'Graveyard of Ships', weather: 'storm',
    objective: 'Cross the wrecks and recover the admiral’s route book.',
    hint: 'Next: Climb across the wrecks to the route book.',
    platforms: [
      { x: 0, y: 560, w: 3100, h: 200, type: 'wreck' },
      { x: 380, y: 450, w: 250, h: 24, type: 'wreck' },
      { x: 780, y: 350, w: 290, h: 24, type: 'wreck' },
      { x: 1260, y: 420, w: 260, h: 24, type: 'wreck' },
      { x: 1710, y: 310, w: 330, h: 24, type: 'wreck' }
    ],
    ladders: [{ x: 480, y: 330, w: 18, h: 230 }, { x: 880, y: 230, w: 18, h: 330 }, { x: 1820, y: 190, w: 18, h: 370 }],
    enemies: [{ x: 650, type: 'corsair' }, { x: 1360, type: 'marine' }, { x: 2050, type: 'skeleton' }],
    steps: [
      { x: 1000, y: 508, name: 'Fleet Signal', label: 'Read the Fleet Signal [E]', hint: 'Next: Take the admiral’s route book from the flagship wreck.' },
      { x: 2700, y: 508, name: 'Admiral’s Route Book', label: 'Recover the Route Book [E]', requiresClear: true, rewardGold: 80, hint: 'The route book charts a way into the storm.' }
    ]
  },
  14: {
    name: 'Tempest Crossing', setting: 'The Maelstrom', weather: 'storm',
    objective: 'Cross the storm and secure the three navigation beacons.',
    hint: 'Next: Secure the first beacon on the storm coast.',
    platforms: [
      { x: 0, y: 560, w: 3400, h: 200, type: 'stone' },
      { x: 420, y: 440, w: 260, h: 24, type: 'wood' },
      { x: 930, y: 350, w: 290, h: 24, type: 'stone' },
      { x: 1480, y: 430, w: 280, h: 24, type: 'wood' },
      { x: 2050, y: 330, w: 300, h: 24, type: 'stone' },
      { x: 2660, y: 440, w: 300, h: 24, type: 'wood' }
    ],
    ladders: [{ x: 520, y: 320, w: 18, h: 240 }, { x: 1020, y: 230, w: 18, h: 330 }, { x: 2160, y: 210, w: 18, h: 350 }],
    enemies: [{ x: 1280, type: 'marine' }, { x: 2350, type: 'corsair' }],
    steps: [
      { x: 750, y: 508, name: 'Coast Beacon', label: 'Secure Coast Beacon [E]', hint: 'Next: Light the middle beacon.' },
      { x: 1780, y: 508, name: 'Storm Beacon', label: 'Light Storm Beacon [E]', hint: 'Next: Reach the final beacon beyond the wrecks.' },
      { x: 3160, y: 508, name: 'Maelstrom Beacon', label: 'Secure Maelstrom Beacon [E]', hint: 'The storm is breaking. The Citadel is ahead.' }
    ]
  }
};

class CampaignAdventureLevel extends LevelBase {
  constructor(game, id, config) {
    super(game, id, config.name, config.setting, config.objective);
    this.config = config;
    this.missionStep = 0;
    this.activeHint = config.hint;
    this.missionCompleted = false;
    this.airPockets = config.airPockets || [];
  }

  init() {
    this.game.renderer.setWeather(this.config.weather);
    this.isUnderwater = !!this.config.underwater;
    this.waterLevel = this.isUnderwater ? 220 : null;
    this.platforms = this.config.platforms.map(platform => ({ ...platform }));
    this.ladders = (this.config.ladders || []).map(ladder => ({ ...ladder }));
    this.enemies = (this.config.enemies || []).map(enemy => new Enemy(
      enemy.x, enemy.y ?? 500, enemy.width || 32, enemy.height || 52, enemy.type || 'corsair'
    ));
    this.boss = null;
    if (this.config.boss) {
      this.boss = new Boss(this.config.boss.x, this.config.boss.y, this.config.boss.name, this.config.boss.type);
      this.enemies.push(this.boss);
    }
    this.interactables = (this.config.steps || []).map((step, index) => ({
      x: step.x,
      y: step.y,
      w: 36,
      h: 42,
      name: step.name,
      label: step.label,
      onInteract: () => this.activateMissionStep(index)
    }));
    this.game.player.x = 80;
    this.game.player.y = this.isUnderwater ? 300 : 480;
    const target = this.interactables[0];
    if (target) window.mysticCompass.setTarget(target.x, target.y, target.name);
    else if (this.boss) window.mysticCompass.setTarget(this.boss.x, this.boss.y, this.boss.name);
  }

  activateMissionStep(index) {
    if (index !== this.missionStep || this.missionCompleted) return;
    const step = this.config.steps[index];
    if (step.requiresClear && this.enemies.some(enemy => !enemy.isDead)) {
      this.game.showToast('Defeat the guards before using this objective.');
      return;
    }

    if (step.rewardGold) window.inventorySystem.addGold(step.rewardGold);
    if (step.rewardItem) window.inventorySystem.addItem(step.rewardItem, 1);
    this.game.showToast(step.message || `${step.name} secured.`);
    this.missionStep++;

    if (this.missionStep >= this.config.steps.length) {
      this.finishMission();
      return;
    }

    const nextStep = this.config.steps[this.missionStep];
    this.activeHint = nextStep.hint;
    window.mysticCompass.setTarget(nextStep.x, nextStep.y, nextStep.name);
    this.game.updateObjectiveGuidance();
  }

  finishMission() {
    if (this.missionCompleted) return;
    this.missionCompleted = true;
    this.game.completeLevel();
  }

  update(dt, player, input) {
    this.airPockets.forEach(pocket => {
      if (Math.hypot(player.x - pocket.x, player.y - pocket.y) < pocket.radius) {
        player.oxygen = Math.min(player.maxOxygen, player.oxygen + 50 * dt);
      }
    });

    if (input.isJustPressed('KeyE')) {
      const item = this.interactables[this.missionStep];
      if (item && Math.hypot(player.x - item.x, player.y - item.y) < 70) item.onInteract();
    }

    if (this.boss && this.boss.isDead && !this.missionCompleted) {
      this.missionCompleted = true;
      if (this.config.rewardItem) window.inventorySystem.addItem(this.config.rewardItem, 1);
      this.game.showToast(`${this.boss.name} defeated! The passage is clear.`);
      setTimeout(() => this.game.completeLevel(), 1800);
    }
  }

  render(ctx, camera) {
    const colors = {
      metal: '#475569', stone: '#44403c', reef: '#0e7490', wreck: '#78350f',
      dock: '#3f2d20', wood: '#5d4037', cavern: '#172554'
    };
    this.platforms.forEach(platform => {
      const screenX = platform.x - camera.x;
      const screenY = platform.y - camera.y;
      ctx.fillStyle = colors[platform.type] || '#292524';
      ctx.fillRect(screenX, screenY, platform.w, platform.h);
      ctx.strokeStyle = this.isUnderwater ? '#67e8f9' : '#d4af37';
      ctx.lineWidth = 2;
      ctx.strokeRect(screenX, screenY, platform.w, platform.h);
    });

    this.ladders.forEach(ladder => {
      const screenX = ladder.x - camera.x;
      const screenY = ladder.y - camera.y;
      ctx.fillStyle = '#b45309';
      ctx.fillRect(screenX, screenY, 4, ladder.h);
      ctx.fillRect(screenX + ladder.w - 4, screenY, 4, ladder.h);
      for (let y = screenY; y < screenY + ladder.h; y += 18) ctx.fillRect(screenX, y, ladder.w, 3);
    });

    this.airPockets.forEach(pocket => {
      const screenX = pocket.x - camera.x;
      const screenY = pocket.y - camera.y;
      ctx.beginPath();
      ctx.arc(screenX, screenY, pocket.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.stroke();
    });

    this.interactables.forEach((item, index) => {
      const screenX = item.x - camera.x;
      const screenY = item.y - camera.y;
      ctx.fillStyle = index === this.missionStep ? '#facc15' : '#78716c';
      ctx.shadowColor = index === this.missionStep ? '#facc15' : 'transparent';
      ctx.shadowBlur = index === this.missionStep ? 14 : 0;
      ctx.fillRect(screenX - 12, screenY - 20, 24, 30);
      ctx.shadowBlur = 0;
      if (index === this.missionStep || Math.hypot(this.game.player.x - item.x, this.game.player.y - item.y) < 80) {
        ctx.font = "bold 11px 'Cinzel', serif";
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fef08a';
        ctx.fillText(item.label, screenX, screenY - 28);
      }
    });
  }
}

/* ==========================================================================
   LEVEL 15: THE FINAL TREASURE (ANCIENT CITADEL & CLIMACTIC CHOICE)
   ========================================================================== */

class Level15_TheFinalTreasure extends LevelBase {
  constructor(game) {
    super(game, 15, "The Final Treasure", "Treasure Island / Citadel", "Reach the legendary Aztec gold chamber, defeat Davy's Shade, and decide the fate of the curse.");
  }

  init() {
    this.game.renderer.setWeather('sunset');
    this.waterLevel = null;

    // Volcanic Citadel battlements & crumbling ramparts
    this.platforms = [
      { x: 0, y: 560, w: 3400, h: 200, type: 'fort_stone' },
      { x: 450, y: 440, w: 260, h: 25, type: 'fort_stone' },
      { x: 850, y: 350, w: 300, h: 25, type: 'fort_stone' },
      { x: 1350, y: 440, w: 280, h: 25, type: 'fort_stone' },
      // Treasure Chamber Altar
      { x: 1850, y: 460, w: 1000, h: 200, type: 'gold_floor' }
    ];

    this.ladders = [
      { x: 500, y: 260, w: 18, h: 300 },
      { x: 1400, y: 240, w: 18, h: 320 }
    ];

    // Final Boss: Davy's Shade / Aztec Leviathan Lord
    this.boss = new Boss(2200, 360, "Davy's Cursed Shade", 'shade');
    this.enemies = [this.boss];

    // The Cursed Aztec Treasure Altar
    this.interactables = [
      {
        x: 2600, y: 380, w: 80, h: 80,
        name: "Cursed Aztec Altar",
        label: "Examine Cursed Altar [E]",
        onInteract: () => {
          if (!this.boss.isDead) {
            this.game.showToast("You must vanquish Davy's Shade before approaching the Altar!");
            return;
          }
          this.triggerEndingChoiceModal();
        }
      }
    ];

    this.game.player.x = 80;
    this.game.player.y = 480;

    window.mysticCompass.setTarget(2200, 360, "Davy's Shade (Final Boss)");
  }

  update(dt, player, input) {
    if (input.isJustPressed('KeyE')) {
      this.interactables.forEach(item => {
        if (Math.hypot(player.x - item.x, player.y - item.y) < 85) {
          item.onInteract();
        }
      });
    }

    if (this.boss.isDead) {
      window.mysticCompass.setTarget(2600, 380, "The Legendary Treasure");
    }
  }

  triggerEndingChoiceModal() {
    const modal = document.getElementById('ending-modal');
    if (modal) modal.classList.add('active');
  }

  render(ctx, camera) {
    ctx.save();

    // Ancient golden stone battlements
    this.platforms.forEach(p => {
      const sx = p.x - camera.x;
      const sy = p.y - camera.y;
      ctx.fillStyle = p.type === 'gold_floor' ? '#78350f' : '#292524';
      ctx.fillRect(sx, sy, p.w, p.h);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, p.w, p.h);
    });

    // Ladders
    this.ladders.forEach(l => {
      const sx = l.x - camera.x;
      const sy = l.y - camera.y;
      ctx.fillStyle = '#b45309';
      ctx.fillRect(sx, sy, l.w, l.h);
    });

    // Treasure Altar with glowing mountains of Aztec gold
    this.interactables.forEach(item => {
      const sx = item.x - camera.x;
      const sy = item.y - camera.y;

      // Golden pyramid altar
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.moveTo(sx - 30, sy + 60);
      ctx.lineTo(sx + 110, sy + 60);
      ctx.lineTo(sx + 40, sy);
      ctx.closePath();
      ctx.fill();

      // Golden chests & glowing Aztec Sun Wheel
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(sx + 40, sy - 15, 20, 0, Math.PI * 2);
      ctx.fill();

      if (Math.hypot(this.game.player.x - item.x, this.game.player.y - item.y) < 85) {
        ctx.font = "bold 13px 'Cinzel', serif";
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.fillText(item.label, sx + 40, sy - 45);
      }
    });

    ctx.restore();
  }
}
