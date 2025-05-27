(function () {
  'use strict';

  // Adapted from Tone.js Reverb node

  const DECAY_TIME_SECONDS = 5;
  const PRE_DELAY_SECONDS = 0.01;
  const CHANNEL_COUNT = 2;

  const createWhiteNoiseBuffer = (audioContext) => {
    const buffer = audioContext.createBuffer(
      CHANNEL_COUNT,
      (DECAY_TIME_SECONDS + PRE_DELAY_SECONDS) * audioContext.sampleRate,
      audioContext.sampleRate
    );
    for (let channelNum = 0; channelNum < CHANNEL_COUNT; channelNum++) {
      const channelData = buffer.getChannelData(channelNum);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = Math.random() * 2 - 1;
      }
    }
    return buffer;
  };

  const createConvolver = async (audioContext) => {
    const offlineContext = new OfflineAudioContext(
      2,
      (DECAY_TIME_SECONDS + PRE_DELAY_SECONDS) * audioContext.sampleRate,
      audioContext.sampleRate
    );
    const bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = createWhiteNoiseBuffer(offlineContext);
    const gain = offlineContext.createGain();
    gain.gain.setValueAtTime(0, 0);
    gain.gain.setValueAtTime(1, PRE_DELAY_SECONDS);
    gain.gain.exponentialRampToValueAtTime(
      0.00001,
      DECAY_TIME_SECONDS + PRE_DELAY_SECONDS
    );
    bufferSource.connect(gain);
    gain.connect(offlineContext.destination);
    const convolver = audioContext.createConvolver();
    bufferSource.start(0);
    convolver.buffer = await offlineContext.startRendering();
    return convolver;
  };

  const PITCH_PREVIEW_TIMEOUT_MS = 30 * 1000;

  const getMediaElements = () =>
    ['video', 'audio']
      .map((tagName) => Array.from(document.getElementsByTagName(tagName)))
      .flat();

  const findRootElement = (htmlElement) => {
    if (!htmlElement.parentElement) {
      return htmlElement;
    }
    return findRootElement(htmlElement.parentElement);
  };

  const audioContext = new AudioContext();
  const handleDocumentClick = () => {
    if (audioContext.state !== 'running') {
      audioContext.start();
    }
    document.removeEventListener('click', handleDocumentClick);
  };
  document.addEventListener('click', handleDocumentClick);

  const settings = {
    playbackRate: 0.8,
    reverbWetMix: 0.4,
    preservesPitch: false,
    isPro: false,
  };

  /*
   * Audio Node graph:
   *                               |-->[Dry Gain]------------------------------>|
   * [MediaElementSourceNode(s)]-->|                                            |-->[Destination]
   *                               |-->[Wet Input]-->[Convolver]-->[Wet Gain]-->|
   */

  const dryGain = audioContext.createGain();
  dryGain.connect(audioContext.destination);

  // Since the convolver node is created asynchronously,
  // use a gain node as an input that can be connected to before the convolver is created.
  // Then this gets connected to the convolver later.
  const wetInputGain = audioContext.createGain();
  wetInputGain.gain.value = 1;

  const wetGain = audioContext.createGain();
  wetGain.connect(audioContext.destination);

  createConvolver(audioContext).then((convolverNode) => {
    convolverNode.connect(wetGain);
    wetInputGain.connect(convolverNode);
  });

  const mediaElementObserver = new MutationObserver((mutations) => {
    mutations.forEach(({ attributeName, target }) => {
      if (
        attributeName === 'preservesPitch' &&
        target.preservesPitch !== settings.preservesPitch
      ) {
        target.preservesPitch = settings.preservesPitch;
      }
      if (
        attributeName === 'playbackRate' &&
        target.playbackRate !== settings.playbackRate
      ) {
        target.playbackRate = settings.playbackRate;
      }
    });
  });

  const rootElementObserver = new MutationObserver((mutations) => {
    if (
      mutations.some(
        ({ addedNodes, removedNodes }) =>
          (addedNodes && addedNodes.length) ||
          (removedNodes && removedNodes.length)
      )
    ) {
      updateSourceNodes();
    }
  });

  let mediaElementSourceNodes = [];

  const isCaptureSupported = (mediaElement) => {
    const captureFunction = ['captureStream', 'mozCaptureStream'].find(
      (functionName) => typeof mediaElement[functionName] === 'function'
    );
    if (!captureFunction) {
      return false;
    }
    try {
      mediaElement[captureFunction]();
      return true;
    } catch (error) {
      // It's probably cross-origin
      return false;
    }
  };

  const updateSourceNodes = () => {
    const currentMediaElements = getMediaElements();

    // If the mediaElement is no longer in the DOM,
    // disconnect its source node and stop tracking it.
    // MutationObserver will automatically stop watching it.
    mediaElementSourceNodes = mediaElementSourceNodes.filter(
      (sourceNode) =>
        currentMediaElements.includes(sourceNode.mediaElement) || // TODO O(n^2)
        sourceNode.disconnect() // returns undefined
    );

    mediaElementSourceNodes = currentMediaElements.map((mediaElement) => {
      mediaElement.preservesPitch = settings.preservesPitch;
      mediaElement.playbackRate = settings.playbackRate;

      // Aparrently this is safe to do multiple times with the same element
      mediaElementObserver.observe(mediaElement, {
        attributes: true,
        attributeFilter: ['preservesPitch', 'playbackRate'],
      });

      let sourceNode = mediaElementSourceNodes.find(
        (sourceNode) => sourceNode.mediaElement === mediaElement // TODO O(n^2)
      );
      if (sourceNode) {
        return sourceNode;
      }

      if (isCaptureSupported(mediaElement)) {
        sourceNode = audioContext.createMediaElementSource(mediaElement);
        sourceNode.connect(dryGain);
        sourceNode.connect(wetInputGain);
      } else {
        sourceNode = {
          mediaElement,
          disconnect: () => {
            /* noop */
          },
          connect: () => {
            /* noop */
          },
        };
      }

      const rootEl = findRootElement(mediaElement);
      rootElementObserver.observe(rootEl, {
        subtree: true,
        childList: true,
      });
      return sourceNode;
    });
  };

  const updatePlaybackRate = (newPlaybackRate) => {
    settings.playbackRate = newPlaybackRate;
    mediaElementSourceNodes.forEach(({ mediaElement }) => {
      mediaElement.playbackRate = newPlaybackRate;
    });
  };

  const updateReverbWetMix = (newReverbWetMix) => {
    settings.reverbWetMix = newReverbWetMix;
    dryGain.gain.value = 1 - newReverbWetMix;
    wetGain.gain.value = newReverbWetMix;
  };

  const updatePreservesPitch = (preservesPitch) => {
    settings.preservesPitch = preservesPitch;
    mediaElementSourceNodes.forEach(({ mediaElement }) => {
      mediaElement.preservesPitch = preservesPitch;
    });
  };

  updateSourceNodes();
  updatePlaybackRate(settings.playbackRate);
  updateReverbWetMix(settings.reverbWetMix);
  updatePreservesPitch(settings.preservesPitch);

  let pitchPreviewTimeout;
  let lastActivePort;
  let lastPitchPreviewTime = 0;

  chrome.runtime.onConnect.addListener((port) => {
    lastActivePort = port;
    port.onMessage.addListener((msg) => {
      const { playbackRate, reverbWetMix, preservesPitch, isPro } = msg;
      // TODO: don't allow strings
      if (typeof playbackRate === 'number' || typeof playbackRate === 'string') {
        updatePlaybackRate(playbackRate);
      }
      if (typeof reverbWetMix === 'number' || typeof reverbWetMix === 'string') {
        updateReverbWetMix(reverbWetMix);
      }
      if (typeof preservesPitch === 'boolean') {
        updatePreservesPitch(preservesPitch);
        if (settings.isPro || !preservesPitch) {
          return;
        }
        lastPitchPreviewTime = Date.now();
        // Since this is async, we're tracking
        // the last active port and using it.
        pitchPreviewTimeout = setTimeout(() => {
          updatePreservesPitch(false);
          try {
            lastActivePort.postMessage({
              type: 'update',
              preservesPitch: false,
            });
          } catch (error) {
            // The popup is probably closed
          }
        }, PITCH_PREVIEW_TIMEOUT_MS);
      }
      if (typeof isPro === 'boolean' && isPro) {
        settings.isPro = true;
        clearTimeout(pitchPreviewTimeout);
      }
    });
  });

  chrome.runtime.onMessage.addListener(
    (request, /* sender */ _, sendResponse) => {
      if (request === 'status-check') {
        sendResponse({
          mediaElementCount: mediaElementSourceNodes.length,
          capturableMediaElementCount: mediaElementSourceNodes.filter(
            (sourceNode) => sourceNode instanceof MediaElementAudioSourceNode
          ).length,
          playbackRate: settings.playbackRate,
          reverbWetMix: settings.reverbWetMix,
          preservesPitch: settings.preservesPitch,
          elapsedPitchPreviewTimeMs: Date.now() - lastPitchPreviewTime,
        });
      }
      return true;
    }
  );

})();
