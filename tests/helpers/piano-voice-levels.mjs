import assert from 'node:assert/strict';

// Consume actual rendered levels, never the synth's analytic headroom bound.
export function assertRenderedVoiceLevels(voices) {
  const classic = voices.find(voice => voice.preset === 'classic');
  assert.ok(classic?.outputPeak > 0 && classic.rms > 0, 'A non-silent classic reference is required');
  for (const preset of ['runaway', 'no-one-noticed']) {
    assert.ok(voices.some(voice => voice.preset === preset), `Missing rendered ${preset} reference`);
  }
  return voices.map(voice => {
    assert.ok(Number.isFinite(voice.outputPeak) && voice.outputPeak > 0 && voice.outputPeak < 1, `${voice.preset}: finite, unclipped rendered peak`);
    assert.ok(Number.isFinite(voice.rms) && voice.rms > 0, `${voice.preset}: non-silent rendered RMS`);
    const peakDbFromClassic = 20 * Math.log10(voice.outputPeak / classic.outputPeak);
    const rmsDbFromClassic = 20 * Math.log10(voice.rms / classic.rms);
    assert.ok(peakDbFromClassic >= -3,
      `${voice.preset}: rendered peak is ${peakDbFromClassic.toFixed(2)} dB relative to classic; must be at least -3 dB`);
    if (voice.preset === 'runaway') {
      assert.ok(Math.abs(peakDbFromClassic) <= 2, `Runaway peak must be within 2 dB of classic, got ${peakDbFromClassic.toFixed(2)} dB`);
      assert.ok(Math.abs(rmsDbFromClassic) <= 2, `Runaway RMS must be within 2 dB of classic, got ${rmsDbFromClassic.toFixed(2)} dB`);
    }
    return { preset: voice.preset, peakDbFromClassic, rmsDbFromClassic };
  });
}
