/* Code Mobile — camada de compatibilidade para WebViews antigas.
 *
 * O WebView de fábrica do Android 9 é o Chrome 66. O app (React 18, Monaco,
 * runtimes em WebAssembly) usa APIs mais novas que existem só a partir do
 * Chrome 71+. Este arquivo é um script clássico carregado antes do bundle e
 * preenche apenas o que falta, sem sobrescrever nada nativo.
 *
 * Regra: cada polyfill é idempotente e no-op quando a engine já implementa.
 */
(function () {
  'use strict';

  var root = typeof self !== 'undefined' ? self : this;

  // --- globalThis (Chrome 71) ---------------------------------------------
  if (typeof root.globalThis === 'undefined') {
    try {
      root.globalThis = root;
    } catch (error) {
      /* ignore */
    }
  }

  // --- navigator.language em worker (Chrome 72) ---------------------------
  // WorkerNavigator.language não existe no Chrome 66. O Monaco lê
  // `navigator.language.toLowerCase()` no boot do worker; sem isso o worker
  // morre com "Cannot read property 'toLowerCase' of undefined".
  if (typeof navigator !== 'undefined' && !navigator.language) {
    try {
      Object.defineProperty(navigator, 'language', { value: 'pt-BR', configurable: true });
      Object.defineProperty(navigator, 'languages', {
        value: ['pt-BR', 'en-US'],
        configurable: true,
      });
    } catch (error) {
      /* engine sem defineProperty em navigator: segue sem */
    }
  }

  // --- queueMicrotask (Chrome 71) -----------------------------------------
  if (typeof root.queueMicrotask !== 'function') {
    var resolved = root.Promise && root.Promise.resolve();
    root.queueMicrotask = function queueMicrotask(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('queueMicrotask requires a function');
      }
      resolved.then(callback).catch(function (error) {
        setTimeout(function () {
          throw error;
        }, 0);
      });
    };
  }

  // --- reportError (Chrome 95) --------------------------------------------
  if (typeof root.reportError !== 'function') {
    root.reportError = function reportError(error) {
      setTimeout(function () {
        throw error;
      }, 0);
    };
  }

  // --- Object.fromEntries / hasOwn ----------------------------------------
  if (typeof Object.fromEntries !== 'function') {
    Object.fromEntries = function fromEntries(entries) {
      var out = {};
      if (!entries || typeof entries[Symbol.iterator] !== 'function') {
        throw new TypeError('Object.fromEntries requires an iterable');
      }
      var iterator = entries[Symbol.iterator]();
      var step = iterator.next();
      while (!step.done) {
        var pair = step.value;
        out[pair[0]] = pair[1];
        step = iterator.next();
      }
      return out;
    };
  }

  if (typeof Object.hasOwn !== 'function') {
    Object.hasOwn = function hasOwn(target, key) {
      return Object.prototype.hasOwnProperty.call(target, key);
    };
  }

  // --- Array.prototype.flat / flatMap / at --------------------------------
  if (typeof Array.prototype.flat !== 'function') {
    Array.prototype.flat = function flat(depth) {
      var levels = typeof depth === 'number' ? depth : 1;
      var flatten = function (list, remaining) {
        var out = [];
        for (var i = 0; i < list.length; i += 1) {
          var value = list[i];
          if (Array.isArray(value) && remaining > 0) {
            out = out.concat(flatten(value, remaining - 1));
          } else if (value !== undefined && value !== null) {
            out.push(value);
          }
        }
        return out;
      };
      return flatten(this, levels);
    };
  }

  if (typeof Array.prototype.flatMap !== 'function') {
    Array.prototype.flatMap = function flatMap(callback, thisArg) {
      var mapped = [];
      for (var i = 0; i < this.length; i += 1) {
        mapped.push(callback.call(thisArg, this[i], i, this));
      }
      return mapped.flat(1);
    };
  }

  var relativeIndex = function (length, index) {
    var value = Math.trunc(index) || 0;
    return value < 0 ? length + value : value;
  };

  if (typeof Array.prototype.at !== 'function') {
    Array.prototype.at = function at(index) {
      var position = relativeIndex(this.length, index);
      return position < 0 || position >= this.length ? undefined : this[position];
    };
  }

  if (typeof Array.prototype.findLast !== 'function') {
    Array.prototype.findLast = function findLast(callback, thisArg) {
      for (var i = this.length - 1; i >= 0; i -= 1) {
        if (callback.call(thisArg, this[i], i, this)) return this[i];
      }
      return undefined;
    };
  }

  if (typeof Array.prototype.findLastIndex !== 'function') {
    Array.prototype.findLastIndex = function findLastIndex(callback, thisArg) {
      for (var i = this.length - 1; i >= 0; i -= 1) {
        if (callback.call(thisArg, this[i], i, this)) return i;
      }
      return -1;
    };
  }

  [
    ['toReversed', function () {
      return Array.prototype.slice.call(this).reverse();
    }],
    ['toSorted', function (compare) {
      return Array.prototype.slice.call(this).sort(compare);
    }],
    ['toSpliced', function () {
      var copy = Array.prototype.slice.call(this);
      copy.splice.apply(copy, arguments);
      return copy;
    }],
    ['with', function (index, value) {
      var copy = Array.prototype.slice.call(this);
      copy[index < 0 ? copy.length + index : index] = value;
      return copy;
    }],
  ].forEach(function (entry) {
    if (typeof Array.prototype[entry[0]] !== 'function') {
      Object.defineProperty(Array.prototype, entry[0], {
        value: entry[1],
        writable: true,
        configurable: true,
        enumerable: false,
      });
    }
  });

  if (typeof String.prototype.at !== 'function') {
    String.prototype.at = function at(index) {
      var position = relativeIndex(this.length, index);
      return position < 0 || position >= this.length ? undefined : this.charAt(position);
    };
  }

  // --- String.prototype.replaceAll / matchAll -----------------------------
  if (typeof String.prototype.replaceAll !== 'function') {
    String.prototype.replaceAll = function replaceAll(search, replacement) {
      if (search instanceof RegExp && search.global !== true) {
        throw new TypeError('replaceAll with a RegExp requires the global flag');
      }
      if (search instanceof RegExp) {
        return this.replace(search, replacement);
      }
      return this.split(String(search)).join(
        typeof replacement === 'function' ? replacement(String(search)) : String(replacement),
      );
    };
  }

  if (typeof String.prototype.matchAll !== 'function') {
    String.prototype.matchAll = function matchAll(pattern) {
      var source = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'g');
      if (!source.global) {
        throw new TypeError('matchAll requires a global RegExp');
      }
      var text = String(this);
      var matches = [];
      var match = source.exec(text);
      while (match !== null) {
        matches.push(match);
        if (match[0] === '') source.lastIndex += 1;
        match = source.exec(text);
      }
      return matches[Symbol.iterator]();
    };
  }

  // --- Promise.allSettled / any (Chrome 76 / 85) --------------------------
  if (typeof Promise.allSettled !== 'function') {
    Promise.allSettled = function allSettled(list) {
      return Promise.all(
        Array.from(list).map(function (item) {
          return Promise.resolve(item).then(
            function (value) {
              return { status: 'fulfilled', value: value };
            },
            function (reason) {
              return { status: 'rejected', reason: reason };
            },
          );
        }),
      );
    };
  }

  if (typeof Promise.any !== 'function') {
    Promise.any = function any(list) {
      return new Promise(function (resolve, reject) {
        var items = Array.from(list);
        var errors = [];
        var remaining = items.length;
        if (remaining === 0) {
          reject(new Error('All promises were rejected'));
          return;
        }
        items.forEach(function (item, index) {
          Promise.resolve(item).then(resolve, function (reason) {
            errors[index] = reason;
            remaining -= 1;
            if (remaining === 0) reject(new Error('All promises were rejected'));
          });
        });
      });
    };
  }

  if (typeof Promise.withResolvers !== 'function') {
    Promise.withResolvers = function withResolvers() {
      var resolve;
      var reject;
      var promise = new Promise(function (res, rej) {
        resolve = res;
        reject = rej;
      });
      return { promise: promise, resolve: resolve, reject: reject };
    };
  }

  // --- Intl.Segmenter (Chrome 87) ----------------------------------------
  // Só `supportedLocalesOf` importa para o Monaco: devolvendo [] ele usa a
  // segmentação por expressão regular que já traz de fábrica.
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter !== 'function') {
    var Segmenter = function Segmenter() {};
    Segmenter.supportedLocalesOf = function supportedLocalesOf() {
      return [];
    };
    Segmenter.prototype.segment = function segment(text) {
      var result = [];
      var input = String(text);
      var pattern = /[A-Za-z0-9_]+|\s+|[^A-Za-z0-9_\s]/g;
      var found = pattern.exec(input);
      while (found !== null) {
        result.push({
          segment: found[0],
          index: found.index,
          input: input,
          isWordLike: /[A-Za-z0-9_]/.test(found[0]),
        });
        found = pattern.exec(input);
      }
      return result;
    };
    Intl.Segmenter = Segmenter;
  }

  // --- structuredClone (Chrome 98) ----------------------------------------
  if (typeof root.structuredClone !== 'function') {
    var cloneValue = function (value, seen) {
      if (value === null || typeof value !== 'object') return value;
      if (seen.has(value)) return seen.get(value);

      if (value instanceof Date) return new Date(value.getTime());
      if (value instanceof RegExp) return new RegExp(value.source, value.flags);
      if (value instanceof ArrayBuffer) return value.slice(0);
      if (ArrayBuffer.isView(value)) {
        return new value.constructor(value.buffer.slice(0), value.byteOffset, value.length);
      }
      if (value instanceof Map) {
        var mapCopy = new Map();
        seen.set(value, mapCopy);
        value.forEach(function (entry, key) {
          mapCopy.set(cloneValue(key, seen), cloneValue(entry, seen));
        });
        return mapCopy;
      }
      if (value instanceof Set) {
        var setCopy = new Set();
        seen.set(value, setCopy);
        value.forEach(function (entry) {
          setCopy.add(cloneValue(entry, seen));
        });
        return setCopy;
      }

      var copy = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
      seen.set(value, copy);
      Object.keys(value).forEach(function (key) {
        copy[key] = cloneValue(value[key], seen);
      });
      return copy;
    };

    root.structuredClone = function structuredClone(value) {
      return cloneValue(value, new Map());
    };
  }

  // --- crypto.randomUUID (Chrome 92) -------------------------------------
  if (root.crypto && typeof root.crypto.randomUUID !== 'function') {
    root.crypto.randomUUID = function randomUUID() {
      var bytes = new Uint8Array(16);
      root.crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      var hex = Array.prototype.map
        .call(bytes, function (byte) {
          return byte.toString(16).padStart(2, '0');
        })
        .join('');
      return (
        hex.slice(0, 8) +
        '-' +
        hex.slice(8, 12) +
        '-' +
        hex.slice(12, 16) +
        '-' +
        hex.slice(16, 20) +
        '-' +
        hex.slice(20)
      );
    };
  }

  // --- WeakRef / FinalizationRegistry (Chrome 84) ------------------------
  // Stubs: só servem para limpeza oportunista de memória. Nunca são
  // chamados de forma que dependa de coleta real.
  if (typeof root.WeakRef !== 'function') {
    root.WeakRef = function WeakRef(target) {
      this.deref = function deref() {
        return target;
      };
    };
  }

  if (typeof root.FinalizationRegistry !== 'function') {
    root.FinalizationRegistry = function FinalizationRegistry() {
      this.register = function register() {};
      this.unregister = function unregister() {};
    };
  }

  // --- ResizeObserver / IntersectionObserver -----------------------------
  if (typeof root.ResizeObserver !== 'function') {
    root.ResizeObserver = function ResizeObserver(callback) {
      this.observe = function observe(target) {
        if (typeof callback === 'function' && target) {
          callback([{ target: target, contentRect: target.getBoundingClientRect() }], this);
        }
      };
      this.unobserve = function unobserve() {};
      this.disconnect = function disconnect() {};
    };
  }

  if (typeof root.IntersectionObserver !== 'function') {
    root.IntersectionObserver = function IntersectionObserver() {
      this.observe = function observe() {};
      this.unobserve = function unobserve() {};
      this.disconnect = function disconnect() {};
      this.takeRecords = function takeRecords() {
        return [];
      };
    };
  }

  if (typeof document === 'undefined') return;

  // --- flag de CSS legado ------------------------------------------------
  // `gap` em flex só existe no Chrome 84+. O CSS gerado traz margens
  // alternativas escopadas em `html.legacy-gap` (scripts/css-compat.mjs);
  // aqui só se decide se essa classe entra. Medição real, porque
  // CSS.supports('gap') responde true para grid também no Chrome 66.
  var detectFlexGap = function () {
    try {
      var box = document.createElement('div');
      box.style.cssText = 'display:flex;gap:4px;position:absolute;top:-100px;left:-100px;visibility:hidden';
      var first = document.createElement('div');
      var second = document.createElement('div');
      first.style.width = '10px';
      second.style.width = '10px';
      box.appendChild(first);
      box.appendChild(second);
      document.body.appendChild(box);
      var distance = second.getBoundingClientRect().left - first.getBoundingClientRect().left;
      document.body.removeChild(box);
      return distance >= 14;
    } catch (error) {
      return true;
    }
  };

  var applyFlags = function () {
    if (detectFlexGap()) return;
    document.documentElement.className += ' legacy-gap';
  };

  if (document.body) applyFlags();
  else document.addEventListener('DOMContentLoaded', applyFlags);

  // --- Element.replaceChildren (Chrome 86) -------------------------------
  if (typeof Element !== 'undefined' && typeof Element.prototype.replaceChildren !== 'function') {
    Element.prototype.replaceChildren = function replaceChildren() {
      while (this.firstChild) this.removeChild(this.firstChild);
      for (var i = 0; i < arguments.length; i += 1) {
        this.appendChild(arguments[i]);
      }
    };
  }
})();
