/* FanumTaxxed — live voice input for the FANUM-991ES PLUS calculator.
 * Speak -> browser SpeechRecognition -> word/number parser -> feeds keys straight
 * into window.FanumCalc.key(), the exact same path as pressing a button.
 * Additive only: it never touches the calculator's own logic.
 */
(function (root) {
  'use strict';

  var SR = (typeof window !== 'undefined')
    ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
    : null;

  // ---------- word maps ----------
  var WORD_NUM = {
    zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
    fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
    eighty: 80, ninety: 90
  };
  var SCALE = {
    hundred: 100, thousand: 1000, million: 1000000, billion: 1000000000,
    lakh: 100000, lac: 100000, crore: 10000000
  };
  var OP = {
    plus: '+', add: '+', sum: '+',
    minus: '-', subtract: '-', negative: '-',
    times: '*', multiply: '*', multiplied: '*', x: '*', eks: '*', star: '*', into: '*',
    divide: '/', divided: '/', over: '/', by: '/',
    equals: '=', equal: '='
  };
  var CMD = {
    clear: 'C', reset: 'C',
    delete: 'DEL', backspace: 'DEL', remove: 'DEL', del: 'DEL'
  };
  var SYM = { '+': '+', '-': '-', '*': '*', '/': '/', '×': '*', '÷': '/', '=': '=' };
  var FILLER = { um: 1, uh: 1, er: 1, hmm: 1, please: 1, the: 1, and: 1, no: 1, nope: 1, a: 1 };

  var NUM_LIT = /^[0-9][0-9,]*(?:\.[0-9]+)?$/;

  // ---------- normalise + phrase fixes ----------
  function normalize(text) {
    var s = String(text).toLowerCase();
    s = s.replace(/([a-z])[-–—]([a-z])/g, '$1 $2');   // fifty-two -> fifty two (word-word only)
    s = s.replace(/[?!;:"'’‘]/g, ' ');
    s = s.replace(/([×÷*+\-=()])/g, ' $1 ');          // split glued operator symbols: 350x250 -> 350 x 250
    s = s.replace(/([0-9])([a-z])/g, '$1 $2');        // 350times -> 350 times
    s = s.replace(/([a-z])([0-9])/g, '$1 $2');        // times250 -> times 250
    s = s.replace(/\b(divided by|divided into)\b/g, ' divide ');
    s = s.replace(/\b(multiplied by|multiply by)\b/g, ' multiply ');
    s = s.replace(/\binto\b/g, ' times ');            // Indian English: 2 into 2 = 2 x 2
    s = s.replace(/\btake away\b/g, ' minus ');
    s = s.replace(/\b(equals to|equal to)\b/g, ' equals ');
    s = s.replace(/\ball clear\b/g, ' clear ');
    s = s.replace(/\b(open bracket|left bracket|open parentheses)\b/g, ' ( ');
    s = s.replace(/\b(close bracket|right bracket|close parentheses)\b/g, ' ) ');
    return s;
  }

  // ---------- number parsing ----------
  // Standard grammar (used when a scale word like hundred/thousand/lakh is present).
  function parseStandard(words) {
    var result = 0, group = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w === 'hundred') group = (group || 1) * 100;
      else if (SCALE[w]) { result += (group || 1) * SCALE[w]; group = 0; }
      else if (WORD_NUM[w] != null) group += WORD_NUM[w];
    }
    return result + group;
  }

  // Group reading (no scale word): "three fifty" -> 350, "one sixty seven" -> 167,
  // "seventeen eight zero two" -> 17802, "twenty two" -> 22 (tens+ones combine).
  function concatDigits(words) {
    var out = [];
    for (var i = 0; i < words.length; i++) {
      var v = WORD_NUM[words[i]];
      if (v == null) continue;
      var nv = WORD_NUM[words[i + 1]];
      if (v >= 20 && v <= 90 && v % 10 === 0 && nv != null && nv >= 0 && nv <= 9) {
        out.push(String(v + nv));
        i++;
      } else {
        out.push(String(v));
      }
    }
    return out.join('');
  }

  function runToKeys(words) {
    var hasScale = false;
    for (var i = 0; i < words.length; i++) if (SCALE[words[i]]) { hasScale = true; break; }
    var digits = hasScale ? String(parseStandard(words)) : concatDigits(words);
    return digits.split('');
  }

  // Transcript text -> calculator key sequence.
  function parseToKeys(text) {
    var keys = [];
    var run = [];
    function flush() {
      if (run.length) { keys.push.apply(keys, runToKeys(run)); run = []; }
    }
    var toks = normalize(text).split(/\s+/);
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (!t) continue;
      if (FILLER[t]) continue;                       // filler: skip, never breaks a number run
      if (WORD_NUM[t] != null || SCALE[t]) { run.push(t); continue; }
      if (NUM_LIT.test(t)) {                         // recognizer gave digits: "350", "17,802", "3.5"
        flush();
        for (var j = 0; j < t.length; j++) { var ch = t[j]; if (ch !== ',') keys.push(ch); }
        continue;
      }
      if (t === 'point' || t === 'dot' || t === 'decimal') { flush(); keys.push('.'); continue; }
      if (SYM[t]) { flush(); keys.push(SYM[t]); continue; }
      if (t === '(' || t === ')') { flush(); keys.push(t); continue; }
      if (OP[t]) { flush(); keys.push(OP[t]); continue; }
      if (CMD[t]) { flush(); keys.push(CMD[t]); continue; }
      flush();                                       // unknown word ends any number run
    }
    flush();
    return keys;
  }

  // ---------- DOM / recognition (browser only) ----------
  var rec = null, listening = false, lastKeys = [];
  var micBtn = null, statusEl = null;

  function $(id) { return document.getElementById(id); }

  function toast(msg) {
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function setStatus(text, live) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle('live', !!live);
  }

  // Type the transcript's keys progressively: append the new tail, or clear+replay
  // if the recognizer revised earlier words mid-utterance.
  function applyTranscript(text) {
    var keys = parseToKeys(text);
    if (!keys.length) return;
    var C = root.FanumCalc;
    if (!C) return;
    C.open();
    var prefix = lastKeys.length <= keys.length;
    if (prefix) {
      for (var i = 0; i < lastKeys.length; i++) if (lastKeys[i] !== keys[i]) { prefix = false; break; }
    }
    if (prefix) {
      for (var j = lastKeys.length; j < keys.length; j++) C.key(keys[j]);
    } else {
      C.key('C');
      for (var k = 0; k < keys.length; k++) C.key(keys[k]);
    }
    lastKeys = keys.slice();
  }

  function beginRec() {
    lastKeys = [];
    try { rec.start(); } catch (err) {}
  }

  function ensureRec() {
    if (rec || !SR) return rec;
    rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-IN';
    rec.onresult = function (e) {
      var parts = [];
      for (var i = 0; i < e.results.length; i++) {
        var alt = e.results[i][0];
        if (alt && alt.transcript) parts.push(alt.transcript);
      }
      var text = parts.join(' ');
      if (text) {
        applyTranscript(text);
        setStatus('Hearing: ' + text, true);
      } else {
        setStatus('Listening…', false);
      }
    };
    rec.onerror = function (e) {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stop();
        toast('Mic blocked. Allow the microphone for this site, then tap MIC again.');
      } else if (e.error === 'network' || e.error === 'audio-capture') {
        stop();
        toast('No microphone found or network error. Check your mic, then try again.');
      }
      // 'no-speech' and the rest: keep listening.
    };
    rec.onend = function () {
      if (listening) beginRec();
    };
    return rec;
  }

  function start() {
    if (!SR) {
      toast('Voice input needs Chrome, Edge or Safari. This browser has no microphone API.');
      return;
    }
    ensureRec();
    if (root.FanumCalc) root.FanumCalc.open();
    listening = true;
    if (micBtn) { micBtn.classList.add('on'); micBtn.setAttribute('aria-pressed', 'true'); }
    setStatus('Listening…', false);
    beginRec();
  }

  function stop() {
    listening = false;
    if (rec) { try { rec.stop(); } catch (err) {} }
    if (micBtn) { micBtn.classList.remove('on'); micBtn.setAttribute('aria-pressed', 'false'); }
    setStatus('', false);
  }

  function toggle() { if (listening) stop(); else start(); }

  function init() {
    micBtn = $('micBtn');
    statusEl = $('micStatus');
    if (micBtn) micBtn.addEventListener('click', toggle);
  }

  root.FanumVoiceParser = { parse: parseToKeys };

  if (typeof window !== 'undefined') {
    window.FanumVoice = { parse: parseToKeys, toggle: toggle, start: start, stop: stop, supported: !!SR };
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parse: parseToKeys };
  }
})(typeof window !== 'undefined' ? window : globalThis);
