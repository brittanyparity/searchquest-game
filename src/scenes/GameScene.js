export class GameScene extends Phaser.Scene {

    constructor() {
        super('GameScene');
    }

    create() {
        const camera = this.cameras.main;

        // --- World & background ------------------------------------------------
        const bg = this.add.image(0, 0, 'background').setOrigin(0, 0);

        // Scale background to feel "large" relative to viewport while keeping aspect
        const worldScale = 1.5;
        bg.setScale(worldScale);

        this.worldWidth = bg.displayWidth;
        this.worldHeight = bg.displayHeight;

        camera.setBounds(0, 0, this.worldWidth, this.worldHeight);

        // --- Camera config -----------------------------------------------------
        this.minZoom = 0.5;
        this.maxZoom = 2.0;
        camera.zoom = 1;

        // Enable a couple of extra pointers so pinch works well on mobile
        this.input.addPointer(2);

        this.isDragging = false;
        this.dragStartPoint = new Phaser.Math.Vector2();
        this.cameraStartPoint = new Phaser.Math.Vector2();
        this.lastPinchDistance = 0;

        // --- Hidden objects ----------------------------------------------------
        // These are sample objects using existing art. Swap positions / textures to
        // line up with your own large background illustration.
        const objectsConfig = [
            { id: 0, key: 'phaserLogo', name: 'Logo', x: this.worldWidth * 0.25, y: this.worldHeight * 0.35 },
            { id: 1, key: 'ship', name: 'Ship', x: this.worldWidth * 0.7, y: this.worldHeight * 0.4, frame: 1 },
            { id: 2, key: 'ship', name: 'Rocket', x: this.worldWidth * 0.5, y: this.worldHeight * 0.75, frame: 2 }
        ];

        this.hiddenObjects = objectsConfig.map((cfg) => {
            const sprite = this.add
                .sprite(cfg.x, cfg.y, cfg.key, cfg.frame || 0)
                .setInteractive({ useHandCursor: true });

            sprite.setData('id', cfg.id);
            sprite.setData('found', false);

            sprite.on('pointerdown', () => {
                this.handleObjectFound(sprite, cfg);
            });

            return { ...cfg, sprite };
        });

        this.totalObjects = this.hiddenObjects.length;
        this.foundObjects = 0;
        this.score = 0;

        // --- Timer -------------------------------------------------------------
        this.totalTime = 60; // seconds
        this.elapsed = 0;
        this.gameOver = false;

        // --- Input: drag panning ----------------------------------------------
        this.input.on('pointerdown', (pointer) => {
            const activePointers = this.getActivePointers();

            if (activePointers.length === 1) {
                // Single-touch drag to pan
                this.isDragging = true;
                this.dragStartPoint.set(pointer.x, pointer.y);
                this.cameraStartPoint.set(camera.scrollX, camera.scrollY);
            }
        });

        this.input.on('pointerup', () => {
            this.isDragging = false;
            this.lastPinchDistance = 0;
        });

        this.input.on('pointermove', (pointer) => {
            const activePointers = this.getActivePointers();

            if (activePointers.length === 2) {
                this.handlePinchZoom(activePointers[0], activePointers[1]);
            } else if (this.isDragging && pointer.isDown && activePointers.length === 1) {
                this.handleDrag(pointer);
            }
        });

        // --- Input: scroll wheel zoom (desktop) -------------------------------
        this.input.on('wheel', (pointer, objs, dx, dy, dz) => {
            const zoomDir = dy > 0 ? -1 : 1;
            const zoomFactor = 1 + zoomDir * 0.1;

            camera.zoom = Phaser.Math.Clamp(
                camera.zoom * zoomFactor,
                this.minZoom,
                this.maxZoom
            );

            this.clampCameraToBounds();
        });

        // --- Hint system -------------------------------------------------------
        this.game.events.on('hintRequested', this.handleHintRequested, this);

        // Notify UI about initial object set
        this.game.events.emit('objectsCreated', {
            total: this.totalObjects,
            objects: this.hiddenObjects.map((o) => ({
                id: o.id,
                key: o.key,
                name: o.name
            }))
        });
    }

    update(time, delta) {
        if (this.gameOver) {
            return;
        }

        this.elapsed += delta / 1000;
        const remaining = Math.max(this.totalTime - this.elapsed, 0);
        const timeProgress = remaining / this.totalTime;

        this.game.events.emit('timerUpdated', {
            remaining,
            progress: timeProgress
        });

        if (remaining <= 0) {
            this.gameOver = true;
            this.game.events.emit('timeUp', {
                score: this.score,
                found: this.foundObjects,
                total: this.totalObjects
            });
        }
    }

    // -------------------------------------------------------------------------
    // Hidden object interactions
    // -------------------------------------------------------------------------

    handleObjectFound(sprite, cfg) {
        if (sprite.getData('found') || this.gameOver) {
            return;
        }

        sprite.setData('found', true);
        this.foundObjects += 1;
        this.score += 100;

        // Subtle feedback
        this.tweens.add({
            targets: sprite,
            scale: sprite.scale * 1.2,
            alpha: 0.5,
            duration: 200,
            yoyo: true
        });

        this.game.events.emit('objectFound', {
            id: cfg.id,
            name: cfg.name,
            score: this.score,
            found: this.foundObjects,
            total: this.totalObjects
        });

        if (this.foundObjects >= this.totalObjects) {
            this.gameOver = true;
            this.game.events.emit('allObjectsFound', {
                score: this.score,
                timeRemaining: Math.max(this.totalTime - this.elapsed, 0)
            });
        }
    }

    // -------------------------------------------------------------------------
    // Camera helpers
    // -------------------------------------------------------------------------

    getActivePointers() {
        return this.input.pointers.filter((p) => p && p.isDown);
    }

    handleDrag(pointer) {
        const camera = this.cameras.main;

        const dx = pointer.x - this.dragStartPoint.x;
        const dy = pointer.y - this.dragStartPoint.y;

        camera.scrollX = this.cameraStartPoint.x - dx / camera.zoom;
        camera.scrollY = this.cameraStartPoint.y - dy / camera.zoom;

        this.clampCameraToBounds();
    }

    handlePinchZoom(p1, p2) {
        const camera = this.cameras.main;

        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);

        if (!this.lastPinchDistance) {
            this.lastPinchDistance = dist;
            return;
        }

        const delta = dist - this.lastPinchDistance;
        const zoomFactor = 1 + delta * 0.002;

        camera.zoom = Phaser.Math.Clamp(
            camera.zoom * zoomFactor,
            this.minZoom,
            this.maxZoom
        );

        this.lastPinchDistance = dist;

        this.clampCameraToBounds();
    }

    clampCameraToBounds() {
        const camera = this.cameras.main;

        const maxScrollX = Math.max(
            0,
            this.worldWidth - camera.width / camera.zoom
        );
        const maxScrollY = Math.max(
            0,
            this.worldHeight - camera.height / camera.zoom
        );

        camera.scrollX = Phaser.Math.Clamp(camera.scrollX, 0, maxScrollX);
        camera.scrollY = Phaser.Math.Clamp(camera.scrollY, 0, maxScrollY);
    }

    // -------------------------------------------------------------------------
    // Hint
    // -------------------------------------------------------------------------

    handleHintRequested() {
        if (this.gameOver) {
            return;
        }

        const next = this.hiddenObjects.find(
            (o) => !o.sprite.getData('found')
        );

        if (!next) {
            return;
        }

        const camera = this.cameras.main;

        this.tweens.add({
            targets: camera,
            scrollX: next.sprite.x - camera.width / (2 * camera.zoom),
            scrollY: next.sprite.y - camera.height / (2 * camera.zoom),
            duration: 400,
            onUpdate: () => this.clampCameraToBounds()
        });

        // Small pulse on the hinted object
        this.tweens.add({
            targets: next.sprite,
            scale: next.sprite.scale * 1.3,
            duration: 200,
            yoyo: true,
            repeat: 1
        });
    }

    shutdown() {
        this.game.events.off('hintRequested', this.handleHintRequested, this);
    }
}

