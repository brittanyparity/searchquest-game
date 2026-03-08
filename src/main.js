import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

const config = {
    type: Phaser.AUTO,
    title: 'SearchQuest',
    parent: 'game-container',
    backgroundColor: '#020617',
    width: 393,
    height: 852,
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
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

new Phaser.Game(config);
            