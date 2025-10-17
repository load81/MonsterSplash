// --- Title Scene ---
class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    preload() {
        // Load all game assets
        this.load.image('background', 'graveyard.png'); 
        this.load.svg('balloon_asset', '40.svg', { width: 30, height: 30 });
        this.load.svg('title_logo', 'title_logo.svg', { width: 450, height: 120 });
        this.load.svg('rules_button', 'rules.svg', { width: 80, height: 40 });
        this.load.svg('rules_hover', 'rules_hover.svg', { width: 80, height: 40 });
        this.load.svg('play_button', 'play.svg', { width: 80, height: 40 });
        this.load.svg('play_hover', 'play_hover.svg', { width: 80, height: 40 });
        this.load.svg('rules_panel', 'rules_panel.svg', { width: 1440, height: 600 });

        // Character and UI assets
        this.load.image('zombie', 'zombie.png');
        this.load.image('ghost', 'ghost.png');
        this.load.image('witch', 'witch.png');
        this.load.image('bat', 'bat.png');
        this.load.image('hand', 'hand.png'); 
        this.load.image('reward', 'reward.png');
        this.load.image('ui_frame', 'ui_frame.png');
        this.load.image('ui_power_dash', 'power.png');
        this.load.bitmapFont('ui_font', 'ui_font.png', 'ui_font.fnt');
        
        // Audio assets
        this.load.audio('ambient_loop', '90.mp3');
        this.load.audio('owl_hoot', '89.mp3');
        this.load.audio('intro', 'intro.mp3');
        this.load.audio('cackle', 'cackle.mp3');
        this.load.audio('moan', 'moan.mp3');
        this.load.audio('boo', 'boo.mp3');
        this.load.audio('zombie_die', 'zombie_die.mp3');
        this.load.audio('ghost_die', 'ghost_die.mp3');
        this.load.audio('witch_die', 'witch_die.mp3');
        this.load.audio('bat_die', 'bat_die.mp3');
        this.load.audio('bat', 'bat.mp3');
    }

    create() {
        this.time.removeAllEvents(); 
        
        this.add.image(360, 150, 'background').setOrigin(0.5, 0.5);
        this.add.image(360, 100, 'title_logo').setOrigin(0.5, 0.5); 
        
        const rulesButton = this.add.image(250, 240, 'rules_button').setInteractive({ useHandCursor: true });
        const startButton = this.add.image(470, 240, 'play_button').setInteractive({ useHandCursor: true });
        
        this.overlayContainer = this.add.container(360, 150);
        const rulesPanel = this.add.image(0, 0, 'rules_panel').setOrigin(0.5, 0.5).setDisplaySize(720, 300); 
        this.overlayContainer.add(rulesPanel);
        this.overlayContainer.setVisible(false); 
        
        this.titleMusic = this.sound.add('ambient_loop', { loop: true, volume: 0.2 });
        this.titleMusic.play();

        this.time.addEvent({
            delay: Phaser.Math.Between(3000, 8000), 
            callback: () => { this.sound.play('owl_hoot', { volume: 0.5 }); },
            loop: true
        });

        const handleHover = (button, hoverKey, releasedKey) => {
            button.on('pointerover', () => button.setTexture(hoverKey));
            button.on('pointerout', () => button.setTexture(releasedKey));
            button.on('pointerup', () => button.setTexture(releasedKey));
        };
        
        handleHover(rulesButton, 'rules_hover', 'rules_button');
        rulesButton.on('pointerdown', () => {
            rulesButton.setTexture('rules_hover');
            this.overlayContainer.setVisible(!this.overlayContainer.visible);
        });

        handleHover(startButton, 'play_hover', 'play_button');
        startButton.on('pointerdown', () => {
            startButton.setTexture('play_hover');
            this.sound.play('intro');
            this.time.delayedCall(100, () => {
                this.sound.stopByKey('ambient_loop');
                this.time.removeAllEvents(); 
                this.scene.start('GameScene');
            }, [], this);
        });
    }
    
    shutdown() {
        this.sound.stopAll();
    }
}


// --- Game Scene ---
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        
        // Game constants
        this.GRAVE_POSITIONS_DEFAULT = [
            {x: 160, y: 120, isOccupied: false}, 
            {x: 568, y: 120, isOccupied: false} 
        ];
        this.CHARACTER_SPECS = {
            zombie: { key: 'zombie', speed: 50, points: 5, scale: 0.5 }, 
            ghost:  { key: 'ghost',  speed: 0,  points: 10, scale: 0.5 },
            witch:  { key: 'witch',  speed: 180, points: 20, scale: 0.42 }, 
            bat:    { key: 'bat',    speed: 0,  points: 0,  reward: 5, scale: 0.5 }
        };
        this.HAND_FIXED_Y = 280; 
        this.RISE_HEIGHT = 40; 
        this.RISE_TIME_FRAMES = 30; 
    }

    init() {
        // Initialize or reset game state variables
        this.gameState = {
            score: 0, level: 1, ammo: 10, isAiming: false, power: 0,
            powerDirection: 1, characters: null, projectiles: null, hand: null,
            isGameOver: false, isPaused: false, batSpawnLocked: true, canFire: true,
            scoreText: null, levelText: null, ammoText: null, powerDash: null,
            pauseButton: null, ambientMusic: null,
            handClampX: 0
        };
        this.GRAVE_POSITIONS = JSON.parse(JSON.stringify(this.GRAVE_POSITIONS_DEFAULT));
    }

    create() {
        // Setup background and physics
        this.gameState.ambientMusic = this.sound.add('ambient_loop', { loop: true, volume: 1.0 }); 
        this.gameState.ambientMusic.play();
        this.add.image(360, 150, 'background').setOrigin(0.5, 0.5);
        this.physics.world.setBounds(0, 0, 720, 300);
        this.physics.world.on('worldbounds', this.onBalloonOut, this);
        this.gameState.projectiles = this.physics.add.group();
        
        // Setup UI elements
        this.add.image(0, 0, 'ui_frame').setOrigin(0,0).setDepth(50);
        const meterX = this.scale.width - 21;
        this.meterTopY = 122;
        this.meterBottomY = 282;
        this.gameState.powerDash = this.add.sprite(meterX, this.meterBottomY, 'ui_power_dash').setDepth(51).setVisible(false);
        this.add.text(meterX, 17, "SCORE", { fontSize: '8px', fill: '#FFFFFF', fontFamily: 'Archivo Narrow', align: 'center' }).setOrigin(0.5).setDepth(53);
        this.gameState.scoreText = this.add.text(meterX, 35, "0", { fontSize: '16px', fill: '#FFA500', fontFamily: 'Archivo Narrow', align: 'center' }).setOrigin(0.5).setDepth(53);
        this.add.text(meterX, 60, "LEVEL", { fontSize: '8px', fill: '#FFFFFF', fontFamily: 'Archivo Narrow', align: 'center' }).setOrigin(0.5).setDepth(53);
        this.gameState.levelText = this.add.text(meterX, 80, "1", { fontSize: '16px', fill: '#FFA500', fontFamily: 'Archivo Narrow', align: 'center' }).setOrigin(0.5).setDepth(53);
        this.pauseButton = this.add.bitmapText(20, 25, 'ui_font', '||', 20).setOrigin(0, 0.5).setInteractive({ useHandCursor: true }).setDepth(100);
        this.pauseButton.on('pointerdown', this.togglePause, this);
        this.muteButton = this.add.text(35, 18, '🔊', { fontSize: '18px', fill: '#FFFFFF', padding: {x: 5, y: 2} }).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(100);
        this.muteButton.on('pointerdown', this.toggleMute, this); 
        this.gameState.ammoText = this.add.bitmapText(75, 27, 'ui_font', `AMMO: ${this.gameState.ammo}`, 22).setOrigin(0, 0.5).setDepth(100);
        
        // Setup player and input
        this.gameState.hand = this.add.sprite(360, 300, 'hand').setOrigin(0.5, 0.5).setScale(0.45).setDepth(20); 
        this.gameState.handClampX = this.scale.width - 60 - 8;
        this.gameState.hand.y = this.HAND_FIXED_Y;
        this.gameState.characters = this.physics.add.group();
        this.input.on('pointerdown', this.startAim, this);
        this.input.on('pointerup', this.throwBalloon, this);
        
        // Setup timed monster spawn events
        this.time.addEvent({ delay: Phaser.Math.Between(2000, 3500), callback: this.spawnSpecialCharacter, callbackScope: this, loop: true });
        this.time.addEvent({ delay: Phaser.Math.Between(2500, 4000), callback: this.checkAndSpawnZombie, callbackScope: this, loop: true });

        if (this.physics.world.debug) {
        	this.gameState.batSpawnLocked = false;
        } else {
        	this.time.delayedCall(8000, () => { this.gameState.batSpawnLocked = false; }, [], this);
    	}
        this.physics.add.overlap(this.gameState.projectiles, this.gameState.characters, this.hitCharacter, null, this);
    }

    update() {
        if(this.gameState.isGameOver || this.gameState.isPaused) return;
        
        this.gameState.hand.x = Phaser.Math.Clamp(this.input.activePointer.x, 8, this.gameState.handClampX);
        this.gameState.hand.y = this.HAND_FIXED_Y; 

        if (this.gameState.isAiming) {
            this.gameState.power += this.gameState.powerDirection * 3; 
            if (this.gameState.power >= 100) { this.gameState.power = 100; this.gameState.powerDirection = -1; } 
            else if (this.gameState.power <= 0) { this.gameState.power = 0; this.gameState.powerDirection = 1; }
            this.drawPowerMeter(); 
        } else {
            this.gameState.powerDash.setVisible(false);
        }
        this.gameState.scoreText.setText(this.gameState.score);
        this.gameState.ammoText.setText(`AMMO: ${this.gameState.ammo}`);
        this.gameState.levelText.setText(this.gameState.level);

        this.gameState.projectiles.children.iterate((balloon) => {
            if (balloon && balloon.canDamage && balloon.body.velocity.y > 0) {
                balloon.canDamage = false;
                balloon.setTint(0x808080);
            }
        });

        if (this.gameState.ammo <= 0 && this.gameState.projectiles.getLength() === 0) { this.triggerGameOver(); }
        
        // Update active characters
        this.gameState.characters.children.iterate((char) => {
            if (char && char.active) {
                if (char.type === 'ghost') { this.updateGhost(char); } 
                else if (char.type === 'bat') { this.updateBat(char); }
                if (char.x < -30 || char.x > 750 || char.y < -30 || char.y > 400) {
                    char.destroy();
                }
            }
        });
    }
    
    addZombieBobTween(target) {
        this.tweens.add({ targets: target, y: target.y - 5, duration: 500, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    }

    onBalloonOut(body) { body.gameObject.destroy(); }

    toggleMute() {
        this.sound.mute = !this.sound.mute;
        this.muteButton.setText(this.sound.mute ? '🔇' : '🔊');
    }

    togglePause() {
        this.gameState.isPaused = !this.gameState.isPaused;
        if (this.gameState.isPaused) {
            this.physics.pause(); this.tweens.pauseAll(); this.sound.pauseAll(); 
            this.pauseButton.setText('>'); 
        } else {
            this.physics.resume(); this.tweens.resumeAll(); this.sound.resumeAll();
            this.pauseButton.setText('||');
        }
    }

    triggerGameOver() {
        this.sound.stopAll();
        this.gameState.isGameOver = true;
        this.time.removeAllEvents(); 
        this.add.rectangle(360, 150, 720, 300, 0x000000, 0.7).setOrigin(0.5).setDepth(99); 
        this.add.text(360, 50, 'Monster Splash', { fontSize: '48px', fill: '#FFD700', stroke: '#800080', strokeThickness: 8, fontFamily: 'Archivo Narrow' }).setOrigin(0.5).setDepth(100);
        this.add.text(360, 130, `Final Score: ${this.gameState.score}`, { fontSize: '28px', fill: '#FFFFFF', fontFamily: 'Archivo Narrow' }).setOrigin(0.5).setDepth(100);
        const restartButton = this.add.text(360, 220, 'RESTART', { fontSize: '32px', fill: '#00FF00', backgroundColor: '#303030', padding: { x: 20, y: 10 }, fontFamily: 'Archivo Narrow' }).setOrigin(0.5).setDepth(100).setInteractive({ useHandCursor: true });
        restartButton.on('pointerdown', () => { this.scene.start('TitleScene'); });
        this.gameState.characters.children.iterate((char) => { if (char && char.body) { char.body.enable = false; } });
    }

    drawPowerMeter() {
        this.gameState.powerDash.setVisible(true);
        const yPos = Phaser.Math.Linear(this.meterBottomY, this.meterTopY, this.gameState.power / 100);
        this.gameState.powerDash.setY(yPos);
    }

    updateGhost(ghost) {
        if (!ghost.state) { 
            ghost.y += ghost.height * ghost.scaleY; 
            ghost.state = 'rising'; 
            ghost.riseTargetY = ghost.y - this.RISE_HEIGHT; 
            ghost.pauseTimer = Phaser.Math.RND.between(90, 150);
            ghost.lateralSpeed = Phaser.Math.RND.between(-20, 20); 
            ghost.setVelocityX(ghost.lateralSpeed);
            ghost.alpha = 0.0;
            ghost.setScale(0); 
            ghost.soundPlayed = false;
        }
        if (ghost.state === 'rising') {
            const framesRemaining = (ghost.y - ghost.riseTargetY) / (this.RISE_HEIGHT / this.RISE_TIME_FRAMES);
            ghost.y -= this.RISE_HEIGHT / this.RISE_TIME_FRAMES; 
            const progress = 1 - (framesRemaining / this.RISE_TIME_FRAMES);
            const easedProgress = Phaser.Math.Easing.Sine.Out(progress);
            ghost.alpha = Phaser.Math.Clamp(easedProgress, 0, 1.0);
            ghost.setScale(Phaser.Math.Clamp(easedProgress, 0, 1.0) * this.CHARACTER_SPECS.ghost.scale);

            if (progress >= 0.3 && !ghost.soundPlayed) { ghost.soundPlayed = true; } 
            if (ghost.y <= ghost.riseTargetY) { 
                ghost.y = ghost.riseTargetY; 
                ghost.state = 'pausing'; 
                ghost.setVelocityX(ghost.lateralSpeed / 4); 
                ghost.setScale(this.CHARACTER_SPECS.ghost.scale); 
            }
        } else if (ghost.state === 'pausing') {
            ghost.alpha = 1.0; 
            ghost.pauseTimer--;
            if (ghost.pauseTimer <= 0) { ghost.state = 'fading'; ghost.setVelocityX(0); }
        } else if (ghost.state === 'fading') {
            ghost.y -= 3; 
            ghost.alpha -= 0.05;
            if (ghost.alpha <= 0) { this.GRAVE_POSITIONS[ghost.graveIndex].isOccupied = false; ghost.destroy(); }
        }
    }

    updateBat(bat) {
        if (!bat.state) {
            bat.state = 'waiting';
            const holdDuration = Phaser.Math.Between(2800, 3500); 
            this.time.delayedCall(holdDuration, () => { 
                if (bat.active) { 
                    bat.state = 'flying'; 
                    bat.setVelocityY(-400); 
                    this.sound.play('bat', { volume: 1.0 });
                    this.tweens.add({ targets: bat, angle: 10, duration: 80, yoyo: true, repeat: -1 });
                } 
            }, [], this);
        }
    }
    
    checkAndSpawnZombie() {
        if (this.gameState.isGameOver || this.gameState.isPaused) return;
        const zombieCount = this.gameState.characters.children.getArray().filter(char => char.type === 'zombie').length;
        if (zombieCount < 2) {
            this.spawnZombie();
        }
    }
    
	spawnZombie() {
		const spec = this.CHARACTER_SPECS.zombie;
		const startSide = Phaser.Math.RND.pick([-1, 1]);
		const x = (startSide === 1) ? -10 : 730;
		const y = 300 + 30; // Spawn from the bottom

		const newChar = this.gameState.characters.create(x, y, 'zombie');
		if (!newChar) return;

		newChar.setScale(spec.scale).setOrigin(0.5, 1);
		newChar.refreshBody(); // Important: Refresh body AFTER scaling and origin change

		// --- HURTBOX ADJUSTMENT ---
		const hurtboxWidth = 60;
		const hurtboxHeight = 40;
		const yOffset = newChar.height * 0.25; // Position it 25% down from the top

		newChar.body.setSize(hurtboxWidth, hurtboxHeight);

		if (startSide === -1) { // Flipped zombie from the RIGHT
			const xOffset = newChar.width - hurtboxWidth - 20; // 20 is a padding value
			newChar.body.setOffset(xOffset, yOffset);
			newChar.setFlipX(true);
		} else { // Normal zombie from the LEFT
			newChar.body.setOffset(20, yOffset); // 20 is a padding value
		}
		// --- END ---

		this.addZombieBobTween(newChar); // This will now work correctly
		newChar.body.setVelocityX(startSide * spec.speed);

		this.sound.play('moan', { volume: 0.3, detune: Phaser.Math.Between(-200, 200) });
		newChar.setDepth(5);
		newChar.body.setImmovable(false).setAllowGravity(false);
		newChar.type = spec.key;
		newChar.points = spec.points;
	}

    spawnSpecialCharacter() {
        if (this.gameState.characters.getLength() >= 8) return;
        if(this.gameState.isGameOver) return;
        const roll = Phaser.Math.RND.between(1, 100);
        let specKey = null;
        if (roll < 60) { specKey = 'ghost'; } 
        else if (roll < 85) { specKey = 'witch'; } 
        else if (!this.gameState.batSpawnLocked) { specKey = 'bat'; }
        else { return; } 
        
        let x, y, newChar;
        let startSide = Phaser.Math.RND.pick([-1, 1]); 
        const spec = this.CHARACTER_SPECS[specKey];

        if (specKey === 'ghost') {
            const availableGraves = this.GRAVE_POSITIONS.filter(g => !g.isOccupied);
            if (availableGraves.length === 0) return; 
            const grave = Phaser.Math.RND.pick(availableGraves);
            grave.isOccupied = true; 
            newChar = this.gameState.characters.create(grave.x, grave.y, spec.key);
            newChar.graveIndex = this.GRAVE_POSITIONS.indexOf(grave); 
            newChar.roundPixels = true;
        } else if (specKey === 'witch') {
            x = (startSide === 1) ? -10 : 730; 
            y = 10; 
            newChar = this.gameState.characters.create(x, y, spec.key);
            newChar.setOrigin(0.5, 0); 
            newChar.body.setSize(50, 80); // width, height in pixels
            newChar.body.setOffset(15, 10); // x-offset, y-offset in pixels
            newChar.setVelocityX(startSide * spec.speed);
            if (startSide === -1) { newChar.setFlipX(true); }
            this.sound.play('cackle', { volume: 1.0 });
        } else if (specKey === 'bat') {
            const batExists = this.gameState.characters.children.getArray().some(char => char.type === 'bat');
            if (batExists) return;

            const finalX = Phaser.Math.RND.between(100, 620);
            const finalY = Phaser.Math.RND.between(50, 100);
            const newBat = this.gameState.characters.create(finalX, -30, spec.key);
            if (!newBat) return;

            newBat.setScale(spec.scale).setOrigin(0.5, 0.5);
            newBat.refreshBody();
            newBat.body.setCircle(25, 45, 5); // radius, x-offset, y-offset
            newBat.body.setImmovable(false).setAllowGravity(false);
            newBat.type = spec.key;
            newBat.points = spec.points;
            newBat.setDepth(15);
            
            this.sound.play('bat', { volume: 1.0 });
            this.tweens.add({
                targets: newBat,
                y: finalY,
                duration: 300,
                ease: 'Power2'
            });
            return;
        }
        if (!newChar) return; 

        newChar.setScale(spec.scale);
        if (spec.key !== 'witch') { newChar.setOrigin(0.5, 1); } 

        newChar.refreshBody();

        if (spec.key === 'ghost') {
            const radius = newChar.body.width * 0.5;
            newChar.body.setCircle(40, 25, 15); // radius, x-offset, y-offset
        }

        newChar.setDepth(spec.key === 'ghost' ? 1 : 10);
        newChar.body.setImmovable(false).setAllowGravity(false); 
        newChar.type = spec.key;
        newChar.points = spec.points;
    }
    
    startAim() {
        if (this.gameState.ammo > 0 && !this.gameState.isGameOver) { 
            this.gameState.isAiming = true;
            this.gameState.power = 0;
            this.gameState.powerDirection = 1; 
        }
    }
    
    throwBalloon() {
        if (this.gameState.isAiming && this.gameState.ammo > 0 && !this.gameState.isGameOver && this.gameState.canFire) {
            if (this.gameState.power < 5) { this.gameState.isAiming = false; this.gameState.power = 0; return; }
            
            this.gameState.isAiming = false;
            this.gameState.ammo--;
            this.gameState.canFire = false;
            this.time.delayedCall(10, () => { this.gameState.canFire = true; }, [], this);

            const maxThrowSpeed = 1000; 
            const effectivePower = Math.max(20, this.gameState.power);
            const velocityScale = effectivePower / 100; 
            const velocityY = -(maxThrowSpeed * velocityScale); 
            let newBalloon = this.gameState.projectiles.create(this.gameState.hand.x, this.gameState.hand.y, 'balloon_asset');
            newBalloon.canDamage = true;
            newBalloon.throwPower = effectivePower;
            newBalloon.setDepth(15);
            newBalloon.setScale(0.5).body.setCircle(15).setAllowGravity(true).setCollideWorldBounds(true);
            newBalloon.body.onWorldBounds = true;
            newBalloon.setVelocity(0, velocityY);
            this.gameState.power = 0; 
            this.gameState.powerDash.setVisible(false);
        }
    }
    
    hitCharacter(balloon, character) {
        if (!balloon.canDamage || !balloon.active || !character.body.enable) return;
        
        // Check power requirements for certain monsters
        const power = balloon.throwPower;
        if (character.type === 'zombie' && (power < 15 || power > 60)) return;
        if (character.type === 'ghost' && (power < 30 || power > 70)) return;
        if (character.type === 'ghost' && character.state !== 'pausing') return; 

        // Disable balloon immediately to prevent multiple hits
        balloon.canDamage = false;
        balloon.body.enable = false;
        balloon.setVelocity(0, 0);

        // Play balloon "pop" effect
        this.tweens.add({
            targets: balloon,
            scale: 1.5,
            alpha: 0,
            duration: 200,
            ease: 'Power2',
            onComplete: () => { balloon.destroy(); }
        });
        
        // Play the character's death sound
        const soundKey = `${character.type}_die`;
        const variedDeathSounds = ['zombie', 'witch', 'ghost'];
        if (variedDeathSounds.includes(character.type)) {
            this.sound.play(soundKey, { volume: 0.8, detune: Phaser.Math.Between(-400, 400) });
        } else {
            this.sound.play(soundKey, { volume: 0.8 });
        }
        
        character.setTint(0xFF0000);
        this.time.delayedCall(100, () => { if (character.active) { character.clearTint() } }, [], this);
        
        character.body.enable = false; 

        const spec = this.CHARACTER_SPECS[character.type];
        if (character.type === 'bat') { this.gameState.ammo += spec.reward; } 
        else { this.gameState.score += spec.points; }
        
        // Handle death animations and cleanup
        if (character.type === 'ghost') {
            this.GRAVE_POSITIONS[character.graveIndex].isOccupied = false;
            this.tweens.add({ targets: character, alpha: 0, scale: 0, duration: 250, ease: 'Power2', onComplete: () => { character.destroy(); } });
        } else if (character.type === 'zombie') {
            character.body.setVelocity(0,0);
            this.tweens.add({ targets: character, alpha: 0, duration: 300, onComplete: () => { character.destroy(); } });
        } else if (character.type === 'witch') {
            character.setVelocity(0,0);
            character.setFlipY(true);
            this.tweens.add({
                targets: character, y: character.y + 100, duration: 400, ease: 'Cubic.easeIn',
                onComplete: () => {
                    this.tweens.add({ targets: character, alpha: 0, duration: 150, onComplete: () => { character.destroy(); } });
                }
            });
        } else { // Bat
            this.tweens.add({
                targets: character, alpha: 0, scale: 0, duration: 150, ease: 'Power2',
                onComplete: () => {
                    const rewardPopup = this.add.image(character.x, character.y, 'reward').setScale(0.5).setAlpha(0).setDepth(100);
                    this.tweens.timeline({
                        targets: rewardPopup,
                        tweens: [
                            { alpha: 1, y: '-=20', duration: 200, ease: 'Power2' },
                            { alpha: 1, duration: 1000 },
                            { alpha: 0, duration: 1000, ease: 'Power2.In' }
                        ],
                        onComplete: () => { rewardPopup.destroy(); }
                    });
                    character.destroy();
                }
            });
        }
    }
}

// --- Game Configuration ---
const config = {
    type: Phaser.AUTO, 
    render: { antialias: true, antialiasGL: true, pixelArt: true, canvas: { willReadFrequently: true } },
    width: 720, height: 300,
    scene: [TitleScene, GameScene], 
    parent: 'game-outer-wrapper',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 600 }, debug: false } // Set to false for production
    },
};

const game = new Phaser.Game(config);

