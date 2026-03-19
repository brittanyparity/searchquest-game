import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

// Get container dimensions for responsive sizing
// Calculate based on the containers directly and viewport
const getContainerSize = () => {
    const gameContainer = document.getElementById('game-container');
    const galleryContainer = document.getElementById('gallery-container');
    const adContainer = document.getElementById('ad-container');
    
    if (gameContainer) {
        // Get actual container heights from DOM
        const galleryHeight = galleryContainer ? galleryContainer.offsetHeight : 100;
        const adHeight = adContainer ? adContainer.offsetHeight : 50;
        
        // Calculate available height for game container (body uses ~85% viewport)
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const usableHeight = viewportHeight * 0.85; // Use 85% of viewport
        const bodyPadding = 0;
        const gap = 0;
        const availableHeight = usableHeight - bodyPadding - galleryHeight - adHeight;
        
        const viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
        const usableWidth = viewportWidth;
        
        const containerWidth = gameContainer.clientWidth || usableWidth;
        
        return {
            width: Math.min(containerWidth, usableWidth),
            height: Math.max(300, availableHeight),
            galleryHeight: galleryHeight,
            adHeight: adHeight,
            spacing: gap
        };
    }
    // Fallback
    return { width: 393, height: 600, galleryHeight: 100, adHeight: 50, spacing: 12 };
};

const initialSize = getContainerSize();

const config = {
    type: Phaser.AUTO,
    title: 'SearchQuest',
    parent: 'game-container',
    backgroundColor: '#ffffff',
    width: initialSize.width,
    height: initialSize.height,
    pixelArt: false,
    input: {
        activePointers: 3
    },
    scene: [
        BootScene,
        GameScene,
        UIScene
    ],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

const game = new Phaser.Game(config);

// Handle window resize
const handleResize = () => {
    const newSize = getContainerSize();
    game.scale.resize(newSize.width, newSize.height);
};

window.addEventListener('resize', handleResize);

// Handle visualViewport changes (important for mobile Safari)
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', () => {
        // Prevent scrolling when viewport changes
        window.scrollTo(0, 0);
    });
}
            