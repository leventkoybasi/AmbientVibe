// DOM Elements
const presetRadios = document.querySelectorAll('input[name="preset"]');
const reverbSlider = document.getElementById('reverb-slider');
const reverbValue = document.getElementById('reverb-value');
const themeToggle = document.getElementById('theme-toggle');
const onoffToggle = document.getElementById('onoff-toggle');
const closeBtn = document.querySelector('.close-btn');
const controlsArea = document.getElementById('controls-area');
const presetForm = document.getElementById('preset-form');

// State
let currentPreset = 'smallRoom';
let reverbIntensity = 50;
let isLightTheme = false;
let isOn = true;

// Preset default values
const presetDefaults = {
  smallRoom: 20,
  largeRoom: 40,
  concertHall: 70,
  ambientWash: 90,
  moonlightChamber: 60,
};

// Load settings from storage
function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('ambientVibeSettings')) || {};
  if (settings.preset) {
    currentPreset = settings.preset;
  }
  if (settings.reverb !== undefined) {
    reverbIntensity = settings.reverb;
  } else {
    reverbIntensity = presetDefaults[currentPreset];
  }
  isLightTheme = settings.theme === 'light';
  isOn = settings.on !== false; // default ON
  updateUI();
}

// Update UI to reflect state
function updateUI() {
  presetRadios.forEach((radio) => {
    radio.checked = isOn && radio.value === currentPreset;
    radio.disabled = !isOn;
    // Kartı da disable yap
    radio.parentElement.classList.toggle('disabled', !isOn);
  });
  reverbSlider.value = reverbIntensity;
  reverbSlider.disabled = !isOn;
  reverbValue.textContent = reverbIntensity + '%';
  themeToggle.checked = isLightTheme;
  document.body.setAttribute('data-theme', isLightTheme ? 'light' : 'dark');
  onoffToggle.checked = isOn;
  controlsArea.classList.toggle('disabled', !isOn);
}

// Save settings to storage
function saveSettings() {
  const settings = {
    preset: currentPreset,
    reverb: reverbIntensity,
    theme: isLightTheme ? 'light' : 'dark',
    on: isOn,
  };
  localStorage.setItem('ambientVibeSettings', JSON.stringify(settings));
}

// Send settings to content script
async function sendSettingsToContentScript() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      // Send enable/disable message
      const enableResponse = await chrome.tabs.sendMessage(tab.id, {
        action: 'toggleEnabled',
        enabled: isOn,
      });

      // If enabled, send preset
      if (isOn) {
        const presetResponse = await chrome.tabs.sendMessage(tab.id, {
          action: 'setPreset',
          preset: currentPreset,
        });
      }

      console.log('AmbientVibe: Settings sent to content script');
    }
  } catch (error) {
    console.error('AmbientVibe: Error sending settings:', error);
  }
}

// Send real-time intensity updates
async function sendIntensityUpdate() {
  if (!isOn) return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'updateIntensity',
        intensity: reverbIntensity,
      });
    }
  } catch (error) {
    console.error('AmbientVibe: Error sending intensity update:', error);
  }
}

// Event listeners
presetRadios.forEach((radio) => {
  radio.addEventListener('change', async () => {
    currentPreset = radio.value;
    reverbIntensity = presetDefaults[currentPreset];
    updateUI();
    saveSettings();
    await sendSettingsToContentScript();
  });
});

reverbSlider.addEventListener('input', async () => {
  reverbIntensity = parseInt(reverbSlider.value, 10);
  reverbValue.textContent = reverbIntensity + '%';
  await sendIntensityUpdate();
});

// Also save when slider changes are finished
reverbSlider.addEventListener('change', () => {
  saveSettings();
});

themeToggle.addEventListener('change', () => {
  isLightTheme = themeToggle.checked;
  document.body.setAttribute('data-theme', isLightTheme ? 'light' : 'dark');
});

onoffToggle.addEventListener('change', async () => {
  isOn = onoffToggle.checked;
  if (!isOn) {
    // Tüm presetleri untick et
    presetRadios.forEach((radio) => (radio.checked = false));
  } else {
    // Açınca eski preset seçili olsun
    presetRadios.forEach((radio) => {
      radio.checked = radio.value === currentPreset;
    });
  }
  updateUI();
  saveSettings();
  await sendSettingsToContentScript();
});

presetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  saveSettings();
  await sendSettingsToContentScript();
});

closeBtn.addEventListener('click', () => {
  window.close();
});

// Başlangıçta yükle
loadSettings();

// Send initial settings to content script when popup opens
setTimeout(async () => {
  await sendSettingsToContentScript();
  console.log('AmbientVibe: Initial settings sent to content script');
}, 100);
