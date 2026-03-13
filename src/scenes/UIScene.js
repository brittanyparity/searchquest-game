export class UIScene extends Phaser.Scene {

    constructor() {
        super('UIScene');
    }

    create() {
        const { width, height } = this.cameras.main;
        this.objects = [];
        
        // Listen for resize events and layout changes from GameScene
        this.scale.on('resize', this.handleResize, this);
        this.game.events.on('layoutChanged', this.onLayoutChanged, this);
        
        // Store layout info (will be set by GameScene)
        this.topBarHeight = 0; // No top bar
        this.bottomBarHeight = Math.max(100, this.cameras.main.height * 0.12);
        
        // Store objects if they were created before UI was ready
        this.pendingObjects = null;

        // ---------------------------------------------------------------------
        // Game event listeners - SET UP FIRST before building UI
        // This ensures we catch the objectsCreated event even if it's emitted early
        // ---------------------------------------------------------------------
        this.game.events.on('objectsCreated', this.onObjectsCreated, this);
        this.game.events.on('objectFound', this.onObjectFound, this);
        this.game.events.on('timerUpdated', this.onTimerUpdated, this);
        this.game.events.on('timeUp', this.onTimeUp, this);
        this.game.events.on('allObjectsFound', this.onAllObjectsFound, this);
        
        this.buildUI();
        
        // Check if objects were already created (GameScene might have emitted before UIScene was ready)
        // Give it a moment for the event to be processed
        this.time.delayedCall(500, () => {
            // If gallery is empty and we have pending objects, populate it
            const gallery = document.getElementById('object-gallery');
            if (gallery && gallery.children.length === 0 && this.pendingObjects) {
                console.log('✅ Gallery is empty but we have pending objects, populating now...');
                this.populateGalleryItems(this.pendingObjects);
            } else if (gallery && gallery.children.length === 0) {
                console.warn('⚠️ Gallery is empty and no pending objects found!');
                console.warn('⚠️ This means the objectsCreated event was not received.');
                console.warn('⚠️ Attempting to manually request objects from GameScene...');
                // Try to manually trigger - ask GameScene to re-emit
                this.game.events.emit('requestObjects');
            }
        });
    }

    buildUI() {
        // Now we build UI using DOM elements in separate containers
        // No top bar anymore - only bottom bar and hint button
        console.log('🔨 Building UI (bottom bar and hint button)...');
        this.buildBottomBar();
        this.buildHintButton();
        console.log('✅ UI build complete');
    }

    buildBottomBar() {
        console.log('🔨 Building bottom bar...');
        const bottomBarContent = document.getElementById('bottom-bar-content');
        if (!bottomBarContent) {
            console.error('❌ bottom-bar-content element not found!');
            return;
        }
        console.log('✅ Found bottom-bar-content element');

        // Clear existing content
        bottomBarContent.innerHTML = '';

        // Get container dimensions
        const container = document.getElementById('bottom-bar-container');
        const width = container ? container.clientWidth : 393;
        const height = container ? container.clientHeight : 160;
        const baseWidth = 393;
        const scale = width / baseWidth;

        // Instructions text - bold and centered, smaller font and reduced height
        const instructions = document.createElement('div');
        instructions.id = 'instructions-text';
        instructions.textContent = 'FIND THE OBJECTS:';
        instructions.style.cssText = `
            font-family: Arial, sans-serif;
            font-size: ${Math.max(11, Math.round(12 * scale))}px;
            font-weight: bold;
            color: #4b5563;
            text-align: center;
            margin-bottom: ${6 * scale}px;
            line-height: 1.2;
            height: auto;
            min-height: auto;
        `;

        // Gallery container with horizontal scrolling (scrollbar hidden)
        const galleryWrapper = document.createElement('div');
        galleryWrapper.id = 'object-gallery-wrapper';
        // Calculate height to fit gallery items (64px + some padding)
        const galleryItemHeight = Math.max(64, 72 * scale);
        galleryWrapper.style.cssText = `
            width: 100%;
            height: ${galleryItemHeight}px;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            -ms-overflow-style: none;
            flex: 1;
        `;
        
        // Hide scrollbar for webkit browsers
        const style = document.createElement('style');
        style.textContent = `
            #object-gallery-wrapper::-webkit-scrollbar {
                display: none;
            }
        `;
        document.head.appendChild(style);

        const gallery = document.createElement('div');
        gallery.id = 'object-gallery';
        gallery.style.cssText = `
            display: flex;
            gap: ${12 * scale}px;
            align-items: center;
            padding-bottom: 4px;
            height: 100%;
        `;

        galleryWrapper.appendChild(gallery);
        bottomBarContent.appendChild(instructions);
        bottomBarContent.appendChild(galleryWrapper);
        
        console.log('✅ Gallery element created with ID: object-gallery');
        console.log('✅ Gallery element in DOM:', !!document.getElementById('object-gallery'));
        
        // Progress bar fill (will be updated by timer)
        const progressBarFill = document.createElement('div');
        progressBarFill.id = 'progress-bar-fill';
        container.appendChild(progressBarFill);
        
        // Always populate gallery with all 5 items (regardless of pending objects)
        setTimeout(() => {
            const gallery = document.getElementById('object-gallery');
            if (gallery) {
                console.log('✅ Gallery exists, populating with all items...');
                this.populateGalleryItems(this.pendingObjects);
            } else {
                console.error('❌ Gallery still not found after buildBottomBar!');
            }
        }, 100);
    }
    
    populateGalleryItems(objects) {
        const gallery = document.getElementById('object-gallery');
        if (!gallery) {
            console.error('Gallery element not found when trying to populate!');
            return;
        }
        
        // Always show all 5 items in the gallery (Item 1.png through Item 5.png)
        // regardless of how many objects are in the game
        const totalItems = 5;
        console.log(`Populating gallery with all ${totalItems} items`);
        
        // Create a map of object IDs to track which ones are found
        const objectMap = {};
        if (objects && objects.length > 0) {
            objects.forEach(obj => {
                objectMap[obj.id] = obj;
            });
        }
        
        // Clear existing gallery
        gallery.innerHTML = '';

        const container = document.getElementById('bottom-bar-container');
        const width = container ? container.clientWidth : 393;
        const baseWidth = 393;
        const scale = width / baseWidth;
        const galleryItemSize = Math.max(56, 64 * scale);

        // Create gallery items for ALL 5 items
        for (let i = 0; i < totalItems; i++) {
            const itemNumber = i + 1;
            const item = document.createElement('div');
            item.setAttribute('data-object-id', i); // Use index as ID
            item.style.cssText = `
                width: ${galleryItemSize}px;
                height: ${galleryItemSize}px;
                min-width: ${galleryItemSize}px;
                background-color: #e5e7eb;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: opacity 0.2s ease;
                overflow: hidden;
                flex-shrink: 0;
            `;
            
            // Create image element for the thumbnail
            const img = document.createElement('img');
            const imagePath = `assets/Item ${itemNumber}.png`;
            img.src = imagePath;
            img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            `;
            img.alt = `Item ${itemNumber}`;
            
            // Handle image load success
            img.onload = () => {
                console.log(`✓ Successfully loaded: ${imagePath}`);
            };
            
            // Handle image load errors - try alternative paths
            img.onerror = () => {
                console.warn(`✗ Failed to load: ${imagePath}, trying alternative path...`);
                // Try alternative path
                const altPath = `./assets/Item ${itemNumber}.png`;
                img.src = altPath;
                
                img.onerror = () => {
                    console.error(`✗ Failed to load both paths: ${imagePath} and ${altPath}`);
                    // Show placeholder if image fails to load
                    item.style.backgroundColor = '#d1d5db';
                    item.innerHTML = `<span style="color: #6b7280; font-size: ${galleryItemSize * 0.4}px; font-weight: bold;">?</span>`;
                };
            };
            
            item.appendChild(img);
            gallery.appendChild(item);
            console.log(`Added gallery item ${itemNumber}`);
        }
        
        console.log(`✓ Gallery populated with ${totalItems} items. Gallery now has ${gallery.children.length} children.`);
    }
    
    buildHintButton() {
        // Create hint button in the sidebar container (at the top)
        const sidebarContent = document.getElementById('sidebar-content');
        if (!sidebarContent) return;
        
        // Remove existing hint button if it exists
        const existingButton = document.getElementById('hint-button-sidebar');
        if (existingButton) {
            existingButton.remove();
        }
        
        const hintButton = document.createElement('button');
        hintButton.id = 'hint-button-sidebar';
        hintButton.innerHTML = '💡'; // Light bulb emoji (you can replace with an icon later)
        hintButton.style.cssText = `
            width: 48px;
            height: 48px;
            background-color: #10b981;
            color: #ffffff;
            border: none;
            border-radius: 50%;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            transition: transform 0.1s ease, box-shadow 0.1s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            align-self: flex-start;
        `;

        hintButton.addEventListener('mousedown', () => {
            hintButton.style.transform = 'scale(0.96)';
        });
        hintButton.addEventListener('mouseup', () => {
            hintButton.style.transform = 'scale(1)';
        });
        hintButton.addEventListener('click', () => {
            this.game.events.emit('hintRequested');
        });

        sidebarContent.appendChild(hintButton);
    }

    handleResize(gameSize) {
        this.buildUI(); // This will rebuild both bottom bar and hint button
    }

    onLayoutChanged({ topBarHeight, bottomBarHeight, playAreaHeight }) {
        this.topBarHeight = 0; // No top bar
        this.bottomBarHeight = bottomBarHeight;
        this.buildUI();
    }

    // -------------------------------------------------------------------------
    // Event handlers
    // -------------------------------------------------------------------------

    onObjectsCreated(payload) {
        console.log('=== onObjectsCreated EVENT RECEIVED ===');
        console.log('Full payload:', JSON.stringify(payload, null, 2));
        const { objects } = payload;
        
        if (!objects || objects.length === 0) {
            console.error('❌ onObjectsCreated called with no objects!', payload);
            return;
        }
        
        console.log(`✅ Received ${objects.length} objects:`, objects);
        
        // Store objects
        this.pendingObjects = objects;
        
        // Try to populate immediately
        const gallery = document.getElementById('object-gallery');
        if (gallery) {
            console.log('✅ Gallery element found in DOM, populating immediately...');
            this.populateGalleryItems(objects);
        } else {
            console.warn('⚠️ Gallery element NOT found in DOM yet. Will populate after bottom bar is built.');
            console.log('Available DOM elements:', {
                bottomBarContent: !!document.getElementById('bottom-bar-content'),
                bottomBarContainer: !!document.getElementById('bottom-bar-container'),
                gallery: !!document.getElementById('object-gallery')
            });
            // Gallery will be populated in buildBottomBar if pendingObjects exists
        }
    }

    onObjectFound({ id, found, total, score }) {
        const progress = total > 0 ? found / total : 0;
        this.updateProgress(progress);

        // Update gallery item opacity in DOM
        const galleryItem = document.querySelector(`[data-object-id="${id}"]`);
        if (galleryItem) {
            galleryItem.style.opacity = '0.3';
        }

        const instructionsText = document.getElementById('instructions-text');
        if (instructionsText) {
            instructionsText.textContent = `FIND THE OBJECTS · SCORE: ${score}`;
        }
    }

    onTimerUpdated({ remaining, progress }) {
        const seconds = Math.ceil(remaining);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;

        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs
                .toString()
                .padStart(2, '0')}`;
        }

        // Update progress bar at bottom of bottom bar
        const progressBarFill = document.getElementById('progress-bar-fill');
        if (progressBarFill) {
            progressBarFill.style.width = `${progress * 100}%`;
        }
    }

    onTimeUp({ score, found, total }) {
        const instructionsText = document.getElementById('instructions-text');
        if (instructionsText) {
            instructionsText.textContent = `TIME UP · SCORE: ${score} · FOUND ${found}/${total}`;
        }
    }

    onAllObjectsFound({ score, timeRemaining }) {
        const instructionsText = document.getElementById('instructions-text');
        if (instructionsText) {
            instructionsText.textContent = `ALL OBJECTS FOUND! SCORE: ${score} · ${timeRemaining.toFixed(1)}s LEFT`;
        }
    }

    updateProgress(value) {
        const clamped = Math.max(0, Math.min(1, value));
        const progressBarFill = document.getElementById('progress-bar-fill');
        if (progressBarFill) {
            progressBarFill.style.width = `${clamped * 100}%`;
        }
    }

    shutdown() {
        this.game.events.off('objectsCreated', this.onObjectsCreated, this);
        this.game.events.off('objectFound', this.onObjectFound, this);
        this.game.events.off('timerUpdated', this.onTimerUpdated, this);
        this.game.events.off('timeUp', this.onTimeUp, this);
        this.game.events.off('allObjectsFound', this.onAllObjectsFound, this);
        this.game.events.off('layoutChanged', this.onLayoutChanged, this);
        this.scale.off('resize', this.handleResize, this);
    }
}

