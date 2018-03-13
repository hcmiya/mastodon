// @preval
// http://www.unicode.org/Public/emoji/5.0/emoji-test.txt
// This file contains the compressed version of the emoji data from
// both emoji_map.json and from emoji-mart's emojiIndex and data objects.
// It's designed to be emitted in an array format to take up less space
// over the wire.

const { unicodeToFilename } = require('./unicode_to_filename');
const { unicodeToUnifiedName } = require('./unicode_to_unified_name');
const emojiMap         = require('./emoji_map.json');
const { emojiIndex } = require('emoji-mart');
const { default: emojiMartData } = require('emoji-mart/dist/data');

const excluded       = ['®', '©', '™'];
const skins          = ['🏻', '🏼', '🏽', '🏾', '🏿'];
const shortcodeMap   = {};

const shortCodesToEmojiData = {};
const emojisWithoutShortCodes = [];

Object.keys(emojiIndex.emojis).forEach(key => {
  shortcodeMap[emojiIndex.emojis[key].native] = emojiIndex.emojis[key].id;
});

const stripModifiers = unicode => {
  skins.forEach(tone => {
    unicode = unicode.replace(tone, '');
  });

  return unicode;
};

Object.keys(emojiMap).forEach(key => {
  if (excluded.includes(key)) {
    delete emojiMap[key];
    return;
  }

  const normalizedKey = stripModifiers(key);
  let shortcode       = shortcodeMap[normalizedKey];

  if (!shortcode) {
    shortcode = shortcodeMap[normalizedKey + '\uFE0F'];
  }

  const filename = emojiMap[key];

  const filenameData = [key];

  if (unicodeToFilename(key) !== filename) {
    // filename can't be derived using unicodeToFilename
    filenameData.push(filename);
  }

  if (typeof shortcode === 'undefined') {
    emojisWithoutShortCodes.push(filenameData);
  } else {
    if (!Array.isArray(shortCodesToEmojiData[shortcode])) {
      shortCodesToEmojiData[shortcode] = [[]];
    }
    shortCodesToEmojiData[shortcode][0].push(filenameData);
  }
});

Object.keys(emojiIndex.emojis).forEach(key => {
  const { native } = emojiIndex.emojis[key];
  let { short_names, search, unified } = emojiMartData.emojis[key];
  if (short_names[0] !== key) {
    throw new Error('The compresser expects the first short_code to be the ' +
      'key. It may need to be rewritten if the emoji change such that this ' +
      'is no longer the case.');
  }

  short_names = short_names.slice(1); // first short name can be inferred from the key

  const searchData = [native, short_names, search];
  if (unicodeToUnifiedName(native) !== unified) {
    // unified name can't be derived from unicodeToUnifiedName
    searchData.push(unified);
  }

  shortCodesToEmojiData[key].push(searchData);
});

// JSON.parse/stringify is to emulate what @preval is doing and avoid any
// inconsistent behavior in dev mode
const rawjson = JSON.stringify([
  shortCodesToEmojiData,
  emojiMartData.skins,
  emojiMartData.categories,
  emojiMartData.short_names,
  emojisWithoutShortCodes,
]);

let compjson = '';
const tokens = [];
const tokenscjk = [];
// 3400 - 4dbf, 4e00 - 9fff, ac00 - d7ff, e000 - faff
const cjkjmp = { 0x4dc0: 0x4e00, 0xa000: 0xac00, 0xd800: 0xe000 };

for (let idx = 0, cjk = 0x3400;;) {
  // fetch string
  const open = rawjson.indexOf('"', idx) + 1;
  if (!open) {
    compjson += rawjson.slice(idx);
    break;
  }
  compjson += rawjson.slice(idx, open);
  let close = open;
  for (;;) {
    close = rawjson.indexOf('"', close);
    if (rawjson[close - 1] !== '\\' || rawjson[close - 2] !== '\\') {
      break;
    }
    close++;
  }
  idx = close + 1;
  const str = JSON.parse(rawjson.slice(open - 1, idx));
  let replacement = rawjson.slice(open, close);
  const cjkfy = str => str.split(',').reduce((rtn, tok) => {
    // encode each CSV value to single CJK char
    let cjkidx;
    if ((cjkidx = tokens.indexOf(tok)) === -1) {
      tokens.push(tok);
      tokenscjk.push(String.fromCharCode(cjk++));
      if (cjk in cjkjmp) cjk = cjkjmp[cjk];
      cjkidx = tokens.length - 1;
    }
    return rtn + tokenscjk[cjkidx];
  }, '');
  if (/^[\dA-Fa-f-]{4,}$/.test(str)) {
    // long filename to unicode
    try {
      if (str.indexOf('-') === -1) {
        throw null;
      }
      // 1: upper+nopadding
      // 2: upper+padding
      // 3: lower+nopadding
      // 4: lower+padding
      let lower, padding = null;
      if (/^[\dA-F-]*$/.test(str)) {
        lower = false;
      } else if (/^[\da-f-]*$/.test(str)) {
        lower = true;
      } else {
        throw null;
      }
      const uni = str.split('-').reduce((rtn, hex) => {
        if (!hex.length) throw null;
        if (hex.length === 4) {
          if (hex[0] === '0') {
            if (padding === false) throw null;
            padding = true;
          }
        } else {
          if (hex[0] === '0') throw null;
        }
        if (hex.length < 4) {
          if (padding) throw null;
          padding = false;
        }
        return rtn + String.fromCodePoint(parseInt(hex, 16));
      }, '');
      const prefix = (padding ? 1 : 0) + (lower ? 2 : 0);
      replacement = String.fromCodePoint(prefix + 1) + uni;
    } catch (e) {
      if (str.length >= 6) replacement = cjkfy(str);
    }
  } else if (/^[\x20-\xff]+$/.test(str) && str === str.toLowerCase()) {
    replacement = cjkfy(str);
  }
  compjson += replacement + '"';
}

const comptoken = tokens.reduce((comp, tok) => {
  if (tok === '') return comp + ',';
  const c = tok[0];
  const u = c.toUpperCase();
  return comp + (c === u ? ',' + tok : u + tok.slice(1));
});

// escape SMP char: \u1Fxxx (4bytes) -> \u0xxx (2-3bytes)
module.exports = [
  compjson.replace(/[\u{1f100}-\u{1ffff}]/ug, c => String.fromCharCode(c.codePointAt(0) - 0x1f000))
    .replace(/\u200d/g, '\x05')
    .replace(/"([\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7ff\ue000-\ufaff]+)"/g, (all, cjk) => cjk)
    .replace(/:\[\[\["|,\[\],|"\],\["|"\]\],\["|\]\],/g, m => String.fromCharCode([':[[["', ',[],', '"],["', '"]],["', ']],'].indexOf(m) + 0xe)),
  comptoken,
];
