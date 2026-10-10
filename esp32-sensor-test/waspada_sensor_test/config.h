#pragma once

#include <stddef.h>
#include <stdint.h>

// UBAH DUA ANGKA INI, lalu upload ulang.
// TEST_MODE: 1 = FSR saja; 2 = ECG saja; 3 = FSR + ECG.
#ifndef TEST_MODE
#define TEST_MODE 1
#endif

// OUTPUT_MODE: 1 = Serial Monitor; 2 = Serial Plotter; 3 = CSV.
#ifndef OUTPUT_MODE
#define OUTPUT_MODE 1
#endif

// Pilih baud yang sama di Serial Monitor / Serial Plotter.
constexpr unsigned long SERIAL_BAUD = 115200;

// Tampilan tuning hanya untuk TEST_MODE=1 / OUTPUT_MODE=1.
constexpr bool FSR_TUNING_VIEW = true;
// Skala relatif 0..100%, BUKAN persen gaya atau satuan Newton.
// Ganti ZERO dengan mV saat tanpa genggaman, FULL dengan mV genggaman kuat.
// Jangan kalibrasi jika sensor belum merespons tekan/lepas.
constexpr int32_t FSR_LEFT_ZERO_MV = 150;
constexpr int32_t FSR_LEFT_FULL_MV = 3100;
constexpr int32_t FSR_RIGHT_ZERO_MV = 150;
constexpr int32_t FSR_RIGHT_FULL_MV = 3100;
static_assert(FSR_LEFT_FULL_MV > FSR_LEFT_ZERO_MV, "Range kiri FULL harus > ZERO");
static_assert(FSR_RIGHT_FULL_MV > FSR_RIGHT_ZERO_MV, "Range kanan FULL harus > ZERO");

// Nomor GPIO ESP32 klasik, bukan nomor urutan kaki board.
constexpr int PIN_ECG = 34;
constexpr int PIN_FSR_LEFT = 32;
constexpr int PIN_FSR_RIGHT = 33;
constexpr int PIN_LO_PLUS = 26;
constexpr int PIN_LO_MINUS = 27;

constexpr uint32_t ECG_PERIOD_US = 4000;    // Target 250 Hz.
// Khusus Plotter ECG: tampilkan paling sering setiap 20 ms (sekitar 50 Hz).
// Sampling tetap 250 Hz. Ini tampilan ringkas; detail puncak dapat terlewat.
// 4000 = detail penuh, 20000 = grafik sekitar 5 kali lebih lambat.
constexpr int64_t ECG_PLOT_INTERVAL_US = 20000;
static_assert(ECG_PLOT_INTERVAL_US >= ECG_PERIOD_US,
              "Interval plot harus >= periode sampling ECG");
constexpr uint32_t FSR_PERIOD_US = 20000;   // Target 50 Hz.
constexpr size_t FSR_AVERAGE_SAMPLES = 5;  // Sekitar 100 ms.

// ANGKA AWAL untuk pengujian, belum merupakan hasil kalibrasi pengguna.
// ON harus lebih besar daripada OFF. Ambang kiri/kanan boleh berbeda.
constexpr uint16_t FSR_LEFT_ON_MV = 800;
constexpr uint16_t FSR_LEFT_OFF_MV = 500;
constexpr uint16_t FSR_RIGHT_ON_MV = 800;
constexpr uint16_t FSR_RIGHT_OFF_MV = 500;
constexpr int64_t RELEASE_HOLD_US = 2000000;  // Lepas selama 2 detik.

constexpr int64_t MONITOR_INTERVAL_US = 500000; // Teks tampil 2 Hz.
constexpr size_t SAMPLE_QUEUE_LENGTH = 256;

static_assert(TEST_MODE >= 1 && TEST_MODE <= 3, "TEST_MODE harus 1, 2, atau 3");
static_assert(OUTPUT_MODE >= 1 && OUTPUT_MODE <= 3, "OUTPUT_MODE harus 1, 2, atau 3");
static_assert(FSR_AVERAGE_SAMPLES >= 1 && FSR_AVERAGE_SAMPLES <= 32,
              "Jumlah sampel average harus 1..32");
static_assert(FSR_LEFT_ON_MV > FSR_LEFT_OFF_MV, "Ambang kiri ON harus > OFF");
static_assert(FSR_RIGHT_ON_MV > FSR_RIGHT_OFF_MV, "Ambang kanan ON harus > OFF");
