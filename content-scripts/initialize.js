(function () {
  'use strict';

  // Reverb creation constants
  const DECAY_TIME_SECONDS = 5;
  const PRE_DELAY_SECONDS = 0.01;
  const CHANNEL_COUNT = 2;

  // IR dosya yolları ve preset eşleşmeleri
  const IR_FILES = {
    intimateRoom: 'audio/m7-small-room.wav',
    studioRoom: 'audio/m7-large-room.wav',
    grandHall: 'audio/m7-large-hall.wav',
    lushPlate: 'audio/m7-plate.wav',
    velvetChamber: 'audio/m7-chamber.wav',
  };

  // Presetler: Daha gerçekçi, müzik dostu ve abartısız ayarlar
  const presets = {
    intimateRoom: {
      label: 'Intimate Room',
      wet: 0.13, // Hafif, doğal oda
      dry: 0.87,
      ir: IR_FILES.intimateRoom,
    },
    studioRoom: {
      label: 'Studio Room',
      wet: 0.22, // Modern, hafif genişlik
      dry: 0.78,
      ir: IR_FILES.studioRoom,
    },
    grandHall: {
      label: 'Grand Hall',
      wet: 0.32, // Geniş ama banyo/church değil
      dry: 0.68,
      ir: IR_FILES.grandHall,
    },
    lushPlate: {
      label: 'Lush Plate',
      wet: 0.18, // Vokal ve enstrüman için parlaklık
      dry: 0.82,
      ir: IR_FILES.lushPlate,
    },
    velvetChamber: {
      label: 'Velvet Chamber',
      wet: 0.25, // Yumuşak, derinlikli, ambient
      dry: 0.75,
      ir: IR_FILES.velvetChamber,
    },
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

  let convolverNode = null;

  const createConvolver = async (audioContext, irPath) => {
    const convolver = audioContext.createConvolver();
    const response = await fetch(chrome.runtime.getURL(irPath));
    const arrayBuffer = await response.arrayBuffer();
    convolver.buffer = await audioContext.decodeAudioData(arrayBuffer);
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

  // Aktif preset ve convolver yönetimi
  let currentPresetKey = 'studioRoom';

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

  const updateConvolver = async () => {
    if (convolverNode) {
      convolverNode.disconnect();
    }
    const preset = presets[currentPresetKey];
    convolverNode = await createConvolver(audioContext, preset.ir);
    wetInputGain.disconnect();
    wetInputGain.connect(convolverNode);
    convolverNode.connect(wetGain);
    dryGain.gain.value = preset.dry;
    wetGain.gain.value = preset.wet;
    console.log('AmbientVibe: Convolver & preset updated:', preset.label);
  };

  // Başlangıçta preset yükle
  updateConvolver();

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

  // Preset değişimi için mesaj dinleyici
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'setPreset' && presets[request.preset]) {
      currentPresetKey = request.preset;
      updateConvolver();
      sendResponse({ success: true });
      return true;
    }
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
