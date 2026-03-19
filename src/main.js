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

window.addEventListener('resize', resizeGameToContainer);

if (typeof ResizeObserver !== 'undefined') {
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
        const ro = new ResizeObserver(() => resizeGameToContainer());
        ro.observe(gameContainer);
    }
}

requestAnimationFrame(() => {
    resizeGameToContainer();
});

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeGameToContainer);
    window.visualViewport.addEventListener('scroll', () => {
        window.scrollTo(0, 0);
    });
}

/** Extra bottom inset so the UI stack clears mobile Safari’s bottom toolbar / URL strip */
const syncMobileBottomGap = () => {
    const vv = window.visualViewport;
    if (!vv) {
        return;
    }
    const obscured = window.innerHeight - vv.height - vv.offsetTop;
    const px = Math.max(44, Math.round(obscured + 16));
    document.documentElement.style.setProperty('--vv-bottom-gap', `${px}px`);
};

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncMobileBottomGap);
    window.visualViewport.addEventListener('scroll', syncMobileBottomGap);
}
window.addEventListener('orientationchange', () => {
    requestAnimationFrame(syncMobileBottomGap);
});
syncMobileBottomGap();
