export class BootScene extends Phaser.Scene {

    constructor() {
        super('BootScene');
    }

    preload() {
        // Use the high-res hidden object artwork as the main background.
        // Note: file extension is .jpeg, not .jpg
        this.load.image('background', 'assets/background.jpeg');
        this.load.image('phaserLogo', 'assets/phaser.png');
        this.load.spritesheet('ship', 'assets/spaceship.png', {
            frameWidth: 176,
            frameHeight: 96
        });
        
        // Load item images for the gallery
        this.load.image('item1', 'assets/Item 1.png');
        this.load.image('item2', 'assets/Item 2.png');
        this.load.image('item3', 'assets/Item 3.png');
        this.load.image('item4', 'assets/Item 4.png');
        this.load.image('item5', 'assets/Item 5.png');
    }

    create() {
        // Start main game and UI in parallel
        this.scene.start('GameScene');
        this.scene.launch('UIScene');
    }
}

