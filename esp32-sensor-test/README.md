# WASPADA — uji lokal sensor ESP32

**Paket presentasi Arduino IDE:** default `TEST_MODE=3`, `OUTPUT_MODE=2`, 115200 baud.
Mode 3 membaca ECG dan FSR bersamaan. Output 2 mengirim satu baris berlabel
`ecg`, `off`, `FSR_L_mV`, `FSR_R_mV`. Monitor menampilkan keempat nilai;
hilangkan centang kedua seri FSR di Plotter agar grafik hanya ECG/off.
Monitor/Plotter menerima aliran yang sama; firmware tidak bisa mengirim teks
berbeda ke masing-masing panel. Jika IDE menolak membuka keduanya, gunakan
bergantian. Output 1 tetap menyediakan tampilan tuning FSR lengkap.
Untuk pengujian FSR saja, atur TEST_MODE=1 dan OUTPUT_MODE=1 seperti panduan awal.

Buka [panduan lengkap](PANDUAN_UJI.md), lalu buka `waspada_sensor_test/waspada_sensor_test.ino` menggunakan Arduino IDE 2. Simpan `.ino`, `config.h`, dan `sensor_types.h` dalam folder yang sama.

Tampilan tuning memakai **115200 baud**. Baca [panduan tuning terbaru](TUNING_FSR.md) untuk raw/avg/min/max/span, bar relatif, serta diagnosis kanal kiri/kanan. Pilihan mode dan threshold ada pada tab `config.h`. ECG diuji setelah pemeriksaan rangkaian/elektroda selesai.

Rangkaian saat ini menggunakan **breadboard**, dengan FSR dan AD8232 sama-sama terpasang. Kode dapat digunakan sebelum membuat PCB. Sensor boleh tetap terhubung; pemilihan mode hanya mengatur pembacaan software.

Target board: **ESP32 klasik / WROOM DevKit**, core **esp32 by Espressif Systems 3.3.4**. GPIO ECG=34, FSR kiri=32, FSR kanan=33, LO+=26, LO−=27.

Paket mencakup sampling berbasis timer, rata-rata FSR, hysteresis, penanda lepas 2 detik, lead-off, Serial Plotter, CSV opsional, dan counter kehilangan data. ECG masih mentah; HR/BPM, HRV, MQTT, dan integrasi Raspberry Pi belum termasuk tahap uji ini.

Gunakan [lembar catatan](CATATAN_UJI.csv) untuk hasil nyata dan baca [status verifikasi](VERIFIKASI.md). Saat copper ECG menyentuh tubuh, gunakan ketentuan daya baterai dan pemeriksaan proteksi elektroda pada panduan; mode FSR pada kode tidak memutus sambungan listrik AD8232.
