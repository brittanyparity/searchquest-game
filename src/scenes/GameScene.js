export class GameScene extends Phaser.Scene {

    constructor() {
        super('GameScene');
    }

    create() {
        const camera = this.cameras.main;
        this.setupLayout();

        // Listen for resize events
        this.scale.on('resize', this.handleResize, this);

        // --- World & background ------------------------------------------------
        const bg = this.add.image(0, 0, 'background').setOrigin(0, 0);

        // Keep scale at 1 so zoom math is easy to reason about.
        const worldScale = 1;
        bg.setScale(worldScale);

        this.worldWidth = bg.displayWidth;
        this.worldHeight = bg.displayHeight;

        camera.setBounds(0, 0, this.worldWidth, this.worldHeight);

        // Set container to match image dimensions
        this.updateContainerSize();

        // Recalculate layout now that we know world dimensions
        // This ensures bottom bar adjusts to show full image height
        this.setupLayout();
        // setupLayout() already calls updateZoom(), so minZoom is set
        
        // --- Camera config -----------------------------------------------------
        // Set initial zoom to minimum (fully zoomed out) and center the image
        // Do this AFTER setupLayout so camera dimensions are correct
        camera.zoom = this.minZoom;
        
        // Center immediately and then again after delays to ensure it sticks
        this.centerImageOnMinZoom();
        
        // Use delays to ensure camera dimensions are fully set
        // Call multiple times to ensure it centers properly after all setup
        this.time.delayedCall(50, () => {
            this.centerImageOnMinZoom();
        });
        this.time.delayedCall(200, () => {
            this.centerImageOnMinZoom();
        });
        this.time.delayedCall(500, () => {
            this.centerImageOnMinZoom();
        });

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
            const camera = this.cameras.main;
            
            // Get the world position under the mouse pointer before zooming
            const worldX = camera.scrollX + pointer.x / camera.zoom;
            const worldY = camera.scrollY + pointer.y / camera.zoom;
            
            // More responsive zoom factor (smaller increments)
            const zoomDir = dy > 0 ? -1 : 1;
            const zoomFactor = 1 + zoomDir * 0.05; // Reduced from 0.1 to 0.05 for finer control

            const oldZoom = camera.zoom;
            camera.zoom = Phaser.Math.Clamp(
                camera.zoom * zoomFactor,
                this.minZoom,
                this.maxZoom
            );
            
            // If we hit minZoom, center the image
            if (camera.zoom === this.minZoom) {
                this.centerImageOnMinZoom();
            } else {
                // Adjust camera position to keep the world point under the mouse fixed
                const newZoom = camera.zoom;
                camera.scrollX = worldX - pointer.x / newZoom;
                camera.scrollY = worldY - pointer.y / newZoom;
            }

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
        
        // Get the world position at the pinch center before zooming
        const worldX = camera.scrollX + pinchCenterX / camera.zoom;
        const worldY = camera.scrollY + pinchCenterY / camera.zoom;

        const delta = dist - this.lastPinchDistance;
        // More responsive zoom factor
        const zoomFactor = 1 + delta * 0.001; // Reduced from 0.002

        const oldZoom = camera.zoom;
        camera.zoom = Phaser.Math.Clamp(
            camera.zoom * zoomFactor,
            this.minZoom,
            this.maxZoom
        );
        
        // If we hit minZoom, center the image
        if (camera.zoom === this.minZoom) {
            this.centerImageOnMinZoom();
        } else {
            // Adjust camera position to keep the world point under pinch center fixed
            const newZoom = camera.zoom;
            camera.scrollX = worldX - pinchCenterX / newZoom;
            camera.scrollY = worldY - pinchCenterY / newZoom;
        }

        this.lastPinchDistance = dist;

        this.clampCameraToBounds();
    }

    clampCameraToBounds() {
        const camera = this.cameras.main;

        // Calculate the visible world size at current zoom
        const visibleWidth = camera.width / camera.zoom;
        const visibleHeight = camera.height / camera.zoom;

        // Calculate max scroll positions
        // If world is smaller than visible area, allow centering (negative values are OK)
        const maxScrollX = this.worldWidth - visibleWidth;
        const maxScrollY = this.worldHeight - visibleHeight;

        // Clamp to bounds, but allow negative values when image is smaller than viewport
        // This allows centering and dragging even when image fits in viewport
        camera.scrollX = Phaser.Math.Clamp(
            camera.scrollX, 
            Math.min(0, maxScrollX), 
            Math.max(0, maxScrollX)
        );
        camera.scrollY = Phaser.Math.Clamp(
            camera.scrollY, 
            Math.min(0, maxScrollY), 
            Math.max(0, maxScrollY)
        );
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

    setupLayout(customWidth = null, customHeight = null) {
        const camera = this.cameras.main;

        // Layout: Now we have two containers (game and bottom bar) with spacing
        // Use custom dimensions if provided (for resize), otherwise use camera dimensions
        const fullWidth = customWidth !== null ? customWidth : camera.width;
        const fullHeight = customHeight !== null ? customHeight : camera.height;
        
        // No top bar anymore
        this.topBarHeight = 0;
        
        // Calculate the exact height needed to show full image at minZoom
        let imageHeightAtMinZoom = 0;
        if (this.worldWidth && this.worldHeight) {
            // minZoom = cameraWidth / worldWidth (to fit width)
            // Image height at minZoom = worldHeight * minZoom
            // But we need to calculate what container height shows full image height
            // If minZoom fits width: minZoom = containerWidth / worldWidth
            // For height: containerHeight / minZoom = worldHeight
            // So: containerHeight = worldHeight * minZoom = worldHeight * (containerWidth / worldWidth)
            const minZoom = fullWidth / this.worldWidth;
            imageHeightAtMinZoom = this.worldHeight * minZoom;
        }
        
        // Set the game container height to match image height when zoomed out
        if (this.worldWidth && this.worldHeight && imageHeightAtMinZoom > 0) {
            this.playAreaHeight = imageHeightAtMinZoom;
            
            // Calculate available space for bottom bar
            // Use 85% of viewport to leave room for browser UI bars
            const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            const usableHeight = viewportHeight * 0.85; // Use 85% of viewport
            const bodyPadding = 8; // 4px top + 4px bottom
            const gap = 6; // Gap between containers
            const availableForBottomBar = usableHeight - bodyPadding - gap - this.playAreaHeight;
            
            // Bottom bar minimum height
            const minBottomBarHeight = Math.max(80, viewportHeight * 0.08);
            
            // Use the larger of minimum or available space
            if (availableForBottomBar >= minBottomBarHeight) {
                this.bottomBarHeight = availableForBottomBar;
            } else {
                this.bottomBarHeight = minBottomBarHeight;
            }
        } else {
            // Fallback if image not loaded yet
            const minBottomBarHeight = Math.max(80, fullHeight * 0.08);
            this.bottomBarHeight = minBottomBarHeight;
            this.playAreaHeight = fullHeight - this.bottomBarHeight;
        }

        // Now the camera viewport uses the full game container (no offset needed)
        // since the bars are in separate containers
        camera.setViewport(0, 0, fullWidth, fullHeight);
        
        // Update camera bounds if world exists
        if (this.worldWidth && this.worldHeight) {
            camera.setBounds(0, 0, this.worldWidth, this.worldHeight);
        }
        
        // Update container size to match image
        this.updateContainerSize();
        
        // Update DOM container heights
        this.updateContainerHeights();
        
        // Emit event so UIScene can update bottom bar height
        this.game.events.emit('layoutChanged', {
            topBarHeight: 0, // No top bar
            bottomBarHeight: this.bottomBarHeight,
            playAreaHeight: this.playAreaHeight
        });

        // Recalculate zoom if world already exists
        if (this.worldWidth && this.worldHeight) {
            this.updateZoom();
        }
    }

    updateContainerSize() {
        // Set the game container to match the image dimensions exactly
        const gameContainer = document.getElementById('game-container');
        
        if (gameContainer && this.worldWidth && this.worldHeight) {
            // Get viewport dimensions to ensure we don't exceed them
            const viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
            const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            const maxWidth = viewportWidth * 0.90; // 90% of viewport
            const maxHeight = viewportHeight * 0.85; // 85% of viewport
            
            // Calculate scale to fit within viewport if needed
            const scaleX = maxWidth / this.worldWidth;
            const scaleY = maxHeight / this.worldHeight;
            const scale = Math.min(1, scaleX, scaleY); // Don't scale up, only down if needed
            
            const containerWidth = this.worldWidth * scale;
            const containerHeight = this.worldHeight * scale;
            
            gameContainer.style.width = `${containerWidth}px`;
            gameContainer.style.height = `${containerHeight}px`;
            gameContainer.style.maxWidth = `${containerWidth}px`;
            gameContainer.style.maxHeight = `${containerHeight}px`;
            
            // Resize the Phaser game to match
            this.scale.resize(containerWidth, containerHeight);
            
            console.log('Container size set to:', { width: containerWidth, height: containerHeight }, 'Image size:', { width: this.worldWidth, height: this.worldHeight });
        }
    }

    updateContainerHeights() {
        // Update the actual DOM container heights (for bottom bar)
        const gameContainer = document.getElementById('game-container');
        const bottomBarContainer = document.getElementById('bottom-bar-container');
        
        // Game container size is now set by updateContainerSize()
        // But we might still need to adjust for bottom bar layout
        if (gameContainer && this.playAreaHeight > 0) {
            // If we're using bottom bar layout, adjust accordingly
            // For now, container size is set by updateContainerSize()
        }
        
        if (bottomBarContainer) {
            bottomBarContainer.style.height = `${this.bottomBarHeight}px`;
        }
    }

    handleResize(gameSize) {
        const camera = this.cameras.main;
        
        // Preserve the current viewport focus (what part of the world is being viewed)
        // Store normalized center position (0-1) in world coordinates
        let worldCenterX = 0.5;
        let worldCenterY = 0.5;
        let currentZoom = camera.zoom;
        const wasAtMinZoom = Math.abs(camera.zoom - this.minZoom) < 0.001;
        
        // Get the new dimensions from the resize event
        // gameSize contains the new game dimensions after resize
        const newWidth = gameSize ? gameSize.width : camera.width;
        const newHeight = gameSize ? gameSize.height : camera.height;
        
        if (this.worldWidth && this.worldHeight) {
            // Calculate what part of the world the camera center is viewing
            // Use the current camera dimensions (before they update)
            const cameraCenterX = camera.scrollX + camera.width / (2 * camera.zoom);
            const cameraCenterY = camera.scrollY + camera.height / (2 * camera.zoom);
            
            worldCenterX = cameraCenterX / this.worldWidth;
            worldCenterY = cameraCenterY / this.worldHeight;
        }
        
        // Setup layout with the new dimensions
        // This ensures the viewport is calculated with the correct new size
        // Update container size if needed
        this.updateContainerSize();
        
        this.setupLayout(newWidth, newHeight);
        
        // Recalculate zoom bounds
        if (this.worldWidth && this.worldHeight) {
            const oldMinZoom = this.minZoom;
            this.updateZoom();
            
            // Restore viewport focus
            if (wasAtMinZoom || Math.abs(camera.zoom - this.minZoom) < 0.001) {
                // If at min zoom, center the image
                camera.zoom = this.minZoom;
                this.centerImageOnMinZoom();
            } else {
                // Maintain proportional zoom level
                const zoomRatio = (currentZoom - oldMinZoom) / (this.maxZoom - oldMinZoom);
                camera.zoom = Phaser.Math.Clamp(
                    this.minZoom + (this.maxZoom - this.minZoom) * zoomRatio,
                    this.minZoom,
                    this.maxZoom
                );
                
                // If we're at minZoom, center the image instead of preserving position
                if (Math.abs(camera.zoom - this.minZoom) < 0.001) {
                    this.centerImageOnMinZoom();
                } else {
                    // Restore the same world position the user was viewing
                    const newWorldCenterX = worldCenterX * this.worldWidth;
                    const newWorldCenterY = worldCenterY * this.worldHeight;
                    
                    camera.scrollX = newWorldCenterX - camera.width / (2 * camera.zoom);
                    camera.scrollY = newWorldCenterY - camera.height / (2 * camera.zoom);
                }
            }
            
            this.clampCameraToBounds();
        }
    }

    updateZoom() {
        const camera = this.cameras.main;
        
        const fitZoomX = camera.width / this.worldWidth;
        const fitZoomY = camera.height / this.worldHeight;
        // Use the smaller zoom to ensure both width and height fit
        // This prevents the bottom of the image from being cut off
        this.minZoom = Math.min(fitZoomX, fitZoomY);
        this.maxZoom = this.minZoom * 8;

        // Clamp current zoom to new bounds
        const wasAtMinZoom = Math.abs(camera.zoom - this.minZoom) < 0.001;
        camera.zoom = Phaser.Math.Clamp(camera.zoom, this.minZoom, this.maxZoom);
        
        // If we were at minZoom and still are, center the image
        if (wasAtMinZoom && Math.abs(camera.zoom - this.minZoom) < 0.001) {
            this.centerImageOnMinZoom();
        }
    }
    
    centerImageOnMinZoom() {
        const camera = this.cameras.main;
        
        // Ensure we're at minZoom
        camera.zoom = this.minZoom;
        
        // Verify camera dimensions are valid
        if (camera.width === 0 || camera.height === 0 || !this.worldWidth || !this.worldHeight) {
            console.warn('Camera or world dimensions not set, retrying centering...');
            this.time.delayedCall(50, () => this.centerImageOnMinZoom());
            return;
        }
        
        // Calculate the visible world size at current zoom
        const visibleWidth = camera.width / camera.zoom;
        const visibleHeight = camera.height / camera.zoom;
        
        // Calculate the world center (image center)
        const worldCenterX = this.worldWidth / 2;
        const worldCenterY = this.worldHeight / 2;
        
        // Calculate scroll positions to center the image
        // When image is smaller than viewport, we need negative scroll values to center it
        const targetScrollX = worldCenterX - visibleWidth / 2;
        const targetScrollY = worldCenterY - visibleHeight / 2;
        
        // Set scroll positions directly
        camera.scrollX = targetScrollX;
        camera.scrollY = targetScrollY;
        
        // Clamp to bounds (allows negative values when image is smaller than viewport)
        this.clampCameraToBounds();
        
        // Log for debugging
        console.log('Centering image:', {
            worldSize: { width: this.worldWidth, height: this.worldHeight },
            cameraSize: { width: camera.width, height: camera.height },
            zoom: camera.zoom,
            visibleSize: { width: visibleWidth, height: visibleHeight },
            scroll: { x: camera.scrollX, y: camera.scrollY },
            worldCenter: { x: worldCenterX, y: worldCenterY },
            targetScroll: { x: targetScrollX, y: targetScrollY }
        });
    }

    shutdown() {
        this.game.events.off('hintRequested', this.handleHintRequested, this);
        this.scale.off('resize', this.handleResize, this);
    }
}

