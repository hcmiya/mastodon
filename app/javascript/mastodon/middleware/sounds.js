const createAudio = sources => {
  const audio = new Audio();
  sources.forEach(({ type, src }) => {
    const source = document.createElement('source');
    source.type = type;
    source.src = src;
    audio.appendChild(source);
  });
  return audio;
};

const play = audio => {
  if (!audio.paused) {
    audio.pause();
    if (typeof audio.fastSeek === 'function') {
      audio.fastSeek(0);
    } else {
      audio.seek(0);
    }
  }

  audio.play();
};

export default function soundsMiddleware() {
  const soundCache = {
    boop: createAudio([
      {
        src: '/sounds/boop.ogg',
        type: 'audio/ogg',
      },
      {
        src: '/sounds/boop.mp3',
        type: 'audio/mpeg',
      },
    ]),
    '1up': createAudio([
      {
        src: '/sounds/proprietary/1up.opus',
        type: 'audio/ogg;codecs=opus',
      },
      {
        src: '/sounds/proprietary/1up.mp4',
        type: 'audio/mp4;codecs=mp4a.40.2',
      },
      {
        src: '/sounds/proprietary/1up.ogg',
        type: 'audio/ogg;codecs=vorbis',
      },
    ]),
    paro: createAudio([
      {
        src: '/sounds/proprietary/paro.opus',
        type: 'audio/ogg;codecs=opus',
      },
      {
        src: '/sounds/proprietary/paro.mp4',
        type: 'audio/mp4;codecs=mp4a.40.2',
      },
    ]),
  };

  return () => next => action => {
    if (action.meta && action.meta.sound && soundCache[action.meta.sound]) {
      play(soundCache[action.meta.sound]);
    }

    return next(action);
  };
};
