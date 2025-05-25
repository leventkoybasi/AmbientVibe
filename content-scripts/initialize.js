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
    // Use highest quality audio context settings for production
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000, // Professional audio sample rate
      latencyHint: 'playback', // Optimized for audio quality over latency
    });
  }

  if (!convolverNode) {
    convolverNode = audioContext.createConvolver();
    // Enable normalization for consistent volume and quality
    convolverNode.normalize = true;

    // Load impulse response with error handling
    try {
      const response = await fetch(chrome.runtime.getURL('audio/large-studio-room.wav'));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      convolverNode.buffer = audioBuffer;
      console.log(
        'AmbientVibe: High-quality IR loaded successfully',
        `${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz, ${
          audioBuffer.numberOfChannels
        } channels`
      );
    } catch (error) {
      console.error('AmbientVibe: Error loading impulse response:', error);
      return; // Don't continue if IR fails to load
    }
  }

  // Create high-quality gain nodes with smooth transitions
  if (!dryGainNode) {
    dryGainNode = audioContext.createGain();
    dryGainNode.gain.setValueAtTime(1, audioContext.currentTime);
  }

  if (!wetGainNode) {
    wetGainNode = audioContext.createGain();
    wetGainNode.gain.setValueAtTime(0, audioContext.currentTime);
  }

  // Avoid multiple connections to the same element
  if (mediaElement.ambientVibeConnected) {
    return;
  }

  try {
    // Create media element source with error handling
    mediaElementSource = audioContext.createMediaElementSource(mediaElement);
    mediaElement.ambientVibeConnected = true;

    // Connect nodes for parallel dry/wet processing (preserves original audio quality)
    mediaElementSource.connect(dryGainNode);
    mediaElementSource.connect(convolverNode);
    convolverNode.connect(wetGainNode);

    // Mix dry and wet signals to destination
    dryGainNode.connect(audioContext.destination);
    wetGainNode.connect(audioContext.destination);

    // Set initial gains
    updateReverbMix();

    console.log('AmbientVibe: High-quality audio processing initialized');
  } catch (error) {
    console.error('AmbientVibe: Error connecting audio nodes:', error);
    mediaElement.ambientVibeConnected = false;
  }
}

// Update reverb mix based on current preset with smooth transitions
function updateReverbMix() {
  if (!dryGainNode || !wetGainNode || !audioContext) return;

  const currentTime = audioContext.currentTime;
  const wetMix = currentWetMix;

  // Smooth gain transitions to avoid clicks
  dryGainNode.gain.exponentialRampToValueAtTime(Math.max(0.001, 1 - wetMix), currentTime + 0.1);
  wetGainNode.gain.exponentialRampToValueAtTime(Math.max(0.001, wetMix), currentTime + 0.1);
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
  try {
    switch (request.action) {
      case 'setPreset':
        currentPreset = request.preset;
        currentWetMix =
          typeof request.reverbWetMix === 'number'
            ? request.reverbWetMix
            : presets[currentPreset].reverbWetMix;
        updateReverbMix();
        console.log('AmbientVibe: Preset changed to', currentPreset, 'wet mix:', currentWetMix);
        break;
      case 'toggleEnabled':
        isEnabled = request.enabled !== undefined ? request.enabled : !isEnabled;
        if (audioContext) {
          if (isEnabled) {
            audioContext.resume().then(() => {
              console.log('AmbientVibe: Audio context resumed');
            });
          } else {
            audioContext.suspend().then(() => {
              console.log('AmbientVibe: Audio context suspended');
            });
          }
        }
        break;
      case 'updateIntensity':
        if (typeof request.intensity === 'number') {
          currentWetMix = request.intensity / 100;
          updateReverbMix();
          console.log('AmbientVibe: Intensity updated to', request.intensity + '%');
        }
        break;
    }
    sendResponse({ success: true, state: { isEnabled, currentPreset, currentWetMix } });
  } catch (error) {
    console.error('AmbientVibe: Error handling message:', error);
    sendResponse({ success: false, error: error.message });
  }
  return true; // Keep message channel open for async response
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
