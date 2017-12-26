import Trie from 'substring-trie';
import { emojify_original as emojify } from '../emoji/emoji';

// ↓の配列に絵文字置換対象の文字列を受け取って置換を施した文字列を返すという
// 関数を追加していく
const trlist = { pre: [], rec:[], post: [] };
const tr = (text, order, ce) => trlist[order].reduce((t, f) => f(t, ce), text);
const highlight = (text, ce) => tr(text, 'rec', ce);
const highlight_root = (text, ce) => ['pre', 'rec', 'post'].reduce((t, o) => tr(t, o, ce), text);
export default highlight_root;

// ユーティリティ
const hesc = raw => {
  let ent = false;
  return raw.replace(/./ug, c => {
    if (ent) {
      if (c === ';') ent = false;
    } else if (c === '&') {
      ent = true;
    } else {
      c = `&#${c.codePointAt(0)};`;
    }
    return c;
  });
};

const unesc = str => {
  if (str.indexOf('<') !== -1 || str.indexOf('>') !== -1) {
    throw new Error('can\'t unescape string containing tags');
  }
  let elem = document.createElement('div');
  elem.innerHTML = str;
  return elem.textContent;
};

const ununesc = str => str.replace(/[&<>]/g, e => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[e]);

const apply_without_tag = f => (str, ce) => {
  let rtn = '';
  const origstr = str;
  let brokentag;
  let depth = 0;
  while (str) {
    let tagbegin = str.indexOf('<');
    const notag = tagbegin === -1;
    if (notag) {
      tagbegin = str.length;
    }
    // < か末尾に到達する前に > に遭遇する場合に備える
    for (let gt; (gt = str.indexOf('>')) !== -1 && gt < tagbegin; tagbegin -= gt + 1) {
      rtn += str.slice(0, gt) + '>';
      str = str.slice(gt + 1);
      brokentag = true;
    }
    const pretag = str.slice(0, tagbegin);
    rtn += tagbegin ? depth ? pretag : f(pretag, ce) : '';
    if (notag) break;

    let tagend = str.indexOf('>', tagbegin + 1) + 1;
    if (!tagend) {
      brokentag = true;
      rtn += str.slice(tagbegin);
      break;
    }
    const tag = str.slice(tagbegin, tagend);
    rtn += tag;
    str = str.slice(tagend);
    if (depth) {
      if (tag[1] === '/') { // closing tag
        depth--;
      } else if (tag[tag.length - 2] !== '/') { // opening tag
        depth++;
      }
    } else if (tag === '<span class="invisible">') {
      depth = 1;
    }
  }
  if (brokentag) console.warn('highlight()に渡された文字列のタグの対応がおかしい → ', origstr);
  return rtn;
};

const split_each_emoji = (str, ce) => {
  const list = [];
  str = emojify(highlight(str, ce), ce);
  while (str) {
    let ei, type;
    if (str[0] === '&') {
      type = 'char';
      ei = str.indexOf(';') + 1;
    } else if (str[0] === '<') {
      let rr;
      if (/^<img\s/.test(str)) {
        type = 'image';
        ei = str.indexOf('>') + 1;
      } else if ((rr = /^<(svg|object)[\s>]/.exec(str))) {
        type = 'image';
        const etag = `</${rr[1]}>`;
        ei = str.indexOf(etag) + etag.length;
      } else if (str.length > 1 && str[1] === '/') {
        type = str.length > 1 && str[1] === '/' ? 'tagclose' : 'tagopen';
        ei = str.indexOf('>') + 1;
      }
    } else {
      type = 'char';
      ei = str.codePointAt(0) >= 65536 ? 2 : 1;
    }
    list.push({ type: type, str: str.slice(0, ei) });
    str = str.slice(ei);
  }
  return list;
};

// ここから関数登録

// ^H^H
trlist.pre.push(apply_without_tag(s => {
  let rtn = '';
  s = unesc(s);
  while (s) {
    let rr = /(\^H)+/i.exec(s);
    if (!rr) break;
    let delend = rr.index;
    if (!delend || /\s/.test(s[delend - 1])) {
      rtn += s.slice(0, delend);
      rtn += rr[0];
      s = s.slice(delend + rr[0].length);
      continue;
    }
    let dellen = rr[0].length / 2;
    let delstart = delend;
    while (delstart > 0 && dellen--) {
      if (/[\udc00-\udfff]/.test(s[--delstart])) delstart--;
    }
    if (delstart < 0) delstart = 0;

    rtn += `${ununesc(s.slice(0, delstart))}<del>${hesc(ununesc(s.slice(delstart, delend)))}</del><span class="invisible">${rr[0]}</span>`;
    s = s.slice(delend + rr[0].length);
  }
  return rtn + ununesc(s);
}));

// ✨IPv6✨
trlist.pre.push(apply_without_tag((s, ce) => {
  let rtn = '';
  let rr;
  while ((rr = /((?:✨[\ufe0e\ufe0f]?)+)( ?IPv6[^✨]*)((?:✨[\ufe0e\ufe0f]?)+)/u.exec(s))) {
    rtn += s.slice(0, rr.index) + rr[1];
    s = s.slice(rr.index + rr[1].length);
    let list = split_each_emoji(rr[2], ce);
    if (list.length > 11) {
      rtn += rr[2];
      s = s.slice(rr[2].length);
      continue;
    }
    let delay = 0;
    list.forEach(e => {
      let c;
      if (/^\s/u.test(e.str)) {
        c = e.str;
      } else switch (e.type) {
      case 'char':
      case 'image':
        c = `<span class="v6don-wave" style="animation-delay: ${delay}ms">${e.str}</span>`;
        delay += 100;
        break;
      case 'tagclose':
      case 'tagopen':
        c = e.str;
        break;
      }
      rtn += c;
    });
    rtn += rr[3];
    s = s.slice(rr[2].length + rr[3].length);
  }
  return rtn + s;
}));

// ₍₍🥫⁾⁾
trlist.pre.push(apply_without_tag((s, ce) => s.replace(/(₍₍|⁽⁽)(\s*)([^₍₎⁽⁾]+?)(\s*)(₎₎|⁾⁾)/g, (all, left, lsp, biti, rsp, right) => {
  const l = left === '⁽⁽' ? 1 : 0;
  const r = right === '⁾⁾' ? 1 : 0;
  if (l ^ r === 0) return all;
  const list = split_each_emoji(biti, ce);
  if (list.length > 5) return all;
  return `${left}${lsp}<span class="v6don-bitibiti">${biti}</span>${rsp}${right}`;
})));

// 置換をString.replace()に投げるやつ
const byre = [];

byre.push({
  order: 'pre',
  re: /((‡+|†+)([^†‡]{1,30}?))(‡+|†+)/,
  fmt: (m, skip, d1, txt, d2) => {
    if (d1[0] !== d2[0]) return null;
    return `<span class="v6don-tyu2"><span class="v6don-dagger">${d1}</span>${txt}<span class="v6don-dagger">${d2}</span></span>`;
  },
});

byre.push(...[
  { re: /5,?000\s?兆円/g, img: require('../../../images/v6don/5000tyoen.svg'), h: 1.8 },
  { re: /5,?000兆/g, img: require('../../../images/v6don/5000tyo.svg'), h: 1.8 },
].map(e => {
  e.fmt = (m) => `<img alt="${hesc(m)}" src="${e.img}" style="height: ${e.h}em;"/>`;
  return e;
}));

byre.push(...[
  {
    order: 'pre', re: /([|｜])([^《]{1,20})《([^》]{1,30})》/g,
    fmt: (all, begin, base, ruby) => {
      if (/^\s+$/.test(base)) return all;
      return `<span class="invisible">${begin}</span>`
        + `<ruby>${base}<span class="invisible">《${ruby}》</span>`
        + `<rt><span class="v6don-ruby-rt" data-ruby="${hesc(ruby)}"></span></rt></ruby>`;
    },
  },
  {
    order: 'pre', re: /([A-Za-z_.\-\u00a0À-ÖØ-öø-ʯ\u0300-\u036f‐'’々\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{2ebef}]+)《([^》]{1,30})》/ug,
    fmt: (all, base, ruby) => `<ruby>${base}<span class="invisible">《${ruby}》</span><rt><span class="v6don-ruby-rt" data-ruby="${hesc(ruby)}"></span></rt></ruby>`,
  },
  { tag: true, re: /(<a\s[^>]*>)(.*?<\/a>)/mg, fmt: (all, tag, text) =>
    tag + text.replace(/:/g, '&#58;'),
  },
  { order: 'post', tag: true, re: /(<(?:p|br\s?\/?)>)((\(?)※.*?(\)?))<\/p>/mg, fmt: (all, br, text, po, pc) =>
    /<br\s?\/?>/.test(text) || (po && !pc || !po && pc) ? all : `${/br/.test(br) ? br : ''}<span class="v6don-kozinkanso">${text}</span></p>`,
  },
  { order: 'post', re: /([えエ][らラ]いっ|erait+)[!！]*/ig, fmt: erai => {
    let delay = 0;
    return erai.split('').map(c => {
      c = `<span class="v6don-wave" style="animation-delay: ${delay}ms">${c}</span>`;
      delay += 100;
      return c;
    }).join('');
  } },
  {
    order: 'post', tag: true, re: /<img v6don-emoji:([^:]+):([^>]+)>/g,
    fmt: (all, name, char) => `<span class="v6don-emoji" data-gryph="${char}" title="&#58;${name}&#58;"></span><span class="invisible">&#58;${name}&#58;</span>`,
  },
]);

const replace_by_re = (re, fmt) => str => {
  if (re.global) return str.replace(re, fmt);

  let rr;
  let rtn = '';
  while (str && (rr = re.exec(str))) {
    let replacement = fmt(...rr);
    if (replacement === null) {
      let idx = rr.index + rr[1].length;
      rtn += str.slice(0, idx);
      str = str.slice(idx);
    } else {
      rtn += str.slice(0, rr.index) + replacement;
      str = str.slice(rr.index + rr[0].length);
    }
  }
  return rtn + str;
};

byre.forEach(e => {
  trlist[e.order || 'rec'].push(e.tag ? replace_by_re(e.re, e.fmt) : apply_without_tag(replace_by_re(e.re, e.fmt)));
});

// trie
const bytrie = { pre: {}, rec: {}, post: {} };

bytrie.rec['熱盛'] = '<img class="emojione" alt="熱盛" src="/emoji/proprietary/atumori.svg" style="width: 3.06em; height: 2em;"/>';
[
  { ptn: '✨', fmt: '<span class="v6don-kira">✨</span>' },
  { ptn: '🤮', fmt: '<img class="emojione" alt="🤮" title=":puke:" src="/emoji/proprietary/puke.png"/>' },
  { ptn: 'これすき', fmt: '<span class="v6don-koresuki">これすき</span>' },
].forEach(e => {
  bytrie.post[e.ptn] = e.fmt;
});

Object.keys(bytrie).forEach(o => {
  const k = Object.keys(bytrie[o]);
  if (!k.length) return;
  const t = new Trie(k);
  trlist[o].push(apply_without_tag(str => {
    let rtn = '', match;
    while (str) {
      if ((match = t.search(str))) {
        rtn += typeof bytrie[o][match] === 'string' ? bytrie[o][match] : bytrie[o][match](match);
        str = str.slice(match.length);
      } else {
        const cl = str.codePointAt(0) < 65536 ? 1 : 2;
        rtn += str.slice(0, cl);
        str = str.slice(cl);
      }
    }
    return rtn;
  }));
});

// :tag:の置換
const shorttab = {};

// :tag: をフツーにimgで返すやつ
[].forEach(e => {
  shorttab[e.name] = {
    replacer: () => `<img class="emojione" alt=":${e.name}:" title=":${e.name}:" src="${require(`../../../images/v6don/${e.name}.${e.ext}`)}" />`,
  };
});

// 回転対応絵文字
[
  'nicoru',
].forEach(name => {
  shorttab[name] = {
    remtest: (rem) => /^-?\d+$/.test(rem),
    asset: require(`../../../images/v6don/${name}.svg`),
    replacer: (match, rem) => {
      const alt = match + (rem || '');
      const style = rem ? `style="transform: rotate(${rem}deg)"` : '';
      return `<img class="emojione" alt=":${alt}:" title=":${alt}:" src="${shorttab[match].asset}" ${style}/>`;
    },
  };
});

// 不自由なロゴ達
const proprietary_image = {
  realtek: { ratio: 4.92, ext: 'svg' },
  sega: { ratio: 3.29, ext: 'svg' },
  puke: { ext: 'png' },
};
for (name in proprietary_image) {
  shorttab[name] = {
    replacer: name => `<img class="emojione" alt=":${name}:" title=":${name}:" src="/emoji/proprietary/${name}.${proprietary_image[name].ext}" ${
      proprietary_image[name].ratio ? `style="width: ${proprietary_image[name].ratio}em;"` : ''
    }/>`,
  };
}

// リンク
shorttab.don = {
  replacer: () => `<a href="https://mstdn.maud.io/">${hesc(':don:')}</a>`,
};

// 単色絵文字
[
  { name: 'hohoemi', char: '\u{f0000}' },
  { name: 'jis2004', char: '\u{f0001}' },
].forEach(e => {
  shorttab[e.name] = {
    // 再帰処理内で1文字として扱わせるために一旦無効なimgに変換、再帰を抜けた後にテキスト化
    replacer: () => `<img v6don-emoji:${e.name}:${e.char}>`,
  };
});

// :tag:置換まとめ
const shorttab_trie = new Trie(Object.keys(shorttab));
trlist.rec.push(apply_without_tag(cur => {
  let prev = '';
  for (;;) {
    let tagbegin = cur.indexOf(':') + 1;
    if (!tagbegin) break;
    let tagend = cur.indexOf(':', tagbegin);
    if (tagend === -1) break;
    let tag = cur.slice(tagbegin, tagend);
    let match = shorttab_trie.search(tag);
    let replace = false, rem = null;
    if (match) {
      if (tag === match) {
        replace = true;
      } else {
        rem = tag.slice(match.length);
        replace = shorttab[match].remtest && shorttab[match].remtest(rem);
      }
    }
    if (replace) {
      prev += cur.slice(0, tagbegin - 1) + shorttab[match].replacer(match, rem);
      cur = cur.slice(tagend + 1);
    } else {
      prev += cur.slice(0, tagend);
      cur = cur.slice(tagend);
    }
  }
  return prev + cur;
}));
