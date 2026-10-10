# WASPADA — uji lokal sensor ESP32

Buka [panduan lengkap](PANDUAN_UJI.md), lalu buka `waspada_sensor_test/waspada_sensor_test.ino` menggunakan Arduino IDE 2. Simpan `.ino`, `config.h`, dan `sensor_types.h` dalam folder yang sama.

Default sudah disetel untuk **FSR saja + Serial Monitor**, pada **115200 baud** dengan tampilan tuning kontinu. Baca [panduan tuning terbaru](TUNING_FSR.md) untuk raw/avg/min/max/span, bar relatif, serta diagnosis kanal kiri/kanan. Pilihan mode dan threshold ada pada tab `config.h`. ECG diuji setelah FSR dan pemeriksaan rangkaian/elektroda selesai.

Rangkaian saat ini menggunakan **breadboard**, dengan FSR dan AD8232 sama-sama terpasang. Kode dapat digunakan sebelum membuat PCB. Sensor boleh tetap terhubung; pemilihan mode hanya mengatur pembacaan software.

Target board: **ESP32 klasik / WROOM DevKit**, core **esp32 by Espressif Systems 3.3.4**. GPIO ECG=34, FSR kiri=32, FSR kanan=33, LO+=26, LO−=27.

Paket mencakup sampling berbasis timer, rata-rata FSR, hysteresis, penanda lepas 2 detik, lead-off, Serial Plotter, CSV opsional, dan counter kehilangan data. ECG masih mentah; HR/BPM, HRV, MQTT, dan integrasi Raspberry Pi belum termasuk tahap uji ini.

Gunakan [lembar catatan](CATATAN_UJI.csv) untuk hasil nyata dan baca [status verifikasi](VERIFIKASI.md). Saat copper ECG menyentuh tubuh, gunakan ketentuan daya baterai dan pemeriksaan proteksi elektroda pada panduan; mode FSR pada kode tidak memutus sambungan listrik AD8232.
