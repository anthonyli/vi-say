import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const text = value => typeof value === 'string' && value.trim().length > 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function localPath(base, value) {
  if (!text(value) || path.isAbsolute(value) || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) {
    throw new Error('Review artifacts must use local relative paths');
  }
  return path.resolve(base, value);
}

// Silent visual studies cannot exempt an audible WAV merely by setting a flag.
function silentPcm16(bytes) {
  if (bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') return false;
  let pcm16 = false;
  let data = false;
  for (let at = 12; at + 8 <= bytes.length;) {
    const name = bytes.toString('ascii', at, at + 4);
    const length = bytes.readUInt32LE(at + 4);
    const start = at + 8, end = start + length;
    if (end > bytes.length) return false;
    if (name === 'fmt ') pcm16 = length >= 16 && bytes.readUInt16LE(start) === 1 && bytes.readUInt16LE(start + 14) === 16;
    if (name === 'data') {
      if (length === 0 || length % 2) return false;
      data = true;
      for (let i = start; i < end; i++) if (bytes[i] !== 0) return false;
    }
    at = end + length % 2;
  }
  return pcm16 && data;
}

/** Validate a recorded human/direct-audio conclusion, never acoustic quality. */
export async function inspectAudioReview(doc, {timelinePath}) {
  const result = {required: Array.isArray(doc.cartoonScenes), recordValidated: false,
    audioQualityAutomaticallyCertified: false, status: 'not_applicable', issues: []};
  if (!result.required) return result;
  const base = path.dirname(path.resolve(timelinePath));
  let audio;
  try {
    audio = await fs.readFile(localPath(base, doc.audio));
    result.audioSha256 = hash(audio);
  } catch (error) {
    result.status = 'needs_listening';
    result.issues.push(`Final audio unavailable: ${error.message}`);
    return result;
  }
  if (doc.visualPreview === true) {
    result.invalidSilentPreview = !silentPcm16(audio);
    if (!result.invalidSilentPreview) {
      result.required = false;
      result.status = 'silent_visual_preview';
    } else {
      result.status = 'needs_listening';
      result.issues.push('visualPreview requires a genuinely silent PCM16 WAV; use a marked audio candidate for audible narration');
    }
    return result;
  }
  result.status = 'needs_listening';
  try {
    if (!object(doc.audioReview)) throw new Error('audioReview with pronunciation and listening paths is required');
    const planPath = localPath(base, doc.audioReview.pronunciation);
    const reviewPath = localPath(base, doc.audioReview.listening);
    const plan = JSON.parse(await fs.readFile(planPath, 'utf8'));
    const record = JSON.parse(await fs.readFile(reviewPath, 'utf8'));
    if (!object(plan) || !object(record)) throw new Error('Pronunciation plan and listening record must be JSON objects');
    if (plan.ready_for_synthesis !== true || !Array.isArray(plan.unresolved_terms) || plan.unresolved_terms.length) result.issues.push('Unresolved pronunciation terms');
    if (!text(plan.spoken_text) || !sha(plan.spoken_sha256) || hash(plan.spoken_text) !== plan.spoken_sha256) result.issues.push('Pronunciation plan spoken text/hash mismatch');
    if (record.audio_sha256 !== result.audioSha256) result.issues.push('Listening record is not bound to this exact final audio');
    if (!sha(record.spoken_sha256) || record.spoken_sha256 !== plan.spoken_sha256) result.issues.push('Narration changed after listening');
    if (!['human_direct_playback', 'direct_audio_inspection_interface'].includes(record.method) ||
        record.scope !== 'full_final_track' || record.verdict !== 'no_unresolved_pronunciation_issue') result.issues.push('Full-track direct listening with a resolved pronunciation verdict required');
    if (!text(record.reviewer) || !text(record.performed_at)) result.issues.push('Listening reviewer/time missing');
    for (const check of ['pronunciation', 'term_fluency', 'voice_consistency']) {
      if (!object(record.checks) || record.checks[check] !== 'passed') result.issues.push(`Direct listening check must pass: ${check}`);
    }
    const terms = Array.isArray(plan.terms) && plan.terms.every(row => object(row) && text(row.term)) ? new Set(plan.terms.map(row => row.term)) : null;
    const reviewed = Array.isArray(record.reviewed_terms) && record.reviewed_terms.every(text) ? new Set(record.reviewed_terms) : null;
    if (!terms || !reviewed || terms.size !== reviewed.size || [...terms].some(term => !reviewed.has(term))) result.issues.push('Review every pronunciation term');
    if (!Array.isArray(record.unresolved_items) || record.unresolved_items.length) result.issues.push('Unresolved listening issues remain');
    if (!object(record.evidence) || !sha(record.evidence.sha256)) {
      result.issues.push('Listening evidence absent or stale');
    } else {
      try {
        const evidence = await fs.readFile(localPath(path.dirname(reviewPath), record.evidence.path));
        if (!evidence.length || hash(evidence) !== record.evidence.sha256) result.issues.push('Listening evidence absent or stale');
      } catch {
        result.issues.push('Listening evidence absent or stale');
      }
    }
  } catch (error) {
    result.issues.push(error.message);
  }
  result.recordValidated = result.issues.length === 0;
  if (result.recordValidated) result.status = 'listening_record_validated';
  return result;
}

export function audioRenderDecision(gate, {unreviewedAudio = false, output}) {
  if (gate.invalidSilentPreview) throw new Error(gate.issues.join('; '));
  if (unreviewedAudio) {
    if (!gate.required) throw new Error('--unreviewed-audio is only for audible cartoon candidates');
    if (!/(?:预览|候选|preview|candidate)/iu.test(path.basename(output, '.mp4'))) throw new Error('Unreviewed audio output filename must contain 预览, 候选, preview or candidate');
    return {mode: 'unreviewed_audio_candidate', listeningRecordValidated: false,
      listening: 'not_checked', audioQualityAutomaticallyCertified: false};
  }
  if (gate.required && !gate.recordValidated) throw new Error(`Final cartoon render requires a valid full-track listening record: ${gate.issues.join('; ')}. Use --unreviewed-audio with an explicitly named candidate only.`);
  return {mode: gate.status, listeningRecordValidated: gate.recordValidated,
    audioQualityAutomaticallyCertified: false};
}
