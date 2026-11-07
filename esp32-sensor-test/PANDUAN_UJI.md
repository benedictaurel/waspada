# Panduan uji ESP32, FSR, dan ECG WASPADA

Mulai dari **FSR saja melalui USB laptop**. Setelah FSR lolos, lanjutkan ECG, lalu gabungkan. Raspberry Pi dan MQTT digunakan pada tahap berikutnya, setelah data lokal benar.

Kondisi saat ini: **ESP32, kedua FSR, dan AD8232 dirangkai pada breadboard**; elektroda/FSR sudah dipasang di steering wheel. Pengujian tidak memerlukan PCB. Kedua jenis sensor boleh tetap terhubung ke breadboard selama sambungan dan daya benar. `TEST_MODE` memilih sensor yang dibaca software; tidak memutus daya sensor atau hubungan elektroda ke tubuh. PCB dibuat setelah pengujian berhasil.

Firmware ada di folder `waspada_sensor_test`. Buka `waspada_sensor_test.ino`; Arduino IDE juga akan membuka tab `config.h` dan `sensor_types.h`. Simpan ketiga file dalam folder yang sama. Yang perlu diubah selama pengujian hanya `config.h`.

## 1. Perangkat dan batas penggunaan

- ESP32 klasik / ESP32-WROOM DevKit 30 pin, sesuai peta pin tim hardware.
- AD8232, FSR kiri/kanan, resistor 10 kΩ dan kapasitor 100 nF per FSR.
- Laptop, kabel USB **data**, Arduino IDE 2, dan multimeter.
- Steering wheel dengan tiga bidang copper terpisah. Asumsi penamaan: LA kiri, RA dan RL kanan; periksa tulisan konektor/kabel kalian sebelum menggunakan asumsi ini.

Sketch menampilkan ECG mentah dalam mV. Sketch ini belum menghitung HR/BPM, RR, HRV, atau kantuk, dan belum mengirim MQTT. Gelombang yang bergerak atau `leads_off=0` bukan bukti bahwa ECG sudah berkualitas baik.

**Sebelum menyentuh copper yang terhubung ke AD8232:** gunakan sistem dengan daya baterai dan hindari hubungan ke listrik PLN. Jika USB terhubung ke laptop, lepaskan charger laptop serta periferal yang terhubung listrik PLN, termasuk sambungan ke Pi beradaptor. Jangan sambungkan osiloskop yang terhubung PLN ke rangkaian yang sedang menyentuh tubuh. Produsen merekomendasikan daya baterai untuk AD8232. Daya baterai sendiri tidak mensertifikasi keamanan modul atau kabel yang dimodifikasi. Rangkaian proteksi elektroda harus tetap utuh; pastikan bersama tim hardware apabila pemotongan kabel ikut membuang komponen proteksi.

Untuk tes FSR melalui permukaan copper, terapkan ketentuan yang sama jika copper masih terhubung ke AD8232. Jika memungkinkan, lepas konektor elektroda AD8232 selama tes FSR. **Memilih mode FSR pada kode tidak memutus sambungan listrik elektroda.**

## 2. Pemeriksaan rangkaian sebelum upload

### Pemeriksaan tanpa daya

1. Cabut USB dan seluruh sumber daya. Tidak ada tangan menyentuh copper.
2. Periksa salah sambung, solder yang menjembatani jalur, dan serabut kabel lepas.
3. Periksa tidak ada korsleting 3V3–GND. Kapasitor dapat membuat pembacaan resistansi berubah sesaat; jangan menilai hanya dari satu bunyi singkat continuity.
   Pada breadboard, rail panjang dapat terputus di tengah dan rail kiri/kanan belum tentu terhubung. Pastikan semua titik sensor benar-benar mendapat 3V3 dan GND yang sama; warna merah/biru hanya penanda. Jangan menjembatani 3V3 dan GND.
4. Untuk uji isolasi copper, idealnya lepaskan koneksi elektroda dari AD8232 agar rangkaian internal modul tidak ikut terbaca.
5. Ukur ujung kabel LA–copper LA, RA–copper RA, dan RL–copper RL: sambungan masing-masing harus baik dan resistansinya rendah.
6. Ukur antarcopper LA–RA, LA–RL, RA–RL: tidak boleh ada sambungan langsung. Lakukan tanpa menyentuh copper dengan tangan.
7. Periksa setiap copper terisolasi dari kedua jalur listrik FSR dan rangka logam setir yang dapat menyatukan elektroda.
8. Ulangi pemeriksaan sambil menekan lapisan setir dengan benda isolator. Pastikan tekanan tidak membuat serabut atau tepi copper menembus isolasi.

Jangan memakai continuity/ohmmeter saat rangkaian mendapat daya. Jika kabel elektroda tidak bisa dilepas, hasil pengukuran antarkabel dapat dipengaruhi resistor internal AD8232; minta tim hardware memeriksa jalurnya sebelum menyimpulkan ada korsleting atau aman.

### Peta koneksi yang dipakai sketch

| Sinyal | Sambungan |
|---|---|
| AD8232 OUTPUT | ESP32 GPIO34 |
| AD8232 LO+ | ESP32 GPIO26 |
| AD8232 LO− | ESP32 GPIO27 |
| AD8232 SDN | 3V3, mengikuti rancangan tim |
| AD8232 daya | 3V3 dan GND |
| Node FSR kiri | ESP32 GPIO32 |
| Node FSR kanan | ESP32 GPIO33 |
| Ground rangkaian | GND bersama |

Setiap FSR: `3V3 → FSR → node → resistor 10 kΩ → GND`. Kapasitor 100 nF dipasang node–GND, paralel dengan resistor. Sensor menggunakan 3,3 V. Jangan memberikan 5 V ke GPIO.

RL adalah elektroda yang terhubung ke rangkaian right-leg drive modul, **bukan kabel GND ESP32**. Jangan menghubungkan RL langsung ke RA/LA/GND. Untuk susunan kalian, kedua bidang kanan perlu tersentuh kulit secara terpisah tanpa disatukan oleh lapisan copper.

### Pemeriksaan dengan daya

1. Elektroda belum menyentuh tubuh. Hubungkan USB ESP32 ke laptop.
2. Gunakan mode voltmeter DC: probe hitam ke GND, probe merah ke rail sensor.
3. Pastikan rail sekitar 3,3 V. Jika terbaca 5 V, cabut daya dan perbaiki sambungan.
4. Pastikan tidak ada komponen panas atau reset berulang.
5. Jika node FSR mudah diakses, ukur terhadap GND: ditekan seharusnya meningkat, dilepas menurun. Jangan menjembatani dua pad dengan probe.

## 3. Persiapan Arduino IDE di Windows

1. Instal Arduino IDE 2 dari situs resmi Arduino.
   Unduh melalui [halaman Arduino Software](https://www.arduino.cc/en/software). Jika IDE 2 sudah terpasang, lanjutkan ke Boards Manager. PlatformIO, Python, aplikasi MQTT, dan pengaturan Raspberry Pi belum diperlukan untuk tes ini.
2. Buka **File → Preferences**. Pada **Additional Boards Manager URLs**, tambahkan:

   ```text
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```

3. Buka **Boards Manager**, cari **esp32 by Espressif Systems**. Panduan ini menggunakan versi **3.3.4** untuk hasil yang bisa direproduksi. Komponen tambahan seperti ArduinoJson atau pustaka MQTT belum diperlukan.
4. Hubungkan ESP32 menggunakan kabel USB data.
5. Pilih **Tools → Board → esp32 → ESP32 Dev Module**, jika board kalian memang ESP32 klasik/WROOM. Jumlah 30 pin saja belum memastikan tipe chip; periksa tulisan pada modul. Jangan memilih ESP32-C3/S3/S2 untuk peta pin ini.
6. Pilih **Tools → Port → COM...** milik ESP32. Cara mengenali: lihat port yang muncul setelah kabel dicolok.
7. Gunakan **Upload Speed 115200** untuk awal; ini berbeda dari baud Serial Monitor.
8. Pertahankan pengaturan lain bawaan board dahulu, kecuali spesifikasi board memerlukan perubahan.
9. Buka `waspada_sensor_test/waspada_sensor_test.ino` dari folder paket ini. Jangan hanya menyalin `.ino` tanpa kedua file `.h`.

Internet boleh digunakan untuk menginstal IDE/core. Tes pembacaan sensor berikut berjalan melalui USB dan tidak membutuhkan hotspot.

## 4. Memilih mode pengujian

Di tab `config.h`, dua bagian yang perlu diperhatikan adalah:

```cpp
#ifndef TEST_MODE
#define TEST_MODE 1
#endif

#ifndef OUTPUT_MODE
#define OUTPUT_MODE 1
#endif
```

Ubah angka di baris `#define`, simpan, lalu **upload ulang**. Mengedit file tanpa upload tidak mengubah program yang berjalan di ESP32.

| Angka TEST_MODE | Yang dibaca | Target sampling |
|---|---|---|
| 1 | FSR kiri/kanan | 50 Hz |
| 2 | ECG dan LO+/LO− | 250 Hz |
| 3 | ECG, LO+/LO−, FSR kiri/kanan | ECG 250 Hz, FSR 50 Hz |

| Angka OUTPUT_MODE | Penggunaan |
|---|---|
| 1 | Serial Monitor: ringkasan 2 kali/detik, status dan diagnostik |
| 2 | Serial Plotter: grafik pada setiap frame yang diambil |
| 3 | CSV: data setiap frame untuk pencatatan lanjutan |

Serial Monitor/Plotter harus menggunakan **115200 baud**. Sampling sensor tetap berjalan pada targetnya walaupun ringkasan hanya tampil dua kali/detik.

Pembaruan tampilan: default `FSR_TUNING_VIEW=true` menampilkan raw/avg/min/max/span dan bar relatif pada mode FSR/Monitor. Baca `TUNING_FSR.md`. Untuk mengikuti contoh ringkasan grip 0/1 di bawah, ubah `FSR_TUNING_VIEW=false` lalu upload. Plotter ECG menggunakan `ECG_PLOT_INTERVAL_US=20000` agar grafik sekitar lima kali lebih lambat, dengan sampling tetap 250 Hz; detail puncak dapat terlewat. Nilai 4000 menampilkan setiap frame yang diterima. Tombol STOP Plotter dapat dipakai sebelum screenshot.

Timer `esp_timer` membangunkan task sampling. ADC dan pemrosesan FSR dijalankan dalam task, bukan ISR. Antrean menampung hasil sebelum task utama mencetak melalui USB. Timestamp memakai waktu mikrodetik 64 bit. Ini target sampling berbasis timer; jitter, keterlambatan, atau kehilangan data masih harus diperiksa pada perangkat nyata.

## 5. Tes pertama: FSR melalui Serial Monitor

### Upload pertama

1. Pastikan `TEST_MODE 1` dan `OUTPUT_MODE 1`.
2. Klik **Verify** (tanda centang). Tunggu kompilasi selesai.
3. Klik **Upload** (panah kanan). Tunggu hingga selesai.
4. Jika berhenti pada `Connecting...`, tahan tombol **BOOT** saat proses menyambung, lalu lepaskan saat penulisan mulai. Jika diperlukan, ikuti petunjuk masuk download mode untuk board kalian. Jangan menghubungkan/mengubah kabel sensor saat daya menyala.
5. Buka **Tools → Serial Monitor**, pilih **115200 baud**.
6. Tekan tombol **EN/RESET** sekali jika perlu untuk melihat pesan awal.

Pesan awal berisi `WASPADA sensor test`, `TEST_MODE=1`, dan `OUTPUT_MODE=1`. Jika ringkasan FSR muncul, board, program, dan koneksi USB sudah bekerja. Ini belum membuktikan rangkaian FSR benar; lanjutkan pengujian respons di bawah.

### Arti tampilan

Contoh ilustrasi, bukan hasil pengukuran steering kalian:

```text
t=12.50s seq=599 L(raw/avg)=1430/1410mV R(raw/avg)=80/78mV gripL=1 gripR=0 lepasL_long=0 lepasR_long=1 ecg_Hz=0.0 fsr_Hz=50.0 dt_min/max=19950/20060us missed=0 drop=0
```

| Bagian | Arti |
|---|---|
| `L(raw/avg)` | Tegangan kiri langsung / rata-rata 5 pembacaan, dalam mV |
| `R(raw/avg)` | Tegangan kanan langsung / rata-rata 5 pembacaan |
| `gripL`, `gripR` | 1 = status menggenggam, 0 = tidak menggenggam menurut threshold awal |
| `lepasL_long`, `lepasR_long` | 1 = status tidak menggenggam sudah bertahan setidaknya 2 detik setelah filter |
| `ecg_Hz=0.0` | Normal pada mode FSR karena ECG tidak dibaca |
| `fsr_Hz` | Jumlah pembacaan FSR aktual per detik dalam interval laporan |
| `dt_min/max` | Interval terpendek/terpanjang antarpengambilan frame pada interval laporan |
| `missed` | Slot jadwal sampling yang dilewati, kumulatif sejak boot |
| `drop` | Frame yang gagal masuk antrean karena penuh, kumulatif sejak boot |

Setelah boot tanpa genggaman, `lepas_long` akan menjadi 1 setelah sekitar 2 detik. Itu normal. Flag ini **bukan** penilaian pengemudi mengantuk dan belum memicu apa pun.

### Urutan percobaan FSR

1. **Tanpa genggaman, 10 detik:** catat rentang `L_avg` dan `R_avg`.
2. **Tekan kiri saja, 5 detik:** kiri harus meningkat; kanan tidak ikut meningkat besar secara konsisten tanpa tekanan di kanan.
3. **Lepaskan kiri, 5 detik:** nilai kembali mendekati baseline. Coba 5 kali.
4. **Tekan kanan saja, 5 detik:** ulangi seperti kiri.
5. **Genggam keduanya, 10 detik:** kedua nilai meningkat.
6. **Tekan ringan → normal → lebih kuat:** amati kecenderungan nilai meningkat. FSR tidak linear dan belum menghasilkan satuan gaya/newton.
7. **Genggam, lepas sekitar 0,5 detik, genggam lagi:** `grip` dapat berubah, tetapi `lepas_long` seharusnya tidak sempat menjadi 1.
8. **Genggam, lalu lepas lebih dari 2 detik:** `lepas_long` berubah menjadi 1 setelah sekitar 2 detik ditambah respons filter dan waktu tampilan.
9. Jalankan minimal **1 menit**. Target `fsr_Hz` mendekati 50 dan `missed=0 drop=0` tetap. Ringkasan pendek dapat sedikit berfluktuasi. Jika counter meningkat atau laju terus jauh dari target, selesaikan masalah sebelum lanjut.

Tekan melalui lapisan copper/isolasi yang akan dipakai saat penggunaan. Lapisan tape yang terlalu menekan FSR dapat membuat baseline tinggi; lapisan yang kaku atau kurang menyalurkan tekanan dapat membuat respons kecil.

ADC ESP32 memiliki batas akurasi, terutama dekat 0 V dan batas atas. Nilai idle tidak wajib tepat 0 mV, dan tekanan kuat dapat mencapai batas pembacaan. Jangan menganggap angka di luar ekspektasi sebagai gaya yang terkalibrasi.

### Melihat grafik FSR

1. Ubah `OUTPUT_MODE` menjadi `2`; `TEST_MODE` tetap `1`. Upload ulang.
2. Tutup Serial Monitor, lalu buka **Tools → Serial Plotter**.
3. Pilih **115200 baud**.
4. Tampil empat kurva: `L_raw`, `L_avg`, `R_raw`, `R_avg`, semuanya dalam mV.
5. Tekan kiri dan kanan bergantian. Kurva `avg` seharusnya lebih halus dan sedikit tertunda dibanding `raw`.

Serial Plotter Arduino menampilkan urutan sampel di sumbu horizontal; jangan langsung menganggap angka sumbu itu sebagai detik.

## 6. Kalibrasi threshold FSR sederhana

Lakukan untuk kiri dan kanan secara terpisah setelah respons analog benar. Nilai bawaan ON=800 mV dan OFF=500 mV hanyalah contoh awal.

1. Catat rentang nilai rata-rata ketika dilepas dalam kondisi lapisan steering sudah final.
2. Catat rentang nilai saat genggaman paling ringan yang masih ingin dianggap "memegang".
3. Jika kedua rentang bertumpuk besar, perbaiki pemasangan/penyaluran tekanan dahulu. Memilih threshold saja tidak dapat memisahkan kondisi yang tidak terpisah datanya.
4. Pilih OFF di atas baseline lepas dan ON di atas OFF, dengan keduanya berada di celah antara kondisi lepas dan genggam.
5. Ubah nilai kiri/kanan berikut di `config.h`, lalu upload ulang:

   ```cpp
   constexpr uint16_t FSR_LEFT_ON_MV = 800;
   constexpr uint16_t FSR_LEFT_OFF_MV = 500;
   constexpr uint16_t FSR_RIGHT_ON_MV = 800;
   constexpr uint16_t FSR_RIGHT_OFF_MV = 500;
   ```

Contoh ilustrasi: lepas 60–150 mV, genggam ringan 1100–1500 mV. ON=800 dan OFF=500 mV mungkin bisa menjadi titik awal. Gunakan hasil steering kalian, bukan contoh ini sebagai patokan pasti.

Status mengikuti nilai rata-rata: `>= ON` menjadi genggam; `<= OFF` menjadi lepas; di antaranya mempertahankan status sebelumnya. Rata-rata 5 sampel menambahkan respons sekitar puluhan hingga 100 ms. Setelah status lepas kontinu 2 detik, `lepas_long=1`. Jeda pembacaan FSR yang panjang mereset filter dan pembuktian lepas kontinu.

## 7. Tes kedua: ECG dan lead-off

Mulai setelah pemeriksaan elektroda/proteksi dan ketentuan daya baterai terpenuhi. Untuk percobaan awal, steering diam dan pengguna duduk santai. Hindari mengencangkan otot atau menggenggam terlalu kuat.

### Periksa LO+/LO− melalui Serial Monitor

1. Ubah `TEST_MODE` menjadi `2`, `OUTPUT_MODE` menjadi `1`. Upload ulang.
2. Buka Serial Monitor pada **115200 baud**.
3. Tanpa kontak tangan, amati `LO+`, `LO-`, dan `leads_off`. Pada rangkaian lead-off yang sesuai, kontak input terlepas seharusnya ditandai.
4. Letakkan tangan kiri pada LA dan tangan kanan pada RA serta RL. Ketiganya harus menyentuh kulit; RL yang hanya ditempel pada setir tanpa tersentuh bukan kontak tubuh.
5. Tunggu beberapa detik agar sinyal pulih setelah kontak berubah. Amati apakah `leads_off` menjadi 0.
6. Lepaskan kontak LA saja, lalu RA saja, masing-masing beberapa detik. Amati respons `LO+`/`LO-`; jangan mengasumsikan label LO pasti cocok dengan nama tangan tanpa memeriksa rangkaian modul.
7. RL bukan input yang dipantau sebagai kanal LO terpisah. Jangan menggunakan LO+/LO− saja untuk menyatakan kontak RL baik.

`leads_off=1` berarti setidaknya salah satu LO HIGH. Sketch tetap mencetak ECG mentah untuk diagnosis, tetapi data itu tidak boleh digunakan untuk menghitung detak. `near_rail=1` berarti nilai saat itu <=150 atau >=3100 mV: ini petunjuk untuk memeriksa clipping/kontak, bukan diagnosis penyebab pasti.

Target pada mode ini: `ecg_Hz` mendekati 250, `fsr_Hz=0`, dan `dt_min/max` sekitar 4000 us. Jitter kecil bisa terjadi. `missed` dan `drop` harus diperiksa, bukan diabaikan karena grafik tampak lancar.

### Lihat gelombang ECG

1. Tetap `TEST_MODE 2`, ubah `OUTPUT_MODE` menjadi `2`. Upload ulang.
2. Tutup Serial Monitor; buka Serial Plotter pada **115200 baud**.
3. Ada dua kurva: `ecg` dalam mV, dan `off` sebagai penanda.
4. `off=0` berarti LO+/LO− tidak menandai lepas; `off=3300` berarti lead-off. Angka 3300 untuk kurva `off` hanya skala visual, **bukan tegangan yang diukur**.
5. Dengan kedua tangan diam, tunggu sampai gelombang stabil. Cari puncak tajam berulang yang konsisten. Baseline bisa berada di sekitar tengah suplai, tetapi baseline sekitar 1650 mV saja tidak membuktikan ECG berhasil.
6. Lepas dan pasang kembali kontak; amati perubahan flag dan proses pemulihan gelombang.
7. Setelah kondisi diam cukup baik, ubah tekanan genggaman perlahan, lalu gerakkan setir sedikit. Catat seberapa besar gelombang terganggu.

Copper dan kulit kering dapat menghasilkan kontak yang berubah-ubah. Gerakan, otot tangan, dan gangguan listrik juga dapat menghasilkan puncak. Jangan menganggap semua puncak sebagai R-peak. Mode uji ini sengaja belum menambahkan filter ECG agar masalah kontak/kejenuhan dapat terlihat.

Jika gelombang sulit diperoleh, pembanding terbaik adalah modul dan elektroda standar yang utuh, jika tersedia, menggunakan pemasangan sesuai panduan produsen dan ketentuan daya yang sama. Ini membantu membedakan masalah modul/pembacaan dengan masalah elektroda copper di setir. Jangan melepas RL atau mengubah rangkaian menjadi dua elektroda tanpa menyesuaikan konfigurasi AD8232 berdasarkan skematik modul.

## 8. Tes ketiga: ECG dan FSR bersamaan

1. Ubah `TEST_MODE 3`, `OUTPUT_MODE 1`. Upload ulang.
2. Buka Serial Monitor pada 115200 baud.
3. Jalankan 2 menit pada kondisi diam, lalu 1 menit dengan perubahan genggaman/gerakan ringan.
4. Periksa `ecg_Hz` mendekati 250 dan `fsr_Hz` mendekati 50, tidak ada reboot, `missed=0 drop=0` tetap.
5. Periksa FSR kiri/kanan masih merespons masing-masing tangan.
6. Periksa ECG dan lead-off tidak dianggap valid hanya karena FSR menyatakan tangan menggenggam. FSR mendeteksi tekanan; kontak elektrik ECG merupakan kondisi berbeda.
7. Untuk presentasi Arduino IDE pada TEST_MODE=3: OUTPUT_MODE=1 dengan FSR_TUNING_VIEW=true menampilkan tuning FSR lengkap; OUTPUT_MODE=2 mengirim ecg, off, FSR_L_mV, FSR_R_mV dalam satu baris berlabel. Monitor menampilkan semua nilai; hilangkan centang FSR_L_mV dan FSR_R_mV pada Plotter untuk grafik ECG/off saja. Jika daftar label tidak muat, gunakan panah di samping legenda. Kedua panel menerima aliran yang sama, bukan data terpisah. Bila IDE menolak akses port bersamaan, gunakan bergantian.
8. Pada grafik bersama, FSR ditahan pada nilai terbaru di antara pembacaan 50 Hz. Plotter dibatasi oleh ECG_PLOT_INTERVAL_US=20000 (sekitar maksimal 50 baris/detik); sampling ECG tetap 250 Hz.
9. Kembali ke Monitor untuk memeriksa counter setelah perubahan format. Setiap upload/reset mengulang counter dari nol.

Untuk kebutuhan HRV berikutnya, validasi kualitas R-peak dan interval RR masih diperlukan. Lolos tes sambungan dan grafik awal tidak otomatis berarti data siap dipakai untuk HRV atau klasifikasi kantuk.

## 9. CSV untuk pencatatan lanjutan (opsional)

`OUTPUT_MODE 3` menghasilkan satu baris header CSV lalu data setiap frame. Gunakan terminal serial yang dapat menyimpan data ke file, atau rekam pada tahap pengembangan berikutnya. Tutup Serial Monitor/Plotter sebelum aplikasi lain membuka port yang sama.

Untuk CSV dengan ECG 250 Hz, baud 115200 mungkin tidak cukup membawa seluruh baris panjang. Naikkan SERIAL_BAUD dan baud aplikasi penerima (misalnya 460800), periksa kestabilan serial serta missed/drop. Pembatasan interval Plotter tidak membatasi CSV. Mode CSV ini belum diuji pada perangkat.

Kolom: `seq, ts_us, ecg_mv, lo_plus, lo_minus, fsrL_raw_mv, fsrR_raw_mv, fsrL_avg_mv, fsrR_avg_mv, gripL, gripR, offL_long, offR_long, fsr_age_us, dt_us, missed_slots, queue_drops`.

- `seq`: nomor slot frame dari nol. Mode FSR memakai slot 20 ms; mode ECG/gabungan memakai slot 4 ms. Celah urutan perlu diperiksa.
- `ts_us`: timestamp aktual awal pembacaan frame sejak inisialisasi timer sistem; bukan jam kalender atau waktu Pi.
- `dt_us`: selisih timestamp frame; frame pertama 0.
- Nilai sensor yang dinonaktifkan atau belum tersedia ditulis `-1`; boolean untuk sensor yang tidak aktif tetap 0, sehingga mode pengujian harus ikut dicatat.
- `fsr_age_us`: umur pembacaan FSR terhadap frame ECG, dibatasi nol ketika FSR baru diambil sedikit setelah timestamp ECG. Nilai `-1` berarti FSR belum tersedia. Dua FSR dan ECG dibaca berurutan, bukan persis simultan.
- `missed_slots`: slot jadwal yang tidak diambil. Callback terlambat tidak diisi dengan sampel buatan.
- `queue_drops`: frame yang tidak masuk antrean karena penuh. Nilai terbaru terbawa pada frame berikutnya yang berhasil masuk antrean.
- Lead-off harus digunakan untuk menandai sampel tidak valid. Data raw tetap dicatat untuk diagnosis.

## 10. Jika hasilnya bermasalah

| Gejala | Yang diperiksa lebih dahulu |
|---|---|
| Port COM tidak muncul | Kabel data, port USB, Device Manager, dan driver bridge USB–UART sesuai chip board |
| Upload gagal saat `Connecting...` | Board/COM, tutup aplikasi serial lain, tombol BOOT, kecepatan upload 115200 |
| `sensor_types.h` / `config.h` tidak ditemukan | Ketiga file harus dalam folder `waspada_sensor_test` yang sama |
| Pesan target ESP32 salah | Periksa chip sebenarnya dan pilihan board; kode ini untuk ESP32 klasik |
| Teks acak | Baud Monitor harus 115200; teks boot singkat dapat memakai baud berbeda |
| Tidak muncul data setelah upload | Buka port yang benar, tekan EN, cek mode output dan pesan ERROR |
| FSR selalu rendah saat ditekan | 3V3, sambungan FSR, node GPIO32/33, kabel putus, tekanan benar-benar mencapai FSR |
| FSR selalu tinggi | Short ke 3V3, resistor 10 kΩ ke GND putus, tape memberi tekanan permanen |
| Tekan kiri, nilai kanan yang naik | Kabel kiri/kanan tertukar atau pemetaan posisi berbeda |
| Kedua nilai ikut berubah besar | Jalur tersambung, ground buruk, atau tekanan mekanik menyebar ke kedua FSR |
| Nilai FSR mendatar saat sangat kuat | Kemungkinan batas ADC/pembagi; kurangi tekanan, bandingkan dengan multimeter |
| `grip=0` padahal nilai naik | Threshold belum sesuai; nilai analog dan kalibrasi diperiksa dulu |
| ECG selalu lead-off | Kontak RA/LA/RL, isolasi di atas copper, sambungan kabel–copper, SDN/daya, pin LO |
| LO normal tetapi ECG buruk | Kontak RL, gerakan/otot, kontinuitas copper, saturasi, catu daya, referensi dan noise |
| ECG datar atau sering dekat batas | Salah GPIO, OUTPUT putus, short antarelektroda, kontak tidak baik, tegangan modul |
| Grafik bergerak tanpa tangan | Input terbuka/noise dapat bergerak; itu bukan bukti ECG berhasil |
| `missed` naik | Task sampling terlambat; cek reset/beban tambahan, gunakan firmware asli tanpa penambahan print di sampler |
| `drop` naik | Pengiriman/output tertahan; cek baud dan koneksi USB, coba mode Monitor |
| Reset/brownout berulang | Suplai, kabel USB, short rangkaian, sambungan ground; matikan daya jika ada komponen panas |

## 11. Catatan hasil dan keputusan lanjut

Salin atau isi `CATATAN_UJI.csv`. Kolom rentang dapat diisi seperti `60-150`. Angka contoh dalam panduan bukan data hasil tes.

Selesaikan tahap lokal jika:

- Rangkaian daya dan isolasi elektroda sudah diperiksa.
- Dua FSR merespons secara konsisten setelah seluruh lapisan steering dipasang.
- Threshold dapat membedakan lepas dan genggam dengan cukup stabil.
- Respons LO terhadap kontak sudah diperiksa dan gelombang saat diam dapat dinilai.
- Gabungan sensor berjalan pada target laju tanpa loss/reboot yang belum dijelaskan.

Sesudah itu, tambahkan Wi-Fi/MQTT bertahap: ESP32, Pi, dan laptop pada hotspot HP yang sama; broker lokal di Pi; kirim status FSR dahulu, kemudian batch ECG. Ulangi pemeriksaan laju, timestamp, urutan, dan loss ketika Wi-Fi aktif. Firmware uji ini belum melaksanakan tahap MQTT.

## Sumber teknis

- [Instalasi Arduino ESP32](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html)
- [ADC dan analogReadMilliVolts](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html)
- [ESP Timer: callback singkat dan pekerjaan melalui task](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/esp_timer.html)
- [AD8232: daya baterai dan batas penggunaan](https://www.sparkfun.com/sparkfun-single-lead-heart-rate-monitor-ad8232.html)
- [AD8232: right-leg drive dan konfigurasi elektroda](https://www.analog.com/media/en/technical-documentation/data-sheets/AD8232.pdf)
- [Panduan pemasangan dan troubleshooting AD8232](https://learn.sparkfun.com/tutorials/ad8232-heart-rate-monitor-hookup-guide/all)

Status kompilasi dan batas verifikasi dicatat terpisah dalam `VERIFIKASI.md`.
