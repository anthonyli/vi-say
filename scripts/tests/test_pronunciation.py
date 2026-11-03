import contextlib
from copy import deepcopy
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pronunciation import check_listening, digest, main, prepare


class PronunciationSampleTests(unittest.TestCase):
    def run_cli(self, text, lexicon):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            text_path, lexicon_path, output = base / 'script.txt', base / 'lexicon.json', base / 'preflight'
            text_path.write_text(text, encoding='utf-8')
            lexicon_path.write_text(json.dumps(lexicon), encoding='utf-8')
            stdout = io.StringIO()
            with patch.object(sys, 'argv', ['pronunciation.py', '--text', str(text_path),
                                           '--lexicon', str(lexicon_path), '--output-dir', str(output)]):
                with contextlib.redirect_stdout(stdout):
                    status = main()
            return (status, json.loads(stdout.getvalue()),
                    json.loads((output / 'pronunciation.json').read_text()),
                    (output / 'sample.txt').read_text(), (output / 'spoken.txt').read_text())

    def test_cli_sample_covers_terms_after_the_fifth_sentence(self):
        terms = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta']
        sentences = [f'完整介绍 {term} 的用途。' for term in terms]
        text = ''.join(sentences)
        status, stdout, plan, sample, spoken = self.run_cli(
            text, {term: {'spoken': term} for term in terms})
        self.assertEqual(status, 0)
        self.assertEqual(sample.splitlines(), sentences)
        self.assertEqual(plan['sample_covered_terms'], terms)
        self.assertEqual(plan['sample_uncovered_terms'], [])
        self.assertTrue(plan['sample_coverage_complete'])
        self.assertEqual(stdout['sample_covered_terms'], terms)
        self.assertEqual(stdout['sample_uncovered_terms'], [])
        self.assertEqual(spoken, text)

    def test_greedy_sample_keeps_a_whole_sentence_and_avoids_redundant_tests(self):
        text = '先介绍 Alpha。再介绍 Beta。实际把 Alpha 和 Beta 一起使用。'
        plan = prepare(text, {'Alpha': {'spoken': '阿尔法'}, 'Beta': {'spoken': '贝塔'}})
        self.assertEqual(plan['sample_text'], '实际把 阿尔法 和 贝塔 一起使用。')
        self.assertEqual(plan['sample_covered_terms'], ['Alpha', 'Beta'])

    def test_same_spoken_alias_does_not_claim_coverage_of_another_source_term(self):
        plan = prepare('先介绍 Alpha。再介绍 Beta。',
                       {'Alpha': {'spoken': '组件'}, 'Beta': {'spoken': '组件'}})
        self.assertEqual(plan['sample_text'].splitlines(), ['先介绍 组件。', '再介绍 组件。'])
        self.assertEqual(plan['sample_covered_terms'], ['Alpha', 'Beta'])

    def test_uncoverable_cross_sentence_term_is_reported_without_audio_claims(self):
        status, stdout, plan, sample, spoken = self.run_cli(
            'Alpha\nBeta。', {'Alpha\nBeta': {'spoken': '组合'}})
        self.assertEqual(status, 1)
        self.assertEqual(spoken, '组合。')
        self.assertTrue(plan['ready_for_synthesis'])  # existing text-only field
        self.assertFalse(plan['sample_coverage_complete'])
        self.assertEqual(plan['sample_uncovered_terms'], ['Alpha\nBeta'])
        self.assertEqual(stdout['sample_uncovered_terms'], ['Alpha\nBeta'])
        self.assertFalse(stdout['pronunciation_verified'])
        self.assertTrue(stdout['listening_required'])

    def test_notes_are_documentation_and_readiness_is_only_text_coverage(self):
        status, stdout, plan, sample, spoken = self.run_cli(
            '用 CSS 导出 JSON。',
            {'CSS': {'spoken': 'CSS', 'notes': '按字母名读，保持连贯'},
             'JSON': {'spoken': 'JSON', 'notes': '本备注不是音素控制'}})
        self.assertEqual(status, 0)
        self.assertEqual(spoken, '用 CSS 导出 JSON。')
        for record in (stdout, plan):
            self.assertTrue(record['ready_for_synthesis'])
            self.assertEqual(record['ready_for_synthesis_scope'], 'text_coverage_only')
            self.assertEqual(record['notes_usage'], 'documentation_only_not_tts_phoneme_or_ssml_control')
            self.assertFalse(record['pronunciation_verified'])
            self.assertTrue(record['listening_required'])

    def test_replacements_keep_original_context_longest_terms_and_word_boundaries(self):
        text = 'PageOn、Page 和 MAIL 用 AI，AIBrand 原样。'
        plan = prepare(text, {'PageOn': {'spoken': 'PageOn'}, 'Page': {'spoken': '页面'},
                              'AI': {'spoken': '人工智能'}})
        self.assertEqual(plan['spoken_text'], 'PageOn、页面 和 MAIL 用 人工智能，AIBrand 原样。')
        self.assertEqual(plan['sample_text'], plan['spoken_text'])
        self.assertEqual([row['term'] for row in plan['terms']], ['PageOn', 'Page', 'AI'])
        self.assertEqual(plan['unresolved_terms'], ['AIBrand', 'MAIL'])
        self.assertFalse(plan['ready_for_synthesis'])

    def test_no_terms_still_offers_complete_original_sentences_for_a_voice_test(self):
        plan = prepare('第一句中文。第二句中文。第三句中文。', {})
        self.assertEqual(plan['sample_text'], '第一句中文。\n第二句中文。')
        self.assertEqual(plan['sample_covered_terms'], [])
        self.assertEqual(plan['sample_uncovered_terms'], [])
        self.assertTrue(plan['sample_coverage_complete'])
        self.assertFalse(plan['pronunciation_verified'])


class ListeningChecksTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.base = Path(temporary.name)
        self.audio = self.base / 'audio.wav'
        self.audio.write_bytes(b'synthetic audio fixture; no real listening performed')
        evidence = self.base / 'notes.txt'
        evidence.write_text('Synthetic record for schema validation only; not listening evidence.')
        self.plan = prepare('用 CSS 选择字段。', {'CSS': {'spoken': 'CSS'}})
        self.record = {
            'audio_sha256': digest(self.audio), 'spoken_sha256': self.plan['spoken_sha256'],
            'method': 'human_direct_playback', 'scope': 'full_final_track',
            'verdict': 'no_unresolved_pronunciation_issue', 'reviewer': 'synthetic fixture',
            'performed_at': 'synthetic fixture', 'reviewed_terms': ['CSS'],
            'checks': {'pronunciation': 'passed', 'term_fluency': 'passed', 'voice_consistency': 'passed'},
            'evidence': {'path': evidence.name, 'sha256': digest(evidence)}, 'unresolved_items': [],
        }

    def validate(self, record):
        return check_listening(self.plan, self.audio, record, self.base)

    def test_three_explicit_passed_checks_validate_only_the_record(self):
        result = self.validate(self.record)
        self.assertTrue(result['record_validated'])
        self.assertEqual(result['issues'], [])
        self.assertFalse(result['audio_quality_automatically_certified'])

    def test_missing_or_invalid_checks_object_is_rejected(self):
        for checks in (None, {}, 'passed', ['pronunciation', 'term_fluency', 'voice_consistency']):
            with self.subTest(checks=checks):
                record = deepcopy(self.record)
                if checks is None:
                    record.pop('checks')
                else:
                    record['checks'] = checks
                result = self.validate(record)
                self.assertFalse(result['record_validated'])
                self.assertTrue(any('term_fluency' in issue for issue in result['issues']))

    def test_each_check_must_be_present_and_exactly_passed(self):
        for name in ('pronunciation', 'term_fluency', 'voice_consistency'):
            for verdict in (None, 'failed', 'not_checked', True, 'PASS', ''):
                with self.subTest(name=name, verdict=verdict):
                    record = deepcopy(self.record)
                    if verdict is None:
                        record['checks'].pop(name)
                    else:
                        record['checks'][name] = verdict
                    result = self.validate(record)
                    self.assertFalse(result['record_validated'])
                    self.assertIn(f'Listening check {name} must be passed', result['issues'])


if __name__ == '__main__':
    unittest.main()
