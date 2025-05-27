(function () {
  'use strict';

  const IR_FILES = {
    intimateRoom: 'audio/small-room.wav',
    studioRoom: 'audio/large-room.wav',
    grandHall: 'audio/large-hall.wav',
    lushPlate: 'audio/plate.wav',
    velvetChamber: 'audio/chamber.wav',
  };

  const presets = {
    intimateRoom: {
      label: 'Intimate Room',
      wet: 0.13,
      dry: 0.87,
      ir: IR_FILES.intimateRoom,
    },
    studioRoom: {
      label: 'Studio Room',
      wet: 0.22,
      dry: 0.78,
      ir: IR_FILES.studioRoom,
    },
    grandHall: {
      label: 'Grand Hall',
      wet: 0.32,
      dry: 0.68,
      ir: IR_FILES.grandHall,
    },
    lushPlate: {
      label: 'Lush Plate',
      wet: 0.18,
      dry: 0.82,
      ir: IR_FILES.lushPlate,
    },
    velvetChamber: {
      label: 'Velvet Chamber',
      wet: 0.25,
      dry: 0.75,
      ir: IR_FILES.velvetChamber,
    },
  };

  const dryGain = audioContext.createGain();
  dryGain.connect(audioContext.destination);

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

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  let audioContextInitialized = false;

  const initializeAudioContext = async () => {
    if (audioContextInitialized) return true;
    try {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      audioContextInitialized = true;
      return true;
    } catch (error) {
      return false;
    }
  };

  const handleDocumentClick = async () => {
    await initializeAudioContext();
    updateSourceNodes();
    document.removeEventListener('click', handleDocumentClick);
  };
  document.addEventListener('click', handleDocumentClick);

  const settings = {
    reverbWetMix: 0.2,
    isEnabled: true,
  };

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
      return false;
    }
  };

  const updateSourceNodes = () => {
    if (!audioContextInitialized) {
      return;
    }
    const currentMediaElements = getMediaElements();
    mediaElementSourceNodes = mediaElementSourceNodes.filter(
      (sourceNode) =>
        currentMediaElements.includes(sourceNode.mediaElement) || sourceNode.disconnect()
    );
    mediaElementSourceNodes = currentMediaElements.map((mediaElement) => {
      let sourceNode = mediaElementSourceNodes.find(
        (sourceNode) => sourceNode.mediaElement === mediaElement
      );
      if (sourceNode) {
        return sourceNode;
      }
      if (isCaptureSupported(mediaElement)) {
        try {
          sourceNode = audioContext.createMediaElementSource(mediaElement);
          sourceNode.connect(dryGain);
          sourceNode.connect(wetInputGain);
        } catch (error) {
          sourceNode = {
            mediaElement,
            disconnect: () => {},
            connect: () => {},
          };
        }
      } else {
        sourceNode = {
          mediaElement,
          disconnect: () => {},
          connect: () => {},
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
  };

  updateConvolver();
  updateReverbWetMix(settings.reverbWetMix);

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      switch (request.action) {
        case 'setPreset':
          const preset = presets[request.preset];
          if (preset) {
            updateReverbWetMix(preset.reverbWetMix);
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
          }
          break;
        default:
          break;
      }
      sendResponse({
        success: true,
        state: { isEnabled: settings.isEnabled, reverbWetMix: settings.reverbWetMix },
      });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'setPreset' && presets[request.preset]) {
      currentPresetKey = request.preset;
      updateConvolver();
      sendResponse({ success: true });
      return true;
    }
  });

  updateSourceNodes();

  document.addEventListener(
    'click',
    () => {
      if (audioContext.state !== 'running') {
        audioContext.resume();
      }
      updateSourceNodes();
    },
    { once: false }
  );

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      updateSourceNodes();
    }
  });

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
})();
