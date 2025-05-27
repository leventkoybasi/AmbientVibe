(function () {
  'use strict';

  // Reverb creation constants
  const DECAY_TIME_SECONDS = 5;
  const PRE_DELAY_SECONDS = 0.01;
  const CHANNEL_COUNT = 2;

  // Create reverb buffer programmatically
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
    gain.gain.exponentialRampToValueAtTime(0.00001, DECAY_TIME_SECONDS + PRE_DELAY_SECONDS);
    bufferSource.connect(gain);
    gain.connect(offlineContext.destination);
    const convolver = audioContext.createConvolver();
    bufferSource.start(0);
    convolver.buffer = await offlineContext.startRendering();
    return convolver;
  };

  const getMediaElements = () =>
    ['video', 'audio'].map((tagName) => Array.from(document.getElementsByTagName(tagName))).flat();

  const findRootElement = (htmlElement) => {
    if (!htmlElement.parentElement) {
      return htmlElement;
    }
    return findRootElement(htmlElement.parentElement);
  };

  // Audio context setup - don't specify sampleRate to avoid issues
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  let audioContextInitialized = false;

  const initializeAudioContext = async () => {
    if (audioContextInitialized) return true;

    try {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      audioContextInitialized = true;
      console.log('AmbientVibe: AudioContext initialized');
      return true;
    } catch (error) {
      console.error('AmbientVibe: Failed to initialize AudioContext:', error);
      return false;
    }
  };

  const handleDocumentClick = async () => {
    await initializeAudioContext();
    updateSourceNodes();
    document.removeEventListener('click', handleDocumentClick);
  };
  document.addEventListener('click', handleDocumentClick);

  // Settings
  const settings = {
    reverbWetMix: 0.2,
    isEnabled: true,
  };

  // Preset configurations
  const presets = {
    smallRoom: { reverbWetMix: 0.2 },
    largeRoom: { reverbWetMix: 0.4 },
    concertHall: { reverbWetMix: 0.7 },
    ambientWash: { reverbWetMix: 0.9 },
    moonlightChamber: { reverbWetMix: 0.6 },
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
  const wetInputGain = audioContext.createGain();
  wetInputGain.gain.value = 1;

  const wetGain = audioContext.createGain();
  wetGain.connect(audioContext.destination);

  createConvolver(audioContext).then((convolverNode) => {
    convolverNode.connect(wetGain);
    wetInputGain.connect(convolverNode);
    console.log('AmbientVibe: Convolver created and connected');
  });

  const mediaElementObserver = new MutationObserver(() => {
    // Re-check media elements when DOM changes
    updateSourceNodes();
  });

  const rootElementObserver = new MutationObserver((mutations) => {
    if (
      mutations.some(
        ({ addedNodes, removedNodes }) =>
          (addedNodes && addedNodes.length) || (removedNodes && removedNodes.length)
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
    if (!audioContextInitialized) {
      console.log('AmbientVibe: AudioContext not initialized, skipping source node update');
      return;
    }

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
      let sourceNode = mediaElementSourceNodes.find(
        (sourceNode) => sourceNode.mediaElement === mediaElement // TODO O(n^2)
      );
      if (sourceNode) {
        return sourceNode;
      }

      if (isCaptureSupported(mediaElement)) {
        try {
          sourceNode = audioContext.createMediaElementSource(mediaElement);
          sourceNode.connect(dryGain);
          sourceNode.connect(wetInputGain);
          console.log('AmbientVibe: Connected audio source for', mediaElement.tagName);
        } catch (error) {
          console.error('AmbientVibe: Failed to create media source:', error);
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
        console.log('AmbientVibe: Capture not supported for', mediaElement.tagName);
      }

      const rootEl = findRootElement(mediaElement);
      rootElementObserver.observe(rootEl, {
        subtree: true,
        childList: true,
      });
      return sourceNode;
    });
  };

  const updateReverbWetMix = (newReverbWetMix) => {
    settings.reverbWetMix = newReverbWetMix;
    if (!settings.isEnabled) {
      dryGain.gain.value = 1;
      wetGain.gain.value = 0;
      return;
    }
    dryGain.gain.value = 1 - newReverbWetMix;
    wetGain.gain.value = newReverbWetMix;
    console.log(
      'AmbientVibe: Reverb mix updated - Dry:',
      (1 - newReverbWetMix).toFixed(2),
      'Wet:',
      newReverbWetMix.toFixed(2)
    );
  };

  const updateEnabled = (enabled) => {
    settings.isEnabled = enabled;
    updateReverbWetMix(settings.reverbWetMix);
    if (enabled) {
      updateSourceNodes();
    }
    console.log('AmbientVibe: Effect', enabled ? 'enabled' : 'disabled');
  };

  // Initialize - wait for user interaction before processing
  updateReverbWetMix(settings.reverbWetMix);

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('AmbientVibe: Received message:', request);

    try {
      switch (request.action) {
        case 'setPreset':
          const preset = presets[request.preset];
          if (preset) {
            updateReverbWetMix(preset.reverbWetMix);
            console.log(
              'AmbientVibe: Preset changed to',
              request.preset,
              'wet mix:',
              preset.reverbWetMix
            );
          }
          break;
        case 'toggleEnabled':
          const enabled = request.enabled !== undefined ? request.enabled : !settings.isEnabled;
          updateEnabled(enabled);
          break;
        case 'updateIntensity':
          if (typeof request.intensity === 'number') {
            const wetMix = request.intensity / 100;
            updateReverbWetMix(wetMix);
            console.log('AmbientVibe: Intensity updated to', request.intensity + '%');
          }
          break;
        default:
          console.log('AmbientVibe: Unknown action:', request.action);
          break;
      }
      sendResponse({
        success: true,
        state: { isEnabled: settings.isEnabled, reverbWetMix: settings.reverbWetMix },
      });
    } catch (error) {
      console.error('AmbientVibe: Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep message channel open for async response
  });

  // Initial processing
  updateSourceNodes();

  // Add global click listener to help with audio context initialization
  document.addEventListener(
    'click',
    () => {
      if (audioContext.state !== 'running') {
        audioContext.resume();
      }
      // Re-process media elements on user interaction
      updateSourceNodes();
    },
    { once: false }
  );

  // Also try when page becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateSourceNodes();
    }
  });

  // Watch for dynamically added media elements
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        updateSourceNodes();
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('AmbientVibe: Content script initialized and ready');
  console.log('AmbientVibe: AudioContext state:', audioContext.state);
  console.log('AmbientVibe: Initial media elements found:', getMediaElements().length);
})();
