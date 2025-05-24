// Audio context and nodes
let audioContext = null;
let convolverNode = null;
let dryGainNode = null;
let wetGainNode = null;
let mediaElementSource = null;

// Preset configurations
const presets = {
  smallRoom: { reverbWetMix: 0.2 },
  largeRoom: { reverbWetMix: 0.4 },
  concertHall: { reverbWetMix: 0.7 },
  ambientWash: { reverbWetMix: 0.9 },
  moonlightChamber: { reverbWetMix: 0.6 },
};

// Current state
let currentPreset = 'smallRoom';
let isEnabled = false;
let currentWetMix = presets[currentPreset].reverbWetMix;

// Initialize audio context and nodes
async function initializeAudioContext(mediaElement) {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (!convolverNode) {
    convolverNode = audioContext.createConvolver();
    // Load impulse response
    try {
      const response = await fetch(chrome.runtime.getURL('audio/large-studio-room.wav'));
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      convolverNode.buffer = audioBuffer;
    } catch (error) {
      console.error('Error loading impulse response:', error);
    }
  }

  // Create gain nodes
  dryGainNode = audioContext.createGain();
  wetGainNode = audioContext.createGain();

  // Create media element source
  mediaElementSource = audioContext.createMediaElementSource(mediaElement);

  // Connect nodes
  mediaElementSource.connect(dryGainNode);
  mediaElementSource.connect(convolverNode);
  convolverNode.connect(wetGainNode);
  dryGainNode.connect(audioContext.destination);
  wetGainNode.connect(audioContext.destination);

  // Set initial gains
  updateReverbMix();
}

// Update reverb mix based on current preset
function updateReverbMix() {
  if (!dryGainNode || !wetGainNode) return;

  const wetMix = currentWetMix;
  dryGainNode.gain.value = 1 - wetMix;
  wetGainNode.gain.value = wetMix;
}

// Find and process media elements
function processMediaElements() {
  const mediaElements = document.querySelectorAll('audio, video');

  mediaElements.forEach(async (mediaElement) => {
    if (!mediaElement.processed) {
      mediaElement.processed = true;
      await initializeAudioContext(mediaElement);
    }
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'setPreset':
      currentPreset = request.preset;
      currentWetMix =
        typeof request.reverbWetMix === 'number'
          ? request.reverbWetMix
          : presets[currentPreset].reverbWetMix;
      updateReverbMix();
      break;
    case 'toggleEnabled':
      isEnabled = !isEnabled;
      if (audioContext) {
        if (isEnabled) {
          audioContext.resume();
        } else {
          audioContext.suspend();
        }
      }
      break;
  }
  sendResponse({ success: true });
});

// Initial processing
processMediaElements();

// Watch for dynamically added media elements
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      processMediaElements();
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
