export class UIScene extends Phaser.Scene {

    constructor() {
        super('UIScene');
    }

    create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor(0x00000000);

        this.objects = [];

        // ---------------------------------------------------------------------
        // Top bar: timer + progress
        // ---------------------------------------------------------------------
        const topBarHeight = 72;

        const topBarBg = this.add
            .rectangle(width / 2, topBarHeight / 2 + 8, width * 0.9, topBarHeight, 0xffffff, 0.9)
            .setStrokeStyle(2, 0xddddff)
            .setScrollFactor(0);

        // Timer "chip" on the left (simple rectangle to keep bundle small)
        const timerBg = this.add
            .rectangle(topBarBg.x - topBarBg.width / 2 + 70, topBarBg.y, 120, 40, 0x111827, 1)
            .setScrollFactor(0);

        this.timerText = this.add
            .text(timerBg.x, timerBg.y, '01:00', {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: '#00ff9c'
            })
            .setOrigin(0.5)
            .setScrollFactor(0);

        // Progress bar (center)
        const progressWidth = topBarBg.width * 0.45;
        const progressX = topBarBg.x + 30;

        this.progressBg = this.add
            .rectangle(progressX, topBarBg.y, progressWidth, 14, 0x111827, 0.35)
            .setOrigin(0, 0.5)
            .setScrollFactor(0);

        this.progressFill = this.add
            .rectangle(progressX, topBarBg.y, 0, 10, 0x22c55e, 1)
            .setOrigin(0, 0.5)
            .setScrollFactor(0);

        // ---------------------------------------------------------------------
        // Bottom bar: instructions + gallery + hint
        // ---------------------------------------------------------------------
        const bottomBarHeight = 160;
        const bottomBarY = height - bottomBarHeight / 2 - 12;

        const bottomBg = this.add
            .rectangle(width / 2, bottomBarY, width * 0.96, bottomBarHeight, 0xffffff, 0.95)
            .setStrokeStyle(2, 0xddddff)
            .setScrollFactor(0);

        this.instructionsText = this.add
            .text(bottomBg.x - bottomBg.width / 2 + 20, bottomBg.y - bottomBarHeight / 2 + 20, 'FIND THE OBJECTS:', {
                fontFamily: 'Arial',
                fontSize: '16px',
                color: '#4b5563'
            })
            .setOrigin(0, 0)
            .setScrollFactor(0);

        // Object gallery container
        this.gallerySprites = [];

        // Hint button
        const hintWidth = bottomBg.width * 0.7;
        const hintHeight = 52;

        const hintButtonRect = this.add
            .rectangle(bottomBg.x, bottomBg.y + bottomBarHeight / 2 - hintHeight / 2 - 16, hintWidth, hintHeight, 0x10b981, 1)
            .setInteractive({ useHandCursor: true })
            .setScrollFactor(0);

        const hintText = this.add
            .text(hintButtonRect.x, hintButtonRect.y, 'Hint', {
                fontFamily: 'Arial',
                fontSize: '20px',
                color: '#ffffff'
            })
            .setOrigin(0.5)
            .setScrollFactor(0);

        hintButtonRect.on('pointerdown', () => {
            this.game.events.emit('hintRequested');
            this.tweens.add({
                targets: [hintButtonRect],
                scale: 0.96,
                duration: 80,
                yoyo: true
            });
        });

        // ---------------------------------------------------------------------
        // Game event listeners
        // ---------------------------------------------------------------------
        this.game.events.on('objectsCreated', this.onObjectsCreated, this);
        this.game.events.on('objectFound', this.onObjectFound, this);
        this.game.events.on('timerUpdated', this.onTimerUpdated, this);
        this.game.events.on('timeUp', this.onTimeUp, this);
        this.game.events.on('allObjectsFound', this.onAllObjectsFound, this);
    }

    // -------------------------------------------------------------------------
    // Event handlers
    // -------------------------------------------------------------------------

    onObjectsCreated(payload) {
        const { objects } = payload;
        const { width } = this.cameras.main;

        const startX = width * 0.14;
        const gap = 70;
        const y = this.instructionsText.y + 56;

        this.gallerySprites.forEach((s) => s.destroy());
        this.gallerySprites.length = 0;

        objects.forEach((obj, index) => {
            const sprite = this.add
                .image(startX + index * gap, y, obj.key)
                .setDisplaySize(56, 56)
                .setScrollFactor(0);

            sprite.setData('id', obj.id);
            this.gallerySprites.push(sprite);
        });
    }

    onObjectFound({ id, found, total, score }) {
        const progress = total > 0 ? found / total : 0;
        this.updateProgress(progress);

        const gallerySprite = this.gallerySprites.find(
            (s) => s.getData('id') === id
        );

        if (gallerySprite) {
            this.tweens.add({
                targets: gallerySprite,
                alpha: 0.3,
                duration: 200
            });
        }

        this.instructionsText.setText(`FIND THE OBJECTS · SCORE: ${score}`);
    }

    onTimerUpdated({ remaining, progress }) {
        const seconds = Math.ceil(remaining);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;

        this.timerText.setText(
            `${mins.toString().padStart(2, '0')}:${secs
                .toString()
                .padStart(2, '0')}`
        );
    }

    onTimeUp({ score, found, total }) {
        this.instructionsText.setText(
            `TIME UP · SCORE: ${score} · FOUND ${found}/${total}`
        );
    }

    onAllObjectsFound({ score, timeRemaining }) {
        this.instructionsText.setText(
            `ALL OBJECTS FOUND! SCORE: ${score} · ${timeRemaining.toFixed(
                1
            )}s LEFT`
        );
    }

    updateProgress(value) {
        const clamped = Phaser.Math.Clamp(value, 0, 1);
        const maxWidth = this.progressBg.width * 0.96;

        this.progressFill.width = maxWidth * clamped;
    }

    shutdown() {
        this.game.events.off('objectsCreated', this.onObjectsCreated, this);
        this.game.events.off('objectFound', this.onObjectFound, this);
        this.game.events.off('timerUpdated', this.onTimerUpdated, this);
        this.game.events.off('timeUp', this.onTimeUp, this);
        this.game.events.off('allObjectsFound', this.onAllObjectsFound, this);
    }
}

