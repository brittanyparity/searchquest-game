export class GameScene extends Phaser.Scene {

    constructor() {
        super('GameScene');
        this.fullFitZoom = 1;
    }

    create() {
        const camera = this.cameras.main;
        this.setupLayout();

        // Listen for resize events
        this.scale.on('resize', this.handleResize, this);

        // --- World & background ------------------------------------------------
        // Origin (0.5, 0.5) = center in normalized 0–1 space — not pixel coordinates.
        // Place the sprite so the image still fills world [0, worldW] × [0, worldH].
        const bg = this.add.image(0, 0, 'background').setOrigin(0.5, 0.5);
        const worldScale = 1;
        bg.setScale(worldScale);
        bg.setPosition(bg.displayWidth * 0.5, bg.displayHeight * 0.5);

        this.worldWidth = bg.displayWidth;
        this.worldHeight = bg.displayHeight;

        camera.setBounds(0, 0, this.worldWidth, this.worldHeight);

        // Recalculate layout now that we know world dimensions
        this.setupLayout();
        // fullFitZoom / minZoom / maxZoom set by updateZoom() inside setupLayout

        // Start centered on the image at ~300% of full-fit zoom (always stay zoomed in vs full scene)
        const startZoom = this.fullFitZoom * 3;
        camera.zoom = Phaser.Math.Clamp(startZoom, this.minZoom, this.maxZoom);
        this.centerImage();

        this.time.delayedCall(50, () => {
            this.centerImage();
        });

        this._lastQuadrant = null;

        // Enable a couple of extra pointers so pinch works well on mobile
        this.input.addPointer(2);

        this.isDragging = false;
        this.dragStartPoint = new Phaser.Math.Vector2();
        this.cameraStartPoint = new Phaser.Math.Vector2();
        this.lastPinchDistance = 0;
        this._recentPinch = false;

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

        this.maxLives = 3;
        this.remainingLives = this.maxLives;
        this._downOnUnfoundHidden = false;

        // --- Timer -------------------------------------------------------------
        this.totalTime = 60; // seconds
        this.elapsed = 0;
        this.gameOver = false;

        // --- Input: drag panning ----------------------------------------------
        this.input.on('pointerdown', (pointer) => {
            this._downOnUnfoundHidden = false;
            if (!this.gameOver) {
                const hits = this.input.hitTestPointer(pointer) || [];
                const onUnfound = this.hiddenObjects.some(
                    (ho) => !ho.sprite.getData('found') && hits.includes(ho.sprite)
                );
                if (onUnfound) {
                    this._downOnUnfoundHidden = true;
                }
            }

            const activePointers = this.getActivePointers();

            if (activePointers.length === 1) {
                // Single-touch drag to pan
                this.isDragging = true;
                this.dragStartPoint.set(pointer.x, pointer.y);
                this.cameraStartPoint.set(camera.scrollX, camera.scrollY);
            }
        });

        this.input.on('pointerup', (pointer) => {
            this.handleLastPointerReleased(pointer);
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
            const camera = this.cameras.main;

            const worldBefore = camera.getWorldPoint(pointer.x, pointer.y);
            
            // More responsive zoom factor (smaller increments)
            const zoomDir = dy > 0 ? -1 : 1;
            const zoomFactor = 1 + zoomDir * 0.05; // Reduced from 0.1 to 0.05 for finer control

            camera.zoom = Phaser.Math.Clamp(
                camera.zoom * zoomFactor,
                this.minZoom,
                this.maxZoom
            );

            const worldAfter = camera.getWorldPoint(pointer.x, pointer.y);
            camera.scrollX += worldBefore.x - worldAfter.x;
            camera.scrollY += worldBefore.y - worldAfter.y;

            this.clampCameraToBounds();
        });

        // --- Hint system -------------------------------------------------------
        this.game.events.on('hintRequested', this.handleHintRequested, this);
        
        // Listen for requests to re-emit objects (in case UIScene missed the initial event)
        this.game.events.on('requestObjects', () => {
            console.log('🎮 GameScene received requestObjects, re-emitting objectsCreated...');
            const objectsData = {
                total: this.totalObjects,
                objects: this.hiddenObjects.map((o) => ({
                    id: o.id,
                    key: o.key,
                    name: o.name
                }))
            };
            this.game.events.emit('objectsCreated', objectsData);
            this.game.events.emit('attemptsUpdated', {
                remaining: this.remainingLives,
                max: this.maxLives
            });
        });

        // Notify UI about initial object set
        // Add a small delay to ensure UIScene listeners are set up
        this.time.delayedCall(100, () => {
            const objectsData = {
                total: this.totalObjects,
                objects: this.hiddenObjects.map((o) => ({
                    id: o.id,
                    key: o.key,
                    name: o.name
                }))
            };
            console.log('🎮 GameScene emitting objectsCreated event:', objectsData);
            console.log('🎮 Event listeners count:', this.game.events.listeners('objectsCreated')?.length || 0);
            this.game.events.emit('objectsCreated', objectsData);
            this.game.events.emit('attemptsUpdated', {
                remaining: this.remainingLives,
                max: this.maxLives
            });
        });
    }

    update(time, delta) {
        if (!this.gameOver) {
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

        if (this.worldWidth && this.worldHeight) {
            const q = this.getViewportQuadrantKey();
            if (q !== this._lastQuadrant) {
                this._lastQuadrant = q;
                this.game.events.emit('viewportQuadrantChanged', { quadrant: q });
            }
        }
    }

    getViewportQuadrantKey() {
        const camera = this.cameras.main;
        const mid = camera.getWorldPoint(camera.width * 0.5, camera.height * 0.5);
        const cx = mid.x;
        const cy = mid.y;
        const midX = this.worldWidth * 0.5;
        const midY = this.worldHeight * 0.5;
        const left = cx < midX;
        const top = cy < midY;
        if (top && left) {
            return 'tl';
        }
        if (top && !left) {
            return 'tr';
        }
        if (!top && left) {
            return 'bl';
        }
        return 'br';
    }

    // -------------------------------------------------------------------------
    // Hidden object interactions
    // -------------------------------------------------------------------------

    handleLastPointerReleased(pointer) {
        if (this.getActivePointers().length > 0) {
            return;
        }
        if (this._recentPinch) {
            this._recentPinch = false;
            return;
        }
        this.handlePossibleWrongTap(pointer);
    }

    handlePossibleWrongTap(pointer) {
        const wasUnfoundDown = this._downOnUnfoundHidden;
        this._downOnUnfoundHidden = false;

        if (this.gameOver) {
            return;
        }
        if (wasUnfoundDown) {
            return;
        }

        const maxDist = 18;
        const maxDuration = 500;
        const dist = Phaser.Math.Distance.Between(pointer.downX, pointer.downY, pointer.x, pointer.y);
        if (dist > maxDist) {
            return;
        }
        if (pointer.getDuration() > maxDuration) {
            return;
        }

        this.loseLife();
    }

    loseLife() {
        if (this.gameOver || this.remainingLives <= 0) {
            return;
        }

        this.remainingLives -= 1;
        this.game.events.emit('attemptsUpdated', {
            remaining: this.remainingLives,
            max: this.maxLives
        });
        this.game.events.emit('lifeLost', { remaining: this.remainingLives });

        const cam = this.cameras.main;
        if (cam && cam.shake) {
            cam.shake(220, 0.035);
        }

        if (this.remainingLives <= 0) {
            this.gameOver = true;
            this.game.events.emit('outOfLives', {
                score: this.score,
                found: this.foundObjects,
                total: this.totalObjects
            });
        }
    }

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
        const manager = this.input && this.input.manager;
        const src = manager && manager.pointers ? manager.pointers : [];

        return src.filter((p) => p && p.isDown);
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

        // Calculate the center point between the two pinch points
        const pinchCenterX = (p1.x + p2.x) / 2;
        const pinchCenterY = (p1.y + p2.y) / 2;
        
        const worldBefore = camera.getWorldPoint(pinchCenterX, pinchCenterY);

        const delta = dist - this.lastPinchDistance;
        if (Math.abs(delta) > 1.5) {
            this._recentPinch = true;
        }
        // More responsive zoom factor
        const zoomFactor = 1 + delta * 0.001; // Reduced from 0.002

        camera.zoom = Phaser.Math.Clamp(
            camera.zoom * zoomFactor,
            this.minZoom,
            this.maxZoom
        );

        const worldAfter = camera.getWorldPoint(pinchCenterX, pinchCenterY);
        camera.scrollX += worldBefore.x - worldAfter.x;
        camera.scrollY += worldBefore.y - worldAfter.y;

        this.lastPinchDistance = dist;

        this.clampCameraToBounds();
    }

    clampCameraToBounds() {
        const cam = this.cameras.main;
        if (cam.useBounds && typeof cam.clampX === 'function') {
            cam.scrollX = cam.clampX(cam.scrollX);
            cam.scrollY = cam.clampY(cam.scrollY);
        }
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
        camera.pan(next.sprite.x, next.sprite.y, 400, 'Power2', false, () => {
            this.clampCameraToBounds();
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

    setupLayout(customWidth = null, customHeight = null) {
        const camera = this.cameras.main;

        const fullWidth = customWidth !== null ? customWidth : camera.width;
        const fullHeight = customHeight !== null ? customHeight : camera.height;

        this.topBarHeight = 0;
        this.playAreaHeight = fullHeight;

        camera.setViewport(0, 0, fullWidth, fullHeight);

        if (this.worldWidth && this.worldHeight) {
            camera.setBounds(0, 0, this.worldWidth, this.worldHeight);
        }

        this.updateContainerHeights();

        this.game.events.emit('layoutChanged', {
            topBarHeight: 0,
            galleryHeight: 120,
            playAreaHeight: this.playAreaHeight
        });

        if (this.worldWidth && this.worldHeight) {
            this.updateZoom();
        }
    }

    updateContainerHeights() {
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.maxHeight = '';
            gameContainer.style.height = '';
        }
    }

    handleResize(gameSize) {
        const camera = this.cameras.main;

        const newWidth = gameSize ? gameSize.width : camera.width;
        const newHeight = gameSize ? gameSize.height : camera.height;

        let nx = 0.5;
        let ny = 0.5;
        const zoomMultiple =
            this.fullFitZoom && this.fullFitZoom > 0 ? camera.zoom / this.fullFitZoom : 3;

        if (this.worldWidth && this.worldHeight) {
            const mid = camera.getWorldPoint(camera.width * 0.5, camera.height * 0.5);
            nx = Phaser.Math.Clamp(mid.x / this.worldWidth, 0, 1);
            ny = Phaser.Math.Clamp(mid.y / this.worldHeight, 0, 1);
        }

        this.setupLayout(newWidth, newHeight);

        if (this.worldWidth && this.worldHeight) {
            camera.zoom = Phaser.Math.Clamp(
                zoomMultiple * this.fullFitZoom,
                this.minZoom,
                this.maxZoom
            );
            const nxc = nx * this.worldWidth;
            const nyc = ny * this.worldHeight;
            camera.scrollX = nxc - camera.width / (2 * camera.zoom);
            camera.scrollY = nyc - camera.height / (2 * camera.zoom);
            this.clampCameraToBounds();
        }
    }

    updateZoom() {
        const camera = this.cameras.main;

        if (!this.worldWidth || !this.worldHeight) {
            return;
        }

        const fitZoomX = camera.width / this.worldWidth;
        const fitZoomY = camera.height / this.worldHeight;
        // Zoom that fits the entire search image in the view (reference only)
        this.fullFitZoom = Math.min(fitZoomX, fitZoomY);
        // Never zoom out past "full image" fit; stay at least 150% of that reference zoom (more zoomed in)
        this.minZoom = this.fullFitZoom * 1.5;
        this.maxZoom = this.fullFitZoom * 24;

        camera.zoom = Phaser.Math.Clamp(camera.zoom, this.minZoom, this.maxZoom);
    }
    
    centerImage() {
        const camera = this.cameras.main;
        
        // Verify camera dimensions are valid
        if (camera.width === 0 || camera.height === 0 || !this.worldWidth || !this.worldHeight) {
            console.warn('Camera or world dimensions not set, retrying centering...');
            this.time.delayedCall(50, () => this.centerImage());
            return;
        }
        
        // Calculate the world center (image center)
        const worldCenterX = this.worldWidth / 2;
        const worldCenterY = this.worldHeight / 2;
        
        // Use Phaser's centerOn method which handles the calculation properly
        camera.centerOn(worldCenterX, worldCenterY);
        
        this.clampCameraToBounds();
    }

    centerImageOnMinZoom() {
        const camera = this.cameras.main;
        camera.zoom = this.minZoom;
        this.centerImage();
    }

    shutdown() {
        this.game.events.off('hintRequested', this.handleHintRequested, this);
        this.scale.off('resize', this.handleResize, this);
    }
}

