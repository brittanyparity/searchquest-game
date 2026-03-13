import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

// Get container dimensions for responsive sizing
// Calculate based on the containers directly and viewport
const getContainerSize = () => {
    const gameContainer = document.getElementById('game-container');
    const bottomBar = document.getElementById('bottom-bar-container');
    
    if (gameContainer) {
        // Get actual bottom bar height from DOM (set dynamically)
        const bottomBarHeight = bottomBar ? bottomBar.offsetHeight : 100;
        
        // Calculate available height for game container
        // Use 85% of viewport to leave room for browser UI bars
        const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        const usableHeight = viewportHeight * 0.85; // Use 85% of viewport
        const bodyPadding = 8; // 4px top + 4px bottom
        const gap = 6; // Gap between game container and bottom bar
        const availableHeight = usableHeight - bodyPadding - gap - bottomBarHeight;
        
        // Use 90% of viewport width
        const viewportWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
        const usableWidth = viewportWidth * 0.90; // Use 90% of viewport
        
        // Use the calculated width or the container's actual width (whichever is smaller)
        const containerWidth = gameContainer.clientWidth || usableWidth;
        
        return {
            width: Math.min(containerWidth, usableWidth),
            height: Math.max(300, availableHeight),
            bottomBarHeight: bottomBarHeight,
            spacing: gap
        };
    }
    // Fallback
    return { width: 393, height: 600, bottomBarHeight: 100, spacing: 12 };
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
            