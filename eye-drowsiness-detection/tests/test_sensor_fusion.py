import unittest

from drowsiness_pipeline.logic.sensor_fusion import calculate_fusion, parse_sensor_frame


class SensorFusionTests(unittest.TestCase):
    def test_uart_frame_and_three_channel_score(self):
        frame = parse_sensor_frame(b"F,7973,142,142,0,0,0\n")
        self.assertIsNotNone(frame)
        result = calculate_fusion(True, frame)
        self.assertAlmostEqual(result.score, 1.0)
        self.assertTrue(result.drowsy)
        self.assertTrue(result.ecg_flag)
        self.assertTrue(result.fsr_flag)

    def test_closed_eyes_with_both_hands_held_does_not_cross_threshold(self):
        frame = parse_sensor_frame(b"F,7197,3139,3106,1,1,1\n")
        self.assertIsNotNone(frame)
        result = calculate_fusion(True, frame)
        self.assertAlmostEqual(result.score, 0.5)
        self.assertFalse(result.drowsy)

    def test_weaker_ecg_channel_contributes_to_score(self):
        frame = parse_sensor_frame(b"F,7198,2400,2300,1,1,2\n")
        self.assertIsNotNone(frame)
        result = calculate_fusion(False, frame)
        self.assertAlmostEqual(result.score, 0.3)
        self.assertTrue(result.ecg_flag)
        self.assertFalse(result.fsr_flag)

    def test_invalid_frame_is_rejected(self):
        self.assertIsNone(parse_sensor_frame(b"F,1,142,142\n"))
        self.assertIsNone(parse_sensor_frame(b"F,1,4000,142,0,0,0\n"))
        self.assertIsNone(parse_sensor_frame(b"F,1,142,142,0,0,3\n"))


if __name__ == "__main__":
    unittest.main()
