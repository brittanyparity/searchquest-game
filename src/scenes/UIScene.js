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
        this.galleryHeight = 120; // Gallery container height
        
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
        this.game.events.on('attemptsUpdated', this.onAttemptsUpdated, this);
        this.game.events.on('lifeLost', this.onLifeLost, this);
        this.game.events.on('outOfLives', this.onOutOfLives, this);
        
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
        // Gallery container for items to search for
        console.log('🔨 Building UI (gallery container and buttons)...');
        this.buildGallery();
        this.buildGameButtons();
        console.log('✅ UI build complete');
    }
    
    buildGameButtons() {
        const settingsSlot = document.getElementById('top-bar-settings-slot');
        if (settingsSlot) {
            settingsSlot.innerHTML = '';
            const settingsButton = document.createElement('button');
            settingsButton.id = 'settings-button';
            settingsButton.type = 'button';
            settingsButton.setAttribute('aria-label', 'Settings');
            settingsButton.innerHTML = '⚙️';
            settingsButton.style.cssText = `
                width: 44px;
                height: 40px;
                background-color: rgba(255, 255, 255, 0.95);
                color: #4b5563;
                border: 1px solid #e5e7eb;
                border-radius: 10px;
                font-size: 20px;
                cursor: pointer;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
                transition: transform 0.1s ease, box-shadow 0.1s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            settingsButton.addEventListener('mousedown', () => {
                settingsButton.style.transform = 'scale(0.96)';
            });
            settingsButton.addEventListener('mouseup', () => {
                settingsButton.style.transform = 'scale(1)';
            });
            settingsButton.addEventListener('touchstart', () => {
                settingsButton.style.transform = 'scale(0.96)';
            }, { passive: true });
            settingsButton.addEventListener('touchend', () => {
                settingsButton.style.transform = 'scale(1)';
            });
            settingsButton.addEventListener('click', () => {
                console.log('Settings clicked');
            });
            settingsSlot.appendChild(settingsButton);
        }

        const hintButton = document.getElementById('hint-button');
        if (hintButton && !hintButton.dataset.wired) {
            hintButton.dataset.wired = '1';
            hintButton.addEventListener('click', () => {
                this.game.events.emit('hintRequested');
            });
        }

        const backButton = document.getElementById('top-bar-back');
        if (backButton && !backButton.dataset.wired) {
            backButton.dataset.wired = '1';
            backButton.addEventListener('click', () => {
                if (window.history.length > 1) {
                    window.history.back();
                }
            });
        }

        const titleEl = document.getElementById('game-top-bar-title');
        if (titleEl && !titleEl.dataset.setTitle) {
            titleEl.dataset.setTitle = '1';
            titleEl.textContent = 'Search Quest';
        }
    }

    buildGallery() {
        console.log('🔨 Building gallery container...');
        const galleryContent = document.getElementById('gallery-content');
        if (!galleryContent) {
            console.error('❌ gallery-content element not found!');
            return;
        }
        console.log('✅ Found gallery-content element');

        // Clear existing content
        galleryContent.innerHTML = '';

        // Get container dimensions
        const container = document.getElementById('gallery-container');
        const width = container ? container.clientWidth : 393;
        const height = container ? container.clientHeight : 160;
        const baseWidth = 393;
        const scale = width / baseWidth;

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
        galleryContent.appendChild(galleryWrapper);
        
        console.log('✅ Gallery element created with ID: object-gallery');
        console.log('✅ Gallery element in DOM:', !!document.getElementById('object-gallery'));
        
        // Always populate gallery with all 5 items (regardless of pending objects)
        setTimeout(() => {
            const gallery = document.getElementById('object-gallery');
            if (gallery) {
                console.log('✅ Gallery exists, populating with all items...');
                this.populateGalleryItems(this.pendingObjects);
            } else {
                console.error('❌ Gallery still not found after buildGallery!');
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

        const container = document.getElementById('gallery-container');
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
    

    handleResize(gameSize) {
        this.buildUI(); // This will rebuild both bottom bar and hint button
    }

    onLayoutChanged({ topBarHeight, galleryHeight, playAreaHeight }) {
        this.topBarHeight = 0; // No top bar
        this.galleryHeight = galleryHeight || 120;
        this.buildUI();
    }

    // -------------------------------------------------------------------------
    // Event handlers
    // -------------------------------------------------------------------------

    onObjectsCreated(payload) {
        console.log('=== onObjectsCreated EVENT RECEIVED ===');
        console.log('Full payload:', JSON.stringify(payload, null, 2));
        const { objects, total } = payload;
        
        if (!objects || objects.length === 0) {
            console.error('❌ onObjectsCreated called with no objects!', payload);
            return;
        }
        
        console.log(`✅ Received ${objects.length} objects:`, objects);
        
        // Store objects
        this.pendingObjects = objects;
        
        // Initialize gallery title with total count
        const galleryTitle = document.getElementById('gallery-title');
        if (galleryTitle) {
            galleryTitle.textContent = `FIND THE OBJECTS · 0/${total || objects.length}`;
        }
        
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

        // Update gallery title with score and found count
        const galleryTitle = document.getElementById('gallery-title');
        if (galleryTitle) {
            galleryTitle.textContent = `FIND THE OBJECTS · ${found}/${total}`;
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
        const galleryTitle = document.getElementById('gallery-title');
        if (galleryTitle) {
            galleryTitle.textContent = `TIME UP · FOUND ${found}/${total}`;
        }
    }

    onAllObjectsFound({ score, timeRemaining }) {
        const galleryTitle = document.getElementById('gallery-title');
        if (galleryTitle) {
            galleryTitle.textContent = `ALL OBJECTS FOUND! ${timeRemaining.toFixed(1)}s LEFT`;
        }
    }

    onAttemptsUpdated({ remaining, max }) {
        const attemptsDisplay = document.getElementById('attempts-display');
        if (attemptsDisplay) {
            const n = Math.max(0, remaining);
            const cap = max != null ? max : n;
            attemptsDisplay.textContent = `♥ ${n}/${cap}`;
        }
    }

    onLifeLost() {
        const attemptsDisplay = document.getElementById('attempts-display');
        if (attemptsDisplay) {
            attemptsDisplay.classList.remove('life-lost-flash');
            void attemptsDisplay.offsetWidth;
            attemptsDisplay.classList.add('life-lost-flash');
            attemptsDisplay.addEventListener(
                'animationend',
                () => attemptsDisplay.classList.remove('life-lost-flash'),
                { once: true }
            );
        }

        const flash = document.getElementById('wrong-tap-flash');
        if (flash) {
            flash.classList.add('visible');
            window.clearTimeout(this._lifeFlashTimer);
            this._lifeFlashTimer = window.setTimeout(() => {
                flash.classList.remove('visible');
            }, 120);
        }
    }

    onOutOfLives({ found, total }) {
        const galleryTitle = document.getElementById('gallery-title');
        if (galleryTitle) {
            galleryTitle.textContent = `OUT OF TRIES · FOUND ${found}/${total}`;
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
        this.game.events.off('attemptsUpdated', this.onAttemptsUpdated, this);
        this.game.events.off('lifeLost', this.onLifeLost, this);
        this.game.events.off('outOfLives', this.onOutOfLives, this);
        this.game.events.off('layoutChanged', this.onLayoutChanged, this);
        this.scale.off('resize', this.handleResize, this);
        window.clearTimeout(this._lifeFlashTimer);
    }
}

