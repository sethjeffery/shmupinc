import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#05060a');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#05060a');
  }
}
