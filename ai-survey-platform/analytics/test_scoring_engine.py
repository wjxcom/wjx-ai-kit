import unittest

from scoring_engine import score_from_json


class TestScoringEngine(unittest.TestCase):
    def test_high_quality(self):
        payload = {
            "answers": [
                {"question_id": "q1", "dimension": "completeness", "value": 1, "max_value": 1},
                {"question_id": "q2", "dimension": "consistency", "value": 1, "max_value": 1},
                {"question_id": "q3", "dimension": "validity", "value": 1, "max_value": 1},
            ]
        }
        result = score_from_json(payload)
        self.assertGreaterEqual(result["total_score"], 85)
        self.assertEqual(result["level"], "高质量")

    def test_medium_quality(self):
        payload = {
            "answers": [
                {"question_id": "q1", "dimension": "completeness", "value": 1, "max_value": 1},
                {"question_id": "q2", "dimension": "consistency", "value": 0.5, "max_value": 1},
                {"question_id": "q3", "dimension": "validity", "value": 0.5, "max_value": 1},
            ]
        }
        result = score_from_json(payload)
        self.assertGreaterEqual(result["total_score"], 60)
        self.assertLess(result["total_score"], 85)
        self.assertEqual(result["level"], "中等质量")

    def test_low_quality(self):
        payload = {
            "answers": [
                {"question_id": "q1", "dimension": "completeness", "value": 0, "max_value": 1},
                {"question_id": "q2", "dimension": "consistency", "value": 0, "max_value": 1},
                {"question_id": "q3", "dimension": "validity", "value": 0, "max_value": 1},
            ]
        }
        result = score_from_json(payload)
        self.assertLess(result["total_score"], 60)
        self.assertEqual(result["level"], "低质量")


if __name__ == "__main__":
    unittest.main()
