export class BootScene extends Phaser.Scene {

    constructor() {
        super('BootScene');
    }

    preload() {
        // Core game art. Replace these with your own large scene / object art as needed.
        this.load.image('background', 'assets/space.png');
        this.load.image('phaserLogo', 'assets/phaser.png');
        this.load.spritesheet('ship', 'assets/spaceship.png', {
            frameWidth: 176,
            frameHeight: 96
        });
    }

    create() {
        // Start main game and UI in parallel
        this.scene.start('GameScene');
        this.scene.launch('UIScene');
    }
}

