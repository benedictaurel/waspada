# Status teknis WASPADA

Status ini merangkum implementasi prototype dan pengujian yang sudah dilaporkan pengguna, per 7 November 2026. "Selesai untuk demo" tidak berarti perangkat tervalidasi untuk pemakaian jalan raya atau penggunaan medis.

## Selesai untuk demo stasioner

- ESP32 membaca dua FSR pada steering wheel, mengklasifikasikan genggaman, dan mengirim frame UART 115200 ke Raspberry Pi.
- Raspberry Pi membaca UART, menghitung EAR kamera dan weighted fusion, lalu mengirim telemetry MQTT ke dashboard.
- Bobot saat ini: EAR 0.50, kanal demo grip 0.30, FSR grip 0.20; alert saat score > 0.75.
- Kanal berlabel ECG adalah `fsr_demo_proxy`: gelombang/status demonstrasi yang diturunkan dari grip FSR, bukan pembacaan ECG atau detak jantung mandiri.
- Pengguna melaporkan uji UART kuat → lemah → lepas, uji MQTT mata terbuka/terpejam dengan tangan lepas, alert dashboard, serta getaran steering wheel. Log yang diarsipkan: `.codex-evidence/`.
- Empat unit test parser/fusion lulus: `python -m unittest discover -s tests -v`.

## Belum selesai / belum tervalidasi

- Perubahan source lokal harus dikomit dan dipush agar remote GitHub benar-benar sama.
- Firmware dan pipeline belum diverifikasi melalui uji stabilitas panjang setelah reboot dengan konfigurasi pameran final.
- Screenshot/log pengguna membuktikan demonstrasi terlapor, bukan keselamatan rangkaian, akurasi medis, atau keandalan kendaraan.
- Rangkaian elektroda/AD8232 dan isolasi listrik belum dinyatakan aman untuk ditempelkan ke tubuh. Jangan menyolder atau menguji elektroda pada tubuh sebelum ditinjau dan proteksi/isolasi dikonfirmasi.
- Paket firmware lain di `esp32-sensor-test/` mencakup sketch eksperimen ECG mentah terpisah; jangan samakan sketch itu dengan firmware FSR/UART demo yang menghasilkan `F,...` enam kolom.

## Sebelum hari pameran

1. Solder hanya rangkaian FSR/ESP32 yang terpisah dari elektroda, dengan daya dilepas dan inspeksi short-circuit setelahnya.
2. Lakukan rehearsal urutan nyala lengkap dan uji 10–15 menit: ESP32/UART, Raspberry Pi/kamera, MQTT/dashboard, laptop bridge/steering wheel.
3. Siapkan sumber daya stabil, kabel cadangan, command startup, dan satu checklist pemulihan jika Pi atau Wi-Fi restart.
4. Presentasikan kanal demo dengan provenance yang akurat; jangan menyebutnya sebagai hasil ECG terukur.
