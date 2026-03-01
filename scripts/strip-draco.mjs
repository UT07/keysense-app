/**
 * Strip Draco compression from GLB files while preserving all other data
 * (animations, skins, images, etc).
 *
 * Approach: Keep the original binary chunk intact, append decoded mesh data
 * at the end, and update only the mesh accessors/bufferViews to point there.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const draco3d = require('draco3d');

const MODELS_DIR = join(import.meta.dirname, '..', 'assets', 'models');
const FILES = ['salsa-cat.glb', 'slim-cat.glb', 'round-cat.glb', 'chonky-cat.glb'];

function parseGlb(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const magic = String.fromCharCode(...buffer.slice(0, 4));
  if (magic !== 'glTF') throw new Error('Not a GLB file');

  let offset = 12;
  let jsonChunk = null;
  let binChunk = null;

  while (offset < buffer.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkData = buffer.slice(offset + 8, offset + 8 + chunkLength);

    if (chunkType === 0x4E4F534A) jsonChunk = JSON.parse(new TextDecoder().decode(chunkData));
    else if (chunkType === 0x004E4942) binChunk = chunkData;

    offset += 8 + chunkLength;
  }

  return { json: jsonChunk, bin: binChunk };
}

function buildGlb(json, binData) {
  const jsonStr = JSON.stringify(json);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const jsonPaddedLen = Math.ceil(jsonBytes.byteLength / 4) * 4;
  const jsonPadded = new Uint8Array(jsonPaddedLen);
  jsonPadded.set(jsonBytes);
  for (let i = jsonBytes.byteLength; i < jsonPaddedLen; i++) jsonPadded[i] = 0x20;

  const binPaddedLen = Math.ceil(binData.byteLength / 4) * 4;
  const binPadded = new Uint8Array(binPaddedLen);
  binPadded.set(binData);

  const totalLen = 12 + 8 + jsonPaddedLen + 8 + binPaddedLen;
  const output = new Uint8Array(totalLen);
  const outView = new DataView(output.buffer);

  output.set(new TextEncoder().encode('glTF'), 0);
  outView.setUint32(4, 2, true);
  outView.setUint32(8, totalLen, true);

  let pos = 12;
  outView.setUint32(pos, jsonPaddedLen, true);
  outView.setUint32(pos + 4, 0x4E4F534A, true);
  output.set(jsonPadded, pos + 8);
  pos += 8 + jsonPaddedLen;

  outView.setUint32(pos, binPaddedLen, true);
  outView.setUint32(pos + 4, 0x004E4942, true);
  output.set(binPadded, pos + 8);

  return output;
}

async function processFile(filename) {
  console.log(`\nProcessing ${filename}...`);
  const filepath = join(MODELS_DIR, filename);
  const fileBuffer = readFileSync(filepath);
  const glb = parseGlb(fileBuffer);

  const extUsed = glb.json.extensionsUsed || [];
  if (!extUsed.includes('KHR_draco_mesh_compression')) {
    console.log(`  No Draco compression, skipping.`);
    return;
  }

  const decoderModule = await draco3d.createDecoderModule({});
  const decoder = new decoderModule.Decoder();

  // Start with ALL original binary data intact
  const originalBin = glb.bin;
  const appendedParts = [];
  let appendOffset = originalBin.byteLength;
  // Align to 4 bytes
  appendOffset = Math.ceil(appendOffset / 4) * 4;

  for (const mesh of (glb.json.meshes || [])) {
    for (const primitive of mesh.primitives) {
      const dracoExt = primitive.extensions?.KHR_draco_mesh_compression;
      if (!dracoExt) continue;

      const bv = glb.json.bufferViews[dracoExt.bufferView];
      const dracoData = originalBin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);

      // Decode Draco
      const dbuf = new decoderModule.DecoderBuffer();
      dbuf.Init(new Int8Array(dracoData), dracoData.byteLength);
      const geoType = decoder.GetEncodedGeometryType(dbuf);

      let geometry;
      if (geoType === decoderModule.TRIANGULAR_MESH) {
        geometry = new decoderModule.Mesh();
        decoder.DecodeBufferToMesh(dbuf, geometry);
      } else {
        geometry = new decoderModule.PointCloud();
        decoder.DecodeBufferToPointCloud(dbuf, geometry);
      }
      decoderModule.destroy(dbuf);

      const numPoints = geometry.num_points();
      console.log(`  Decoded primitive: ${numPoints} points`);

      // Decode indices
      if (geoType === decoderModule.TRIANGULAR_MESH) {
        const numFaces = geometry.num_faces();
        const faceArray = new decoderModule.DracoInt32Array();
        const maxIdx = numPoints - 1;
        const useShort = maxIdx <= 65535;
        const indices = useShort ? new Uint16Array(numFaces * 3) : new Uint32Array(numFaces * 3);

        for (let i = 0; i < numFaces; i++) {
          decoder.GetFaceFromMesh(geometry, i, faceArray);
          indices[i * 3] = faceArray.GetValue(0);
          indices[i * 3 + 1] = faceArray.GetValue(1);
          indices[i * 3 + 2] = faceArray.GetValue(2);
        }
        decoderModule.destroy(faceArray);

        const idxBytes = new Uint8Array(indices.buffer);
        const paddedLen = Math.ceil(idxBytes.byteLength / 4) * 4;
        const padded = new Uint8Array(paddedLen);
        padded.set(idxBytes);

        const bvIdx = glb.json.bufferViews.length;
        glb.json.bufferViews.push({ buffer: 0, byteOffset: appendOffset, byteLength: idxBytes.byteLength });
        appendedParts.push(padded);
        appendOffset += paddedLen;

        const accIdx = glb.json.accessors.length;
        glb.json.accessors.push({
          bufferView: bvIdx, byteOffset: 0,
          componentType: useShort ? 5123 : 5125,
          count: numFaces * 3, type: 'SCALAR',
          max: [maxIdx], min: [0],
        });
        primitive.indices = accIdx;
      }

      // Decode attributes
      const COMP_MAP = { 1: 'SCALAR', 2: 'VEC2', 3: 'VEC3', 4: 'VEC4' };

      if (dracoExt.attributes) {
        for (const [attrName, dracoAttrId] of Object.entries(dracoExt.attributes)) {
          const attr = decoder.GetAttributeByUniqueId(geometry, dracoAttrId);
          if (!attr) continue;

          const nc = attr.num_components();
          const total = numPoints * nc;
          const arr = new decoderModule.DracoFloat32Array();
          decoder.GetAttributeFloatForAllPoints(geometry, attr, arr);

          const values = new Float32Array(total);
          for (let i = 0; i < total; i++) values[i] = arr.GetValue(i);
          decoderModule.destroy(arr);

          const fBytes = new Uint8Array(values.buffer);
          const paddedLen = Math.ceil(fBytes.byteLength / 4) * 4;
          const padded = new Uint8Array(paddedLen);
          padded.set(fBytes);

          const min = Array.from({ length: nc }, () => Infinity);
          const max = Array.from({ length: nc }, () => -Infinity);
          for (let i = 0; i < numPoints; i++) {
            for (let c = 0; c < nc; c++) {
              const v = values[i * nc + c];
              if (v < min[c]) min[c] = v;
              if (v > max[c]) max[c] = v;
            }
          }

          const bvIdx = glb.json.bufferViews.length;
          glb.json.bufferViews.push({ buffer: 0, byteOffset: appendOffset, byteLength: fBytes.byteLength });
          appendedParts.push(padded);
          appendOffset += paddedLen;

          const accIdx = glb.json.accessors.length;
          glb.json.accessors.push({
            bufferView: bvIdx, byteOffset: 0,
            componentType: 5126, count: numPoints,
            type: COMP_MAP[nc] || 'SCALAR', min, max,
          });
          primitive.attributes[attrName] = accIdx;
        }
      }

      // Remove Draco extension from primitive
      delete primitive.extensions?.KHR_draco_mesh_compression;
      if (primitive.extensions && Object.keys(primitive.extensions).length === 0) {
        delete primitive.extensions;
      }

      decoderModule.destroy(geometry);
    }
  }

  decoderModule.destroy(decoder);

  // Remove Draco from global extensions
  glb.json.extensionsUsed = (glb.json.extensionsUsed || []).filter(e => e !== 'KHR_draco_mesh_compression');
  glb.json.extensionsRequired = (glb.json.extensionsRequired || []).filter(e => e !== 'KHR_draco_mesh_compression');
  if (glb.json.extensionsUsed.length === 0) delete glb.json.extensionsUsed;
  if (glb.json.extensionsRequired?.length === 0) delete glb.json.extensionsRequired;

  // Build new binary: original data + appended decoded data
  const origPadded = Math.ceil(originalBin.byteLength / 4) * 4;
  const totalBinLen = appendOffset;
  const newBin = new Uint8Array(totalBinLen);
  newBin.set(originalBin);
  // Zero-fill padding gap
  let writePos = origPadded;
  for (const part of appendedParts) {
    newBin.set(part, writePos);
    writePos += part.byteLength;
  }

  glb.json.buffers = [{ byteLength: totalBinLen }];

  const output = buildGlb(glb.json, newBin);
  writeFileSync(filepath, output);

  console.log(`  ${fileBuffer.byteLength} → ${output.byteLength} bytes (${(output.byteLength/1024).toFixed(0)}KB)`);
}

console.log('Stripping Draco compression (preserving animations)...');
for (const file of FILES) {
  await processFile(file);
}
console.log('\nDone! All GLBs are Draco-free with animations intact.');
