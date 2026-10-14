/* ==========================================================================
   DIALOGUE & QUEST SYSTEM - The Lost Compass
   Branching NPC conversations, quest progress, and typewriter UI
   ========================================================================== */

class DialogueSystem {
  constructor() {
    this.modal = null;
    this.speakerEl = null;
    this.textEl = null;
    this.choicesEl = null;
    this.portraitCanvas = null;
    
    this.isOpen = false;
    this.currentDialogue = null;
    this.currentNode = null;
    this.typewriterInterval = null;
    this.fullText = "";
    this.currentTextIndex = 0;

    // Quest state tracking
    this.questState = {
      level1_found_compass: false,
      level2_ruins_solved: false,
      level3_talked_barnaby: false,
      level3_found_spy: false,
      level3_ready_to_sail: false,
      level4_flagship_defeated: false,
      level5_guardian_defeated: false,
      level6_final_choice_made: false
    };
  }

  init() {
    this.modal = document.getElementById('dialogue-modal');
    this.speakerEl = document.getElementById('dialogue-speaker-name');
    this.textEl = document.getElementById('dialogue-message-body');
    this.choicesEl = document.getElementById('dialogue-choices-container');
    this.portraitCanvas = document.getElementById('npc-portrait-canvas');
  }

  startDialogue(dialogueTree, startNodeId = 'start') {
    if (!this.modal) this.init();
    this.currentDialogue = dialogueTree;
    this.isOpen = true;
    this.modal.classList.add('active');
    this.goToNode(startNodeId);
  }

  goToNode(nodeId) {
    const node = this.currentDialogue[nodeId];
    if (!node) {
      this.closeDialogue();
      return;
    }
    this.currentNode = node;

    if (this.speakerEl) this.speakerEl.innerText = node.speaker || "Mysterious Stranger";
    this.renderPortrait(node.speakerRole || 'pirate');

    // Typewriter effect
    this.fullText = node.text;
    this.currentTextIndex = 0;
    if (this.textEl) this.textEl.innerText = "";
    if (this.choicesEl) this.choicesEl.innerHTML = "";

    if (this.typewriterInterval) clearInterval(this.typewriterInterval);

    this.typewriterInterval = setInterval(() => {
      if (this.currentTextIndex < this.fullText.length) {
        this.currentTextIndex++;
        this.textEl.textContent = this.fullText.slice(0, this.currentTextIndex);
      } else {
        clearInterval(this.typewriterInterval);
        this.typewriterInterval = null;
        this.renderChoices(node.choices);
      }
    }, 20);

    // Call onEnter action if defined
    if (typeof node.onEnter === 'function') {
      node.onEnter(this.questState);
    }
  }

  skipTypewriter() {
    if (this.typewriterInterval) {
      clearInterval(this.typewriterInterval);
      this.typewriterInterval = null;
      if (this.textEl) this.textEl.innerText = this.fullText;
      if (this.currentNode) this.renderChoices(this.currentNode.choices);
    }
  }

  renderChoices(choices) {
    if (!this.choicesEl) return;
    this.choicesEl.innerHTML = "";

    if (!choices || choices.length === 0) {
      const btn = document.createElement('button');
      btn.className = 'dialogue-choice-btn';
      btn.innerText = 'Continue [Space]';
      btn.onclick = () => this.closeDialogue();
      this.choicesEl.appendChild(btn);
      return;
    }

    choices.forEach(ch => {
      // Check condition if present
      if (typeof ch.condition === 'function' && !ch.condition(this.questState)) {
        return;
      }

      const btn = document.createElement('button');
      btn.className = 'dialogue-choice-btn';
      btn.innerText = ch.text;
      btn.onclick = () => {
        if (typeof ch.action === 'function') {
          ch.action(this.questState);
        }
        if (ch.nextNode) {
          this.goToNode(ch.nextNode);
        } else {
          this.closeDialogue();
        }
      };
      this.choicesEl.appendChild(btn);
    });
  }

  closeDialogue() {
    if (this.typewriterInterval) clearInterval(this.typewriterInterval);
    this.isOpen = false;
    if (this.modal) this.modal.classList.remove('active');
  }

  renderPortrait(role) {
    if (!this.portraitCanvas) return;
    const ctx = this.portraitCanvas.getContext('2d');
    const w = this.portraitCanvas.width = 90;
    const h = this.portraitCanvas.height = 90;

    ctx.clearRect(0, 0, w, h);

    // Dark moody background
    const bgGrad = ctx.createRadialGradient(w/2, h/2, 5, w/2, h/2, 45);
    bgGrad.addColorStop(0, '#2d1e15');
    bgGrad.addColorStop(1, '#0e0804');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Draw stylized avatar based on role
    ctx.save();
    ctx.translate(w/2, h/2);

    if (role === 'barnaby') {
      // Old Blind Barnaby: Grey beard, eye patch, weathered hat
      ctx.fillStyle = '#1c130d';
      ctx.beginPath();
      ctx.arc(0, 5, 22, 0, Math.PI * 2);
      ctx.fill();
      // Beard
      ctx.fillStyle = '#b0aba5';
      ctx.beginPath();
      ctx.moveTo(-18, 5);
      ctx.quadraticCurveTo(0, 38, 18, 5);
      ctx.fill();
      // Face
      ctx.fillStyle = '#cf9f74';
      ctx.beginPath();
      ctx.arc(0, -5, 16, 0, Math.PI * 2);
      ctx.fill();
      // Eye patch
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(-5, -6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-16, -12);
      ctx.lineTo(8, 2);
      ctx.stroke();
      // Tricorn hat
      ctx.fillStyle = '#3a271d';
      ctx.beginPath();
      ctx.moveTo(-30, -14);
      ctx.lineTo(30, -14);
      ctx.lineTo(0, -32);
      ctx.closePath();
      ctx.fill();
    } else if (role === 'rouge') {
      // Madame Rouge: Feathered red hat, mysterious smile
      ctx.fillStyle = '#e8a588';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      // Crimson hair / hat
      ctx.fillStyle = '#831818';
      ctx.beginPath();
      ctx.arc(0, -6, 20, Math.PI, Math.PI * 2);
      ctx.lineTo(32, -8);
      ctx.lineTo(-32, -8);
      ctx.closePath();
      ctx.fill();
      // Gold earring
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(16, 4, 4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (role === 'flint') {
      // First Mate Flint: Tough bandana, stubble, scar
      ctx.fillStyle = '#c58b5e';
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.fill();
      // Navy Bandana
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.arc(0, -8, 18, Math.PI * 0.9, Math.PI * 2.1);
      ctx.fill();
      // Scar across eye
      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, -10);
      ctx.lineTo(-2, 4);
      ctx.stroke();
    } else if (role === 'guardian' || role === 'shade') {
      // Spectral Wraith / Cursed Boss: Glowing cyan skull
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#064e3b';
      ctx.beginPath();
      ctx.arc(0, -2, 18, 0, Math.PI * 2);
      ctx.fill();
      // Glowing Cyan Eyes
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(-7, -5, 4, 0, Math.PI * 2);
      ctx.arc(7, -5, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Default Pirate
      ctx.fillStyle = '#d4a373';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.moveTo(-25, -10);
      ctx.lineTo(25, -10);
      ctx.lineTo(0, -28);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}

window.dialogueSystem = new DialogueSystem();
