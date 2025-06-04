# AmbientVibe

[![Get it on Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Live%20Extension-brightgreen?logo=googlechrome)](https://chromewebstore.google.com/detail/ambientvibe/menfohimagklbbmfcmhpfalgpjmijaij)

![Main Desing 01](images/Main%20Desing%2001.jpg)
![Main Desing 02](images/Main%20Desing%2002.jpg)
![Main Desing 03](images/Main%20Desing%2003.jpg)

**Modern Chrome extension that adds high-quality ambient reverb effects to web audio**

---

## 🎯 Purpose

AmbientVibe is an elegant and user-friendly Chrome extension that adds real-time reverb (ambiance) effects to music or videos playing on sites like YouTube, Spotify, SoundCloud, and more.

---

## 🚀 Features

- 🎚️ **Preset Selection:** Small Room, Large Room, Grand Hall, Lush Plate, Velvet Chamber
- 🌈 **Theme Support:** Dark (Spotify-style), Light, and Violet themes
- 🔊 **Reverb Intensity:** Adjustable effect intensity with percentage control
- 🟢 **ON/OFF Switch:** One-click activation/deactivation
- 💾 **Settings Storage:** All settings saved locally for persistence
- 🖥️ **Modern UI:** Responsive design with logo and elegant popup interface
- ⚡ **High Performance:** Optimized audio processing with professional-grade 48kHz audio context
- 🎵 **Production Quality:** Pure JavaScript implementation with high-quality impulse response

---

## 🛠️ Installation & Setup

### Prerequisites

- Google Chrome browser
- No additional software or dependencies required

### Step-by-Step Installation

1. **Download the Extension:**

   - Clone the repository or download as ZIP and extract to your desired location.

2. **Verify Required Files:**
   Ensure these essential files are present:

   - `manifest.json` (Extension configuration)
   - `audio/small-room.wav` (Impulse response)
   - `audio/large-room.wav` (Impulse response)
   - `audio/large-hall.wav` (Impulse response)
   - `audio/plate.wav` (Impulse response)
   - `audio/chamber.wav` (Impulse response)
   - `images/ambientvibe.png` (Extension icon)

3. **Load in Chrome:**

   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **"Developer mode"** (toggle in top right corner)
   - Click **"Load unpacked"** button
   - Select the AmbientVibe project folder
   - The extension will load and appear in your toolbar

4. **Verify Installation:**
   - Look for the AmbientVibe icon in your Chrome toolbar
   - Click the icon to open the control popup
   - If successful, you'll see the modern interface with all controls

---

## 🎮 How to Use

### Getting Started

1. Navigate to any audio/video website (YouTube, Spotify, SoundCloud, etc.)
2. Start playing music or video content
3. Click the AmbientVibe icon in your Chrome toolbar
4. The control popup will open with all available options

### Control Interface

#### 🟢 Main Power Switch

- ON/OFF Toggle: Master control to enable/disable all reverb effects
- Visual Feedback: Interface dims when disabled
- Instant Effect: Changes take effect immediately

#### 🎚️ Reverb Presets

Choose from 5 carefully crafted reverb environments:

- **Small Room** – Intimate, subtle reverb for close listening
- **Large Room** – Medium spatial reverb for general use
- **Grand Hall** – Grand, spacious reverb for classical or cinematic music
- **Lush Plate** – Smooth, musical plate reverb for vocals and instruments
- **Velvet Chamber** – Warm, ethereal reverb for relaxing music

#### 🔊 Intensity Control

- Fine-tune the reverb amount with the percentage slider (0-100%)
- Real-time adjustment – changes apply instantly without interruption
- Overrides preset values when manually adjusted

#### 🌈 Theme Selection

- Dark Theme (Default) – Spotify-inspired dark interface
- Light Theme – Clean, bright interface for daytime use
- Violet Theme – Stylish purple gradient theme

### Testing the Extension

#### ✅ Expected Behavior

- Immediate reverb effect when switched ON
- Clear audio difference between ON/OFF states
- Distinct characteristics when changing presets
- Smooth intensity changes with the slider
- Persistent settings that remember your preferences

#### 🔊 Audio Quality

- No pitch changes – only pure reverb added to original audio
- No audio artifacts or distortion
- High-quality processing at 48kHz professional sample rate
- Smooth transitions between settings without clicks or pops

---

## 📦 Project Structure

```
AmbientVibe/
├── manifest.json                 # Chrome extension manifest
├── audio/
│   ├── small-room.wav           # Impulse response
│   ├── large-room.wav           # Impulse response
│   ├── large-hall.wav           # Impulse response
│   ├── plate.wav                # Impulse response
│   └── chamber.wav              # Impulse response
├── content-scripts/
│   └── initialize.js            # Audio processing logic
├── popups/
│   └── main/
│       ├── main.html           # Extension popup interface
│       ├── main.js             # Popup behavior logic
│       └── main.css            # Modern styling with themes
├── images/
│   └── ambientvibe.png         # Extension icon
├── README.md                   # This documentation
└── PRODUCTION_CHECKLIST.md     # Quality assurance checklist
```

---

## 🎵 Technical Specifications

### Audio Processing

- Sample Rate: 48kHz (professional audio standard)
- Impulse Response: High-quality WAV format, mono channel
- Audio Engine: Web Audio API with convolution reverb
- Latency: Optimized for playback quality over low latency
- Effects: Pure ambient reverb only, no pitch or other artifacts

### Browser Compatibility

- Chrome Manifest V3 compliant
- Modern Chrome versions (90+)
- Cross-platform support (Windows, macOS, Linux)

### Performance

- Lightweight: Total package size ~2.3MB
- Efficient processing: Minimal CPU impact
- Memory optimized: Proper resource cleanup
- Background processing: No interference with browsing

---

## 🛠️ Troubleshooting

### Extension Not Loading

**Problem:** Extension fails to install in Chrome

**Solutions:**

1. Ensure Developer mode is enabled in `chrome://extensions/`
2. Check that all required files are present in the folder
3. Verify `manifest.json` is valid (no syntax errors)
4. Try refreshing the extensions page after loading

### No Reverb Effect Heard

**Problem:** Extension loads but no audio effect is audible

**Solutions:**

1. Check the ON/OFF switch – ensure it's in the ON position
2. Verify audio is playing on the webpage first
3. Try different websites or refresh the page
4. Check Chrome permissions if needed

---

## 📧 Support & Feedback

For questions, suggestions, or bug reports, please open an issue on the project repository.
