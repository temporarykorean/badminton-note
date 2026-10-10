import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const html=await readFile('dist/index.html','utf8');
const manifest=JSON.parse(await readFile('dist/manifest.webmanifest','utf8'));
const base=process.env.PAGES_EXPECTED_BASE||'/';
assert.equal(manifest.name,'콕리콜');assert.equal(manifest.short_name,'콕리콜');assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');
for(const link of ['manifest.webmanifest','icons/apple-touch-icon.png','icons/icon.svg'])assert.ok(html.includes(`href="${base}${link}"`),`Incorrect Pages path: ${link}`);
const assets=[...html.matchAll(/(?:src|href)="([^"]*assets\/[^"\s]+)"/g)].map(m=>m[1]);
assert.ok(assets.length>=2);for(const asset of assets){assert.ok(asset.startsWith(base));await access(`dist/${asset.slice(base.length)}`)}
for(const icon of manifest.icons){assert.ok(!icon.src.startsWith('/'));const bytes=await readFile(`dist/${icon.src}`);assert.equal(bytes.readUInt32BE(16),Number(icon.sizes.split('x')[0]));assert.equal(bytes.readUInt32BE(20),Number(icon.sizes.split('x')[1]));}
console.log(`Pages assets and standalone manifest verified for ${base}`);
