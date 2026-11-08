/* Parser tests: run with `node test/voice-parser.test.js`.
 * Exercises the word -> key conversion against every example the user gave,
 * plus edge cases (lakh/crore, decimals, digit-by-digit, tens+ones, fillers).
 */
'use strict';
var assert = require('assert');
var { parse } = require('../voice.js');

var cases = [
  // [transcript, expected key sequence]
  ['350 times 250',                     '350*250'],
  ['150 plus 167 plus 17802',           '150+167+17802'],
  ['three fifty times two fifty',       '350*250'],
  ['one fifty',                         '150'],
  ['one hundred fifty',                 '150'],
  ['one sixty seven',                   '167'],
  ['seventeen thousand eight hundred two', '17802'],
  ['seventeen eight zero two',          '17802'],
  ['two fifty',                         '250'],
  ['three five zero',                   '350'],
  ['twenty two',                        '22'],
  ['one hundred and fifty',             '150'],
  ['two lakh fifty thousand',           '250000'],
  ['three point five',                  '3.5'],
  ['clear',                             'C'],
  ['delete',                            'DEL'],
  ['one plus two equals',               '1+2='],
  ['divided by',                        '/'],
  ['one hundred two',                   '102'],
  ['one thousand two hundred fifty',    '1250'],
  ['fifty seven plus three',            '57+3'],
  ['two into two',                      '2*2'],
  ['3.5 plus 0.5',                      '3.5+0.5'],
  ['one million two hundred thousand',  '1200000'],
  ['one crore',                         '10000000'],
  ['multiplied by',                     '*'],
  ['take away',                         '-'],
  ['equals to',                         '='],
  ['um three fifty',                    '350'],
  ['one oh two',                        '102'],
  ['ten thousand five hundred',         '10500'],
  ['zero point zero five',              '0.05'],
  // glued-token cases the recognizer actually produces on mobile
  ['350x250',                           '350*250'],
  ['350×250',                           '350*250'],
  ['350times250',                       '350*250'],
  ['350-250',                           '350-250'],
  ['3.5plus2',                          '3.5+2'],
  ['150plus167plus17802',               '150+167+17802'],
  ['350 x 250',                         '350*250']
];

var fails = 0;
cases.forEach(function (c) {
  var got = parse(c[0]).join('');
  var ok = got === c[1];
  if (!ok) fails++;
  console.log((ok ? 'PASS' : 'FAIL') + '  "' + c[0] + '"  ->  ' + got + (ok ? '' : '  (expected ' + c[1] + ')'));
});

console.log('\n' + (cases.length - fails) + '/' + cases.length + ' passed');
process.exit(fails ? 1 : 0);
