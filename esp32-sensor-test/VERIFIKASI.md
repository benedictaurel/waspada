# Verifikasi firmware uji sensor

Versi gabungan terbaru: TEST_MODE=3 / OUTPUT_MODE=2 mengirim ecg, off,
FSR_L_mV, FSR_R_mV. Lolos kompilasi ESP32 core 3.3.12, target
esp32:esp32:esp32, --warnings all: flash 281160 byte, RAM statis 22220 byte,
tanpa peringatan compiler. Tampilan tuning mengabaikan frame sebelum sampel
FSR pertama agar nilai awal -1 tidak masuk min/max. Belum diuji hardware oleh Codex.
Pernyataan output Plotter mode 3 hanya ECG/off di catatan lama di bawah telah diganti.

Pemeriksaan terbaru paket Arduino IDE (10 Oktober 2026): TEST_MODE=3 /
OUTPUT_MODE=1 berhasil dikompilasi dengan core ESP32 3.3.12 yang terpasang
di Arduino IDE, target esp32:esp32:esp32, --warnings all.
Flash 282276 byte; RAM statis 22244 byte. Tidak ada upload oleh Codex.
TEST_MODE=3 / OUTPUT_MODE=2 juga berhasil dikompilasi pada core 3.3.12:
flash 281116 byte, RAM statis 22220 byte. Kedua kompilasi tanpa peringatan
yang dilaporkan compiler. Pengujian perangkat tetap dilakukan pengguna.
Catatan core 3.3.4 dan angka kompilasi di bawah merupakan riwayat versi awal.

Pembaruan tuning FSR: tampilan Monitor FSR sekarang memiliki raw/avg,
min/max/span sejak reset serta skala relatif ZERO/FULL dan bar ASCII.
Baud saat ini 115200. Hasil kompilasi di bawah adalah versi sebelum
pembaruan tampilan ini; tidak merupakan verifikasi kompilasi versi baru.
Plotter ECG kini dibatasi interval 20000 us tanpa mengubah sampling 4000 us.
Paket presentasi Arduino IDE memakai TEST_MODE=3 / OUTPUT_MODE=1 secara default.
Tuning FSR aktif juga pada mode 3; output Plotter mode 3 hanya ECG/off.
Lihat TUNING_FSR.md untuk konfigurasi terbaru. Belum diuji pada perangkat oleh Codex.

Tanggal: 10 Oktober 2026 (Asia/Jakarta).

Kompilasi nyata dilakukan menggunakan Arduino CLI 1.5.2-rc.1, core `esp32:esp32@3.3.4`, dan target `esp32:esp32:esp32` (ESP32 Dev Module), dengan `--warnings all`. Tidak ada upload ke perangkat.

| Konfigurasi | Hasil kompilasi | Flash program | RAM statis |
|---|---|---:|---:|
| TEST_MODE=1, OUTPUT_MODE=1 — FSR/Monitor (default) | Lolos | 293591 byte | 20960 byte |
| TEST_MODE=2, OUTPUT_MODE=2 — ECG/Plotter | Lolos | 291375 byte | 20896 byte |
| TEST_MODE=3, OUTPUT_MODE=3 — gabungan/CSV | Lolos | 292451 byte | 20896 byte |

Ketiga kompilasi selesai tanpa peringatan yang dilaporkan compiler. Batas flash partisi bawaan 1310720 byte; RAM statis maksimum yang dilaporkan 327680 byte. Angka RAM statis belum mencakup alokasi runtime, termasuk antrean dan stack task sampling.

Mode alternatif dikompilasi memakai override flag, sehingga `config.h` yang dikirim tetap **TEST_MODE=1 / OUTPUT_MODE=1**. Pada Arduino IDE, pengguna mengubah dua angka itu dan mengunggah ulang sesuai panduan.

Contoh reproduksi jika Arduino CLI dan core tersebut sudah terpasang:

```powershell
arduino-cli compile --fqbn esp32:esp32:esp32 --warnings all .\waspada_sensor_test
arduino-cli compile --fqbn esp32:esp32:esp32 --warnings all --build-property "compiler.cpp.extra_flags=-DTEST_MODE=2 -DOUTPUT_MODE=2" .\waspada_sensor_test
arduino-cli compile --fqbn esp32:esp32:esp32 --warnings all --build-property "compiler.cpp.extra_flags=-DTEST_MODE=3 -DOUTPUT_MODE=3" .\waspada_sensor_test
```

Pemeriksaan tambahan: konsistensi encoding UTF-8, whitespace, default mode, dan jumlah kolom CSV catatan (21 kolom, 13 skenario uji).

Kompilasi membuktikan kode dapat dibangun untuk target tersebut. **Belum ada pengukuran hardware:** tegangan, isolasi copper, kualitas kontak kulit, kestabilan sampling, respons FSR/lead-off, bentuk ECG, serta keamanan modul/proteksi elektroda masih perlu diuji pada rangkaian nyata. Counter `missed/drop=0` juga tidak membuktikan kualitas ECG atau menjamin seluruh data diterima aplikasi laptop; pencatatan CSV perlu memeriksa urutan dan timestamp.

Toolchain untuk pemeriksaan dipasang secara sementara di folder `tmp` proyek, terpisah dari instalasi Arduino pengguna. Paket yang dibagikan berisi source dan panduan, tanpa toolchain atau binary siap-flash.
