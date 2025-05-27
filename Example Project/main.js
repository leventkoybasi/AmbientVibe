(function () {
  'use strict';

  {
    Promise.resolve().then(function () { return analytics; });
  }

  const GUMROAD_PRODUCT_ID = 'wkv8pA33JKzo8MO7OLibfQ==';
  const LICENSE_KEY_STORAGE_KEY = 'licenseKey';
  const SUBSCRIPTION_ID_STORAGE_KEY = 'subscriptionId';
  const DEFAULT_SETTINGS_STORAGE_KEY = 'defaultSettings';
  const SPEED_SLIDER_GUIDE_STATE_STORAGE_KEY = 'speedSliderGuideState';
  const REVERB_SLIDER_GUIDE_STATE_STORAGE_KEY = 'reverbSliderGuideState';
  const CUSTOM_PRESETS_STORAGE_KEY = 'customPresets';
  const DISMISSED_NOTIFICATIONS_STORAGE_KEY = 'dismissedNotifications';
  // If the license key was validated, don't bother trying to revalidate it
  // for this amount of time.
  const VALIDATION_EFFECTIVE_TIME_MS = 6 * 60 * 60 * 1000; // 6 hours
  // If the license key was validated, we'll consider it active for this amount of time
  // unless we can prove it's now inactive by fetching it again.
  const MAX_NO_REVALIDATION_TIME_MS = 24 * 60 * 60 * 1000; // One day

  const PRESETS = {
    slowedandreverb: {
      playbackRate: 0.8,
      reverbWetMix: 0.4,
      preservesPitch: false,
    },
    nightcore: {
      playbackRate: 1.2,
      reverbWetMix: 0,
      preservesPitch: false,
    },
    off: {
      playbackRate: 1,
      reverbWetMix: 0,
      preservesPitch: false,
    },
  };

  const nearestStep = (value, step) =>
    step ? Math.round(value / step) * step : value;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const saveLicenseKey = (licenseKey) =>
    chrome.storage.sync
      .set({
        [LICENSE_KEY_STORAGE_KEY]: {
          licenseKey,
          validationTimestamp: Date.now(),
        },
      })
      .then(() => true)
      .catch(() => false);

  const getLicenseKey = () =>
    chrome.storage.sync
      .get([LICENSE_KEY_STORAGE_KEY])
      .then((results) => results[LICENSE_KEY_STORAGE_KEY] || {})
      .catch(() => {});

  const clearLicenseAndSubscriptionId = () => {
    chrome.storage.sync
      .remove([LICENSE_KEY_STORAGE_KEY, SUBSCRIPTION_ID_STORAGE_KEY])
      .then(() => true)
      .catch(() => false);
  };

  const saveSubscriptionId = (subscriptionId) =>
    chrome.storage.sync
      .set({
        [SUBSCRIPTION_ID_STORAGE_KEY]: subscriptionId,
      })
      .then(() => true)
      .catch(() => false);

  const saveSubscriptionIdIfExists = (subscriptionId) =>
    subscriptionId ? saveSubscriptionId(subscriptionId) : Promise.resolve(false);

  const getSubscriptionId = () =>
    chrome.storage.sync
      .get([SUBSCRIPTION_ID_STORAGE_KEY])
      .then((results) => results[SUBSCRIPTION_ID_STORAGE_KEY])
      .catch(() => undefined);

  const getDefaultSettings = () =>
    chrome.storage.sync
      .get([DEFAULT_SETTINGS_STORAGE_KEY])
      .then(
        (results) =>
          results[DEFAULT_SETTINGS_STORAGE_KEY] || PRESETS.slowedandreverb
      )
      .catch(() => PRESETS.slowedandreverb);

  const setDefaultSettings = (newSettings) =>
    chrome.storage.sync
      .set({
        [DEFAULT_SETTINGS_STORAGE_KEY]: newSettings,
      })
      .then(() => true)
      .catch(() => false);

  const saveSpeedGuideState = (state) =>
    chrome.storage.local
      .set({
        [SPEED_SLIDER_GUIDE_STATE_STORAGE_KEY]: state,
      })
      .then(() => true)
      .catch(() => false);

  const saveReverbGuideState = (state) =>
    chrome.storage.local
      .set({
        [REVERB_SLIDER_GUIDE_STATE_STORAGE_KEY]: state,
      })
      .then(() => true)
      .catch(() => false);

  const getCustomPresets = () =>
    chrome.storage.local
      .get([CUSTOM_PRESETS_STORAGE_KEY])
      .then((results) => results[CUSTOM_PRESETS_STORAGE_KEY] || [])
      .catch(() => []);

  const saveCustomPresets = (newCustomPresets) =>
    chrome.storage.local
      .set({ [CUSTOM_PRESETS_STORAGE_KEY]: newCustomPresets })
      .then(() => true)
      .catch(() => false);

  const getGuideStates = () =>
    chrome.storage.local
      .get([
        SPEED_SLIDER_GUIDE_STATE_STORAGE_KEY,
        REVERB_SLIDER_GUIDE_STATE_STORAGE_KEY,
      ])
      .then((results) =>
        // Interpret undefined values as true
        Object.fromEntries(
          [
            SPEED_SLIDER_GUIDE_STATE_STORAGE_KEY,
            REVERB_SLIDER_GUIDE_STATE_STORAGE_KEY,
          ].map((key) =>
            typeof results[key] === 'boolean' ? [key, results[key]] : [key, true]
          )
        )
      )
      .catch(() => ({
        [SPEED_SLIDER_GUIDE_STATE_STORAGE_KEY]: true,
        [REVERB_SLIDER_GUIDE_STATE_STORAGE_KEY]: true,
      }));

  const getDismissedNotifications = () =>
    chrome.storage.sync
      .get([DISMISSED_NOTIFICATIONS_STORAGE_KEY])
      .then((results) => results[DISMISSED_NOTIFICATIONS_STORAGE_KEY] || []);

  const recordNotificationDismissed = (notificationId) =>
    getDismissedNotifications().then((dismissedNotifications) =>
      chrome.storage.sync.set({
        [DISMISSED_NOTIFICATIONS_STORAGE_KEY]: Array.from(
          new Set([...dismissedNotifications, notificationId])
        ),
      })
    );

  const getCurrentTab = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    return tab;
  };

  const setBadgeText = ({ tabId, text }) => {
    if (chrome.badgeAction) {
      chrome.badgeAction.setBadgeText({ tabId, text });
    } else if (chrome.action) {
      chrome.action.setBadgeText({ tabId, text });
    }
  };

  const setContent = (contentId) => {
    Array.from(document.getElementsByClassName('content')).forEach(
      (contentEl) => {
        contentEl.style.display = contentId === contentEl.id ? '' : 'none';
      }
    );
    if (contentId === 'upgrader') {
      document.body.classList.add('is-upgrading');
      document.getElementById('header-remixer-link').href =
        'https://slowedandreverb.studio/pro';
    } else {
      document.body.classList.remove('is-upgrading');
      if (!isPro) {
        document.getElementById('header-remixer-link').href =
          'https://slowedandreverb.studio';
      }
    }
  };

  let isPro = false;
  let isDomLoaded = false;
  const setProMessage = (message, shouldShowCta = false) => {
    const _setMessage = () => {
      const element = document.getElementById('pro-message');
      element.innerText = message;
      element.style.display = message ? 'block' : 'none';
      document.getElementById('pro-cta').style.display = shouldShowCta
        ? 'block'
        : 'none';
    };
    if (isDomLoaded) {
      _setMessage();
      return;
    }
    document.addEventListener('DOMContentLoaded', _setMessage);
  };

  const setLicenseKeyWarningMessage = (message) => {
    const element = document.getElementById('license-key-warning');
    element.innerText = message;
    element.style.display = message ? 'block' : 'none';
  };

  const setLicenseKeyInputValue = (licenseKey) => {
    const _setValue = () => {
      const inputElement = document.getElementById('license-key-input');
      inputElement.value = licenseKey && licenseKey.toString();
      handleLicenseKeyInput({ target: inputElement });
    };
    if (isDomLoaded) {
      _setValue();
      return;
    }
    document.addEventListener('DOMContentLoaded', _setValue);
  };

  const enableManageSubscription = (subscriptionId) => {
    if (!subscriptionId) {
      return;
    }
    Array.from(
      document.getElementsByClassName('manage-subscription-link')
    ).forEach((linkElement) => {
      linkElement.href = `https://app.gumroad.com/subscriptions/${subscriptionId}/manage`;
      linkElement.style.display = 'block';
    });
  };

  const checkInitializationStatus = async (tabId) => {
    try {
      const response = await chrome.tabs.sendMessage(tabId, 'status-check');
      return response;
    } catch (error) {
      // Nothing listening; probably not initialized
      return false;
    }
  };

  const updatePlaybackRateDisplay = (newPlaybackRate) => {
    const playbackRateLabel = document.getElementById('speed-label');
    playbackRateLabel.innerText = `Speed (${Math.round(newPlaybackRate * 100) / 100}x)`;
    setSliderValue('speed-slider', newPlaybackRate - 0.5);
  };

  const updateReverbWetMixDisplay = (newReverbWetMix) => {
    const reverbWetMixLabel = document.getElementById('reverb-label');
    reverbWetMixLabel.innerText = `Reverb (${Math.round(newReverbWetMix * 100)}%)`;
    setSliderValue('reverb-slider', newReverbWetMix);
  };

  const updatePreservesPitchDisplay = (
    preservesPitch,
    elapsedPreviewTimeMs = 0
  ) => {
    const preservesPitchCheckboxEl = document.getElementById(
      'preserve-pitch-checkbox'
    );
    preservesPitchCheckboxEl.checked = preservesPitch;
    const isPreviewing = !isPro && preservesPitch;
    document.getElementById('preserve-pitch-preview-warning').style.display =
      isPreviewing ? 'flex' : 'none';
    document.getElementById(
      'preserve-pitch-preview-animation'
    ).style.animationDelay = `-${elapsedPreviewTimeMs}ms`;
  };

  const emphasizeCallToAction = () => {
    const proCtaButton = document.getElementById('pro-cta');
    proCtaButton.classList.remove('button--cta--emphasized');
    proCtaButton.scrollIntoView();
    setTimeout(() => {
      document.getElementById('pro-cta').classList.add('button--cta--emphasized');
    }, 0);
  };

  const handleLicenseKeyInput = (event) => {
    if (!event || !event.target) {
      return;
    }
    const unlockButton = document.getElementById('submit-key-button');
    const clearButton = document.getElementById('license-key-input-clear-button');
    const hasKeyValue =
      typeof event.target.value === 'string' &&
      event.target.value.trim().length > 0;
    unlockButton.ariaDisabled = !hasKeyValue;
    if (hasKeyValue) {
      unlockButton.classList.remove('button--is-disabled');
      clearButton.style.display = 'block';
    } else {
      unlockButton.classList.add('button--is-disabled');
      clearButton.style.display = 'none';
    }
  };

  const isBeforeExpiryDate = (date) => {
    if (!date) {
      return true;
    }
    const expiryTimestamp = new Date(date).valueOf();
    if (Number.isNaN(expiryTimestamp)) {
      return true;
    }
    return Date.now() < expiryTimestamp;
  };

  // Returns null if something went wrong fetching the license
  const fetchLicense = async (licenseKey) => {
    try {
      const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: GUMROAD_PRODUCT_ID,
          license_key: licenseKey,
        }),
      });
      const license = await response.json();
      return license;
    } catch (error) {
      return null;
    }
  };

  const isLicenseActive = (license) =>
    Boolean(
      license &&
        license.success &&
        license.purchase &&
        [
          license.purchase.subscription_ended_at,
          license.purchase.subscription_cancelled_at,
          license.purchase.subscription_failed_at,
        ].every((dateString) => isBeforeExpiryDate(dateString))
    );

  const initialProStatusPromise = getLicenseKey().then(
    ({ licenseKey, validationTimestamp } = {}) => {
      if (!licenseKey) {
        return false;
      }
      if (isDomLoaded) {
        document.getElementById('upgrader').classList.add('is-entering-key');
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          document.getElementById('upgrader').classList.add('is-entering-key');
        });
      }
      const currentTimestamp = Date.now();
      if (currentTimestamp - validationTimestamp < VALIDATION_EFFECTIVE_TIME_MS) {
        // We'll just assume it's sill valid but maybe recheck it in the background if it's been a bit
        if (currentTimestamp - validationTimestamp < 60 * 60 * 1000) {
          return true;
        }
        // Try to validate it in the background
        fetchLicense(licenseKey).then((license) => {
          if (!isLicenseActive(license)) {
            // We'll just ignore this for now.
            // Eventually it must be revalidated.
            return;
          }
          saveLicenseKey(licenseKey);
          saveSubscriptionIdIfExists(license.purchase.subscription_id);
        });
        return true;
      }
      setLicenseKeyInputValue(licenseKey);
      setProMessage('Checking license key...');
      return fetchLicense(licenseKey).then((license) => {
        const isActive = isLicenseActive(license);
        if (isActive) {
          return Promise.all([
            saveLicenseKey(licenseKey),
            saveSubscriptionIdIfExists(license.purchase.subscription_id),
          ]).then(() => true);
        }
        if (
          currentTimestamp - validationTimestamp <
          MAX_NO_REVALIDATION_TIME_MS
        ) {
          // We didn't validate it this time but we did recently
          return true;
        }
        setProMessage('', true);
        return false;
      });
    }
  );

  const setSliderValue = (sliderId, percent) => {
    const sliderEl = document.getElementById(sliderId);
    const [fillEl] = sliderEl.getElementsByClassName('slider__fill');
    const [handleEl] = sliderEl.getElementsByClassName('slider__handle');
    fillEl.style.width = `${percent * 100}%`;
    handleEl.style.left = `${percent * 100}%`;
  };

  const setSliderGuideState = (sliderId, isActive) => {
    const toggleButtonEl = document.getElementById(
      `toggle-${sliderId}-guides-button`
    );
    if (isActive) {
      toggleButtonEl.classList.add('button--icon--is-active');
    } else {
      toggleButtonEl.classList.remove('button--icon--is-active');
    }
    const sliderEl = document.getElementById(`${sliderId}-slider`);
    const [stepsEl] = sliderEl.getElementsByClassName('slider__steps');
    stepsEl.style.display = isActive ? 'block' : 'none';
    if (sliderId === 'speed') {
      saveSpeedGuideState(isActive);
    } else if (sliderId === 'reverb') {
      saveReverbGuideState(isActive);
    }
  };

  const storedGuideStatePromise = getGuideStates();
  const storedDefaultSettingsPromise = getDefaultSettings();
  const storedPresetsPromise = getCustomPresets();
  const storedSubscriptionIdPromise = getSubscriptionId();

  let customPresets = [];

  const createCustomPresetElements = (preset) => {
    const presetButtonEl = document.createElement('button');
    presetButtonEl.setAttribute('type', 'button');
    presetButtonEl.classList.add('preset');
    presetButtonEl.innerText = preset.name;
    const editButtonEl = document.createElement('button');
    editButtonEl.setAttribute('type', 'button');
    editButtonEl.classList.add(
      'preset__button',
      'preset__button--right',
      'button--icon'
    );
    const xmlns = 'http://www.w3.org/2000/svg';
    const svgEl = document.createElementNS(xmlns, 'svg');
    svgEl.setAttributeNS(null, 'height', '24');
    svgEl.setAttributeNS(null, 'width', '24');
    svgEl.setAttributeNS(null, 'viewBox', '0 -960 960 960');
    svgEl.setAttributeNS(null, 'fill', 'currentColor');
    const svgElPath = document.createElementNS(xmlns, 'path');
    svgElPath.setAttributeNS(
      null,
      'd',
      'M200-200h57l391-391-57-57-391 391v57Zm-40 80q-17 0-28.5-11.5T120-160v-97q0-16 6-30.5t17-25.5l505-504q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L313-143q-11 11-25.5 17t-30.5 6h-97Zm600-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z'
    );
    svgEl.append(svgElPath);
    editButtonEl.append(svgEl);
    return [presetButtonEl, editButtonEl];
  };

  const activatePro = () => {
    isPro = true;
    document.body.classList.add('is-pro');
    Array.from(document.getElementsByClassName('site-remixer-link')).forEach(
      (element) => {
        element.href = 'https://slowedandreverb.studio/pro';
      }
    );
    storedGuideStatePromise.then((states) => {
      setSliderGuideState('speed', states[SPEED_SLIDER_GUIDE_STATE_STORAGE_KEY]);
      setSliderGuideState(
        'reverb',
        states[REVERB_SLIDER_GUIDE_STATE_STORAGE_KEY]
      );
    });
    storedSubscriptionIdPromise.then((subscriptionId) => {
      enableManageSubscription(subscriptionId);
    });
    document.getElementById('pro-cta').style.display = 'none';
    ['button--locked', 'button--icon--locked'].forEach((className) =>
      Array.from(document.getElementsByClassName(className)).forEach((element) =>
        element.classList.remove(className)
      )
    );
    document.getElementById('preserve-pitch-preview-warning').style.display =
      'none';
    setProMessage('');
  };

  const settings = {
    playbackRate: 0.8,
    reverbWetMix: 0.4,
    preservesPitch: false,
  };

  document.addEventListener('DOMContentLoaded', async () => {
    isDomLoaded = true;
    initialProStatusPromise.then((isActive) => {
      if (isActive) {
        activatePro();
      }
    });

    storedSubscriptionIdPromise.then((subscriptionId) => {
      enableManageSubscription(subscriptionId);
    });

    const currentTab = await getCurrentTab();
    const tabId = currentTab && currentTab.id;
    if (!tabId) {
      return;
    }
    let status = await checkInitializationStatus(tabId);
    let wasInitialized = false;
    if (!status) {
      wasInitialized = true;
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['/content-scripts/initialize.js'],
      });
      status = await checkInitializationStatus(tabId);
    }
    const hasMediaElements = status.mediaElementCount > 0;
    if (hasMediaElements) {
      settings.playbackRate = status.playbackRate;
      settings.reverbWetMix = status.reverbWetMix;
      settings.preservesPitch = status.preservesPitch;
      updatePlaybackRateDisplay(status.playbackRate);
      updateReverbWetMixDisplay(status.reverbWetMix);
      updatePreservesPitchDisplay(
        status.preservesPitch,
        status.elapsedPitchPreviewTimeMs
      );
      document.getElementById('reverb-capture-warning').style.display =
        status.mediaElementCount > status.capturableMediaElementCount
          ? 'block'
          : 'none';
      ['controls', 'presets', 'storage'].forEach((id) => {
        document.getElementById(id).classList.remove('unused');
      });
    } else {
      ['controls', 'presets', 'storage'].forEach((id) => {
        document.getElementById(id).classList.add('unused');
      });
    }

    setBadgeText({ tabId, text: hasMediaElements ? 'ON' : '' });
    document.getElementById('no-media-warning').style.display = hasMediaElements
      ? 'none'
      : 'block';

    const port = chrome.tabs.connect(tabId);

    initialProStatusPromise.then((isActive) => {
      port.postMessage({
        type: 'update',
        isPro: isActive,
      });
    });

    const updatePlaybackRate = (newPlaybackRate) => {
      settings.playbackRate = newPlaybackRate;
      updatePlaybackRateDisplay(newPlaybackRate);
      port.postMessage({
        type: 'update',
        playbackRate: newPlaybackRate,
      });
    };

    const updateReverbWetMix = (newReverbWetMix) => {
      settings.reverbWetMix = newReverbWetMix;
      updateReverbWetMixDisplay(newReverbWetMix);
      port.postMessage({
        type: 'update',
        reverbWetMix: newReverbWetMix,
      });
    };

    const updatePreservesPitch = (preservesPitch) => {
      settings.preservesPitch = preservesPitch;
      updatePreservesPitchDisplay(preservesPitch);
      port.postMessage({
        type: 'update',
        preservesPitch,
      });
    };

    port.onMessage.addListener(({ preservesPitch }) => {
      if (typeof preservesPitch === 'boolean') {
        updatePreservesPitch(preservesPitch);
      }
    });

    Promise.all([initialProStatusPromise, storedDefaultSettingsPromise]).then(
      async ([isActive, defaultSettings]) => {
        if (!isActive || !wasInitialized || !defaultSettings) {
          return;
        }
        updatePlaybackRate(defaultSettings.playbackRate);
        updateReverbWetMix(defaultSettings.reverbWetMix);
        updatePreservesPitch(defaultSettings.preservesPitch);
      }
    );

    ['slowedandreverb', 'nightcore', 'off'].forEach((presetId) => {
      const preset = PRESETS[presetId];
      document
        .getElementById(`${presetId}-preset-button`)
        .addEventListener('click', () => {
          updatePlaybackRate(preset.playbackRate);
          updateReverbWetMix(preset.reverbWetMix);
          updatePreservesPitch(preset.preservesPitch);
        });
    });

    const insertCustomPreset = (preset) => {
      const listEl = document.getElementById('preset-list');
      const presetEditorEl = document.getElementById('preset-editor');
      const presetEl = document.createElement('li');
      presetEl.classList.add('preset-container--has-right-button');
      const [presetButtonEl, editPresetButtonEl] =
        createCustomPresetElements(preset);
      presetEl.append(presetButtonEl, editPresetButtonEl);
      presetButtonEl.addEventListener('click', () => {
        updatePlaybackRate(preset.playbackRate);
        updateReverbWetMix(preset.reverbWetMix);
        updatePreservesPitch(preset.preservesPitch);
      });
      editPresetButtonEl.lastChild.addEventListener('click', () => {
        const keyEl = document.getElementById('preset-editor__key');
        if (keyEl.value) {
          const previousEditingPreset = customPresets.find(
            ({ key }) => key === keyEl.value
          );
          insertCustomPreset(previousEditingPreset);
        }
        document.getElementById('preset-editor__key').value = preset.key;
        updatePlaybackRate(preset.playbackRate);
        updateReverbWetMix(preset.reverbWetMix);
        updatePreservesPitch(preset.preservesPitch);
        listEl.removeChild(presetEl);
        document.getElementById('preset-editor__input').value = preset.name;
        document.getElementById('add-preset-button').style.display = 'none';
        presetEditorEl.style.display = 'block';
        document.getElementById('controls').classList.add('controls--is-editing');
      });
      listEl.insertBefore(presetEl, presetEditorEl);
    };

    Promise.all([initialProStatusPromise, storedPresetsPromise]).then(
      ([isActive, storedPresets]) => {
        if (!isActive) {
          return;
        }
        customPresets = storedPresets;
        customPresets.forEach((preset) => {
          insertCustomPreset(preset);
        });
      }
    );

    ['speed', 'reverb'].forEach((guideToggleButtonId) => {
      const toggleButtonEl = document.getElementById(
        `toggle-${guideToggleButtonId}-guides-button`
      );
      toggleButtonEl.addEventListener('click', () => {
        if (!isPro) {
          emphasizeCallToAction();
          return;
        }
        const isActive = toggleButtonEl.classList.contains(
          'button--icon--is-active'
        );
        setSliderGuideState(guideToggleButtonId, !isActive);
      });
    });

    ['speed', 'reverb'].forEach((sliderId) => {
      const sliderEl = document.getElementById(`${sliderId}-slider`);
      const [trackEl] = sliderEl.getElementsByClassName('slider__track');
      const [stepsEl] = sliderEl.getElementsByClassName('slider__steps');
      const [handleEl] = sliderEl.getElementsByClassName('slider__handle');
      const min = sliderId === 'speed' ? 0.5 : 0;
      const max = sliderId === 'speed' ? 1.5 : 1;

      const updateValueFromPointerEvent = (event) => {
        const step = stepsEl.style.display === 'none' ? 0.01 : 0.05;
        const { x, width } = trackEl.getBoundingClientRect();
        const xPercent = clamp((event.clientX - x) / width, 0, 1);
        const newValue = nearestStep(xPercent * (max - min) + min, step);
        if (sliderId === 'speed') {
          updatePlaybackRate(newValue);
        } else if (sliderId === 'reverb') {
          updateReverbWetMix(newValue);
        }
      };
      sliderEl.addEventListener('pointerdown', (event) => {
        sliderEl.setPointerCapture(event.pointerId);
        updateValueFromPointerEvent(event);
      });
      sliderEl.addEventListener('pointerup', (event) => {
        sliderEl.releasePointerCapture(event.pointerId);
      });
      sliderEl.addEventListener('pointermove', (event) => {
        if (sliderEl.hasPointerCapture(event.pointerId)) {
          updateValueFromPointerEvent(event);
        }
      });
      handleEl.addEventListener('dragstart', (event) => {
        event.preventDefault();
      });
    });

    const preservePitchCheckboxEl = document.getElementById(
      'preserve-pitch-checkbox'
    );
    preservePitchCheckboxEl.addEventListener('change', (event) => {
      updatePreservesPitch(event.target.checked);
      if (!isPro && event.target.checked) {
        emphasizeCallToAction();
      }
    });

    const presetEditorEl = document.getElementById('preset-editor');
    const addPresetButtonEl = document.getElementById('add-preset-button');

    addPresetButtonEl.addEventListener('click', () => {
      if (!isPro) {
        emphasizeCallToAction();
        return;
      }
      document.getElementById('preset-editor__input').value = '';
      document.getElementById('preset-editor__key').value = '';
      addPresetButtonEl.style.display = 'none';
      presetEditorEl.style.display = 'block';
      document.getElementById('controls').classList.add('controls--is-editing');
    });

    document
      .getElementById('preset-editor__save')
      .addEventListener('click', () => {
        const name = document.getElementById('preset-editor__input').value;
        if (!name || !name.trim()) {
          return;
        }
        const keyEl = document.getElementById('preset-editor__key');
        const key = keyEl.value || crypto.randomUUID();
        customPresets = customPresets.filter((preset) => preset.key !== key);
        const preset = {
          name,
          key,
          ...settings,
        };
        customPresets.push(preset);
        saveCustomPresets(customPresets).then(() => {
          insertCustomPreset(preset);
          addPresetButtonEl.style.display = 'block';
          presetEditorEl.style.display = 'none';
          keyEl.value = '';
          document
            .getElementById('controls')
            .classList.remove('controls--is-editing');
        });
      });

    document
      .getElementById('preset-editor__delete')
      .addEventListener('click', () => {
        addPresetButtonEl.style.display = 'block';
        presetEditorEl.style.display = 'none';
        document
          .getElementById('controls')
          .classList.remove('controls--is-editing');
        const keyEl = document.getElementById('preset-editor__key');
        if (!keyEl.value) {
          return;
        }
        customPresets = customPresets.filter(
          (preset) => preset.key !== keyEl.value
        );
        saveCustomPresets(customPresets).then(() => {
          addPresetButtonEl.style.display = 'block';
          presetEditorEl.style.display = 'none';
          keyEl.value = '';
        });
      });

    document
      .getElementById(`save-global-settings-button`)
      .addEventListener('click', () => {
        if (!isPro) {
          emphasizeCallToAction();
          return;
        }
        setDefaultSettings(settings);
      });

    document
      .getElementById(`clear-global-settings-button`)
      .addEventListener('click', () => {
        if (!isPro) {
          emphasizeCallToAction();
          return;
        }
        setDefaultSettings(null);
      });

    Array.from(document.getElementsByClassName('checkout-start-link')).forEach(
      (linkElement) => {
        const href = linkElement.getAttribute('href');
        const url = new URL(href);
        url.searchParams.set('referrer', "https://browserextension.slowedandreverb.studio");
        linkElement.setAttribute('href', decodeURIComponent(url.toString()));
      }
    );

    Array.from(document.getElementsByClassName('notification')).forEach(
      (notificationElement) => {
        Array.from(
          notificationElement.getElementsByClassName('notification__dismiss')
        ).forEach((buttonElement) => {
          buttonElement.addEventListener('click', () => {
            notificationElement.classList.remove('notification--is-shown');
            recordNotificationDismissed(notificationElement.id);
          });
        });
      }
    );

    if (new Date() < new Date('2024-10-01')) {
      getDismissedNotifications().then((notificationIds) => {
        if (!notificationIds.includes('firefox-released')) {
          document
            .getElementById('firefox-released')
            .classList.add('notification--is-shown');
        }
      });
    }

    document.getElementById('pro-cta').addEventListener('click', () => {
      setContent('upgrader');
    });

    document
      .getElementById('license-key-input')
      .addEventListener('input', handleLicenseKeyInput);

    document.getElementById('submit-key-button').addEventListener('click', () => {
      setLicenseKeyWarningMessage('');
      const licenseKeyInput = document.getElementById('license-key-input');
      const licenseKey =
        typeof licenseKeyInput.value === 'string' &&
        licenseKeyInput.value
          .trim()
          .split(' ')
          .filter((char) => char)
          .join('')
          .toUpperCase();
      licenseKeyInput.value = licenseKey;
      if (!licenseKey) {
        return;
      }
      const exampleKey = 'ABCD1234-E5F6G7H8-9012IJKL-3M4N5O6P';
      if (licenseKeyInput.validity.patternMismatch) {
        setLicenseKeyWarningMessage(
          `Sorry, that doesn't look like a license key. License keys look like this:\n${exampleKey}`
        );
        return;
      }
      if (licenseKey === exampleKey) {
        setLicenseKeyWarningMessage(
          "lmao, nice try. You'll need to get your own license key."
        );
        return;
      }
      const spinner = document.getElementById('submit-key-button__progress');
      spinner.style.display = 'inline';
      fetchLicense(licenseKey)
        .then((license) => {
          const isActive = isLicenseActive(license);
          const subscriptionId =
            license && license.purchase && license.purchase.subscription_id;
          if (subscriptionId) {
            enableManageSubscription(license.purchase.subscription_id);
            if (!isActive) {
              setLicenseKeyWarningMessage('This license key has expired.');
              return;
            }
          }
          if (!isActive) {
            setLicenseKeyWarningMessage(
              "Sorry, we couldn't verify that license key. If it's new, please try again in a few minutes. If you purchased this key but can't unlock Pro features, send an email to support@slowedandreverb.studio."
            );
            return;
          }
          activatePro();
          setContent('configuration');
          saveLicenseKey(licenseKey);
          saveSubscriptionIdIfExists(license.purchase.subscription_id);
        })
        .catch((err) => {
          console.error(err);
          setLicenseKeyWarningMessage(
            "We're having trouble validating your license key. Please ensure you have access the internet from this device or try again in a few minutes."
          );
        })
        .finally(() => {
          spinner.style.display = 'none';
        });
    });

    document.getElementById('back-button').addEventListener('click', () => {
      setContent('configuration');
    });

    document.getElementById('enter-key-button').addEventListener('click', () => {
      document.getElementById('upgrader').classList.add('is-entering-key');
    });

    document
      .getElementById('license-key-input-clear-button')
      .addEventListener('click', () => {
        const inputElement = document.getElementById('license-key-input');
        inputElement.value = '';
        handleLicenseKeyInput({ target: inputElement });
        clearLicenseAndSubscriptionId();
        setLicenseKeyWarningMessage('');
        Array.from(
          document.getElementsByClassName('manage-subscription-link')
        ).forEach((linkElement) => {
          linkElement.style.display = 'none';
        });
      });
  });

  const ANALYTICS_ENDPOINT =
    'https://uounkdlleuaodzckcrba6ltkui0wvblj.lambda-url.us-east-2.on.aws/';

  const sendAnalyticsEvents = (events) => {
    fetch(ANALYTICS_ENDPOINT, {
      mode: 'no-cors',
      method: 'POST',
      keepAlive: true,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'source@version': [
          'slowedandreverb.studio-browser-extension',
          "0.3.1",
        ].join('@'),
        events,
      }),
    }).catch((err) => {
      // Oh well
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('pro-cta').addEventListener('click', () => {
      sendAnalyticsEvents([{ name: 'upgrade' }]);
    });
  });

  var analytics = /*#__PURE__*/Object.freeze({
    __proto__: null
  });

})();
