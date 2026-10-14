/* ==========================================================================
   INVENTORY & ECONOMY SYSTEM - The Lost Compass
   Manages weapons, consumables, treasures, quest items, and merchant trading
   ========================================================================== */

class InventorySystem {
  constructor() {
    this.gold = 50;
    this.ammo = 20;
    this.maxAmmo = 20;

    // Item registry
    this.items = {
      // Weapons
      cutlass: {
        id: 'cutlass',
        name: 'Officer Cutlass',
        type: 'weapon',
        damage: 25,
        icon: '⚔️',
        desc: 'A reliable balanced naval blade. Fast strikes and parry capability.',
        qty: 1,
        usable: false
      },
      flintlock: {
        id: 'flintlock',
        name: 'Flintlock Pistol',
        type: 'weapon',
        damage: 60,
        icon: '🔫',
        desc: 'A brass-inlaid pirate pistol. Powerful ranged shot, uses gunpowder ammo.',
        qty: 1,
        usable: false
      },
      blunderbuss: {
        id: 'blunderbuss',
        name: 'Iron Blunderbuss',
        type: 'weapon',
        damage: 110,
        icon: '💥',
        desc: 'Fires a devastating spread of heavy pellets. High damage close range.',
        qty: 0,
        cost: 120,
        usable: false
      },
      cursed_saber: {
        id: 'cursed_saber',
        name: 'Cursed Phantom Saber',
        type: 'weapon',
        damage: 48,
        icon: '🗡️',
        desc: 'Forged in the ghostly depths. Emits a spectral aura that cuts through armor.',
        qty: 0,
        cost: 200,
        usable: false
      },

      // Consumables
      rum: {
        id: 'rum',
        name: 'Aged Caribbean Rum',
        type: 'consumable',
        icon: '🍶',
        desc: 'Strong pirate liquor. Restores 45 points of Health instantly.',
        qty: 2,
        cost: 25,
        usable: true,
        use: () => {
          if (!window.game || !window.game.player) return false;
          const p = window.game.player;
          if (p.health >= p.maxHealth) {
            window.game.showToast("Health is already full!");
            return false;
          }
          p.heal(45);
          window.game.showToast("Drank Rum: Restored 45 Health!");
          if (window.soundEngine) window.soundEngine.playCoin();
          return true;
        }
      },
      hardtack: {
        id: 'hardtack',
        name: 'Sailor Biscuit',
        type: 'consumable',
        icon: '🍞',
        desc: 'Dry ship ration. Restores full Stamina and boosts agility temporarily.',
        qty: 2,
        cost: 15,
        usable: true,
        use: () => {
          if (!window.game || !window.game.player) return false;
          window.game.player.stamina = window.game.player.maxStamina;
          window.game.showToast("Ate Biscuit: Stamina fully restored!");
          return true;
        }
      },
      powder_pouch: {
        id: 'powder_pouch',
        name: 'Gunpowder Horn',
        type: 'consumable',
        icon: '💣',
        desc: 'Fine black powder. Restores 6 pistol shots.',
        qty: 1,
        cost: 20,
        usable: true,
        use: () => {
          if (this.ammo >= this.maxAmmo) {
            window.game.showToast("Ammo capacity already full!");
            return false;
          }
          this.ammo = Math.min(this.maxAmmo, this.ammo + 6);
          this.updateHUD();
          window.game.showToast("Loaded 6 Gunpowder Ammo!");
          return true;
        }
      },

      // Quest Items
      compass: {
        id: 'compass',
        name: 'The Lost Compass',
        type: 'quest',
        icon: '🧭',
        desc: 'A legendary cursed relic. Its needle twitches towards your deepest desire.',
        qty: 0,
        usable: false
      },
      skeleton_key: {
        id: 'skeleton_key',
        name: 'Ornate Skeleton Key',
        type: 'quest',
        icon: '🗝️',
        desc: 'Carved from blackened brass. Can unlock ancient locked chests and gates.',
        qty: 0,
        usable: false
      },
      sunken_medallion: {
        id: 'sunken_medallion',
        name: 'Sunken Aztec Medallion',
        type: 'quest',
        icon: '🪙',
        desc: 'Ancient gold carved with serpent sigils. Fits the pedestal of the Jungle Ruins.',
        qty: 0,
        usable: false
      },
      sea_chart: {
        id: 'sea_chart',
        name: 'Port Royale Sea Chart',
        type: 'quest',
        icon: '📜',
        desc: 'Detailed navigation map of the cursed reefs and naval trade routes.',
        qty: 0,
        usable: false
      },
      map_fragment: {
        id: 'map_fragment',
        name: 'Final Map Fragment',
        type: 'quest',
        icon: '🗺️',
        desc: 'Retrieved from the ghostly Guardian of Cursed Caves. Pinpoints the Treasure Citadel.',
        qty: 0,
        usable: false
      }
    };

    this.selectedItemId = 'cutlass';
  }

  init() {
    this.updateHUD();
    this.setupUIEvents();
  }

  setupUIEvents() {
    const invBtn = document.getElementById('btn-inventory');
    const modal = document.getElementById('inventory-modal');
    const closeBtn = document.getElementById('close-inventory');

    if (invBtn && modal) {
      invBtn.addEventListener('click', () => this.toggleInventoryModal());
    }
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    }
  }

  toggleInventoryModal() {
    const modal = document.getElementById('inventory-modal');
    if (!modal) return;
    const isOpening = !modal.classList.contains('active');
    modal.classList.toggle('active', isOpening);
    if (isOpening) {
      this.renderInventoryModal();
    }
  }

  hasItem(id) {
    return this.items[id] && this.items[id].qty > 0;
  }

  addItem(id, count = 1) {
    if (!this.items[id]) return;
    this.items[id].qty += count;
    this.updateHUD();
    if (window.game) {
      window.game.showToast(`Obtained: ${this.items[id].name} (+${count})`);
      if (window.soundEngine) window.soundEngine.playCoin();
    }
  }

  removeItem(id, count = 1) {
    if (!this.items[id] || this.items[id].qty <= 0) return false;
    this.items[id].qty = Math.max(0, this.items[id].qty - count);
    this.updateHUD();
    return true;
  }

  addGold(amount) {
    this.gold += amount;
    this.updateHUD();
    if (window.soundEngine) window.soundEngine.playCoin();
    if (window.game) window.game.showToast(`+${amount} Gold Doubloons`);
  }

  spendGold(amount) {
    if (this.gold < amount) return false;
    this.gold -= amount;
    this.updateHUD();
    return true;
  }

  getSaveData() {
    return {
      gold: this.gold,
      ammo: this.ammo,
      items: Object.fromEntries(Object.entries(this.items).map(([id, item]) => [id, item.qty]))
    };
  }

  restoreSaveData(data) {
    if (!data) return;
    if (Number.isFinite(data.gold)) this.gold = Math.max(0, Math.floor(data.gold));
    if (Number.isFinite(data.ammo)) this.ammo = Math.max(0, Math.min(this.maxAmmo, Math.floor(data.ammo)));
    if (data.items && typeof data.items === 'object') {
      Object.entries(data.items).forEach(([id, qty]) => {
        if (this.items[id] && Number.isFinite(qty)) {
          this.items[id].qty = Math.max(0, Math.floor(qty));
        }
      });
    }
    this.updateHUD();
  }

  resetForNewGame() {
    this.gold = 50;
    this.ammo = 20;
    const startingItems = { cutlass: 1, flintlock: 1, rum: 2, hardtack: 2, powder_pouch: 1 };
    Object.values(this.items).forEach(item => {
      item.qty = startingItems[item.id] || 0;
    });
    this.selectedItemId = 'cutlass';
    this.updateHUD();
  }

  useItem(id) {
    const item = this.items[id];
    if (!item || item.qty <= 0) return;
    if (item.usable && typeof item.use === 'function') {
      const success = item.use();
      if (success) {
        item.qty--;
        this.renderInventoryModal();
        this.updateHUD();
      }
    }
  }

  updateHUD() {
    const goldEl = document.getElementById('gold-count');
    const ammoEl = document.getElementById('ammo-count');
    if (goldEl) goldEl.innerText = this.gold;
    if (ammoEl) ammoEl.innerText = `${this.ammo}/${this.maxAmmo}`;
  }

  renderInventoryModal() {
    const grid = document.getElementById('inventory-slots-container');
    const details = document.getElementById('item-details-content');
    if (!grid) return;

    grid.innerHTML = '';
    const itemList = Object.values(this.items).filter(item => item.qty > 0);

    if (itemList.length === 0) {
      grid.innerHTML = '<div style="grid-column: span 4; text-align: center; padding: 20px; color: #888;">Bag is empty</div>';
      return;
    }

    itemList.forEach(item => {
      const slot = document.createElement('div');
      slot.className = `inventory-slot ${item.id === this.selectedItemId ? 'active-item' : ''}`;
      slot.innerHTML = `
        <div class="slot-icon">${item.icon}</div>
        <div class="slot-name">${item.name}</div>
        <div class="slot-qty">x${item.qty}</div>
      `;

      slot.addEventListener('click', () => {
        this.selectedItemId = item.id;
        this.renderInventoryModal();
      });

      slot.addEventListener('dblclick', () => {
        if (item.usable) {
          this.useItem(item.id);
        }
      });

      grid.appendChild(slot);
    });

    const currentItem = this.items[this.selectedItemId];
    if (currentItem && currentItem.qty > 0 && details) {
      details.innerHTML = `
        <div style="font-family: 'Cinzel', serif; font-size: 15px; font-weight: bold; color: var(--gold-light); margin-bottom: 4px;">
          ${currentItem.icon} ${currentItem.name} (${currentItem.type.toUpperCase()})
        </div>
        <div style="margin-bottom: 8px; color: #e2d7c0; line-height: 1.4;">${currentItem.desc}</div>
        ${currentItem.usable ? `<button class="action-btn" onclick="window.inventorySystem.useItem('${currentItem.id}')">Use Item</button>` : ''}
      `;
    }
  }
}

window.inventorySystem = new InventorySystem();
