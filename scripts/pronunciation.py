#!/usr/bin/env python3
"""Prepare a pronunciation-aware TTS script; bind real listening to its final WAV."""
import argparse
import hashlib
import json
import re
from pathlib import Path


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def prepare(text, lexicon):
    if not isinstance(text, str) or not text.strip():
        raise ValueError('Narration must not be blank')
    if not isinstance(lexicon, dict):
        raise ValueError('Lexicon must map exact written terms to spoken/notes objects')
    for term, entry in lexicon.items():
        if not term or not isinstance(entry, dict) or not isinstance(entry.get('spoken'), str) or not entry['spoken'].strip():
            raise ValueError('Each term needs a nonempty spoken form; keep natural English words whole')
    # Longest phrase first prevents a short entry from stealing a brand name.
    terms = sorted(lexicon, key=len, reverse=True)
    def term_pattern(t):
        left = r'(?<![A-Za-z0-9])' if t[0].isascii() and t[0].isalnum() else ''
        right = r'(?![A-Za-z0-9])' if t[-1].isascii() and t[-1].isalnum() else ''
        return left+re.escape(t)+right
    pattern = re.compile('|'.join(term_pattern(t) for t in terms)) if terms else None
    used = []
    def replace(match):
        term = match.group()
        # Do not replace AI inside MAIL or a shorter brand inside another brand.
        a, b = match.span()
        if (term[0].isascii() and term[0].isalnum() and a and text[a-1].isascii() and text[a-1].isalnum()) or \
           (term[-1].isascii() and term[-1].isalnum() and b < len(text) and text[b].isascii() and text[b].isalnum()):
            return term
        used.append(term)
        return lexicon[term]['spoken']
    spoken = pattern.sub(replace, text) if pattern else text
    covered = pattern.sub(lambda m: ' ' * len(m.group()) if m.group() in used else m.group(), text) if pattern else text
    unknown = sorted(set(re.findall(r'[A-Za-z][A-Za-z0-9.+_-]*|\d+(?:[.,:/-]\d+)*(?:%|％|[万亿年月日元倍])?', covered)))
    suspicious = []
    if re.search(r'(?:[A-Za-z][，,、。\s]+){3,}[A-Za-z]', spoken):
        suspicious.append('Possible letter-by-letter pronunciation: review abbreviations; never split ordinary English brands into syllables')
    rows = [{'term': t, 'spoken': lexicon[t]['spoken'], 'notes': lexicon[t].get('notes', '')} for t in dict.fromkeys(used)]
    return {'spoken_text': spoken, 'terms': rows, 'unresolved_terms': unknown,
            'warnings': suspicious, 'ready_for_synthesis': not unknown,
            'script_sha256': hashlib.sha256(text.encode()).hexdigest(),
            'spoken_sha256': hashlib.sha256(spoken.encode()).hexdigest(),
            'listening_required': True, 'pronunciation_verified': False}


def check_listening(plan, audio, record, base):
    """A recorded listening conclusion, never automated acoustic proof."""
    errors = []
    if not plan.get('ready_for_synthesis'):
        errors.append('Unresolved pronunciation terms')
    if record.get('audio_sha256') != digest(audio):
        errors.append('Listening record is not bound to this exact final audio')
    if record.get('spoken_sha256') != plan.get('spoken_sha256'):
        errors.append('Narration changed after listening')
    if record.get('method') not in ['human_direct_playback', 'direct_audio_inspection_interface'] or \
       record.get('scope') != 'full_final_track' or record.get('verdict') != 'no_unresolved_pronunciation_issue':
        errors.append('Full-track direct listening with a resolved pronunciation verdict required')
    if not record.get('reviewer') or not record.get('performed_at'):
        errors.append('Listening reviewer/time missing')
    if set(record.get('reviewed_terms', [])) != {r['term'] for r in plan.get('terms', [])}:
        errors.append('Review every pronunciation term')
    ref = record.get('evidence', {})
    p = Path(base) / ref.get('path', '')
    if not p.is_file() or digest(p) != ref.get('sha256'):
        errors.append('Listening evidence absent or stale')
    if record.get('unresolved_items') != []:
        errors.append('Unresolved listening issues remain')
    return {'record_validated': not errors, 'issues': errors, 'audio_quality_automatically_certified': False}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--text', type=Path, required=True)
    ap.add_argument('--lexicon', type=Path, required=True)
    ap.add_argument('--output-dir', type=Path, required=True)
    args = ap.parse_args()
    plan = prepare(args.text.read_text(), json.loads(args.lexicon.read_text()))
    args.output_dir.mkdir(parents=True, exist_ok=False)
    (args.output_dir / 'spoken.txt').write_text(plan['spoken_text'])
    (args.output_dir / 'pronunciation.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2)+'\n')
    # A short test uses whole original sentences containing terms, not isolated phonemes.
    sentences = re.findall(r'[^。！？!?\n]+[。！？!?]?', plan['spoken_text'])
    sample = [s for s in sentences if any(row['spoken'] in s for row in plan['terms'])]
    (args.output_dir / 'sample.txt').write_text('\n'.join((sample or sentences[:2])[:5]))
    print(json.dumps({'ready_for_synthesis':plan['ready_for_synthesis'], 'unresolved_terms':plan['unresolved_terms'], 'warnings':plan['warnings']},ensure_ascii=False))
    return 0 if plan['ready_for_synthesis'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
