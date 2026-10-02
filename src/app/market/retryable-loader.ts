export class RetryableLoader<T> {
  private pendingLoad: Promise<T> | null = null;

  constructor(
    private readonly load: () => Promise<T>,
  ) {}

  get(): Promise<T> {
    if (this.pendingLoad === null) {
      this.pendingLoad = this.load().catch(
        (error: unknown) => {
          this.pendingLoad = null;
          throw error;
        },
      );
    }

    return this.pendingLoad;
  }
}
