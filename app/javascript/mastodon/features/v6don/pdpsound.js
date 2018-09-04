const n2hz = note => 440 * Math.pow(2, (note - 57) / 12);

export class PdPSelected {

  constructor() {
    this.paused = false;
  }

  pause() {
    if (this.current) {
      this.current.close();
    }
  }

  play() {
    const notes = [65, 72, 77];
    const noteStep = 0.078;

    const ctx = new AudioContext();
    this.current = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.024;
    master.connect(ctx.destination);

    const source = ctx.createGain();
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.26;
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0.3;

    source.connect(master);
    source.connect(delay).connect(delayWet).connect(master);
    delayWet.connect(delay);

    const createTime = ctx.currentTime + 0.05;
    for (let i = 0; i < notes.length; i++) {
      const oc = ctx.createOscillator();
      oc.type = 'square';
      oc.frequency.value = n2hz(notes[i]);

      const adsr = ctx.createGain();

      oc.connect(adsr).connect(source);

      const noteBegin = createTime + i * noteStep;
      oc.start(noteBegin);
      adsr.gain.setTargetAtTime(0, noteBegin, 0.09);
      if (i !== notes.length - 1) {
        oc.stop(noteBegin + noteStep);
      } else {
        oc.stop(noteBegin + 5);
        oc.onended = () => {
          ctx.close();
        };
      }
    }
  }

}
