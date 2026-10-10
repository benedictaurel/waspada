#pragma once

#include <stddef.h>
#include <stdint.h>
#include "config.h"

// Semua state pemrosesan hanya diakses oleh task sampling.
class MovingAverage {
 public:
  void reset() {
    count_ = 0;
    cursor_ = 0;
    sum_ = 0;
  }

  uint16_t update(uint16_t value) {
    if (count_ < FSR_AVERAGE_SAMPLES) {
      ++count_;
    } else {
      sum_ -= values_[cursor_];
    }
    values_[cursor_] = value;
    sum_ += value;
    cursor_ = (cursor_ + 1) % FSR_AVERAGE_SAMPLES;
    return static_cast<uint16_t>(sum_ / count_);
  }

 private:
  uint16_t values_[FSR_AVERAGE_SAMPLES]{};
  size_t count_ = 0;
  size_t cursor_ = 0;
  uint32_t sum_ = 0;
};

class GripTracker {
 public:
  void reset() {
    gripping = false;
    releasedLong = false;
    offSinceUs_ = -1;
  }

  void update(uint16_t value, int64_t nowUs, uint16_t onMv, uint16_t offMv) {
    if (value >= onMv) {
      gripping = true;
    } else if (value <= offMv) {
      gripping = false;
    }
    // Di antara ON dan OFF, pertahankan status sebelumnya (hysteresis).
    if (gripping) {
      offSinceUs_ = -1;
      releasedLong = false;
    } else {
      if (offSinceUs_ < 0) offSinceUs_ = nowUs;
      releasedLong = nowUs - offSinceUs_ >= RELEASE_HOLD_US;
    }
  }

  bool gripping = false;
  bool releasedLong = false;

 private:
  int64_t offSinceUs_ = -1;
};

struct SensorFrame {
  uint64_t seq = 0;
  int64_t tsUs = 0;
  int64_t fsrTsUs = 0;
  uint32_t dtUs = 0;
  int32_t ecgMv = -1;
  int32_t loPlus = -1;
  int32_t loMinus = -1;
  int32_t fsrLeftRawMv = -1;
  int32_t fsrRightRawMv = -1;
  int32_t fsrLeftAvgMv = -1;
  int32_t fsrRightAvgMv = -1;
  bool gripLeft = false;
  bool gripRight = false;
  bool offLeftLong = false;
  bool offRightLong = false;
  uint32_t ecgSamples = 0;
  uint32_t fsrSamples = 0;
  uint32_t missedSlots = 0;
  uint32_t queueDrops = 0;
};
