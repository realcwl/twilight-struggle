import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CUES, SCORE, audioPreferences, DEFAULT_AUDIO } from './cues';
import { byteRange } from '../../worker/range';

test('music ranges support Safari probes, seeking, suffixes and unsatisfiable requests', () => {
  assert.deepEqual(byteRange('bytes=0-1',1000),{start:0,end:1});
  assert.deepEqual(byteRange('bytes=700-',1000),{start:700,end:999});
  assert.deepEqual(byteRange('bytes=-100',1000),{start:900,end:999});
  assert.deepEqual(byteRange('bytes=500-3000',1000),{start:500,end:999});
  assert.deepEqual(byteRange('bytes=-3000',1000),{start:0,end:999});
  for(const h of ['bytes=1000-','bytes=20-10','bytes=-0','bytes=-','bytes=0-1,4-6','bytes=9007199254740992-']) assert.equal(byteRange(h,1000),null);
});

test('audio preferences survive corrupt/old storage and preserve intentional silence', () => {
  for (const input of [null, false, 'invalid', 42]) assert.deepEqual(audioPreferences(input), DEFAULT_AUDIO);
  assert.deepEqual(audioPreferences({muted:true,music:0,effects:0}), {muted:true,music:0,effects:0});
  assert.deepEqual(audioPreferences({muted:'false',music:Infinity,effects:NaN}), DEFAULT_AUDIO);
  assert.deepEqual(audioPreferences({music:3,effects:-1}), {muted:false,music:1,effects:0});
});

test('every shipped cue decodes, has headroom and stays small enough for responsive playback', () => {
  const manifest = JSON.parse(readFileSync('public/audio/manifest.json','utf8'));
  const files = [...new Set(Object.values(CUES).flatMap(c => [...c.files]))];
  for (const file of files) {
    const path = `public/audio/sfx/${file}.mp3`;
    const pcm = execFileSync('ffmpeg',['-v','error','-i',path,'-ac','1','-ar','22050','-f','f32le','-']);
    const values = new Float32Array(pcm.buffer,pcm.byteOffset,pcm.length/4);
    let peak=0, energy=0;
    for (const value of values) { assert.ok(Number.isFinite(value)); peak=Math.max(peak,Math.abs(value)); energy+=value*value; }
    assert.ok(peak > .01 && peak < .95, `${file}: decoded headroom ${peak}`);
    assert.ok(energy > .01, `${file}: audible samples`);
    assert.ok(values.length / 22050 <= 6, `${file}: short cue`);
    assert.ok(statSync(path).size < 150_000);
    assert.ok(manifest.assets.some((a: {file:string}) => a.file === `audio/sfx/${file}.mp3`));
  }
  for (const track of SCORE) {
    const path=`public/audio/music/${track.file}`;
    const meta=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name','-of','json',path],{encoding:'utf8'}));
    assert.equal(meta.streams[0].codec_name,'aac');
    assert.ok(Number(meta.format.duration)>300);
    assert.ok(statSync(path).size < 25*1024*1024, 'Cloudflare individual asset limit');
  }
  const credits=readFileSync('public/audio/CREDITS.txt','utf8');
  for(const track of SCORE) assert.ok(credits.includes(track.title));
  assert.ok(credits.includes('Scott Buckley') && credits.includes('CC-BY 4.0'));
});
