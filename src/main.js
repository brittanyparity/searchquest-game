import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

const readGameContainerSize = () => {
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) {
        return { width: 393, height: 600 };
    }
    const rect = gameContainer.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    return { width, height };
};

const initialSize = readGameContainerSize();

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

const resizeGameToContainer = () => {
    const { width, height } = readGameContainerSize();
    game.scale.resize(width, height);
};

/**
 * Pin document height to the *visual* viewport (iOS Safari) so flex layout + padding
 * stay inside what’s actually visible — avoids the ad row sitting under the toolbar.
 */
const syncViewportLayout = () => {
    const root = document.documentElement;
    const vv = window.visualViewport;

    if (vv) {
        const h = Math.max(1, Math.round(vv.height));
        root.style.setProperty('--app-visible-height', `${h}px`);
        const obscured = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        const bottomPad = Math.max(10, Math.min(24, Math.round(10 + obscured * 0.4)));
        root.style.setProperty('--vv-bottom-gap', `${bottomPad}px`);
    } else {
        root.style.removeProperty('--app-visible-height');
    }

    resizeGameToContainer();
};

window.addEventListener('resize', syncViewportLayout);

if (typeof ResizeObserver !== 'undefined') {
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        const ro = new ResizeObserver(() => resizeGameToContainer());
        ro.observe(gameContainer);
    }
}

requestAnimationFrame(() => {
    syncViewportLayout();
});

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncViewportLayout);
    window.visualViewport.addEventListener('scroll', () => {
        window.scrollTo(0, 0);
        syncViewportLayout();
    });
}

window.addEventListener('orientationchange', () => {
    requestAnimationFrame(syncViewportLayout);
});

syncViewportLayout();
