export const timer = {
  duration: 0,
  remaining: 0,
  intervalId: null,
  isPaused: false,
  onTimeUp: null,
  onTick: null,

  init(duration, onTimeUpCallback, onTickCallback = null) {
    this.duration = duration;
    this.remaining = duration;
    this.onTimeUp = onTimeUpCallback;
    this.onTick = onTickCallback;
  },

  start() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(() => {
      if (!this.isPaused) {
        this.remaining--;

        if (this.onTick) {
          this.onTick(this.remaining);
        }

        if (this.remaining <= 0) {
          this.stop();
          if (this.onTimeUp) {
            this.onTimeUp();
          }
        }
      }
    }, 1000);
  },

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  },

  pause() {
    this.isPaused = true;
  },

  resume() {
    this.isPaused = false;
  },

  reset(newDuration = null) {
    this.stop();

    if (newDuration !== null) {
      this.duration = newDuration;
    }

    this.remaining = this.duration;
    this.isPaused = false;

    if (this.onTick) {
      this.onTick(this.remaining);
    }
  },
};
