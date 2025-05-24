# AmbientVibe

![AmbientVibe Logo](images/logo.png)

**Web müziğine canlı reverb efekti ekleyen modern Chrome uzantısı**

---

## 🎯 Amaç

**AmbientVibe**, YouTube, Spotify, SoundCloud gibi sitelerde çalan müziğe veya videoya gerçek zamanlı reverb (ambiance) efekti eklemenizi sağlayan, şık ve kullanıcı dostu bir Chrome uzantısıdır.

---

## 🚀 Özellikler

- 🎚️ **Preset Seçimi:** Small Room, Large Room, Concert Hall, Ambient Wash, Moonlight Chamber
- 🌈 **Tema Desteği:** Koyu (Spotify), Açık ve Violet temalar
- 🔊 **Reverb Intensity:** Efekt şiddetini % olarak ayarlayabilme
- 🟢 **ON/OFF Switch:** Tek tıkla aktif/pasif etme
- 💾 **Ayar Saklama:** Tüm ayarlar localStorage'da tek obje olarak saklanır
- 🖥️ **Modern UI:** Responsive, logo ve başlık ile şık popup arayüzü
- ⚡ **Performanslı:** Tek bir AudioContext ve optimize edilmiş IR dosyası kullanımı

---

## 🖼️ Ekran Görüntüsü

![AmbientVibe Popup](docs/screenshot.png)

---

## 🛠️ Kurulum

1.  **Projeyi klonla veya indir:**
    ```sh
    git clone https://github.com/kullanici/ambientvibe.git
    ```
2.  **Gerekli dosyaları kontrol et:**
    - `audio/large-studio-room.wav` (Impulse Response dosyası)
    - `images/logo.png` (Logo)
3.  **Chrome'da yükle:**
    - `chrome://extensions` sayfasına git
    - `chrome://extensions` sayfasına git
    - Sağ üstten "Geliştirici Modu"nu aç
    - "Paketlenmemiş yükle" butonuna tıkla ve proje klasörünü seç

---

## 📦 Klasör Yapısı

```
extension-root/
├── manifest.json
├── audio/
│   └── large-studio-room.wav
├── content-scripts/
│   └── initialize.js
├── popups/
│   └── main/
│       ├── main.html
│       ├── main.js
│       └── main.css
├── themes/
│   ├── theme-dark.css
│   ├── theme-violet.css
│   └── theme-light.css
├── images/
│   └── logo.png
```

---

## 👨‍💻 Geliştirici Notları

- **Ayarlar**: Tüm kullanıcı tercihleri (preset, intensity, tema, on/off) localStorage'da `ambientVibeSettings` anahtarıyla obje olarak saklanır.
- **UI/UX**: Tüm switchler ve kartlar modern, temaya duyarlı ve erişilebilir şekilde tasarlanmıştır.
- **IR Dosyası**: `audio/large-studio-room.wav` dosyasını kendi reverb IR dosyanızla değiştirebilirsiniz.

---

## 📢 Katkı ve Lisans

Katkı sağlamak isterseniz PR gönderebilir veya issue açabilirsiniz.
MIT Lisansı ile dağıtılmaktadır.

---

AmbientVibe &mdash; Müzik dinleme deneyimini bir üst seviyeye taşı!
