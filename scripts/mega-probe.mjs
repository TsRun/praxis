import { File } from 'megajs';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const url = 'https://mega.nz/file/wspV3SAb#suZPW8PI-UiuBkXo3nqheOGSyz8SYR2MCaa3phnhYAU';

try {
  const f = File.fromURL(url);
  await f.loadAttributes();
  console.log('file:', f.name, f.size, 'bytes');
  const out = createWriteStream('/tmp/mega-test.7z');
  const stream = f.download({});
  let bytes = 0;
  stream.on('data', (c) => { bytes += c.length; });
  stream.on('error', (e) => console.log('stream err', e.message));
  await pipeline(stream, out);
  console.log('downloaded:', bytes, 'bytes ✓');
} catch (e) {
  console.log('ERR', e.code || '', e.message);
  if (e.cause) console.log('  cause:', e.cause?.code, e.cause?.message);
}
