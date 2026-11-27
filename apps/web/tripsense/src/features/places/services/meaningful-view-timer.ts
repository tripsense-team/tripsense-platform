export class MeaningfulViewTimer {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly onComplete: () => void,
    private readonly isVisible: () => boolean,
    private readonly delayMs = 2_000,
  ) {}

  restart(): void {
    this.cancel();
    if (!this.isVisible()) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.onComplete();
    }, this.delayMs);
  }

  cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
