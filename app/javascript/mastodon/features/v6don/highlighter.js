import Trie from 'substring-trie';
import { autoPlayGif } from '../../initial_state';

// ↓の配列に絵文字置換対象の文字列を受け取って置換を施した文字列を返すという
// 関数を追加していく
const trlist = { pre: [], rec:[], post: [] };

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

const apply_without_tag = f => (str, rec) => {
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
    rtn += tagbegin ? depth ? pretag : f(pretag, rec) : '';
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

const split_each_emoji = (str, rec) => {
  const list = [];
  str = rec ? rec(str) : str;
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

const replace_by_re = (re, fmt) => (str, rec) => {
  if (re.global) return str.replace(re, typeof(fmt) === 'string' ? fmt : function() {
    return fmt(...Array.from(arguments).slice(0, -2).concat(rec));
  });

  let rr;
  let rtn = '';
  while (str && (rr = re.exec(str))) {
    let replacement = fmt(...rr.concat(rec));
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

// 置換をString.replace()に投げるやつ
const byre = [];

byre.push(...[
  {
    // ✨IPv6✨
    order: 'pre',
    re: /(((?:✨[\ufe0e\ufe0f]?)+)( ?IPv6[^✨]*))((?:✨[\ufe0e\ufe0f]?)+)/u,
    fmt: (all, skip, kira1, ipv6, kira2, rec) => {
      const list = split_each_emoji(ipv6, rec);
      if (list.length > 11) {
        return null;
      }
      let delay = 0;
      let rtn = '';
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
      return kira1 + rtn + kira2;
    },
  },
  {
    // ††
    order: 'pre',
    re: /((‡+|†+)([^†‡]{1,30}?))(‡+|†+)/,
    fmt: (m, skip, d1, txt, d2) => {
      if (d1[0] !== d2[0]) return null;
      return `<span class="v6don-tyu2"><span class="v6don-dagger">${d1}</span>${txt}<span class="v6don-dagger">${d2}</span></span>`;
    },
  },
  {
    // ₍₍🥫⁾⁾
    order: 'pre',
    re: /(₍₍|⁽⁽)(\s*)([^₍₎⁽⁾]+?)(\s*)(₎₎|⁾⁾)/g,
    fmt: (all, left, lsp, biti, rsp, right, rec) => {
      const l = left === '⁽⁽' ? 1 : 0;
      const r = right === '⁾⁾' ? 1 : 0;
      if (l ^ r === 0) return all;
      const list = split_each_emoji(biti, rec);
      if (list.length > 5) return all;
      return `${left}${lsp}<span class="v6don-bitibiti">${biti}</span>${rsp}${right}`;
    },
  },
  {
    order: 'pre',
    re: /([|｜])([^《]{1,20})《([^》]{1,30})》/g,
    fmt: (all, begin, base, ruby) => {
      if (/^\s+$/.test(base)) return all;
      return `<span class="invisible">${begin}</span>`
        + `<ruby>${base}<span class="invisible">《${ruby}》</span>`
        + `<rt><span class="v6don-ruby-rt" data-ruby="${hesc(ruby)}"></span></rt></ruby>`;
    },
  },
  {
    order: 'pre',
    re: /([A-Za-z_.\-\u00a0À-ÖØ-öø-ʯ\u0300-\u036f‐'’々\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{2ebef}]+)《([^》]{1,30})》/ug,
    fmt: (all, base, ruby) => `<ruby>${base}<span class="invisible">《${ruby}》</span><rt><span class="v6don-ruby-rt" data-ruby="${hesc(ruby)}"></span></rt></ruby>`,
  },
  {
    tag: true,
    order: 'pre',
    re: /(<a\s[^>]*>)(.*?<\/a>)/mg,
    fmt: (all, tag, text) => tag + text.replace(/:/g, '&#58;'),
  },
  {
    order: 'post',
    tag: true,
    re: /(<(?:p|br\s?\/?)>)((\(?)※.*?(\)?))<\/p>/mg,
    fmt: (all, br, text, po, pc) =>
      /<br\s?\/?>/.test(text) || (po && !pc || !po && pc) ? all : `${/br/.test(br) ? br : ''}<span class="v6don-kozinkanso">${text}</span></p>`,
  },
  {
    order: 'post',
    re: /([えエ][らラ]いっ+|erait+)[!！]*/ig,
    fmt: erai => {
      let delay = 0;
      return erai.split('').map(c => {
        c = `<span class="v6don-wave" style="animation-delay: ${delay}ms">${c}</span>`;
        delay += 100;
        return c;
      }).join('');
    },
  },
  {
    order: 'post',
    tag: true,
    re: /説(。*\s*(?:<\/p>|<br\s*\/?>))/igm,
    fmt: '<span class="v6don-setu">説</span>$1',
  },
  {
    order: 'post',
    tag: true,
    re: /<img v6don-emoji:([^:]+):([^>]+)>/g,
    fmt: (all, name, char) => `<span class="v6don-emoji" data-gryph="${char}" title="&#58;${name}&#58;"></span><span class="invisible">&#58;${name}&#58;</span>`,
  },
]);

byre.forEach(e => {
  trlist[e.order || 'rec'].push(e.tag ? replace_by_re(e.re, e.fmt) : apply_without_tag(replace_by_re(e.re, e.fmt)));
});

// trie
const bytrie = { pre: {}, rec: {}, post: {} };

bytrie.rec['熱盛'] = '<img class="emojione" alt="熱盛" src="/emoji/proprietary/atumori.svg" style="width: 3.06em; height: 2em;"/>';
[
  { ptn: '5000兆円', img: require('../../../images/v6don/5000tyoen.svg'), h: 1.8 },
  { ptn: '5000兆', img: require('../../../images/v6don/5000tyo.svg'), h: 1.8 },
].forEach(e => {
  bytrie.rec[e.ptn] = `<img alt="${hesc(e.ptn)}" src="${e.img}" style="height: ${e.h}em;"/>`;
});
[
  { ptn: '✨', fmt: '<span class="v6don-kira">✨</span>' },
  { ptn: '🤮', fmt: '<img class="emojione" alt="🤮" title=":puke:" src="/emoji/proprietary/puke.png"/>' },
  { ptn: 'これすき', fmt: '<span class="v6don-koresuki">これすき</span>' },
  { ptn: '死にたい', fmt: '<span class="v6don-sinitai"><span class="v6don-sinitai-si">死</span><span class="v6don-sinitai-ni">に</span><span class="v6don-sinitai-ta">た</span><span class="v6don-sinitai-i">い</span></span>' },
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
  { name: 'hohoemi', char: '\ue000' },
  { name: 'jis2004', char: '\ue001' },
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

// まとめ

const highlight = (text, ce = {}) => {
  const reclist = [].concat(trlist.rec);
  if (Object.keys(ce).length) {
    reclist.push(apply_without_tag(cur => {
      let prev = '';
      for (;;) {
        let tagbegin = cur.indexOf(':');
        if (tagbegin === -1) break;
        let tagend = cur.indexOf(':', tagbegin + 1);
        if (tagend === -1) break;
        let tag = cur.slice(tagbegin, tagend + 1);
        if (tag in ce) {
          prev += cur.slice(0, tagbegin);
          const filename = autoPlayGif ? ce[tag].url : ce[tag].static_url;
          const replacement = `<img draggable="false" class="emojione" alt="${tag}" title="${tag}" src="${filename}" />`;
          prev += replacement;
          cur = cur.slice(tagend + 1);
        } else {
          prev += cur.slice(0, tagend);
          cur = cur.slice(tagend);
        }
      }
      return prev + cur;
    }));
  }
  const rec = text => reclist.reduce((t, f) => f(t), text);
  return trlist.post.reduce((t, f) => f(t), rec(trlist.pre.reduce((t, f) => f(t, rec), text)));
}
export default highlight;
